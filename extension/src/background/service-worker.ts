import { ApiClient } from "../network/api-client";
import { AgentLoop } from "../agent/agent-loop";
import { TaskManager } from "../agent/task-manager";
import { Action, SanitizedPageContext } from "../types";

const API_BASE = "http://localhost:8000";

/* ── Tab helpers ─────────────────────────────────────── */

async function activeTabId(): Promise<number> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const id = tabs[0]?.id;
  if (id === undefined) throw new Error("No active browser tab");
  return id;
}

async function observeTab(): Promise<SanitizedPageContext> {
  const tabId = await activeTabId();
  return chrome.tabs.sendMessage(tabId, { type: "context" }) as Promise<SanitizedPageContext>;
}

async function executeInTab(action: Action): Promise<void> {
  const tabId = await activeTabId();
  const result = await chrome.tabs.sendMessage(tabId, {
    type: "execute",
    action,
  }) as { ok?: boolean; error?: string };
  if (!result?.ok) throw new Error(result?.error || "Browser action failed");
}

/* ── Read saved configuration ─────────────────────────── */

async function getSavedConfig(): Promise<{ provider: string; model: string; apiKey?: string }> {
  const stored = await chrome.storage.local.get(["provider", "model", "apiKey"]);
  const provider =
    typeof stored.provider === "string" && stored.provider
      ? stored.provider
      : "openai";
  const model =
    typeof stored.model === "string" && stored.model
      ? stored.model
      : "gpt-4o-mini";
  const apiKey = typeof stored.apiKey === "string" ? stored.apiKey : undefined;
  return { provider, model, apiKey };
}

/* ── Build a fresh manager per task (picks up latest saved config) ── */

async function buildManager(): Promise<TaskManager> {
  const { provider, model, apiKey } = await getSavedConfig();
  const api = new ApiClient(API_BASE);
  const loop = new AgentLoop(api, provider, model, apiKey, observeTab, executeInTab);
  return new TaskManager(loop);
}

/* ── Message listener ─────────────────────────────────── */

let currentManager: TaskManager | null = null;

chrome.runtime.onMessage.addListener(
  (
    message: { type: string; task?: string },
    _sender,
    sendResponse,
  ) => {
    if (message.type === "run" && message.task) {
      buildManager()
        .then((manager) => {
          currentManager = manager;
          return manager.start(message.task!);
        })
        .then(() => sendResponse({ ok: true }))
        .catch((e) =>
          sendResponse({
            ok: false,
            error: e instanceof Error ? e.message : String(e),
          }),
        );
      return true; // keep channel open for async response
    }

    if (message.type === "status") {
      sendResponse({
        status: currentManager?.status ?? "idle",
        error: currentManager?.error,
        pendingAction: currentManager?.pendingAction,
      });
      return false;
    }

    if (message.type === "confirm") {
      if (currentManager) {
        currentManager.confirmAction();
      }
      sendResponse({ ok: true });
      return false;
    }

    return false;
  },
);
import { ApiClient } from "../network/api-client";
import { AgentLoop } from "../agent/agent-loop";
import { TaskManager } from "../agent/task-manager";
import { Action, SanitizedPageContext } from "../types";

const API_BASE = "http://localhost:8000";

/* ── Tab helpers ─────────────────────────────────────── */

async function activeTab(): Promise<chrome.tabs.Tab> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab?.id) throw new Error("No active browser tab");
  return tab;
}

async function activeTabId(): Promise<number> {
  return (await activeTab()).id!;
}

async function ensureContentScript(tabId: number): Promise<void> {
  try {
    await chrome.tabs.sendMessage(tabId, { type: "ping" });
    return;
  } catch {
    // Not injected yet — fall through and inject it.
  }

  const tab = await chrome.tabs.get(tabId);
  const url = tab.url || "";
  if (/^(chrome|chrome-extension|edge|about|devtools):/.test(url) || url === "") {
    throw new Error(
      "Cyclops can't run on this page (browser-internal or restricted page). Open a normal website and try again.",
    );
  }

  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
  } catch (e) {
    throw new Error(
      `Could not attach to this page (${e instanceof Error ? e.message : String(e)}). Try refreshing the tab.`,
    );
  }
}

async function sendToTab<T>(message: Record<string, unknown>): Promise<T> {
  const tabId = await activeTabId();
  await ensureContentScript(tabId);
  return chrome.tabs.sendMessage(tabId, message) as Promise<T>;
}

async function observeTab(): Promise<SanitizedPageContext> {
  return sendToTab<SanitizedPageContext>({ type: "context" });
}

function isSafeNavigation(url: string): string {
  const parsed = new URL(url);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Unsafe navigation URL");
  }
  return parsed.href;
}

async function navigateActiveTab(url: string): Promise<void> {
  const tab = await activeTab();
  const targetUrl = isSafeNavigation(url);
  const tabId = tab.id!;

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => finish(new Error("Navigation timed out")), 15000);

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      if (error) reject(error);
      else resolve();
    };

    const onUpdated = (updatedTabId: number, changeInfo: { status?: string }) => {
      if (updatedTabId === tabId && changeInfo.status === "complete") finish();
    };

    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs.update(tabId, { url: targetUrl }).catch((error) => {
      finish(error instanceof Error ? error : new Error(String(error)));
    });
  });

  await ensureContentScript(tabId);
}

async function executeInTab(action: Action): Promise<void> {
  if (action.action === "navigate") {
    await navigateActiveTab(action.url || "");
    return;
  }

  const result = await sendToTab<{ ok?: boolean; error?: string }>({
    type: "execute",
    action,
  });
  if (!result?.ok) throw new Error(result?.error || "Browser action failed");
}

/* ── Read saved configuration ─────────────────────────── */

async function getSavedConfig(): Promise<{ provider: string; model: string; apiKey?: string }> {
  const stored = await chrome.storage.local.get(["provider", "model", "apiKey"]);
  const provider =
    typeof stored.provider === "string" && stored.provider ? stored.provider : "openai";
  const model =
    typeof stored.model === "string" && stored.model ? stored.model : "gpt-4o-mini";
  const apiKey = typeof stored.apiKey === "string" ? stored.apiKey : undefined;
  return { provider, model, apiKey };
}

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
      if (currentManager?.status === "running" || currentManager?.status === "awaiting_confirmation") {
        sendResponse({ ok: false, error: "Task already running" });
        return false;
      }

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
      return true;
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
      currentManager?.confirmAction();
      sendResponse({ ok: true });
      return false;
    }

    if (message.type === "reject") {
      currentManager?.rejectAction();
      sendResponse({ ok: true });
      return false;
    }

    if (message.type === "stop" || message.type === "cancel") {
      currentManager?.stop();
      sendResponse({ ok: true });
      return false;
    }

    return false;
  },
);

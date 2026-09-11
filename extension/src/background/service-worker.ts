import { ApiClient } from "../network/api-client"; import { AgentLoop } from "../agent/agent-loop"; import { TaskManager } from "../agent/task-manager";
import { Action, SanitizedPageContext } from "../types";

async function activeTabId(): Promise<number> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const id = tabs[0]?.id;
  if (id === undefined) throw new Error("No active browser tab");
  return id;
}

async function observeTab(): Promise<SanitizedPageContext> {
  return chrome.tabs.sendMessage(await activeTabId(), { type: "context" }) as Promise<SanitizedPageContext>;
}

async function executeInTab(action: Action): Promise<void> {
  const result = await chrome.tabs.sendMessage(await activeTabId(), { type: "execute", action }) as { ok?: boolean; error?: string };
  if (!result?.ok) throw new Error(result?.error || "Browser action failed");
}

const manager=new TaskManager(new AgentLoop(new ApiClient("http://localhost:8000"), "openai", "gpt-4o-mini", observeTab, executeInTab));
chrome.runtime.onMessage.addListener((message:{type:string;task?:string},_sender,sendResponse)=>{if(message.type==="run"&&message.task){manager.start(message.task).then(()=>sendResponse({ok:true})).catch(e=>sendResponse({ok:false,error:e instanceof Error?e.message:String(e)}));return true;} if(message.type==="status")sendResponse({status:manager.status,error:manager.error});return false;});
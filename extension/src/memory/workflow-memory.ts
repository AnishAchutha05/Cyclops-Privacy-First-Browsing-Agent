const KEY="cyclops.workflow";
export async function readWorkflow<T=unknown>():Promise<T|undefined>{const r=await chrome.storage.local.get(KEY);return r[KEY] as T|undefined;}
export async function writeWorkflow<T>(value:T):Promise<void>{await chrome.storage.local.set({[KEY]:value});}
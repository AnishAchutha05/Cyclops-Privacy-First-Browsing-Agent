import { buildContext } from "./context/builder";
import { execute } from "./tools/tool-runtime"; import { Action } from "./types";
chrome.runtime.onMessage.addListener((message:{type:string;action?:Action},_sender,sendResponse)=>{if(message.type==="ping"){sendResponse({ok:true});return true;}if(message.type==="context"){sendResponse(buildContext());return true;}if(message.type==="execute"&&message.action){execute(message.action).then(()=>sendResponse({ok:true})).catch(e=>sendResponse({ok:false,error:String(e)}));return true;}return false;});

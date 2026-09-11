import { PlanRequest,PlanResponse } from "../types";
import { containsSensitive } from "../privacy/detector";
export class ApiClient { constructor(private readonly endpoint:string,private readonly fetcher:typeof fetch=fetch,private readonly timeoutMs=15000){} async plan(request:PlanRequest):Promise<PlanResponse>{if(!request.task.trim())throw new Error("Task is required");if(!request.sanitized_context.trim())throw new Error("Sanitized context is required");if(containsSensitive(request.sanitized_context))throw new Error("Raw sensitive data detected at network boundary");const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),this.timeoutMs);try{const r=await this.fetcher(`${this.endpoint.replace(/\/$/,"")}/agent/plan`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(request),signal:controller.signal}); if(!r.ok)throw new Error(`Planning failed (${r.status})`); const data:unknown=await r.json(); if(!isPlanResponse(data))throw new Error("Invalid plan response"); return data;}finally{clearTimeout(timer);}}
}
function isPlanResponse(value:unknown):value is PlanResponse {
  if(!value||typeof value!=="object"||!Array.isArray((value as PlanResponse).actions))return false;
  return (value as PlanResponse).actions.length>0&&(value as PlanResponse).actions.every(a=>{
    if(!a||typeof a!=="object"||typeof a.action!=="string")return false;
    return true;
  });
}
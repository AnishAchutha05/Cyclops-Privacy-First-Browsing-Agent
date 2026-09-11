import { ApiClient } from "../network/api-client"; import { serializeContext } from "../context/builder"; import { execute } from "../tools/tool-runtime"; import { Action,SanitizedPageContext,TOOL_NAMES } from "../types"; import { TaskMemoryStore } from "../memory/task-memory";
type Observe=()=>SanitizedPageContext|Promise<SanitizedPageContext>; type Execute=(action:Action)=>void|Promise<void>;
export class AgentLoop { 
  public onActionPlanned?: (action: Action) => Promise<boolean>;
  constructor(private api:ApiClient,private provider="openai",private model="gpt-4o-mini",private apiKey:string|undefined,private observe:Observe,private executeAction:Execute=execute,private readonly maxSteps=8){} 
  async run(task:string):Promise<void>{
    const memory=new TaskMemoryStore(task);
    let context = await this.observe();
    for(let step=0;step<this.maxSteps;step++){
      const plan=await this.api.plan({task,sanitized_context:serializeContext(context),available_tools:[...TOOL_NAMES],provider:this.provider,model:this.model,api_key:this.apiKey,metadata:{page_title:context.page_title}});
      const action=plan.actions[0];
      if(!action)throw new Error("Planner returned no action");
      
      if (this.onActionPlanned) {
        const approved = await this.onActionPlanned(action);
        if (!approved) throw new Error("Action cancelled by user");
      }
      
      await this.executeAction(action);
      memory.markComplete(step);
      
      if(plan.actions.length===1)return;
      context=await this.observe();
    }
    throw new Error(`Agent stopped after ${this.maxSteps} planning steps`);
  }
}
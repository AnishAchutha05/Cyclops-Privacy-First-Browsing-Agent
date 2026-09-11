import { AgentLoop } from "./agent-loop";
import { Action } from "../types";
export type TaskStatus="idle"|"running"|"awaiting_confirmation"|"completed"|"failed";
export class TaskManager { 
  status:TaskStatus="idle"; 
  error?:string; 
  pendingAction?:Action;
  private resolveConfirm?: (confirmed: boolean) => void;

  constructor(private loop:AgentLoop){
    this.loop.onActionPlanned = (action) => {
      this.pendingAction = action;
      this.status = "awaiting_confirmation";
      return new Promise((resolve) => {
        this.resolveConfirm = resolve;
      });
    };
  } 
  
  async start(task:string){
    if(this.status==="running" || this.status==="awaiting_confirmation") throw new Error("Task already running");
    this.status="running";
    this.error=undefined;
    try{
      await this.loop.run(task);
      this.status="completed";
    }catch(e){
      this.status="failed";
      this.error=e instanceof Error?e.message:String(e);
      throw e;
    }
  }

  confirmAction() {
    if (this.status === "awaiting_confirmation" && this.resolveConfirm) {
      this.status = "running";
      this.pendingAction = undefined;
      const resolve = this.resolveConfirm;
      this.resolveConfirm = undefined;
      resolve(true);
    }
  }
}
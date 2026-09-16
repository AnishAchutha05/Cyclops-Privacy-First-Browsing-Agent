import { AgentLoop } from "./agent-loop";
import { Action } from "../types";

export type TaskStatus = "idle" | "running" | "awaiting_confirmation" | "completed" | "failed";

function requiresConfirmation(action: Action): boolean {
  if (action.action !== "click" || !action.target) return false;
  return /submit|purchase|buy|pay|checkout|send|delete|remove|confirm/i.test(action.target);
}

export class TaskManager {
  status: TaskStatus = "idle";
  error?: string;
  pendingAction?: Action;
  private resolveConfirm?: (confirmed: boolean) => void;

  constructor(private loop: AgentLoop) {
    this.loop.onActionPlanned = (action) => {
      if (!requiresConfirmation(action)) return Promise.resolve(true);

      this.pendingAction = action;
      this.status = "awaiting_confirmation";
      return new Promise((resolve) => {
        this.resolveConfirm = resolve;
      });
    };
  }

  async start(task: string): Promise<void> {
    if (this.status === "running" || this.status === "awaiting_confirmation") {
      throw new Error("Task already running");
    }

    this.status = "running";
    this.error = undefined;
    this.pendingAction = undefined;

    try {
      await this.loop.run(task);
      this.status = "completed";
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message === "Task cancelled") {
        this.status = "idle";
        this.error = undefined;
        return;
      }

      this.status = "failed";
      this.error = message;
      throw error;
    }
  }

  confirmAction(): void {
    if (this.status === "awaiting_confirmation" && this.resolveConfirm) {
      this.status = "running";
      this.pendingAction = undefined;
      const resolve = this.resolveConfirm;
      this.resolveConfirm = undefined;
      resolve(true);
    }
  }

  rejectAction(): void {
    if (this.status === "awaiting_confirmation" && this.resolveConfirm) {
      this.pendingAction = undefined;
      const resolve = this.resolveConfirm;
      this.resolveConfirm = undefined;
      resolve(false);
    }
  }

  stop(): void {
    if (this.status === "awaiting_confirmation") {
      this.rejectAction();
    }
    this.loop.cancel();
    this.pendingAction = undefined;
    this.error = undefined;
    this.status = "idle";
  }
}

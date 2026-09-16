import { ApiClient } from "../network/api-client";
import { serializeContext } from "../context/builder";
import { execute } from "../tools/tool-runtime";
import {
  Action,
  SanitizedPageContext,
  TOOL_NAMES,
} from "../types";
import { TaskMemoryStore } from "../memory/task-memory";

type Observe = () =>
  | SanitizedPageContext
  | Promise<SanitizedPageContext>;

type Execute = (
  action: Action,
) => void | Promise<void>;

function actionSignature(action: Action): string {
  return JSON.stringify({
    action: action.action,
    target: action.target,
    value: action.value,
    value_source: action.value_source,
    direction: action.direction,
    amount: action.amount,
    url: action.url,
    key: action.key,
    duration_ms: action.duration_ms,
    selector: action.selector,
  });
}

export class AgentLoop {
  public onActionPlanned?: (
    action: Action,
  ) => Promise<boolean>;

  private controller: AbortController | null = null;

  constructor(
    private api: ApiClient,
    private provider = "openai",
    private model = "gpt-4o-mini",
    private apiKey: string | undefined,
    private observe: Observe,
    private executeAction: Execute = execute,
    private readonly maxSteps = 8,
  ) {}

  cancel(): void {
    this.controller?.abort();
  }

  private throwIfCancelled(): void {
    if (this.controller?.signal.aborted) {
      throw new Error("Task cancelled");
    }
  }

  async run(task: string): Promise<void> {
    this.controller?.abort();

    this.controller = new AbortController();

    const { signal } = this.controller;

    const memory = new TaskMemoryStore(task);

    let previousSignature = "";
    let repeatedCount = 0;

    try {
      let context = await this.observe();

      this.throwIfCancelled();

      for (
        let step = 0;
        step < this.maxSteps;
        step++
      ) {
        this.throwIfCancelled();

        const plan = await this.api.plan(
          {
            task,
            sanitized_context:
              serializeContext(context),
            available_tools: [
              ...TOOL_NAMES,
            ],
            provider: this.provider,
            model: this.model,
            api_key: this.apiKey,
            metadata: {
              page_title:
                context.page_title,
            },
          },
          signal,
        );

        this.throwIfCancelled();

        const action = plan.actions[0];

        if (!action) {
          throw new Error(
            "Planner returned no action",
          );
        }

        console.log(
          "Cyclops plan:",
          plan,
        );

        const signature =
          actionSignature(action);

        if (
          signature === previousSignature
        ) {
          repeatedCount += 1;
        } else {
          repeatedCount = 0;
          previousSignature =
            signature;
        }

        /*
         * Hard anti-loop guard.
         * Three identical consecutive actions
         * means the planner is stuck.
         */
        if (repeatedCount >= 2) {
          throw new Error(
            "Agent stopped because the same action was repeated.",
          );
        }

        if (this.onActionPlanned) {
          const approved =
            await this.onActionPlanned(
              action,
            );

          this.throwIfCancelled();

          if (!approved) {
            throw new Error(
              "Action cancelled by user",
            );
          }
        }

        await this.executeAction(action);

        this.throwIfCancelled();

        memory.markComplete(step);

        /*
         * Explicit model completion.
         */
        if (action.action === "done") {
          return;
        }

        /*
         * Gemini classified the task as a
         * single-step workflow.
         *
         * One successful action = complete.
         */
        if (plan.mode === "single_step") {
          return;
        }

        /*
         * Multi-step workflow:
         * execute → observe → plan again.
         */
        context = await this.observe();

        this.throwIfCancelled();
      }

      throw new Error(
        `Agent stopped after ${this.maxSteps} planning steps`,
      );

    } finally {

      if (
        this.controller?.signal === signal
      ) {
        this.controller = null;
      }
    }
  }
}
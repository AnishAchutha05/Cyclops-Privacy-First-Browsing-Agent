import { PlanRequest, PlanResponse } from "../types";
import { containsSensitive } from "../privacy/detector";

export class ApiClient {
  constructor(
    private readonly endpoint: string,
    private readonly fetcher: typeof fetch = (...args) =>
      globalThis.fetch(...args),
    private readonly timeoutMs = 15000,
  ) {}

  async plan(
    request: PlanRequest,
    externalSignal?: AbortSignal,
  ): Promise<PlanResponse> {
    if (!request.task.trim()) {
      throw new Error("Task is required");
    }

    if (!request.sanitized_context.trim()) {
      throw new Error("Sanitized context is required");
    }

    if (containsSensitive(request.sanitized_context)) {
      throw new Error(
        "Raw sensitive data detected at network boundary",
      );
    }

    const controller = new AbortController();

    const timer = setTimeout(
      () => controller.abort(),
      this.timeoutMs,
    );

    const onExternalAbort = () => controller.abort();

    if (externalSignal) {
      if (externalSignal.aborted) {
        controller.abort();
      }

      externalSignal.addEventListener(
        "abort",
        onExternalAbort,
        { once: true },
      );
    }

    try {
      const response = await this.fetcher(
        `${this.endpoint.replace(/\/$/, "")}/agent/plan`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify(request),
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        let detail = "";

        try {
          const errorBody = await response.json();

          if (
            errorBody &&
            typeof errorBody === "object" &&
            "detail" in errorBody
          ) {
            detail = `: ${String(errorBody.detail)}`;
          }
        } catch {
          // Ignore malformed error responses.
        }

        throw new Error(
          `Planning failed (${response.status})${detail}`,
        );
      }

      const data: unknown = await response.json();

      if (!isPlanResponse(data)) {
        throw new Error("Invalid plan response");
      }

      return data;

    } catch (error) {

      if (controller.signal.aborted) {
        if (externalSignal?.aborted) {
          throw new Error("Task cancelled");
        }

        throw new Error(
          "Planning request timed out",
        );
      }

      throw error;

    } finally {

      clearTimeout(timer);

      if (externalSignal) {
        externalSignal.removeEventListener(
          "abort",
          onExternalAbort,
        );
      }
    }
  }
}

function isPlanResponse(
  value: unknown,
): value is PlanResponse {

  if (
    !value ||
    typeof value !== "object"
  ) {
    return false;
  }

  const candidate =
    value as Partial<PlanResponse>;

  if (
    candidate.mode !== "single_step" &&
    candidate.mode !== "multi_step"
  ) {
    return false;
  }

  if (
    !Array.isArray(candidate.actions) ||
    candidate.actions.length !== 1
  ) {
    return false;
  }

  return candidate.actions.every(
    (action) =>
      !!action &&
      typeof action === "object" &&
      typeof action.action === "string",
  );
}
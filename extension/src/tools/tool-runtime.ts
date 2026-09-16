import { Action } from "../types";
import { click } from "./click";
import { fill } from "./fill";
import { select } from "./select";
import { scroll } from "./scroll";
import { pressKey } from "./keyboard";
import { navigate } from "./navigate";
import { wait } from "./wait";
import { resolveProfile, resolveProfileFile } from "../profile/profile";
import { screenshot } from "./screenshot";
import { upload } from "./upload";

export async function execute(action: Action): Promise<void> {
  switch (action.action) {
    case "click":
      return click(required(action.target));
    case "fill":
      return fill(
        required(action.target),
        action.value_source ? await resolveProfile(action.value_source) : required(action.value),
      );
    case "select":
      return select(required(action.target), required(action.value));
    case "scroll":
      return scroll(action.direction || "down", action.amount ?? 500);
    case "press_key":
      return pressKey(required(action.key), action.target);
    case "navigate":
      return navigate(required(action.url));
    case "wait":
      return wait(action.duration_ms || 0);
    case "screenshot":
      await screenshot();
      return;
    case "upload":
      return upload(required(action.target), await resolveProfileFile(required(action.value_source)));
    case "done":
      return;
    default:
      throw new Error(`Unsupported action: ${action.action}`);
  }
}

function required(value: string | undefined): string {
  if (!value) throw new Error("Action argument missing");
  return value;
}

import { Profile } from "../types";
import { loadProfile } from "./storage";

export async function resolveProfile(path: string, profile?: Profile): Promise<string> {
  if (!/^local_profile\..+/.test(path)) {
    throw new Error("Only local profile references are allowed");
  }

  const p = profile || await loadProfile();
  const value = p[path.slice("local_profile.".length)];
  if (!value || typeof value !== "string") {
    throw new Error(`Profile value unavailable: ${path}`);
  }
  return value;
}

export async function resolveProfileFile(path: string, profile?: Profile): Promise<File> {
  const value = await resolveProfile(path, profile);
  if (!value.startsWith("data:")) {
    throw new Error(
      `Local file '${path}' must be stored as a data URL in the local profile before it can be uploaded`,
    );
  }

  const match = value.match(/^data:([^;,]+)?(?:;base64)?,(.*)$/s);
  if (!match) throw new Error(`Invalid local file data for ${path}`);

  const mime = match[1] || "application/octet-stream";
  const body = match[2];
  const isBase64 = value.startsWith(`data:${mime};base64,`);

  let bytes: Uint8Array;
  if (isBase64) {
    const binary = atob(body);
    bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } else {
    bytes = new TextEncoder().encode(decodeURIComponent(body));
  }

  const filename = path.slice("local_profile.".length).split("/").pop() || "upload";
  return new File([bytes], filename, { type: mime });
}

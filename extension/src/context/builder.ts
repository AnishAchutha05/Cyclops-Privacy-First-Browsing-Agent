import {
  extractElements,
} from "../dom/extractor";
import {
  sanitizeText,
  sanitizeUrl,
} from "../privacy/sanitizer";
import { SanitizedPageContext } from "../types";

export function buildContext(
  doc: Document = document
): SanitizedPageContext {
  const scrollY = window.scrollY;
  const viewportHeight = window.innerHeight;
  const documentHeight = document.documentElement.scrollHeight;

  return {
    page_title: sanitizeText(doc.title),
    page_url_base: sanitizeUrl(location.href),
    elements: extractElements(doc),

    scroll_y: scrollY,
    viewport_height: viewportHeight,
    document_height: documentHeight,

    sanitization_note:
      "PII, file paths, query parameters, and fragments are removed locally.",
  };
}

export function serializeContext(
  context: SanitizedPageContext
): string {
  return JSON.stringify(context);
}
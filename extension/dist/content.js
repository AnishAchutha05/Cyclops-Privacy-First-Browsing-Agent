"use strict";
(() => {
  // src/privacy/detector.ts
  var patterns = [["email", /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i], ["phone", /\b(?:\+?\d[\d\s().-]{7,}\d)\b/], ["credit_card", /\b(?:\d[ -]*?){13,19}\b/], ["ssn", /\b\d{3}-\d{2}-\d{4}\b/], ["address", /\b\d{1,5}\s+\w+(?:\s+\w+){1,4}\s(?:street|st|road|rd|avenue|ave|lane|ln|drive|dr)\b/i], ["api_key", /\b(?:sk-[A-Za-z0-9]{20,}|AIza[A-Za-z0-9_-]{30,}|gh[pousr]_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{20,})\b/]];
  function detectSensitive(value) {
    return patterns.filter(([, r]) => r.test(value)).map(([k]) => k);
  }
  function detectSensitiveDom(element) {
    const signal = [element.getAttribute("autocomplete"), element.getAttribute("name"), element.getAttribute("id"), element.getAttribute("aria-label"), element.getAttribute("placeholder"), element.getAttribute("type")].filter(Boolean).join(" ").toLowerCase();
    const kinds = [];
    if (/(password|email|phone|tel|address|ssn|credit|card|token|secret|api.?key)/.test(signal)) {
      if (/password|secret|token|api.?key/.test(signal)) kinds.push("api_key");
      if (/email/.test(signal)) kinds.push("email");
      if (/phone|tel/.test(signal)) kinds.push("phone");
      if (/address/.test(signal)) kinds.push("address");
      if (/credit|card/.test(signal)) kinds.push("credit_card");
    }
    return [...new Set(kinds)];
  }

  // src/privacy/redactor.ts
  function redact(value) {
    let out = value;
    for (const kind of detectSensitive(value)) {
      const re = kind === "email" ? /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi : kind === "phone" ? /\b(?:\+?\d[\d\s().-]{7,}\d)\b/g : kind === "ssn" ? /\b\d{3}-\d{2}-\d{4}\b/g : kind === "credit_card" ? /\b(?:\d[ -]*?){13,19}\b/g : /\b\d{1,5}\s+\w+(?:\s+\w+){1,4}\s(?:street|st|road|rd|avenue|ave|lane|ln|drive|dr)\b/gi;
      out = out.replace(re, "[REDACTED]");
    }
    return out;
  }

  // src/privacy/sanitizer.ts
  function sanitizeText(value) {
    return redact(value).replace(/(?:file|blob):\/\/[^\s]+/gi, "[LOCAL_FILE]");
  }
  function sanitizeUrl(url) {
    try {
      const u = new URL(url);
      return `${u.origin}${u.pathname}`;
    } catch {
      return "";
    }
  }

  // src/dom/extractor.ts
  function extractElements(root = document) {
    const nodes = root.querySelectorAll("button,input,select,textarea,a,[role=button],[role=link],[role=textbox]");
    const used = /* @__PURE__ */ new Set();
    return Array.from(nodes).map((n, i) => {
      const e = n;
      const type = e.type === "checkbox" ? "checkbox" : e.type === "radio" ? "radio" : e.type === "file" ? "file" : n.tagName.toLowerCase() === "a" ? "link" : n.tagName.toLowerCase();
      const base = e.id || e.name || n.getAttribute("data-cyclops-id") || `element_${i}`;
      let id = base;
      let suffix = 1;
      while (used.has(id)) id = `${base}_${suffix++}`;
      used.add(id);
      n.setAttribute("data-cyclops-id", id);
      const sensitive = detectSensitiveDom(n).length > 0;
      return { id, type, label: sanitizeText(e.getAttribute("aria-label") || e.textContent?.trim() || ""), placeholder: sanitizeText(e.getAttribute("placeholder") || ""), value: type === "file" ? "[LOCAL_FILE]" : sensitive ? "[REDACTED]" : sanitizeText(e.value || ""), visible: !!n.offsetParent, enabled: !e.disabled };
    });
  }

  // src/context/builder.ts
  function buildContext(doc = document) {
    return { page_title: sanitizeText(doc.title), page_url_base: sanitizeUrl(location.href), elements: extractElements(doc), sanitization_note: "PII, file paths, query parameters, and fragments are removed locally." };
  }

  // src/dom/state.ts
  function findElement(id, root = document) {
    const escaped = CSS.escape(id);
    return root.querySelector(
      `[data-cyclops-id="${escaped}"],#${escaped},[name="${escaped}"]`
    ) || Array.from(root.querySelectorAll(
      "button,input,select,textarea,a,[role=button],[role=link],[role=textbox]"
    )).find((element, index) => `element_${index}` === id) || null;
  }

  // src/tools/click.ts
  function click(target) {
    const e = findElement(target);
    if (!e) throw new Error(`Element not found: ${target}`);
    if (e.disabled) throw new Error("Element disabled");
    e.click();
  }

  // src/tools/fill.ts
  function fill(target, value) {
    const e = findElement(target);
    if (!e) throw new Error(`Element not found: ${target}`);
    e.focus();
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (setter) setter.call(e, value);
    else e.value = value;
    e.dispatchEvent(new Event("input", { bubbles: true }));
    e.dispatchEvent(new Event("change", { bubbles: true }));
  }

  // src/tools/select.ts
  function select(target, value) {
    const e = findElement(target);
    if (!e || e.tagName !== "SELECT") throw new Error(`Select not found: ${target}`);
    const option = Array.from(e.options).find((o) => o.value === value || o.text === value);
    if (!option) throw new Error("Option unavailable");
    e.value = option.value;
    e.dispatchEvent(new Event("change", { bubbles: true }));
  }

  // src/tools/scroll.ts
  function scroll(direction) {
    const x = direction === "left" ? -400 : direction === "right" ? 400 : 0, y = direction === "up" ? -500 : direction === "down" ? 500 : 0;
    window.scrollBy({ left: x, top: y, behavior: "smooth" });
  }

  // src/tools/keyboard.ts
  function pressKey(key, target) {
    const e = (target ? document.getElementById(target) : document.activeElement) || document.body;
    e.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
    if (key === "Enter" && e instanceof HTMLElement) e.click();
  }

  // src/tools/navigate.ts
  function navigate(url) {
    const u = new URL(url);
    if (!["http:", "https:"].includes(u.protocol)) throw new Error("Unsafe navigation URL");
    location.assign(u.href);
  }

  // src/tools/wait.ts
  var wait = (ms) => new Promise((resolve) => setTimeout(resolve, Math.max(0, Math.min(ms, 3e4))));

  // src/profile/storage.ts
  var KEY = "cyclops.profile";
  async function loadProfile() {
    const r = await chrome.storage.local.get(KEY);
    return r[KEY] || {};
  }

  // src/profile/profile.ts
  async function resolveProfile(path, profile) {
    if (!/^local_profile\..+/.test(path)) throw new Error("Only local profile references are allowed");
    const p = profile || await loadProfile();
    const value = p[path.slice("local_profile.".length)];
    if (!value) throw new Error(`Profile value unavailable: ${path}`);
    return value;
  }

  // src/tools/screenshot.ts
  async function screenshot() {
    const canvas = document.createElement("canvas");
    const width = Math.min(1200, Math.max(320, document.documentElement.clientWidth));
    const height = Math.min(900, Math.max(200, document.documentElement.clientHeight));
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Screenshot unavailable");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#111";
    ctx.font = "14px sans-serif";
    const text = (document.body?.innerText || "").slice(0, 4e3);
    text.split(/\n+/).reduce((y, line) => {
      ctx.fillText(line.slice(0, 140), 8, y);
      return y + 18;
    }, 20);
    return canvas.toDataURL("image/png");
  }

  // src/tools/tool-runtime.ts
  async function execute(action) {
    switch (action.action) {
      case "click":
        return click(required(action.target));
      case "fill":
        return fill(required(action.target), action.value_source ? await resolveProfile(action.value_source) : required(action.value));
      case "select":
        return select(required(action.target), required(action.value));
      case "scroll":
        return scroll(action.direction || "down");
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
        await resolveProfile(required(action.value_source));
        throw new Error("Upload requires an explicit local file selection; no file contents are available to the agent runtime");
      default:
        throw new Error(`Unsupported action: ${action.action}`);
    }
  }
  function required(value) {
    if (!value) throw new Error("Action argument missing");
    return value;
  }

  // src/content.ts
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === "context") {
      sendResponse(buildContext());
      return true;
    }
    if (message.type === "execute" && message.action) {
      execute(message.action).then(() => sendResponse({ ok: true })).catch((e) => sendResponse({ ok: false, error: String(e) }));
      return true;
    }
    return false;
  });
})();

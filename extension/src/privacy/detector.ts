const patterns: Array<[string,RegExp]> = [["email",/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i],["phone",/\b(?:\+?\d[\d\s().-]{7,}\d)\b/],["credit_card",/\b(?:\d[ -]*?){13,19}\b/],["ssn",/\b\d{3}-\d{2}-\d{4}\b/],["address",/\b\d{1,5}\s+\w+(?:\s+\w+){1,4}\s(?:street|st|road|rd|avenue|ave|lane|ln|drive|dr)\b/i],["api_key",/\b(?:sk-[A-Za-z0-9]{20,}|AIza[A-Za-z0-9_-]{30,}|gh[pousr]_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{20,})\b/]];
export type SensitiveKind = "email"|"phone"|"credit_card"|"ssn"|"address"|"api_key";
export function detectSensitive(value:string): SensitiveKind[] { return patterns.filter(([,r])=>r.test(value)).map(([k])=>k as SensitiveKind); }
export function containsSensitive(value:string):boolean{return detectSensitive(value).length>0;}
export function detectSensitiveDom(element:Element): SensitiveKind[] {
  const signal = [element.getAttribute("autocomplete"), element.getAttribute("name"), element.getAttribute("id"), element.getAttribute("aria-label"), element.getAttribute("placeholder"), element.getAttribute("type")].filter(Boolean).join(" ").toLowerCase();
  const kinds:SensitiveKind[] = [];
  if (/(password|email|phone|tel|address|ssn|credit|card|token|secret|api.?key)/.test(signal)) {
    if (/password|secret|token|api.?key/.test(signal)) kinds.push("api_key");
    if (/email/.test(signal)) kinds.push("email");
    if (/phone|tel/.test(signal)) kinds.push("phone");
    if (/address/.test(signal)) kinds.push("address");
    if (/credit|card/.test(signal)) kinds.push("credit_card");
  }
  return [...new Set(kinds)];
}
import { redact } from "./redactor";
export function sanitizeText(value:string):string { return redact(value).replace(/(?:file|blob):\/\/[^\s]+/gi,"[LOCAL_FILE]"); }
export function sanitizeUrl(url:string):string { try { const u=new URL(url); return `${u.origin}${u.pathname}`; } catch { return ""; } }
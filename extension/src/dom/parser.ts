import { extractElements } from "./extractor";
export { extractElements };
export function visibleText(root:Document|Element=document):string{return Array.from(root.querySelectorAll("body,body *")).filter(e=>(e as HTMLElement).offsetParent).map(e=>e.textContent?.trim()).filter(Boolean).slice(0,100).join(" ");}
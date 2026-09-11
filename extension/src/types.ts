export type ElementType = "button"|"input"|"select"|"textarea"|"link"|"checkbox"|"radio"|"file"|"text";
export interface PageElement { id:string; type:ElementType; label?:string; placeholder?:string; value?:string; visible:boolean; enabled:boolean; }
export interface SanitizedPageContext { page_title:string; page_url_base:string; elements:PageElement[]; sanitization_note:string; }
export type ActionName = "click"|"fill"|"upload"|"scroll"|"navigate"|"screenshot"|"wait"|"press_key"|"select";
export interface Action { action:ActionName; target?:string; value?:string; value_source?:`local_profile.${string}`; direction?:"up"|"down"|"left"|"right"; url?:string; key?:string; duration_ms?:number; selector?:string; }
export interface PlanRequest { task:string; sanitized_context:string; available_tools:string[]; provider:string; model:string; metadata?:Record<string,string>; }
export interface PlanResponse { actions:Action[]; }
export interface Profile { full_name?:string; email?:string; phone?:string; address?:string; [key:string]:string|undefined; }
export const TOOL_NAMES: readonly ActionName[]=["click","fill","upload","scroll","navigate","screenshot","wait","press_key","select"];

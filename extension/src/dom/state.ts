export function findElement(id:string,root:Document|Element=document):HTMLElement|null{
  const escaped=CSS.escape(id);
  return root.querySelector<HTMLElement>(
    `[data-cyclops-id="${escaped}"],#${escaped},[name="${escaped}"]`,
  ) || Array.from(root.querySelectorAll<HTMLElement>(
    "button,input,select,textarea,a,[role=button],[role=link],[role=textbox]",
  )).find((element,index)=>`element_${index}`===id) || null;
}
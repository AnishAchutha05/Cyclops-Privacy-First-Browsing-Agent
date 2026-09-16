export type ScrollDirection = "up" | "down" | "left" | "right";

export function scroll(
  direction: ScrollDirection,
  amount = 500,
): Promise<void> {
  const distance = Math.max(0, amount);
  const x = direction === "left" ? -distance : direction === "right" ? distance : 0;
  const y = direction === "up" ? -distance : direction === "down" ? distance : 0;

  window.scrollBy({ left: x, top: y, behavior: "auto" });

  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

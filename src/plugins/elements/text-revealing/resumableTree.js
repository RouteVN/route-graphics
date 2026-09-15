import { canResumeTextReveal } from "./textRevealingRuntime.js";

// Follow authored component paths through the actual mounted content parents.
// A root render aborts old reveal timers even when a container is unchanged.
export const hasResumableTextRevealInTree = ({ parent, elements }) => {
  if (!parent || parent.destroyed) return false;
  for (const element of elements ?? []) {
    const display = parent.children.find((child) => child.label === element.id);
    if (!display || display.destroyed) continue;
    if (element.type === "text-revealing" && canResumeTextReveal(display)) {
      return true;
    }
    if (element.type === "container") {
      const content = display.children.find(
        (child) => child.label === `${element.id}-content`,
      );
      if (
        hasResumableTextRevealInTree({
          parent: content ?? display,
          elements: element.children,
        })
      )
        return true;
    }
  }
  return false;
};

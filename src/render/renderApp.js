import { renderRect } from "./renderRect.js";
import renderText from "./renderText.js";
import { renderSprite } from "./renderSprite.js";
import { renderContainer } from "./renderContainer.js";
import { diffElements } from "./common.js";
import { deleteRect } from "../delete/deleteRect.js";
import { deleteText } from "../delete/deleteText.js";
import { deleteContainer } from "../delete/deleteContainer.js";
import { deleteSprite } from "../delete/deleteSprite.js";
import { updateRect } from "../update/updateRect.js";
import { updateText } from "../update/updateText.js";
import { updateSprite } from "../update/updateSprite.js";
import { updateContainer } from "../update/updateContainer.js";
import { renderTextRevealing } from "./renderTextRevealing.js";
/**
 * @typedef {import('../types.js').Application} Application
 * @typedef {import('../types.js').ASTNode} ASTNode
 * @typedef {import('../types.js').Container} Container
 * @typedef {import('../types.js').RenderAppOptions} RenderAppOptions
 */

/**
 * @param {Object} renderOptions
 * @property {Application} renderOptions.app
 * @property {Container} renderOptions.parent
 * @property {ASTNode[]} renderOptions.prevASTTree
 * @property {ASTNode[]} renderOptions.nextASTTree
 * @property {Object[]} renderOptions.transitions
 * @property {Function} renderOptions.eventHandler
 * @property {Function} renderOptions.transitionElements
 * @property {AbortSignal[]} renderOptions.signal
 */
export async function renderApp({
  app,
  parent,
  prevASTTree,
  nextASTTree,
  transitions,
  eventHandler,
  transitionElements,
  signal,
}) {
  const { toAddElement, toDeleteElement, toUpdateElement } = diffElements(
    prevASTTree,
    nextASTTree,
    transitions,
  );
  const asyncActions = [];

  for (const element of toDeleteElement) {
    switch (element.type) {
      case "rect":
        asyncActions.push(
          deleteRect({
            app,
            parent,
            rectASTNode: element,
            transitions,
            transitionElements,
            signal,
          }),
        );
        break;
      case "text":
        asyncActions.push(
          deleteText({
            app,
            parent,
            textASTNode: element,
            transitions,
            transitionElements,
            signal,
          }),
        );
        break;
      case "container":
        asyncActions.push(
          deleteContainer({
            app,
            parent,
            containerASTNode: element,
            transitions,
            transitionElements,
            signal,
          }),
        );
        break;
      case "sprite":
        asyncActions.push(
          deleteSprite({
            app,
            parent,
            spriteASTNode: element,
            transitions,
            transitionElements,
            signal,
          }),
        );
        break;
      default:
    }
  }

  for (const element of toAddElement) {
    switch (element.type) {
      case "rect":
        asyncActions.push(
          renderRect({
            app,
            parent,
            rectASTNode: element,
            transitions,
            transitionElements,
            eventHandler,
            signal,
          }),
        );
        break;
      case "text":
        asyncActions.push(
          renderText({
            app,
            parent,
            textASTNode: element,
            transitions,
            transitionElements,
            eventHandler,
            signal,
          }),
        );
        break;
      case "container":
        asyncActions.push(
          renderContainer({
            app,
            parent,
            containerASTNode: element,
            transitions,
            transitionElements,
            eventHandler,
            signal,
          }),
        );
        break;
      case "sprite":
        asyncActions.push(
          renderSprite({
            app,
            parent,
            spriteASTNode: element,
            transitions,
            transitionElements,
            eventHandler,
            signal,
          }),
        );
        break;
      case "text-revealing":
        asyncActions.push(renderTextRevealing({
          app,
          parent,
          element,
          signal
        }))
      default:
    }
  }

  for (const { prev, next } of toUpdateElement) {
    switch (next.type) {
      case "rect":
        asyncActions.push(
          updateRect({
            app,
            parent,
            prevRectASTNode: prev,
            nextRectASTNode: next,
            transitions,
            transitionElements,
            eventHandler,
            signal,
          }),
        );
        break;
      case "text":
        asyncActions.push(
          updateText({
            app,
            parent,
            prevTextASTNode: prev,
            nextTextASTNode: next,
            transitions,
            transitionElements,
            eventHandler,
            signal,
          }),
        );
        break;
      case "container":
        asyncActions.push(
          updateContainer({
            app,
            parent,
            prevAST: prev,
            nextAST: next,
            transitions,
            transitionElements,
            eventHandler,
            signal,
          }),
        );
        break;
      case "sprite":
        asyncActions.push(
          updateSprite({
            app,
            parent,
            prevAST: prev,
            nextAST: next,
            transitions,
            transitionElements,
            eventHandler,
            signal,
          }),
        );
        break;
      default:
    }
  }
  await Promise.all(asyncActions);
  sortContainerChildren(parent, nextASTTree);
}

function sortContainerChildren(container, nextAST) {
  container.children.sort((a, b) => {
    const aElement = nextAST.find((element) => element.id === a.label);
    const bElement = nextAST.find((element) => element.id === b.label);

    if (aElement && bElement) {
      // First, sort by zIndex if specified
      const aZIndex = aElement.zIndex ?? 0;
      const bZIndex = bElement.zIndex ?? 0;
      if (aZIndex !== bZIndex) {
        return aZIndex - bZIndex;
      }

      // If zIndex is the same or not specified, maintain order from nextState.elements
      const aIndex = nextAST.findIndex((element) => element.id === a.label);
      const bIndex = nextAST.findIndex((element) => element.id === b.label);
      return aIndex - bIndex;
    }

    // Keep elements that aren't in nextState.elements at their current position
    if (!aElement && !bElement) return 0;
    if (!aElement) return -1;
    if (!bElement) return 1;
  });
}

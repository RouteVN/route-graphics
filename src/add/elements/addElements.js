import { addRect, addText, addSprite, addContainer } from "../add/index.js";
import { diffElements } from "../util/diffElements.js";
import { deleteRect } from "../delete/deleteRect.js";
import { deleteText } from "../delete/deleteText.js";
import { deleteContainer } from "../delete/deleteContainer.js";
import { deleteSprite } from "../delete/deleteSprite.js";
import { updateRect } from "../update/updateRect.js";
import { updateText } from "../update/updateText.js";
import { updateSprite } from "../update/updateSprite.js";
import { updateContainer } from "../update/updateContainer.js";
import { addTextRevealing } from "../add/index.js";
import { updateTextRevealing } from "../update/updateTextRevealing.js";
import { deleteTextRevealing } from "../delete/deleteTextRevealing.js";
import { addSlider } from "../add/index.js";
import { deleteSlider } from "../delete/deleteSlider.js";
import { updateSlider } from "../update/updateSlider.js";
import { ASTNodeType } from "../types.js";
/**
 * @typedef {import('../types.js').Application} Application
 * @typedef {import('../types.js').ASTNode} ASTNode
 * @typedef {import('../types.js').Container} Container
 */

/**
 * @param {Object} addElementsOptions
 * @property {Application} addElementsOptions.app
 * @property {Container} addElementsOptions.parent
 * @property {ASTNode[]} addElementsOptions.prevASTTree
 * @property {ASTNode[]} addElementsOptions.nextASTTree
 * @property {Object[]} addElementsOptions.transitions
 * @property {Function} addElementsOptions.eventHandler
 * @property {Function} addElementsOptions.transitionElements
 * @property {AbortSignal[]} addElementsOptions.signal
 */
export const addElements = async({
  app,
  parent,
  prevASTTree,
  nextASTTree,
  transitions,
  eventHandler,
  transitionElements,
  signal,
}) => {
  const { toAddElement, toDeleteElement, toUpdateElement } = diffElements(
    prevASTTree,
    nextASTTree,
    transitions,
  );
  const asyncActions = [];

  for (const element of toDeleteElement) {
    switch (element.type) {
      case ASTNodeType.RECT:
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
      case ASTNodeType.TEXT:
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
      case ASTNodeType.CONTAINER:
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
      case ASTNodeType.SPRITE:
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
      case ASTNodeType.TEXT_REVEALING:
        asyncActions.push(
          deleteTextRevealing({
            app,
            parent,
            textRevealingASTNode: element,
            signal,
          }),
        );
        break;
      case ASTNodeType.SLIDER:
        asyncActions.push(
          deleteSlider({
            app,
            parent,
            sliderASTNode: element,
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
      case ASTNodeType.RECT:
        asyncActions.push(
          addRect({
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
      case ASTNodeType.TEXT:
        asyncActions.push(
          addText({
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
      case ASTNodeType.CONTAINER:
        asyncActions.push(
          addContainer({
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
      case ASTNodeType.SPRITE:
        asyncActions.push(
          addSprite({
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
      case ASTNodeType.TEXT_REVEALING:
        asyncActions.push(
          addTextRevealing({
            app,
            parent,
            textRevealingASTNode: element,
            signal,
          }),
        );
        break;
      case ASTNodeType.SLIDER:
        asyncActions.push(
          addSlider({
            app,
            parent,
            sliderASTNode: element,
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

  for (const { prev, next } of toUpdateElement) {
    switch (next.type) {
      case ASTNodeType.RECT:
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
      case ASTNodeType.TEXT:
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
      case ASTNodeType.CONTAINER:
        asyncActions.push(
          updateContainer({
            app,
            parent,
            prevContainerASTNode: prev,
            nextContainerASTNode: next,
            transitions,
            transitionElements,
            eventHandler,
            signal,
          }),
        );
        break;
      case ASTNodeType.SPRITE:
        asyncActions.push(
          updateSprite({
            app,
            parent,
            prevSpriteASTNode: prev,
            nextSpriteASTNode: next,
            transitions,
            transitionElements,
            eventHandler,
            signal,
          }),
        );
        break;
      case ASTNodeType.TEXT_REVEALING:
        asyncActions.push(
          updateTextRevealing({
            app,
            parent,
            textRevealingASTNode: next,
            signal,
          }),
        );
        break;
      case ASTNodeType.SLIDER:
        asyncActions.push(
          updateSlider({
            app,
            parent,
            prevSliderASTNode: prev,
            nextSliderASTNode: next,
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

const sortContainerChildren = (container, nextAST) => {
  container.children.sort((a, b) => {
    const aIndex = nextAST.findIndex((element) => element.id === a.label);
    const bIndex = nextAST.findIndex((element) => element.id === b.label);

    // If both elements are in nextAST, maintain order from nextASTTree
    if (aIndex !== -1 && bIndex !== -1) {
      return aIndex - bIndex;
    }

    // Keep elements that aren't in nextAST at their current position
    if (aIndex === -1 && bIndex === -1) return 0;
    if (aIndex === -1) return -1;
    if (bIndex === -1) return 1;
  });
}

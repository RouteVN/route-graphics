import { isDeepEqual } from "../../../util/isDeepEqual.js";
import {
  INPUT_RUNTIME,
  getInputGeometry,
  syncInputView,
} from "./inputShared.js";

const emitInputEvent = ({
  eventHandler,
  eventName,
  element,
  eventConfig,
  snapshot,
}) => {
  if (!eventHandler || !eventConfig) return;

  eventHandler(eventName, {
    _event: {
      id: element.id,
      value: snapshot.value,
      selectionStart: snapshot.selectionStart,
      selectionEnd: snapshot.selectionEnd,
      composing: snapshot.composing,
    },
    ...(eventConfig.payload ?? {}),
  });
};

const createCallbacks = ({ element, runtime, eventHandler }) => ({
  onValueChange: (snapshot) => {
    runtime.value = snapshot.value;
    runtime.selectionStart = snapshot.selectionStart;
    runtime.selectionEnd = snapshot.selectionEnd;
    runtime.lastExternalValue = snapshot.value;
    syncInputView(runtime, element);
    emitInputEvent({
      eventHandler,
      eventName: "change",
      element,
      eventConfig: element.change,
      snapshot,
    });
  },
  onFocus: (snapshot) => {
    runtime.focused = true;
    runtime.selectionStart = snapshot.selectionStart;
    runtime.selectionEnd = snapshot.selectionEnd;
    runtime.selectionAnchor =
      snapshot.selectionStart === snapshot.selectionEnd
        ? snapshot.selectionEnd
        : runtime.selectionAnchor;
    runtime.blinkVisible = true;
    runtime.blinkTick = 0;
    syncInputView(runtime, element);
    emitInputEvent({
      eventHandler,
      eventName: "focus",
      element,
      eventConfig: element.focusEvent,
      snapshot,
    });
  },
  onBlur: (snapshot) => {
    runtime.focused = false;
    runtime.selectionStart = snapshot.selectionStart;
    runtime.selectionEnd = snapshot.selectionEnd;
    runtime.blinkVisible = false;
    runtime.composing = false;
    syncInputView(runtime, element);
    emitInputEvent({
      eventHandler,
      eventName: "blur",
      element,
      eventConfig: element.blurEvent,
      snapshot,
    });
  },
  onSelectionChange: (snapshot) => {
    runtime.focused = snapshot.focused;
    runtime.selectionStart = snapshot.selectionStart;
    runtime.selectionEnd = snapshot.selectionEnd;
    if (snapshot.selectionStart === snapshot.selectionEnd) {
      runtime.selectionAnchor = snapshot.selectionEnd;
    }
    syncInputView(runtime, element);
    emitInputEvent({
      eventHandler,
      eventName: "selectionChange",
      element,
      eventConfig: element.selectionChange,
      snapshot,
    });
  },
  onSubmit: (snapshot) => {
    emitInputEvent({
      eventHandler,
      eventName: "submit",
      element,
      eventConfig: element.submit,
      snapshot,
    });
  },
  onCompositionStart: (snapshot) => {
    runtime.composing = true;
    syncInputView(runtime, element);
    emitInputEvent({
      eventHandler,
      eventName: "compositionStart",
      element,
      eventConfig: element.compositionStart,
      snapshot,
    });
  },
  onCompositionUpdate: (snapshot) => {
    runtime.composing = true;
    runtime.selectionStart = snapshot.selectionStart;
    runtime.selectionEnd = snapshot.selectionEnd;
    syncInputView(runtime, element);
    emitInputEvent({
      eventHandler,
      eventName: "compositionUpdate",
      element,
      eventConfig: element.compositionUpdate,
      snapshot,
    });
  },
  onCompositionEnd: (snapshot) => {
    runtime.composing = false;
    runtime.value = snapshot.value;
    runtime.selectionStart = snapshot.selectionStart;
    runtime.selectionEnd = snapshot.selectionEnd;
    syncInputView(runtime, element);
    emitInputEvent({
      eventHandler,
      eventName: "compositionEnd",
      element,
      eventConfig: element.compositionEnd,
      snapshot,
    });
  },
});

export const updateInput = ({
  app,
  parent,
  prevElement,
  nextElement,
  eventHandler,
  zIndex,
}) => {
  const container = parent.children.find(
    (child) => child.label === prevElement.id,
  );

  if (!container) return;
  if (!app.inputDomBridge?.update) {
    throw new Error(
      "Input plugin requires app.inputDomBridge to be initialized",
    );
  }

  container.zIndex = zIndex;

  const runtime = container[INPUT_RUNTIME];

  if (!runtime) return;

  const nextRuntimeElement = {
    ...nextElement,
  };

  const shouldAdoptExternalValue =
    runtime.focused !== true || nextElement.value !== prevElement.value;

  if (shouldAdoptExternalValue && runtime.composing !== true) {
    runtime.value = nextElement.value;
    runtime.lastExternalValue = nextElement.value;
  } else {
    nextRuntimeElement.value = runtime.value;
  }

  runtime.element = nextRuntimeElement;
  container.label = nextElement.id;
  container.cursor = nextElement.disabled ? "default" : "text";
  container.x = Math.round(nextElement.x);
  container.y = Math.round(nextElement.y);
  container.alpha = nextElement.alpha;

  if (nextElement.disabled === true) {
    runtime.draggingSelection = false;
  }

  if (!isDeepEqual(prevElement, nextElement) || shouldAdoptExternalValue) {
    syncInputView(runtime, nextRuntimeElement);
  }

  app.inputDomBridge.update(nextElement.id, {
    ...nextRuntimeElement,
    value: runtime.value,
    callbacks: createCallbacks({
      element: nextRuntimeElement,
      runtime,
      eventHandler,
    }),
    getGeometry: () => getInputGeometry(app, container, nextRuntimeElement),
  });
};

export default updateInput;

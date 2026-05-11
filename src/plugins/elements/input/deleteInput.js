import { INPUT_RUNTIME } from "./inputShared.js";
import { dispatchLiveAnimations } from "../../animations/planAnimations.js";

export const deleteInput = ({
  app,
  parent,
  element,
  animations,
  animationBus,
  completionTracker,
}) => {
  const inputContainer = parent.getChildByLabel(element.id);

  if (!inputContainer) return;
  if (!app.inputDomBridge?.unmount) {
    throw new Error(
      "Input plugin requires app.inputDomBridge to be initialized",
    );
  }

  const runtime = inputContainer[INPUT_RUNTIME];

  const deleteElement = () => {
    if (inputContainer.destroyed) {
      return;
    }

    if (runtime?.tickerListener) {
      app.ticker?.remove?.(runtime.tickerListener);
    }

    app.inputDomBridge.unmount(element.id);
    inputContainer.destroy({ children: true });
  };

  const dispatched = dispatchLiveAnimations({
    animations,
    targetId: element.id,
    animationBus,
    completionTracker,
    element: inputContainer,
    targetState: null,
    onComplete: deleteElement,
  });

  if (!dispatched) {
    deleteElement();
  }
};

export default deleteInput;

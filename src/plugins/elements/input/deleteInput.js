import { INPUT_RUNTIME } from "./inputShared.js";

export const deleteInput = ({ app, parent, element }) => {
  const inputContainer = parent.getChildByLabel(element.id);

  if (!inputContainer) return;
  if (!app.inputDomBridge?.unmount) {
    throw new Error(
      "Input plugin requires app.inputDomBridge to be initialized",
    );
  }

  const runtime = inputContainer[INPUT_RUNTIME];

  if (runtime?.tickerListener) {
    app.ticker?.remove?.(runtime.tickerListener);
  }

  app.inputDomBridge.unmount(element.id);
  inputContainer.destroy({ children: true });
};

export default deleteInput;

import { cloneSerializableData } from "./cloneSerializableData.js";

export const clonePayloadForEvent = (payload = {}) =>
  cloneSerializableData(payload);

const MAX_STAGE_EVENT_DEPTH = 6;

const cloneStageValue = (value, seen, depth = 0) => {
  if (depth > MAX_STAGE_EVENT_DEPTH) return undefined;
  if (value === null) return null;

  const valueType = typeof value;
  if (valueType === "string" || valueType === "number" || valueType === "boolean")
    return value;
  if (valueType === "bigint") return value.toString();
  if (valueType === "undefined" || valueType === "function" || valueType === "symbol")
    return undefined;
  if (valueType !== "object") return undefined;

  if (seen.has(value)) return undefined;
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => {
      const cloned = cloneStageValue(item, seen, depth + 1);
      return cloned === undefined ? null : cloned;
    });
  }

  const output = {};
  for (const key of Object.keys(value)) {
    let child;
    try {
      child = value[key];
    } catch (_error) {
      continue;
    }
    const cloned = cloneStageValue(child, seen, depth + 1);
    if (cloned !== undefined) {
      output[key] = cloned;
    }
  }

  return output;
};

export const createStageEventPayload = (event) =>
  cloneStageValue(event, new WeakSet()) ?? {};

export const createSafeEventHandler = (eventHandler) => {
  if (typeof eventHandler !== "function") return undefined;

  return (eventName, payload = {}) => {
    eventHandler(eventName, clonePayloadForEvent(payload));
  };
};

export default createSafeEventHandler;

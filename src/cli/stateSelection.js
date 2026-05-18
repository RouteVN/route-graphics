export const parseStateSelection = (value, stateCount) => {
  if (!Number.isInteger(stateCount) || stateCount < 0) {
    throw new Error("State count must be a non-negative integer.");
  }

  if (value === undefined || value === null || value === "") {
    return Array.from({ length: stateCount }, (_entry, index) => index);
  }

  const selected = [];
  const seen = new Set();

  const addIndex = (index) => {
    if (index < 0 || index >= stateCount) {
      throw new Error(
        `State index ${index} is out of range for ${stateCount} state(s).`,
      );
    }

    if (!seen.has(index)) {
      seen.add(index);
      selected.push(index);
    }
  };

  for (const rawPart of String(value).split(",")) {
    const part = rawPart.trim();
    if (!part) {
      throw new Error("State selection contains an empty segment.");
    }

    const rangeMatch = /^(\d+)-(\d+)$/.exec(part);
    if (rangeMatch) {
      const start = Number.parseInt(rangeMatch[1], 10);
      const end = Number.parseInt(rangeMatch[2], 10);

      if (start > end) {
        throw new Error(`State range "${part}" must be ascending.`);
      }

      for (let index = start; index <= end; index += 1) {
        addIndex(index);
      }
      continue;
    }

    if (!/^\d+$/.test(part)) {
      throw new Error(
        `Invalid state selection "${part}". Use indexes or ranges like 0,2-4.`,
      );
    }

    addIndex(Number.parseInt(part, 10));
  }

  if (selected.length === 0) {
    throw new Error("State selection did not include any states.");
  }

  return selected;
};

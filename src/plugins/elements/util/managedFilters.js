const MANAGED_FILTERS_KEY = "__routeGraphicsManagedFilters";

const EFFECT_ORDER = ["shadow", "blur", "shader"];

const getManagedFilters = (displayObject) => {
  if (!displayObject[MANAGED_FILTERS_KEY]) {
    Object.defineProperty(displayObject, MANAGED_FILTERS_KEY, {
      value: new Map(),
      enumerable: false,
      configurable: true,
    });
  }

  return displayObject[MANAGED_FILTERS_KEY];
};

const getFilterList = (displayObject) => {
  if (!displayObject.filters) return [];
  return Array.isArray(displayObject.filters)
    ? displayObject.filters
    : [displayObject.filters];
};

const normalizeFilterList = (filter) => {
  if (!filter) return [];
  return Array.isArray(filter) ? filter.filter(Boolean) : [filter];
};

const rebuildFilters = (
  displayObject,
  managedFilters,
  previousManagedFilter,
) => {
  const managedFilterSet = new Set();
  for (const filter of managedFilters.values()) {
    for (const item of normalizeFilterList(filter)) {
      managedFilterSet.add(item);
    }
  }
  for (const item of normalizeFilterList(previousManagedFilter)) {
    managedFilterSet.add(item);
  }

  const unmanagedFilters = getFilterList(displayObject).filter(
    (filter) => !managedFilterSet.has(filter),
  );
  const orderedManagedFilters = EFFECT_ORDER.flatMap((key) =>
    normalizeFilterList(managedFilters.get(key)),
  );
  const nextFilters = [...orderedManagedFilters, ...unmanagedFilters];

  displayObject.filters = nextFilters.length > 0 ? nextFilters : null;
};

const destroyManagedFilter = (filter) => {
  for (const item of normalizeFilterList(filter)) {
    item.destroy?.();
  }
};

export const setManagedFilter = (displayObject, key, filter) => {
  const managedFilters = getManagedFilters(displayObject);
  const previousFilter = managedFilters.get(key);

  if (filter) {
    managedFilters.set(key, filter);
  } else {
    managedFilters.delete(key);
  }

  rebuildFilters(displayObject, managedFilters, previousFilter);

  if (previousFilter && previousFilter !== filter) {
    destroyManagedFilter(previousFilter);
  }
};

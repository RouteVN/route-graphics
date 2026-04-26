const MANAGED_FILTERS_KEY = "__routeGraphicsManagedFilters";

const EFFECT_ORDER = ["shadow", "blur"];

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

const rebuildFilters = (
  displayObject,
  managedFilters,
  previousManagedFilter,
) => {
  const managedFilterSet = new Set(managedFilters.values());
  if (previousManagedFilter) {
    managedFilterSet.add(previousManagedFilter);
  }

  const unmanagedFilters = getFilterList(displayObject).filter(
    (filter) => !managedFilterSet.has(filter),
  );
  const orderedManagedFilters = EFFECT_ORDER.map((key) =>
    managedFilters.get(key),
  ).filter(Boolean);
  const nextFilters = [...orderedManagedFilters, ...unmanagedFilters];

  displayObject.filters = nextFilters.length > 0 ? nextFilters : null;
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
    previousFilter.destroy?.();
  }
};

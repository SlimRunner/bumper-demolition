/**
 * polyfill for `Map.getOrInsert` see
 *
 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/getOrInsert
 * @param map container source
 * @param key map locator
 * @param initial initial value to use if key does not exist
 * @returns value found in `key` or provided initial value
 */
export function getOrInsert<T, S>(map: Map<T, S>, key: T, initial: S): S {
  const value = map.get(key);
  if (value == null) {
    map.set(key, initial);
  }
  return map.get(key)!;
}

/**
 * Same as `getOrInsert` except it will short-circuit initial value
 * construction if not needed. Useful for expensive objects.
 * @param map container source
 * @param key map locator
 * @param ctor callback that constructs the initial object
 * @returns value found in `key` or constructed initial value
 */
export function getOrInsertCond<T, S>(
  map: Map<T, S>,
  key: T,
  ctor: () => S,
): S {
  const value = map.get(key);
  if (value == null) {
    map.set(key, ctor());
  }
  return map.get(key)!;
}

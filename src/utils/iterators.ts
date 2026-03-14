export function range(count: number): Generator<number, void, unknown>;
export function range(
  start: number,
  end: number,
): Generator<number, void, unknown>;
export function range(
  start: number,
  end: number,
  step: number,
): Generator<number, void, unknown>;
export function* range(
  start: number,
  end: number | null = null,
  step: number = 1,
): Generator<number, void, unknown> {
  if (end == null) {
    [start, end] = [0, start];
  }
  if ((end - start) * step < 0) {
    return;
  } else if (step >= 1) {
    for (let i = start; i < end; i += step) {
      yield i;
    }
  } else {
    for (let i = start; i > end; i += step) {
      yield i;
    }
  }
}

export function* enumerate<T>(
  iter: Iterable<T>,
): Generator<[number, T], void, unknown> {
  let i = 0;
  for (const item of iter) {
    yield [i++, item];
  }
  return;
}

export function* zipgen<T extends any[]>(
  ...iters: { [K in keyof T]: Iterable<T[K]> | Iterator<T[K]> }
): Generator<T, void, unknown> {
  // Normalize everything into Iterators
  const iterators = iters.map((it) => {
    if (typeof it === "object" && it !== null && Symbol.iterator in it) {
      return (it as Iterable<any>)[Symbol.iterator]();
    }
    return it as Iterator<any>;
  });

  while (true) {
    const results = iterators.map((iter) => iter.next());
    
    // If any iterator is done, we stop
    if (results.some((res) => res.done)) {
      return;
    }

    // Yield the values as a typed tuple
    yield results.map((res) => res.value) as T;
  }
}

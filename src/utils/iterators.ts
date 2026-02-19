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

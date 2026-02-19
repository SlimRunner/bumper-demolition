export interface StringParsable {
  toString(radix?: number): string;
}

export function normalizeLines(expression: string): string {
  return expression.replace("\r\n", "\n");
}

export function parseNumberList(text: string, sep: string = " "): number[] {
  const numbers = text
    .trim()
    .replace(RegExp(String.raw`${sep}+`, "g"), sep)
    .split(sep)
    .map((n) => Number(n));
  return numbers;
}

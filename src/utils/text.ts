export interface StringParsable {
  toString(radix?: number): string;
}

export function normalizeLines(expression: string): string {
  return expression.replace(/\r\n/g, "\n");
}

export function parseNumberList(text: string, sep: string = " "): number[] {
  const numbers = text
    .trim()
    .replace(RegExp(String.raw`${sep}+`, "g"), sep)
    .split(sep)
    .map((n) => Number(n));
  return numbers;
}

export function resolveSiblingPath(sourcePath: string, relativePath: string) {
  if (
    relativePath.startsWith("/") ||
    /^[a-z][a-z0-9+.-]*:/i.test(relativePath)
  ) {
    return relativePath;
  }

  const normalizedSource = sourcePath.replace(/\\/g, "/");
  const slashIdx = normalizedSource.lastIndexOf("/");
  const baseDir = slashIdx >= 0 ? normalizedSource.slice(0, slashIdx + 1) : "";
  return `${baseDir}${relativePath}`;
}

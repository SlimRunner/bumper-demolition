import { CarName } from "../components/types";

export const CarNameLabels: Record<
  CarName,
  {
    colorName: string;
    labelName: string;
  }
> = {
  carA: {
    colorName: "Red",
    labelName: "Car A",
  },
  carB: {
    colorName: "Blue",
    labelName: "Car B",
  },
};

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

type Constructor<T> = new (...args: any[]) => T;

type TokenizerProps = {
  separator: RegExp;
  saveSeparator: boolean;
};

export class TokenStream {
  private i = 0;
  private tokens: string[];
  private spaces: string[];
  private error: Constructor<Error>;

  constructor(
    expression: string,
    error: Constructor<Error>,
    props?: Partial<TokenizerProps>,
  ) {
    this.error = error;
    this.spaces = [];

    const { separator, saveSeparator }: TokenizerProps = {
      separator: / +/g,
      saveSeparator: true,
      ...props,
    };

    this.tokens = expression.split(separator);
    if (this.tokens.length === 0) return;

    expression.replace(separator, (match) => {
      this.spaces.push(saveSeparator ? match : "");
      return "";
    });

    if (this.tokens[0] === "") {
      this.tokens.shift();
    } else {
      this.spaces.unshift("");
    }

    if (this.tokens.length !== this.spaces.length) {
      throw new this.error("TokenStream assertion failed");
    }
  }

  private dispatchToken(prependSep: boolean) {
    const result = this.peekToken(prependSep);
    this.i += 1;
    return result;
  }

  private peekToken(prependSep: boolean) {
    const i = this.i;

    if (i >= this.tokens.length) {
      throw new this.error("unexpected end of input");
    }

    if (prependSep) {
      return this.tokens[i] + this.spaces[i];
    } else {
      return this.tokens[i];
    }
  }

  peek(prependSep: boolean = false) {
    return this.peekToken(prependSep);
  }

  next(prependSep: boolean = false): string {
    return this.dispatchToken(prependSep);
  }

  peekOpt(prependSep: boolean = false): string | null {
    if (this.i >= this.tokens.length) {
      return null;
    }
    return this.peekToken(prependSep);
  }

  nextOpt(prependSep: boolean = false): string | null {
    if (this.i >= this.tokens.length) {
      return null;
    }
    return this.dispatchToken(prependSep);
  }

  get remaining() {
    return this.tokens.length - this.i;
  }
}

import { StringParsable } from "./text";

// Define a class factory function
export function createError(name: string) {
  class CustomError extends Error {
    readonly expected?: StringParsable;
    readonly received?: StringParsable;
    readonly name: string;

    constructor(msg: string);
    constructor(msg: string, expected: StringParsable, received: StringParsable);
    constructor(msg: string, expected?: StringParsable, received?: StringParsable) {
      // Pass remaining arguments (including vendor specific ones) to parent constructor
      super(msg);

      // Maintains proper stack trace for where our error was thrown (only available on V8)
      // if (Error.captureStackTrace) {
      //   Error.captureStackTrace(this, CustomError);
      // }

      this.name = name;
      this.expected = expected;
      this.received = received;
    }

    what(): string {
      return `${this.name}: ${this.message}`;
    }
  }

  return CustomError;
}

function hasToStringProperty(obj: any): obj is { toString: () => string } {
  return typeof obj === "object" && typeof obj.toString === "function";
}

export function formatType(input: any) {
  if (input instanceof Array) {
    return JSON.stringify(input);
  } else if (hasToStringProperty(input)) {
    return input.toString();
  } else {
    return "unknown";
  }
}

// export const MyClass = createError("MyClass");

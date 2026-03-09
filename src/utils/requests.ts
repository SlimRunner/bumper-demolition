import { createError } from "./error";

export const FileError = createError("FileError");

export function loadFile(filename: string) {
  return fetch(filename)
    .then((res) => {
      if (res.ok) return Promise.resolve(res.text());
      else return Promise.reject(res.status);
    })
    .catch((err) => {
      throw new FileError(`File not found: ${filename}`);
    });
}

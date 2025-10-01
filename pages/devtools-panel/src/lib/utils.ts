import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

export type JSONValue = string | number | boolean | null | JSONObject | JSONArray;
export interface JSONObject {
  [key: string]: JSONValue;
}
export interface JSONArray extends Array<JSONValue> {}

export const cn = (...inputs: (string | undefined | null | boolean | Record<string, unknown>)[]) =>
  twMerge(clsx(inputs));

export const looseRecursiveJSONParse = <T = unknown>(input: T): T => {
  if (typeof input === 'string') {
    const value = input.trim();

    // Try JSON-ish detection
    if (
      (value.startsWith('{') && value.endsWith('}')) ||
      (value.startsWith('[') && value.endsWith(']')) ||
      (value.startsWith('"') && value.endsWith('"'))
    ) {
      try {
        const parsed = JSON.parse(value);
        return looseRecursiveJSONParse(parsed) as T;
      } catch {
        return value as T;
      }
    }

    return value as T;
  }

  if (Array.isArray(input)) {
    return input.map(looseRecursiveJSONParse) as T;
  }

  if (input !== null && typeof input === 'object') {
    const obj: any = {};
    for (const [key, val] of Object.entries(input)) {
      obj[key] = looseRecursiveJSONParse(val);
    }
    return obj as T;
  }

  return input;
};

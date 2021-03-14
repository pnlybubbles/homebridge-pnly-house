import { unreachable } from "./util";

export type RawActive = 0 | 1;

export function deriveActive(value: RawActive): boolean {
  return value === 1 ? true : value === 0 ? false : unreachable(value);
}

export function deriveRawActive(value: boolean): RawActive {
  return value ? 1 : 0;
}

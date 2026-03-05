import { funcB } from "./circular-b.js";

export function funcA(): string {
  return "A:" + funcB();
}

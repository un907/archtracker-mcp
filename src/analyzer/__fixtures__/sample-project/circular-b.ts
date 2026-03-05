import { funcA } from "./circular-a.js";

export function funcB(): string {
  return "B:" + funcA();
}

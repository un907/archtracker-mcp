import { api } from "./api.js";
import { Button } from "./Button.js";

export function App() {
  api.fetch();
  return Button;
}

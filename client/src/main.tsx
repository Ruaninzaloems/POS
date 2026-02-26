import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const root = createRoot(document.getElementById("root")!);
root.render(<App />);

if (import.meta.hot) {
  import.meta.hot.accept("./App", (mod) => {
    if (mod) {
      root.render(<mod.default />);
    }
  });
}

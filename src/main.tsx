import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const params = new URLSearchParams(window.location.search);
const fallbackPath = params.get("p");
if (fallbackPath?.startsWith("/")) {
  const fallbackSearch = params.get("q");
  const fallbackHash = params.get("h");
  window.history.replaceState(
    null,
    "",
    `${fallbackPath}${fallbackSearch ? `?${fallbackSearch}` : ""}${fallbackHash ? `#${fallbackHash}` : ""}`,
  );
}

createRoot(document.getElementById("root")!).render(<App />);

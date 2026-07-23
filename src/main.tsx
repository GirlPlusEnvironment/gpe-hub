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
} else if (window.location.pathname === "/" && window.location.hash.includes("type=recovery")) {
  window.history.replaceState(null, "", `/reset-password${window.location.hash}`);
}

createRoot(document.getElementById("root")!).render(<App />);

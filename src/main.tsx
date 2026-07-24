import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Routes, Route } from "react-router-dom";
import "./index.css";
import App from "./App";

function Router() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/private" element={<App />} />
        <Route path="/reset-password" element={<App />} />
      </Routes>
    </HashRouter>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Router />
  </StrictMode>,
);
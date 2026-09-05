import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { SystemProvider } from "./context/SystemContext";
import { AuthProvider } from "./context/AuthContext";
import AppErrorBoundary from "./components/AppErrorBoundary";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppErrorBoundary>
      <SystemProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </SystemProvider>
    </AppErrorBoundary>
  </StrictMode>
);

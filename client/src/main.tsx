import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "./components/ui/sonner";
import { toast } from "sonner";
import "./index.css";
import App from "./App.tsx";
import { applyUpdate, registerServiceWorker } from "./lib/pwa";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
    <Toaster position="top-center" expand={false} richColors closeButton />
  </StrictMode>
);

registerServiceWorker(() => {
  toast("A new version of Wordigo is available", {
    description: "Refresh to get the latest update.",
    duration: Infinity,
    action: {
      label: "Refresh",
      onClick: () => applyUpdate(),
    },
  });
});

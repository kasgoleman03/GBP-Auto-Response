import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "@/app/router";
import { AppDataProvider } from "@/app/AppDataProvider";
import { ToastProvider } from "@/components/ui/Toast";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ToastProvider>
      <AppDataProvider>
        <RouterProvider router={router} />
      </AppDataProvider>
    </ToastProvider>
  </StrictMode>
);

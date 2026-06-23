"use client";

import type { ReactNode } from "react";
import { ToastProvider } from "@/components/ui/Toast";
import { AppDataProvider } from "@/app/AppDataProvider";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <AppDataProvider>{children}</AppDataProvider>
    </ToastProvider>
  );
}

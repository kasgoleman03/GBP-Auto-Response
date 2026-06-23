"use client";

import { useEffect, type ReactNode } from "react";
import { cx } from "@/lib/format";
import { XIcon } from "./icons";

/**
 * A modal that renders as a centered dialog on desktop and a bottom sheet on
 * mobile — the pattern the owner expects when working one-handed on a phone.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-ink-950/40 backdrop-blur-[2px] animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cx(
          "animate-sheet-up relative z-10 flex max-h-[92vh] w-full flex-col bg-white shadow-2xl",
          "rounded-t-3xl sm:max-w-lg sm:rounded-3xl safe-bottom"
        )}
      >
        {title && (
          <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
            <h2 className="text-base font-semibold text-ink-900">{title}</h2>
            <button
              onClick={onClose}
              aria-label="Close"
              className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
            >
              <XIcon size={20} />
            </button>
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="border-t border-ink-100 px-5 py-4">{footer}</div>
        )}
      </div>
    </div>
  );
}

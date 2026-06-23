import type { ReactNode } from "react";
import { cx } from "@/lib/format";

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
  count?: number;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = "md",
  className,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cx(
        "inline-flex items-center gap-1 rounded-xl bg-ink-100 p-1",
        className
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={cx(
              "inline-flex items-center gap-1.5 rounded-lg font-semibold transition-all whitespace-nowrap",
              size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm",
              active
                ? "bg-white text-ink-900 shadow-sm"
                : "text-ink-500 hover:text-ink-700"
            )}
          >
            {opt.label}
            {typeof opt.count === "number" && (
              <span
                className={cx(
                  "rounded-full px-1.5 text-[11px] font-bold tabular-nums",
                  active
                    ? "bg-brand-100 text-brand-700"
                    : "bg-ink-200 text-ink-600"
                )}
              >
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

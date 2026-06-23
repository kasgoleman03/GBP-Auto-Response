import { cx } from "@/lib/format";
import { StarIcon } from "./icons";
import type { Rating } from "@/lib/types";

const TONE_BY_RATING: Record<number, string> = {
  1: "text-red-500",
  2: "text-orange-500",
  3: "text-amber-500",
  4: "text-lime-600",
  5: "text-emerald-500",
};

export function StarRating({
  rating,
  size = 16,
  className,
  showValue = false,
}: {
  rating: Rating;
  size?: number;
  className?: string;
  showValue?: boolean;
}) {
  return (
    <span
      className={cx("inline-flex items-center gap-0.5", className)}
      role="img"
      aria-label={`${rating} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <StarIcon
          key={n}
          size={size}
          filled={n <= rating}
          className={cx(
            n <= rating ? TONE_BY_RATING[rating] : "text-ink-200"
          )}
        />
      ))}
      {showValue && (
        <span className="ml-1 text-sm font-semibold text-ink-700">
          {rating}.0
        </span>
      )}
    </span>
  );
}

/** Interactive star picker for forms (rule editor, previews). */
export function StarPicker({
  value,
  onChange,
  size = 28,
}: {
  value: Rating;
  onChange: (rating: Rating) => void;
  size?: number;
}) {
  return (
    <div className="inline-flex items-center gap-1">
      {([1, 2, 3, 4, 5] as Rating[]).map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          className="rounded-md p-0.5 transition-transform hover:scale-110"
        >
          <StarIcon
            size={size}
            filled={n <= value}
            className={n <= value ? TONE_BY_RATING[value] : "text-ink-200"}
          />
        </button>
      ))}
    </div>
  );
}

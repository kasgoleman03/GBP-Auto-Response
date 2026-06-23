import { Avatar } from "@/components/ui/Avatar";
import { StarRating } from "@/components/ui/StarRating";
import { Badge } from "@/components/ui/Badge";
import { fullDate, timeAgo } from "@/lib/format";
import type { Review } from "@/lib/types";

/** The customer's review — reused in the inbox card and the approval screen. */
export function ReviewBlock({
  review,
  size = "md",
}: {
  review: Review;
  size?: "md" | "lg";
}) {
  return (
    <div className="flex gap-3">
      <Avatar
        name={review.reviewerName}
        src={review.reviewerAvatarUrl}
        size={size === "lg" ? 48 : 40}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-semibold text-ink-900">
            {review.reviewerName}
          </span>
          <span className="text-xs text-ink-400" title={fullDate(review.date)}>
            {timeAgo(review.date)}
          </span>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-2">
          <StarRating rating={review.rating} size={size === "lg" ? 18 : 15} />
          {review.hasText ? (
            <Badge tone="neutral">{review.wordCount} words</Badge>
          ) : (
            <Badge tone="neutral">Rating only</Badge>
          )}
        </div>
        {review.hasText ? (
          <p
            className={
              size === "lg"
                ? "mt-3 whitespace-pre-line text-[15px] leading-relaxed text-ink-700"
                : "mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-700"
            }
          >
            {review.text}
          </p>
        ) : (
          <p className="mt-2 text-sm italic text-ink-400">
            {review.reviewerName.split(" ")[0]} left a {review.rating}-star
            rating with no written review.
          </p>
        )}
      </div>
    </div>
  );
}

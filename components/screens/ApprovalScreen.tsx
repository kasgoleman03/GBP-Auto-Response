"use client";

import { useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ReviewBlock } from "@/components/ReviewBlock";
import { ReplyComposer } from "@/components/ReplyComposer";
import { ReviewStatusBadge } from "@/components/StatusBadge";
import {
  ArrowLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ShieldIcon,
} from "@/components/ui/icons";
import { useAppData } from "@/app/AppDataProvider";
import { useAsync } from "@/lib/useAsync";
import { api } from "@/lib/dataClient";
import { ACTION_DESCRIPTION, describeCondition, resolveAction } from "@/lib/rules";
import { fullDate } from "@/lib/format";

export function ApprovalScreen() {
  const params = useParams<{ reviewId: string }>();
  const reviewId = params.reviewId;
  const router = useRouter();
  const { reviews, loading } = useAppData();
  const rulesState = useAsync(() => api.listRules(), []);

  const review = reviews.find((r) => r.id === reviewId);

  // Build the pending queue for fast triage (next/prev).
  const pendingQueue = useMemo(
    () =>
      reviews
        .filter((r) => r.status === "needs_review")
        .sort((a, b) => +new Date(b.date) - +new Date(a.date)),
    [reviews]
  );
  const queueIndex = pendingQueue.findIndex((r) => r.id === reviewId);
  const prev = queueIndex > 0 ? pendingQueue[queueIndex - 1] : undefined;
  const next =
    queueIndex >= 0 && queueIndex < pendingQueue.length - 1
      ? pendingQueue[queueIndex + 1]
      : undefined;

  const matched =
    review && rulesState.data
      ? resolveAction(rulesState.data, review)
      : undefined;

  function goAfterPost() {
    // Advance to the next pending review, or back to the inbox if none.
    const remaining = pendingQueue.filter((r) => r.id !== reviewId);
    if (remaining.length > 0) {
      router.push(`/review/${remaining[0].id}`);
    } else {
      router.push("/inbox");
    }
  }

  if (loading) {
    return (
      <FullScreen>
        <Card className="p-6">
          <div className="space-y-3">
            <div className="skeleton h-10 w-10 rounded-full" />
            <div className="skeleton h-4 w-48 rounded" />
            <div className="skeleton h-3 w-full rounded" />
          </div>
        </Card>
      </FullScreen>
    );
  }

  if (!review) {
    return (
      <FullScreen>
        <Card className="p-8 text-center">
          <p className="text-base font-semibold text-ink-900">
            Review not found
          </p>
          <p className="mt-1 text-sm text-ink-500">
            It may have been removed or already handled.
          </p>
          <Button
            className="mt-4"
            onClick={() => router.push("/inbox")}
            iconLeft={<ArrowLeftIcon size={18} />}
          >
            Back to inbox
          </Button>
        </Card>
      </FullScreen>
    );
  }

  return (
    <div className="min-h-screen bg-ink-50">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-ink-200/70 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-2 px-4 py-3">
          <button
            onClick={() => router.push("/inbox")}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-semibold text-ink-600 hover:bg-ink-100"
          >
            <ArrowLeftIcon size={18} />
            Inbox
          </button>
          {queueIndex >= 0 && pendingQueue.length > 1 && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-ink-400">
                {queueIndex + 1} of {pendingQueue.length} pending
              </span>
              <button
                disabled={!prev}
                onClick={() => prev && router.push(`/review/${prev.id}`)}
                className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-100 disabled:opacity-30"
                aria-label="Previous review"
              >
                <ChevronLeftIcon size={18} />
              </button>
              <button
                disabled={!next}
                onClick={() => next && router.push(`/review/${next.id}`)}
                className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-100 disabled:opacity-30"
                aria-label="Next review"
              >
                <ChevronRightIcon size={18} />
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-5 animate-fade-in">
        <div className="mb-3 flex items-center justify-between">
          <h1 className="text-lg font-bold text-ink-900">Review &amp; reply</h1>
          <ReviewStatusBadge status={review.status} />
        </div>

        <Card className="p-5">
          <ReviewBlock review={review} size="lg" />
          <p className="mt-3 border-t border-ink-100 pt-3 text-xs text-ink-400">
            Left on {fullDate(review.date)}
          </p>
        </Card>

        {matched && (
          <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-ink-200 bg-white p-3.5">
            <span className="mt-0.5 text-brand-600">
              <ShieldIcon size={18} />
            </span>
            <div className="text-sm">
              <p className="font-semibold text-ink-800">
                Why you're seeing this
              </p>
              <p className="mt-0.5 text-ink-500">
                Matched your rule{" "}
                <Badge tone="brand">{matched.rule.name}</Badge>{" "}
                <span className="text-ink-400">
                  ({describeCondition(matched.rule)})
                </span>
                . {ACTION_DESCRIPTION[matched.action]}
              </p>
            </div>
          </div>
        )}

        <div className="mt-4">
          <ReplyComposer review={review} onPosted={goAfterPost} />
        </div>
      </div>
    </div>
  );
}

function FullScreen({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  return (
    <div className="min-h-screen bg-ink-50">
      <header className="border-b border-ink-200/70 bg-white px-4 py-3">
        <button
          onClick={() => router.push("/inbox")}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-600"
        >
          <ArrowLeftIcon size={18} />
          Inbox
        </button>
      </header>
      <div className="mx-auto max-w-2xl px-4 py-6">{children}</div>
    </div>
  );
}

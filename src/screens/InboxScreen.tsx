import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Screen, PageHeader } from "@/components/PageHeader";
import { Card, EmptyState } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/Field";
import { Avatar } from "@/components/ui/Avatar";
import { StarRating } from "@/components/ui/StarRating";
import { ReviewStatusBadge } from "@/components/StatusBadge";
import { ReviewBlock } from "@/components/ReviewBlock";
import { ReplyComposer } from "@/components/ReplyComposer";
import {
  CheckCircleIcon,
  ChevronRightIcon,
  ClockIcon,
  GoogleIcon,
  RefreshIcon,
  StarIcon,
  XIcon,
  ZapIcon,
} from "@/components/ui/icons";
import { useAppData } from "@/app/AppDataProvider";
import { useAsync } from "@/lib/useAsync";
import { api } from "@/lib/mockApi";
import { cx, timeAgo } from "@/lib/format";
import { useToast } from "@/components/ui/Toast";
import type { Review, ReviewStatus } from "@/lib/types";

type Filter = "all" | ReviewStatus;

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "needs_review", label: "Needs review" },
  { value: "auto_posted", label: "Auto-posted" },
  { value: "posted", label: "Replied" },
  { value: "notify_only", label: "Notified" },
  { value: "skipped", label: "Skipped" },
];

export function InboxScreen() {
  const { reviews, loading } = useAppData();
  const stats = useAsync(() => api.getInboxStats(), []);
  const [filter, setFilter] = useState<Filter>("needs_review");
  const [search, setSearch] = useState("");

  const counts = useMemo(() => {
    const c: Record<Filter, number> = {
      all: reviews.length,
      needs_review: 0,
      auto_posted: 0,
      posted: 0,
      notify_only: 0,
      skipped: 0,
    };
    for (const r of reviews) c[r.status] += 1;
    return c;
  }, [reviews]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reviews
      .filter((r) => (filter === "all" ? true : r.status === filter))
      .filter(
        (r) =>
          !q ||
          r.reviewerName.toLowerCase().includes(q) ||
          r.text.toLowerCase().includes(q)
      )
      .sort((a, b) => +new Date(b.date) - +new Date(a.date));
  }, [reviews, filter, search]);

  return (
    <Screen>
      <PageHeader
        title="Inbox"
        subtitle="Review and approve AI-drafted replies to your Google reviews."
        actions={
          stats.data ? (
            <span className="hidden items-center gap-1.5 text-xs font-medium text-ink-400 sm:inline-flex">
              <RefreshIcon size={14} />
              Last synced {timeAgo(stats.data.lastSyncedAt)}
            </span>
          ) : undefined
        }
      />

      <ConnectionBanner />

      <StatsStrip
        loading={stats.loading}
        needsReview={counts.needs_review}
        autoPosted={stats.data?.autoPostedThisWeek ?? 0}
        avgRating={stats.data?.averageRating ?? 0}
        withoutReply={stats.data?.withoutReply ?? 0}
      />

      {/* Mobile last-synced line */}
      {stats.data && (
        <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-ink-400 sm:hidden">
          <RefreshIcon size={13} />
          Last synced {timeAgo(stats.data.lastSyncedAt)}
        </p>
      )}

      <div className="mt-5 flex flex-col gap-3">
        {/* Scrollable status filter chips */}
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {FILTERS.map((f) => {
            const active = f.value === filter;
            return (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={cx(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ring-1 ring-inset",
                  active
                    ? "bg-brand-600 text-white ring-brand-600"
                    : "bg-white text-ink-600 ring-ink-200 hover:ring-ink-300"
                )}
              >
                {f.label}
                <span
                  className={cx(
                    "rounded-full px-1.5 text-[11px] font-bold tabular-nums",
                    active ? "bg-white/20 text-white" : "bg-ink-100 text-ink-500"
                  )}
                >
                  {counts[f.value]}
                </span>
              </button>
            );
          })}
        </div>
        <TextInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search reviews…"
          aria-label="Search reviews"
        />
      </div>

      <div className="mt-4 space-y-3">
        {loading ? (
          <LoadingList />
        ) : filtered.length === 0 ? (
          <Card>
            {filter === "needs_review" ? (
              <EmptyState
                icon={<CheckCircleIcon size={26} />}
                title="You're all caught up"
                description="No reviews are waiting for your approval. New ones will show up here automatically."
              />
            ) : (
              <EmptyState
                icon={<StarIcon size={26} />}
                title="No reviews found"
                description={
                  search
                    ? "Try a different search term."
                    : "Reviews will appear here as they come in."
                }
              />
            )}
          </Card>
        ) : (
          filtered.map((review) =>
            review.status === "needs_review" ? (
              <ApprovalCard key={review.id} review={review} />
            ) : (
              <SummaryRow key={review.id} review={review} />
            )
          )
        )}
      </div>
    </Screen>
  );
}

function ConnectionBanner() {
  const { connection, connectGoogle } = useAppData();
  const toast = useToast();
  const [connecting, setConnecting] = useState(false);

  if (!connection || connection.status === "connected") return null;

  async function handleConnect() {
    setConnecting(true);
    try {
      await connectGoogle({
        businessName: "Vanguard Kickboxing & Fitness",
        locationAddress: "1847 SE Division St, Portland, OR 97202",
        googleAccountEmail: "frontdesk@vanguardkickboxing.com",
      });
      toast.show("Connected to Google Business Profile", { tone: "success" });
    } finally {
      setConnecting(false);
    }
  }

  return (
    <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 text-amber-600">
          <XIcon size={18} />
        </span>
        <div>
          <p className="text-sm font-semibold text-amber-900">
            Not connected to Google Business Profile
          </p>
          <p className="text-xs text-amber-700">
            Reconnect to keep importing reviews and posting replies.
          </p>
        </div>
      </div>
      <Button
        size="sm"
        iconLeft={<GoogleIcon size={16} />}
        loading={connecting}
        onClick={handleConnect}
        className="shrink-0"
      >
        Connect
      </Button>
    </div>
  );
}

function ApprovalCard({ review }: { review: Review }) {
  return (
    <Card className="overflow-hidden p-4 animate-fade-in">
      <div className="flex items-start justify-between gap-2">
        <ReviewBlock review={review} />
        <Link
          to={`/review/${review.id}`}
          className="shrink-0 rounded-lg p-1 text-ink-300 hover:bg-ink-100 hover:text-ink-600"
          aria-label="Open full review"
          title="Open full screen"
        >
          <ChevronRightIcon size={18} />
        </Link>
      </div>
      <div className="mt-4 border-t border-ink-100 pt-4">
        <ReplyComposer review={review} compact />
      </div>
    </Card>
  );
}

function SummaryRow({ review }: { review: Review }) {
  return (
    <Link to={`/review/${review.id}`} className="block">
      <Card className="flex items-center gap-3 p-3.5 transition-colors hover:border-brand-200 hover:bg-brand-50/30">
        <Avatar name={review.reviewerName} size={42} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-semibold text-ink-900">
              {review.reviewerName}
            </span>
            <StarRating rating={review.rating} size={13} />
          </div>
          <p className="mt-0.5 truncate text-sm text-ink-500">
            {review.hasText
              ? review.text
              : `${review.rating}-star rating, no text`}
          </p>
          <p className="mt-0.5 text-[11px] font-medium text-ink-400">
            {review.hasText ? `${review.wordCount} words` : "Rating only"}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <ReviewStatusBadge status={review.status} />
          <span className="text-[11px] text-ink-400">
            {timeAgo(review.date)}
          </span>
        </div>
      </Card>
    </Link>
  );
}

function StatsStrip({
  loading,
  needsReview,
  autoPosted,
  avgRating,
  withoutReply,
}: {
  loading: boolean;
  needsReview: number;
  autoPosted: number;
  avgRating: number;
  withoutReply: number;
}) {
  const items = [
    {
      label: "Needs review",
      value: needsReview,
      icon: <ClockIcon size={16} />,
      tone: "text-amber-600 bg-amber-50",
    },
    {
      label: "Auto-posted",
      value: autoPosted,
      icon: <ZapIcon size={16} />,
      tone: "text-emerald-600 bg-emerald-50",
    },
    {
      label: "Avg rating",
      value: loading ? "—" : avgRating.toFixed(1),
      icon: <StarIcon size={16} filled />,
      tone: "text-brand-600 bg-brand-50",
    },
    {
      label: "Without reply",
      value: withoutReply,
      icon: <XIcon size={16} />,
      tone: "text-violet-600 bg-violet-50",
    },
  ];
  return (
    <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((it) => (
        <Card key={it.label} className="p-3.5">
          <div
            className={cx(
              "inline-flex h-8 w-8 items-center justify-center rounded-lg",
              it.tone
            )}
          >
            {it.icon}
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-ink-900">
            {it.value}
          </p>
          <p className="text-xs font-medium text-ink-500">{it.label}</p>
        </Card>
      ))}
    </div>
  );
}

function LoadingList() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <Card key={i} className="p-4">
          <div className="flex gap-3">
            <div className="skeleton h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-3.5 w-40 rounded" />
              <div className="skeleton h-3 w-24 rounded" />
              <div className="skeleton h-3 w-full rounded" />
              <div className="skeleton h-3 w-[80%] rounded" />
            </div>
          </div>
        </Card>
      ))}
    </>
  );
}

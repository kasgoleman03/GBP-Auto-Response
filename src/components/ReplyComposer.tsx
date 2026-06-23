import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { TextArea } from "@/components/ui/Field";
import {
  CheckIcon,
  CopyIcon,
  PencilIcon,
  RefreshIcon,
  SparkleIcon,
} from "@/components/ui/icons";
import { useAppData } from "@/app/AppDataProvider";
import { useToast } from "@/components/ui/Toast";
import { cx, timeAgo } from "@/lib/format";
import type { Draft, Review } from "@/lib/types";

type Mode = "view" | "edit";

/**
 * The approval engine: shows the AI draft for a review and lets the owner
 * Approve & Post, Redo (regenerate), or Write My Own. Used both inline in the
 * inbox (compact) and on the full approval screen.
 */
export function ReplyComposer({
  review,
  compact = false,
  autofocusEdit = false,
  onPosted,
}: {
  review: Review;
  compact?: boolean;
  autofocusEdit?: boolean;
  onPosted?: () => void;
}) {
  const { getDraft, regenerateDraft, approveAndPost, postOwnReply, skipReview } =
    useAppData();
  const toast = useToast();

  const [draft, setDraft] = useState<Draft | undefined>();
  const [loadingDraft, setLoadingDraft] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [posting, setPosting] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [mode, setMode] = useState<Mode>("view");
  const [editText, setEditText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const alreadyHandled = review.status !== "needs_review";

  useEffect(() => {
    let active = true;
    setLoadingDraft(true);
    getDraft(review.id).then((d) => {
      if (!active) return;
      setDraft(d);
      setEditText(d?.text ?? "");
      setLoadingDraft(false);
      if (autofocusEdit) setMode("edit");
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [review.id]);

  useEffect(() => {
    if (mode === "edit") {
      const el = textareaRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }
    }
  }, [mode]);

  async function handleRedo() {
    setRegenerating(true);
    try {
      const next = await regenerateDraft(review.id);
      setDraft(next);
      setEditText(next.text);
      toast.show("Fresh draft generated", { tone: "success" });
    } finally {
      setRegenerating(false);
    }
  }

  async function handleApprove() {
    setPosting(true);
    try {
      await approveAndPost(review.id, draft?.text);
      toast.show(`Reply posted to ${review.reviewerName}`, {
        tone: "success",
      });
      onPosted?.();
    } finally {
      setPosting(false);
    }
  }

  async function handlePostOwn() {
    const text = editText.trim();
    if (!text) {
      toast.show("Write a reply before posting", { tone: "error" });
      return;
    }
    setPosting(true);
    try {
      await postOwnReply(review.id, text);
      toast.show(`Your reply was posted to ${review.reviewerName}`, {
        tone: "success",
      });
      onPosted?.();
    } finally {
      setPosting(false);
    }
  }

  async function handleSkip() {
    setSkipping(true);
    try {
      await skipReview(review.id);
      toast.show("Review skipped — no reply will be posted");
      onPosted?.();
    } finally {
      setSkipping(false);
    }
  }

  function copyDraft() {
    const text = mode === "edit" ? editText : draft?.text ?? "";
    void navigator.clipboard?.writeText(text);
    toast.show("Reply copied to clipboard");
  }

  // --- Already posted / handled: show read-only reply -----------------
  if (alreadyHandled) {
    return (
      <div className="rounded-xl border border-ink-200 bg-ink-50/60 p-4">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-ink-500">
          <SparkleIcon size={14} />
          {review.status === "auto_posted"
            ? "Auto-posted reply"
            : review.status === "skipped"
              ? "No reply posted"
              : "Your posted reply"}
        </div>
        {draft?.text && review.status !== "skipped" ? (
          <p className="whitespace-pre-line text-sm leading-relaxed text-ink-700">
            {draft.text}
          </p>
        ) : (
          <p className="text-sm italic text-ink-400">
            You chose not to reply to this review.
          </p>
        )}
      </div>
    );
  }

  const busy = posting || regenerating || skipping;

  return (
    <div className={cx(compact && "rounded-xl")}>
      {/* AI draft surface */}
      <div className="relative overflow-hidden rounded-xl border border-brand-200 bg-gradient-to-b from-brand-50/70 to-white p-4">
        <div className="mb-2.5 flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-brand-700">
            <SparkleIcon size={14} />
            AI draft
          </span>
          <div className="flex items-center gap-1">
            {draft?.updatedAt && !regenerating && (
              <span className="mr-1 text-[11px] text-ink-400">
                {draft.status === "edited" ? "Edited" : "Generated"}{" "}
                {timeAgo(draft.updatedAt)}
              </span>
            )}
            <button
              onClick={copyDraft}
              className="rounded-md p-1 text-ink-400 hover:bg-white hover:text-ink-700"
              aria-label="Copy reply"
              title="Copy"
            >
              <CopyIcon size={15} />
            </button>
          </div>
        </div>

        {loadingDraft ? (
          <DraftSkeleton />
        ) : regenerating ? (
          <RegeneratingState />
        ) : mode === "edit" ? (
          <div>
            <TextArea
              ref={textareaRef}
              rows={compact ? 4 : 6}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              placeholder="Write your reply…"
              className="bg-white"
            />
            <div className="mt-1 text-right text-[11px] text-ink-400">
              {editText.trim().split(/\s+/).filter(Boolean).length} words
            </div>
          </div>
        ) : draft ? (
          <p className="whitespace-pre-line text-[15px] leading-relaxed text-ink-800">
            {draft.text}
          </p>
        ) : (
          <div className="py-2">
            <p className="text-sm text-ink-500">
              No draft yet for this {review.hasText ? "review" : "rating"}.
            </p>
            <Button
              size="sm"
              variant="secondary"
              className="mt-3"
              iconLeft={<SparkleIcon size={16} />}
              onClick={handleRedo}
              loading={regenerating}
            >
              Generate a draft
            </Button>
          </div>
        )}
      </div>

      {/* Actions */}
      {draft && mode === "view" && (
        <div className="mt-3 space-y-2">
          <Button
            block
            size={compact ? "md" : "lg"}
            variant="success"
            iconLeft={<CheckIcon size={20} />}
            onClick={handleApprove}
            loading={posting}
            disabled={busy && !posting}
          >
            Approve &amp; Post
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="secondary"
              iconLeft={<RefreshIcon size={18} />}
              onClick={handleRedo}
              loading={regenerating}
              disabled={busy && !regenerating}
            >
              Redo
            </Button>
            <Button
              variant="secondary"
              iconLeft={<PencilIcon size={18} />}
              onClick={() => setMode("edit")}
              disabled={busy}
            >
              Write my own
            </Button>
          </div>
        </div>
      )}

      {mode === "edit" && (
        <div className="mt-3 space-y-2">
          <Button
            block
            size={compact ? "md" : "lg"}
            variant="success"
            iconLeft={<CheckIcon size={20} />}
            onClick={handlePostOwn}
            loading={posting}
          >
            Post my reply
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="secondary"
              iconLeft={<RefreshIcon size={18} />}
              onClick={handleRedo}
              loading={regenerating}
              disabled={busy && !regenerating}
            >
              Ask AI again
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setMode("view");
                setEditText(draft?.text ?? "");
              }}
              disabled={busy}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Skip */}
      {!loadingDraft && (
        <div className="mt-3 flex items-center justify-center">
          <button
            onClick={handleSkip}
            disabled={busy}
            className="text-xs font-medium text-ink-400 underline-offset-2 hover:text-ink-600 hover:underline disabled:opacity-50"
          >
            {skipping ? "Skipping…" : "Skip — don't reply"}
          </button>
        </div>
      )}

      {review.rating <= 2 && mode === "view" && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-inset ring-amber-200">
          <span className="mt-0.5">
            <Badge tone="warning">Heads up</Badge>
          </span>
          <span>
            This is a critical review. Replies here are always sent for your
            approval — a thoughtful response can win the customer back.
          </span>
        </div>
      )}
    </div>
  );
}

function DraftSkeleton() {
  return (
    <div className="space-y-2">
      <div className="skeleton h-3.5 w-[92%] rounded" />
      <div className="skeleton h-3.5 w-[98%] rounded" />
      <div className="skeleton h-3.5 w-[70%] rounded" />
    </div>
  );
}

function RegeneratingState() {
  return (
    <div className="flex items-center gap-2 py-2 text-sm font-medium text-brand-700">
      <SparkleIcon size={16} className="animate-pulse" />
      <span className="animate-pulse">Drafting a fresh reply…</span>
    </div>
  );
}

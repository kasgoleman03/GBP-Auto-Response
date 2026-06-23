import { Badge } from "@/components/ui/Badge";
import {
  BellIcon,
  CheckIcon,
  ClockIcon,
  XIcon,
  ZapIcon,
} from "@/components/ui/icons";
import type { ReviewStatus, RuleAction } from "@/lib/types";

const REVIEW_STATUS_META: Record<
  ReviewStatus,
  { label: string; tone: Parameters<typeof Badge>[0]["tone"]; icon: React.ReactNode }
> = {
  needs_review: {
    label: "Needs review",
    tone: "warning",
    icon: <ClockIcon size={12} />,
  },
  auto_posted: {
    label: "Auto-posted",
    tone: "success",
    icon: <ZapIcon size={12} />,
  },
  posted: { label: "Posted", tone: "brand", icon: <CheckIcon size={12} /> },
  notify_only: {
    label: "Notified",
    tone: "info",
    icon: <BellIcon size={12} />,
  },
  skipped: { label: "Skipped", tone: "neutral", icon: <XIcon size={12} /> },
};

export function ReviewStatusBadge({ status }: { status: ReviewStatus }) {
  const meta = REVIEW_STATUS_META[status];
  return (
    <Badge tone={meta.tone} icon={meta.icon}>
      {meta.label}
    </Badge>
  );
}

const ACTION_META: Record<
  RuleAction,
  { label: string; tone: Parameters<typeof Badge>[0]["tone"]; icon: React.ReactNode }
> = {
  auto_post: {
    label: "Auto-post",
    tone: "success",
    icon: <ZapIcon size={12} />,
  },
  draft: {
    label: "Draft for approval",
    tone: "warning",
    icon: <ClockIcon size={12} />,
  },
  notify: { label: "Notify only", tone: "info", icon: <BellIcon size={12} /> },
};

export function RuleActionBadge({ action }: { action: RuleAction }) {
  const meta = ACTION_META[action];
  return (
    <Badge tone={meta.tone} icon={meta.icon}>
      {meta.label}
    </Badge>
  );
}

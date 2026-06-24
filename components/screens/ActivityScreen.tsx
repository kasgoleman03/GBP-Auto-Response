"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Screen, PageHeader } from "@/components/PageHeader";
import { Card, EmptyState } from "@/components/ui/Card";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import {
  BellIcon,
  CheckIcon,
  ListIcon,
  PencilIcon,
  RefreshIcon,
  ShieldIcon,
  SparkleIcon,
  XIcon,
  ZapIcon,
} from "@/components/ui/icons";
import { useAsync } from "@/lib/useAsync";
import { api } from "@/lib/dataClient";
import { cx, dayLabel, fullDate, timeAgo } from "@/lib/format";
import type { ActivityEntry, ActivityType } from "@/lib/types";

type Filter = "all" | "automated" | "you";

const META: Record<
  ActivityType,
  { icon: React.ReactNode; tone: string }
> = {
  auto_posted: { icon: <ZapIcon size={16} />, tone: "text-emerald-600 bg-emerald-50" },
  approved: { icon: <CheckIcon size={16} />, tone: "text-brand-600 bg-brand-50" },
  edited_and_posted: {
    icon: <PencilIcon size={16} />,
    tone: "text-brand-600 bg-brand-50",
  },
  regenerated: { icon: <RefreshIcon size={16} />, tone: "text-violet-600 bg-violet-50" },
  skipped: { icon: <XIcon size={16} />, tone: "text-ink-500 bg-ink-100" },
  rule_changed: { icon: <ShieldIcon size={16} />, tone: "text-amber-600 bg-amber-50" },
  voice_changed: { icon: <SparkleIcon size={16} />, tone: "text-violet-600 bg-violet-50" },
  connected: { icon: <CheckIcon size={16} />, tone: "text-emerald-600 bg-emerald-50" },
  notified: { icon: <BellIcon size={16} />, tone: "text-sky-600 bg-sky-50" },
  reverted: { icon: <RefreshIcon size={16} />, tone: "text-ink-500 bg-ink-100" },
  reopened: { icon: <RefreshIcon size={16} />, tone: "text-brand-600 bg-brand-50" },
};

export function ActivityScreen() {
  const { data, loading } = useAsync(() => api.listActivity(), []);
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = useMemo(() => {
    const items = data ?? [];
    if (filter === "automated") return items.filter((i) => i.actor === "system");
    if (filter === "you") return items.filter((i) => i.actor === "you");
    return items;
  }, [data, filter]);

  const groups = useMemo(() => groupByDay(filtered), [filtered]);

  return (
    <Screen>
      <PageHeader
        title="Activity log"
        subtitle="A complete history of every reply, automation, and setting change."
      />

      <div className="mt-5">
        <SegmentedControl<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All" },
            { value: "automated", label: "Automated" },
            { value: "you", label: "By you" },
          ]}
        />
      </div>

      <div className="mt-4">
        {loading ? (
          <Card className="divide-y divide-ink-100">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3 p-4">
                <div className="skeleton h-9 w-9 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-3.5 w-2/3 rounded" />
                  <div className="skeleton h-3 w-24 rounded" />
                </div>
              </div>
            ))}
          </Card>
        ) : filtered.length === 0 ? (
          <Card>
            <EmptyState
              icon={<ListIcon size={26} />}
              title="Nothing here yet"
              description="Activity will appear as replies are posted and settings change."
            />
          </Card>
        ) : (
          <div className="space-y-6">
            {groups.map(([day, entries]) => (
              <div key={day}>
                <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-ink-400">
                  {day}
                </h2>
                <Card className="divide-y divide-ink-100">
                  {entries.map((entry) => (
                    <ActivityRow key={entry.id} entry={entry} />
                  ))}
                </Card>
              </div>
            ))}
          </div>
        )}
      </div>
    </Screen>
  );
}

function ActivityRow({ entry }: { entry: ActivityEntry }) {
  const meta = META[entry.type];
  const content = (
    <div className="flex gap-3 p-4">
      <span
        className={cx(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          meta.tone
        )}
      >
        {meta.icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink-900">{entry.summary}</p>
        {entry.detail && (
          <p className="mt-1 line-clamp-2 rounded-lg bg-ink-50 px-2.5 py-1.5 text-xs italic text-ink-500">
            "{entry.detail}"
          </p>
        )}
        <p
          className="mt-1.5 text-xs text-ink-400"
          title={fullDate(entry.date)}
        >
          {entry.actor === "system" ? "Automated" : "You"} ·{" "}
          {timeAgo(entry.date)}
        </p>
      </div>
    </div>
  );

  if (entry.reviewId) {
    return (
      <Link
        href={`/review/${entry.reviewId}`}
        className="block transition-colors hover:bg-ink-50/60"
      >
        {content}
      </Link>
    );
  }
  return content;
}

function groupByDay(entries: ActivityEntry[]): [string, ActivityEntry[]][] {
  const map = new Map<string, ActivityEntry[]>();
  for (const entry of entries) {
    const key = dayLabel(entry.date);
    const list = map.get(key);
    if (list) list.push(entry);
    else map.set(key, [entry]);
  }
  return Array.from(map.entries());
}

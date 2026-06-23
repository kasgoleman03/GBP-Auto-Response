"use client";

import { useEffect, useState } from "react";
import { Screen, PageHeader } from "@/components/PageHeader";
import { Card, EmptyState } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Switch } from "@/components/ui/Switch";
import { Sheet } from "@/components/ui/Sheet";
import { RuleActionBadge } from "@/components/StatusBadge";
import { RuleEditor } from "@/components/RuleEditor";
import {
  InfoIcon,
  PencilIcon,
  PlusIcon,
  ShieldIcon,
  SlidersIcon,
  TrashIcon,
} from "@/components/ui/icons";
import { api } from "@/lib/mockApi";
import { describeCondition } from "@/lib/rules";
import { useToast } from "@/components/ui/Toast";
import { cx } from "@/lib/format";
import type { Rule } from "@/lib/types";

function blankRule(): Rule {
  return {
    id: `rule_${Date.now()}`,
    name: "",
    condition: {
      minStars: 5,
      maxStars: 5,
      minWords: null,
      maxWords: null,
      starOnly: false,
    },
    action: "draft",
    enabled: true,
  };
}

export function RulesScreen() {
  const toast = useToast();
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Rule | null>(null);
  const [isNew, setIsNew] = useState(false);

  useEffect(() => {
    api.listRules().then((r) => {
      setRules(r);
      setLoading(false);
    });
  }, []);

  async function toggleRule(rule: Rule, enabled: boolean) {
    // Locked / catch-all rules can't be paused — they're a safety net.
    if (rule.locked || rule.catchAll) return;
    const updated = { ...rule, enabled };
    setRules((prev) => prev.map((r) => (r.id === rule.id ? updated : r)));
    await api.saveRule(updated);
  }

  async function handleSave(rule: Rule) {
    const saved = await api.saveRule(rule);
    setRules((prev) => {
      const exists = prev.some((r) => r.id === saved.id);
      const list = exists
        ? prev.map((r) => (r.id === saved.id ? saved : r))
        : [...prev, saved];
      // Keep the catch-all rule pinned to the bottom.
      return [...list].sort((a, b) => (a.catchAll ? 1 : 0) - (b.catchAll ? 1 : 0));
    });
    setEditing(null);
    toast.show(isNew ? "Rule created" : "Rule updated", { tone: "success" });
  }

  async function handleDelete(rule: Rule) {
    setRules((prev) => prev.filter((r) => r.id !== rule.id));
    setEditing(null);
    await api.deleteRule(rule.id);
    toast.show("Rule deleted");
  }

  function openNew() {
    setEditing(blankRule());
    setIsNew(true);
  }

  function openEdit(rule: Rule) {
    setEditing(rule);
    setIsNew(false);
  }

  return (
    <Screen>
      <PageHeader
        title="Automation rules"
        subtitle="Decide what ReplyPilot handles automatically and what it sends to you."
        actions={
          <Button
            iconLeft={<PlusIcon size={18} />}
            onClick={openNew}
            className="hidden sm:inline-flex"
          >
            New rule
          </Button>
        }
      />

      <Card className="mt-5 flex items-start gap-3 border-brand-200 bg-brand-50/50 p-4">
        <span className="mt-0.5 text-brand-600">
          <SlidersIcon size={20} />
        </span>
        <div className="flex-1 text-sm text-ink-600">
          <p className="font-semibold text-ink-900">Rules run top to bottom.</p>
          <p className="mt-0.5">
            The first rule that matches a review decides what happens.
          </p>
        </div>
        <span
          className="mt-0.5 shrink-0 cursor-help text-ink-400"
          title="To change priority, edit a rule's conditions so the right one matches first. The catch-all rule always stays last."
          aria-label="How ordering works"
        >
          <InfoIcon size={18} />
        </span>
      </Card>

      <div className="mt-4 space-y-3">
        {loading ? (
          [0, 1, 2].map((i) => (
            <Card key={i} className="p-4">
              <div className="skeleton h-4 w-56 rounded" />
              <div className="skeleton mt-3 h-3 w-40 rounded" />
            </Card>
          ))
        ) : rules.length === 0 ? (
          <Card>
            <EmptyState
              icon={<SlidersIcon size={26} />}
              title="No rules yet"
              description="Add a rule to start automating replies."
              action={
                <Button iconLeft={<PlusIcon size={18} />} onClick={openNew}>
                  New rule
                </Button>
              }
            />
          </Card>
        ) : (
          rules.map((rule, i) => (
            <RuleRow
              key={rule.id}
              rule={rule}
              index={i + 1}
              onToggle={(enabled) => toggleRule(rule, enabled)}
              onEdit={() => openEdit(rule)}
            />
          ))
        )}
      </div>

      {/* Mobile FAB */}
      <button
        onClick={openNew}
        className="fixed bottom-20 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg shadow-brand-600/40 sm:hidden"
        aria-label="New rule"
      >
        <PlusIcon size={26} />
      </button>

      <Sheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={isNew ? "New rule" : "Edit rule"}
      >
        {editing && (
          <RuleEditor
            rule={editing}
            isNew={isNew}
            onSave={handleSave}
            onDelete={handleDelete}
            onCancel={() => setEditing(null)}
          />
        )}
      </Sheet>
    </Screen>
  );
}

function RuleRow({
  rule,
  index,
  onToggle,
  onEdit,
}: {
  rule: Rule;
  index: number;
  onToggle: (enabled: boolean) => void;
  onEdit: () => void;
}) {
  const switchLocked = !!rule.locked || !!rule.catchAll;
  return (
    <Card className={cx("p-4", rule.catchAll && "border-dashed border-ink-300")}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-ink-100 text-xs font-bold text-ink-500">
          {rule.catchAll ? "∗" : index}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-ink-900">{rule.name}</span>
            {rule.catchAll ? (
              <Badge tone="brand" icon={<ShieldIcon size={12} />}>
                Default · always last
              </Badge>
            ) : (
              rule.locked && (
                <Badge tone="neutral" icon={<ShieldIcon size={12} />}>
                  Protected
                </Badge>
              )
            )}
          </div>
          <p className="mt-1 text-sm text-ink-500">
            {rule.catchAll ? (
              "Any review the rules above didn't catch"
            ) : (
              <>
                When a review is{" "}
                <span className="font-medium text-ink-700">
                  {describeCondition(rule)}
                </span>
              </>
            )}
          </p>
          <div className="mt-2.5 flex items-center gap-2">
            <span className="text-xs text-ink-400">then</span>
            <RuleActionBadge action={rule.action} />
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-3">
          <Switch
            checked={rule.enabled}
            onChange={onToggle}
            disabled={switchLocked}
            label={`Enable ${rule.name}`}
          />
          <button
            onClick={onEdit}
            className="inline-flex items-center gap-1 text-xs font-semibold text-ink-500 hover:text-brand-600"
          >
            {switchLocked ? (
              <>
                <PencilIcon size={14} /> Edit action
              </>
            ) : (
              <>
                <PencilIcon size={14} /> Edit
              </>
            )}
          </button>
        </div>
      </div>
      {!rule.enabled && !switchLocked && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-500">
          <TrashIcon size={14} />
          Paused — reviews matching this won't be auto-handled.
        </div>
      )}
    </Card>
  );
}

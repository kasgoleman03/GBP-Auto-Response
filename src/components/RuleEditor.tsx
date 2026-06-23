import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/Field";
import { Switch } from "@/components/ui/Switch";
import {
  BellIcon,
  ClockIcon,
  ShieldIcon,
  TrashIcon,
  ZapIcon,
} from "@/components/ui/icons";
import { ACTION_DESCRIPTION, ACTION_LABEL } from "@/lib/rules";
import { cx } from "@/lib/format";
import type { Rating, Rule, RuleAction } from "@/lib/types";

const ACTION_ICON: Record<RuleAction, React.ReactNode> = {
  auto_post: <ZapIcon size={18} />,
  draft: <ClockIcon size={18} />,
  notify: <BellIcon size={18} />,
};

const ACTION_TONE: Record<RuleAction, string> = {
  auto_post: "text-emerald-600 bg-emerald-50",
  draft: "text-amber-600 bg-amber-50",
  notify: "text-sky-600 bg-sky-50",
};

export function RuleEditor({
  rule,
  isNew,
  onSave,
  onDelete,
  onCancel,
}: {
  rule: Rule;
  isNew: boolean;
  onSave: (rule: Rule) => void;
  onDelete: (rule: Rule) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<Rule>(rule);
  const [byLength, setByLength] = useState(
    rule.condition.minWords != null || rule.condition.maxWords != null
  );
  const locked = !!rule.locked;

  function update(patch: Partial<Rule>) {
    setDraft((d) => ({ ...d, ...patch }));
  }
  function updateCond(patch: Partial<Rule["condition"]>) {
    setDraft((d) => ({ ...d, condition: { ...d.condition, ...patch } }));
  }

  const nameError = draft.name.trim() === "";
  const starError = draft.condition.maxStars < draft.condition.minStars;

  const preview = useMemo(() => {
    const c = draft.condition;
    const stars =
      c.minStars === c.maxStars
        ? `${c.minStars}★`
        : `${c.minStars}–${c.maxStars}★`;
    let len = "any length";
    if (c.starOnly) len = "rating only";
    else if (byLength) {
      if (c.minWords != null && c.maxWords != null)
        len = `${c.minWords}–${c.maxWords} words`;
      else if (c.minWords != null) len = `${c.minWords}+ words`;
      else if (c.maxWords != null) len = `under ${c.maxWords + 1} words`;
    }
    return { stars, len };
  }, [draft.condition, byLength]);

  function handleSave() {
    if (nameError || starError) return;
    const condition = { ...draft.condition };
    if (condition.starOnly || !byLength) {
      condition.minWords = null;
      condition.maxWords = null;
    }
    onSave({ ...draft, condition });
  }

  return (
    <div className="space-y-5">
      <Field label="Rule name" htmlFor="rule-name">
        <TextInput
          id="rule-name"
          value={draft.name}
          disabled={locked}
          onChange={(e) => update({ name: e.target.value })}
          placeholder="e.g. 5-star quick praise"
        />
        {nameError && !locked && (
          <p className="text-xs text-red-600">Give your rule a name.</p>
        )}
      </Field>

      {locked && (
        <div className="flex items-start gap-2 rounded-xl bg-ink-50 px-3.5 py-3 text-sm text-ink-600">
          <ShieldIcon size={18} className="mt-0.5 shrink-0 text-ink-400" />
          {draft.catchAll
            ? "This is the default catch-all rule. It always runs last and handles any review your other rules didn't match. You can change what it does, but it can't be removed or reordered."
            : "This is a protected safety rule. You can change what it does, but its conditions and on/off state are locked."}
        </div>
      )}

      {/* Condition: stars */}
      <Field
        label="Star rating"
        hint="Which ratings should this rule apply to?"
      >
        <div className="flex items-center gap-2">
          <StarSelect
            value={draft.condition.minStars}
            disabled={locked}
            onChange={(v) =>
              updateCond({
                minStars: v,
                maxStars: Math.max(v, draft.condition.maxStars) as Rating,
              })
            }
          />
          <span className="text-sm text-ink-400">to</span>
          <StarSelect
            value={draft.condition.maxStars}
            disabled={locked}
            min={draft.condition.minStars}
            onChange={(v) => updateCond({ maxStars: v })}
          />
        </div>
      </Field>

      {/* Condition: text */}
      <div className="space-y-3 rounded-xl border border-ink-200 p-3.5">
        <ToggleRow
          label="Only rating-only reviews"
          hint="Customers who left stars but no written text."
          checked={draft.condition.starOnly}
          disabled={locked}
          onChange={(starOnly) => {
            updateCond({ starOnly });
            if (starOnly) setByLength(false);
          }}
        />
        {!draft.condition.starOnly && (
          <>
            <div className="border-t border-ink-100" />
            <ToggleRow
              label="Filter by review length"
              hint="Match only reviews within a word-count range."
              checked={byLength}
              disabled={locked}
              onChange={setByLength}
            />
            {byLength && (
              <div className="grid grid-cols-2 gap-3 pt-1">
                <Field label="Min words">
                  <TextInput
                    type="number"
                    min={0}
                    disabled={locked}
                    value={draft.condition.minWords ?? ""}
                    placeholder="Any"
                    onChange={(e) =>
                      updateCond({
                        minWords:
                          e.target.value === ""
                            ? null
                            : Number(e.target.value),
                      })
                    }
                  />
                </Field>
                <Field label="Max words">
                  <TextInput
                    type="number"
                    min={0}
                    disabled={locked}
                    value={draft.condition.maxWords ?? ""}
                    placeholder="Any"
                    onChange={(e) =>
                      updateCond({
                        maxWords:
                          e.target.value === ""
                            ? null
                            : Number(e.target.value),
                      })
                    }
                  />
                </Field>
              </div>
            )}
          </>
        )}
      </div>

      {/* Action */}
      <Field label="Then ReplyPilot should">
        <div className="space-y-2">
          {(["auto_post", "draft", "notify"] as RuleAction[]).map((action) => {
            const active = draft.action === action;
            return (
              <button
                key={action}
                type="button"
                onClick={() => update({ action })}
                className={cx(
                  "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors",
                  active
                    ? "border-brand-400 bg-brand-50/60 ring-1 ring-brand-300"
                    : "border-ink-200 hover:border-ink-300"
                )}
              >
                <span
                  className={cx(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                    ACTION_TONE[action]
                  )}
                >
                  {ACTION_ICON[action]}
                </span>
                <div>
                  <p className="font-semibold text-ink-900">
                    {ACTION_LABEL[action]}
                  </p>
                  <p className="text-sm text-ink-500">
                    {ACTION_DESCRIPTION[action]}
                  </p>
                </div>
                <span
                  className={cx(
                    "ml-auto mt-1 h-4 w-4 shrink-0 rounded-full border-2",
                    active
                      ? "border-brand-600 bg-brand-600"
                      : "border-ink-300"
                  )}
                />
              </button>
            );
          })}
        </div>
      </Field>

      {/* Live preview */}
      <div className="rounded-xl bg-ink-900 px-4 py-3 text-sm text-white">
        <span className="text-ink-300">A review that's </span>
        <span className="font-semibold">{preview.stars}</span>
        <span className="text-ink-300">, </span>
        <span className="font-semibold">{preview.len}</span>
        <span className="text-ink-300"> → </span>
        <span className="font-semibold text-brand-300">
          {ACTION_LABEL[draft.action]}
        </span>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <Button block onClick={handleSave} disabled={nameError || starError}>
          {isNew ? "Create rule" : "Save changes"}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>

      {!isNew && !locked && (
        <button
          onClick={() => onDelete(draft)}
          className="flex w-full items-center justify-center gap-1.5 py-1 text-sm font-semibold text-red-600 hover:text-red-700"
        >
          <TrashIcon size={16} />
          Delete rule
        </button>
      )}
    </div>
  );
}

function StarSelect({
  value,
  onChange,
  min = 1,
  disabled,
}: {
  value: Rating;
  onChange: (v: Rating) => void;
  min?: number;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value) as Rating)}
      className="rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-[15px] font-medium text-ink-900 focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-500/10 disabled:bg-ink-50 disabled:text-ink-400"
    >
      {([1, 2, 3, 4, 5] as Rating[])
        .filter((n) => n >= min)
        .map((n) => (
          <option key={n} value={n}>
            {n} star{n > 1 ? "s" : ""}
          </option>
        ))}
    </select>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-sm font-semibold text-ink-800">{label}</p>
        {hint && <p className="text-xs text-ink-500">{hint}</p>}
      </div>
      <Switch checked={checked} onChange={onChange} disabled={disabled} label={label} />
    </div>
  );
}

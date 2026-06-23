"use client";

import { useEffect, useMemo, useState } from "react";
import { Screen, PageHeader } from "@/components/PageHeader";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, TextArea, TextInput } from "@/components/ui/Field";
import { Switch } from "@/components/ui/Switch";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Badge } from "@/components/ui/Badge";
import { StarRating } from "@/components/ui/StarRating";
import {
  RefreshIcon,
  SparkleIcon,
  XIcon,
} from "@/components/ui/icons";
import { api } from "@/lib/mockApi";
import { useToast } from "@/components/ui/Toast";
import { cx } from "@/lib/format";
import type { Review, ReplyLength, VoiceConfig, VoiceTone } from "@/lib/types";

const TONES: { value: VoiceTone; label: string }[] = [
  { value: "warm", label: "Warm" },
  { value: "friendly", label: "Friendly" },
  { value: "professional", label: "Professional" },
  { value: "playful", label: "Playful" },
  { value: "concise", label: "Concise" },
];

const LENGTHS: { value: ReplyLength; label: string }[] = [
  { value: "short", label: "Short" },
  { value: "medium", label: "Medium" },
  { value: "long", label: "Long" },
];

const SAMPLE_POSITIVE: Review = {
  id: "sample_pos",
  reviewerName: "Jordan Avery",
  rating: 5,
  text: "Three months in and I'm hooked — the coaches actually correct your form and the conditioning rounds are no joke. Down 15 pounds and stronger than ever!",
  hasText: true,
  wordCount: 27,
  date: new Date().toISOString(),
  status: "needs_review",
};

const SAMPLE_NEGATIVE: Review = {
  id: "sample_neg",
  reviewerName: "Jordan Avery",
  rating: 2,
  text: "Classes are packed and I couldn't get on a bag for half the session. Felt like I paid for a workout I didn't get.",
  hasText: true,
  wordCount: 24,
  date: new Date().toISOString(),
  status: "needs_review",
};

export function VoiceScreen() {
  const toast = useToast();
  const [config, setConfig] = useState<VoiceConfig | null>(null);
  const [saved, setSaved] = useState<VoiceConfig | null>(null);
  const [saving, setSaving] = useState(false);

  const [sampleKind, setSampleKind] = useState<"positive" | "negative">(
    "positive"
  );
  const [preview, setPreview] = useState("");
  const [previewing, setPreviewing] = useState(false);
  const [bannedInput, setBannedInput] = useState("");

  useEffect(() => {
    api.getVoiceConfig().then((c) => {
      setConfig(c);
      setSaved(c);
    });
  }, []);

  const dirty = useMemo(
    () => JSON.stringify(config) !== JSON.stringify(saved),
    [config, saved]
  );

  function update(patch: Partial<VoiceConfig>) {
    setConfig((c) => (c ? { ...c, ...patch } : c));
  }

  async function runPreview() {
    if (!config) return;
    setPreviewing(true);
    try {
      const sample =
        sampleKind === "positive" ? SAMPLE_POSITIVE : SAMPLE_NEGATIVE;
      const text = await api.previewVoice(config, sample);
      setPreview(text);
    } finally {
      setPreviewing(false);
    }
  }

  // Auto-generate a preview whenever the sample or saved config first loads.
  useEffect(() => {
    if (config) void runPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sampleKind, saved]);

  async function handleSave() {
    if (!config) return;
    setSaving(true);
    try {
      const result = await api.saveVoiceConfig(config);
      setSaved(result);
      toast.show("Brand voice saved", { tone: "success" });
    } finally {
      setSaving(false);
    }
  }

  function addBanned() {
    const phrase = bannedInput.trim();
    if (!phrase || !config) return;
    if (!config.bannedPhrases.includes(phrase)) {
      update({ bannedPhrases: [...config.bannedPhrases, phrase] });
    }
    setBannedInput("");
  }

  if (!config) {
    return (
      <Screen>
        <PageHeader title="Voice & brand" />
        <Card className="mt-5 p-6">
          <div className="skeleton h-4 w-48 rounded" />
          <div className="skeleton mt-4 h-24 w-full rounded" />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <PageHeader
        title="Voice & brand"
        subtitle="Teach the AI how your business sounds. Every draft uses these settings."
      />

      <div className="mt-5 grid gap-4 lg:grid-cols-5">
        {/* Form */}
        <div className="space-y-4 lg:col-span-3">
          <Card className="space-y-5 p-5">
            <SectionHeader title="Identity" />
            <Field label="Business name" htmlFor="biz">
              <TextInput
                id="biz"
                value={config.businessName}
                onChange={(e) => update({ businessName: e.target.value })}
              />
            </Field>
            <Field
              label="How should your replies sound?"
              htmlFor="voice"
              hint="Describe your personality, values, and any phrases you love. The AI uses this as its guide."
            >
              <TextArea
                id="voice"
                rows={4}
                value={config.voiceDescription}
                onChange={(e) => update({ voiceDescription: e.target.value })}
                placeholder="e.g. Warm and personal, like a neighbor who remembers your name…"
              />
            </Field>
          </Card>

          <Card className="space-y-5 p-5">
            <SectionHeader title="Style" />
            <Field label="Tone">
              <div className="flex flex-wrap gap-2">
                {TONES.map((t) => (
                  <Chip
                    key={t.value}
                    active={config.tone === t.value}
                    onClick={() => update({ tone: t.value })}
                  >
                    {t.label}
                  </Chip>
                ))}
              </div>
            </Field>
            <Field label="Reply length">
              <SegmentedControl<ReplyLength>
                value={config.length}
                onChange={(length) => update({ length })}
                options={LENGTHS}
              />
            </Field>
            <Field label="Sign-off" htmlFor="signoff" hint="Optional. Added to the end of replies.">
              <TextInput
                id="signoff"
                value={config.signOff}
                onChange={(e) => update({ signOff: e.target.value })}
                placeholder="— The Vanguard Team"
              />
            </Field>
          </Card>

          <Card className="space-y-1 p-5">
            <SectionHeader title="Preferences" />
            <ToggleRow
              label="Use the reviewer's first name"
              hint="Greet customers personally when their name is available."
              checked={config.useFirstName}
              onChange={(v) => update({ useFirstName: v })}
            />
            <div className="border-t border-ink-100" />
            <ToggleRow
              label="Allow emoji"
              hint="Let replies include the occasional tasteful emoji."
              checked={config.allowEmoji}
              onChange={(v) => update({ allowEmoji: v })}
            />
            <div className="border-t border-ink-100" />
            <ToggleRow
              label="Offer to make it right"
              hint="On critical reviews, invite the customer to reach out privately."
              checked={config.offerToMakeItRight}
              onChange={(v) => update({ offerToMakeItRight: v })}
            />
          </Card>

          <Card className="space-y-3 p-5">
            <SectionHeader
              title="Words to avoid"
              description="The AI will never use these phrases."
            />
            <div className="flex flex-wrap gap-2">
              {config.bannedPhrases.map((phrase) => (
                <span
                  key={phrase}
                  className="inline-flex items-center gap-1 rounded-full bg-red-50 py-1 pl-3 pr-1.5 text-sm font-medium text-red-700 ring-1 ring-inset ring-red-200"
                >
                  {phrase}
                  <button
                    onClick={() =>
                      update({
                        bannedPhrases: config.bannedPhrases.filter(
                          (p) => p !== phrase
                        ),
                      })
                    }
                    className="rounded-full p-0.5 hover:bg-red-100"
                    aria-label={`Remove ${phrase}`}
                  >
                    <XIcon size={14} />
                  </button>
                </span>
              ))}
              {config.bannedPhrases.length === 0 && (
                <span className="text-sm text-ink-400">
                  No banned phrases yet.
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <TextInput
                value={bannedInput}
                onChange={(e) => setBannedInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addBanned();
                  }
                }}
                placeholder="e.g. valued customer"
              />
              <Button variant="secondary" onClick={addBanned}>
                Add
              </Button>
            </div>
          </Card>
        </div>

        {/* Live preview */}
        <div className="lg:col-span-2">
          <div className="lg:sticky lg:top-6">
            <Card className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
                <span className="inline-flex items-center gap-1.5 text-sm font-bold text-ink-900">
                  <SparkleIcon size={16} className="text-brand-600" />
                  Live preview
                </span>
                <button
                  onClick={runPreview}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700"
                >
                  <RefreshIcon size={14} />
                  Regenerate
                </button>
              </div>
              <div className="p-4">
                <SegmentedControl<"positive" | "negative">
                  size="sm"
                  value={sampleKind}
                  onChange={setSampleKind}
                  options={[
                    { value: "positive", label: "5★ review" },
                    { value: "negative", label: "2★ review" },
                  ]}
                />
                <div className="mt-3 rounded-xl bg-ink-50 p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-ink-800">
                      {(sampleKind === "positive"
                        ? SAMPLE_POSITIVE
                        : SAMPLE_NEGATIVE
                      ).reviewerName}
                    </span>
                    <StarRating
                      rating={sampleKind === "positive" ? 5 : 2}
                      size={13}
                    />
                  </div>
                  <p className="mt-1 text-sm text-ink-600">
                    {(sampleKind === "positive"
                      ? SAMPLE_POSITIVE
                      : SAMPLE_NEGATIVE
                    ).text}
                  </p>
                </div>
                <div className="mt-3">
                  <div className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-brand-700">
                    <SparkleIcon size={13} />
                    AI reply
                  </div>
                  {previewing ? (
                    <div className="space-y-2 rounded-xl border border-brand-200 bg-brand-50/50 p-3">
                      <div className="skeleton h-3 w-full rounded" />
                      <div className="skeleton h-3 w-[85%] rounded" />
                      <div className="skeleton h-3 w-[60%] rounded" />
                    </div>
                  ) : (
                    <p className="animate-fade-in whitespace-pre-line rounded-xl border border-brand-200 bg-brand-50/50 p-3 text-sm leading-relaxed text-ink-800">
                      {preview}
                    </p>
                  )}
                </div>
                {dirty && (
                  <p className="mt-3 text-center text-xs text-ink-400">
                    Preview reflects unsaved changes.
                  </p>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Sticky save bar */}
      <div
        className={cx(
          "fixed inset-x-0 bottom-16 z-40 transition-all lg:bottom-0",
          dirty ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0 pointer-events-none"
        )}
      >
        <div className="mx-auto max-w-3xl px-4 pb-3">
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-ink-200 bg-white px-4 py-3 shadow-lg shadow-ink-900/10">
            <span className="text-sm font-medium text-ink-600">
              You have unsaved changes
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                onClick={() => setConfig(saved)}
                disabled={saving}
              >
                Discard
              </Button>
              <Button onClick={handleSave} loading={saving}>
                Save changes
              </Button>
            </div>
          </div>
        </div>
      </div>

      {dirty && <Badge tone="warning" className="sr-only">unsaved</Badge>}
    </Screen>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ring-1 ring-inset",
        active
          ? "bg-brand-600 text-white ring-brand-600"
          : "bg-white text-ink-600 ring-ink-200 hover:ring-ink-300"
      )}
    >
      {children}
    </button>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink-800">{label}</p>
        {hint && <p className="text-xs text-ink-500">{hint}</p>}
      </div>
      <Switch checked={checked} onChange={onChange} label={label} />
    </div>
  );
}

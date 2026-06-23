"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Spinner } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { StarRating } from "@/components/ui/StarRating";
import {
  BellIcon,
  CheckCircleIcon,
  CheckIcon,
  ClockIcon,
  GoogleIcon,
  ShieldIcon,
  SparkleIcon,
  ZapIcon,
} from "@/components/ui/icons";
import { useAppData } from "@/app/AppDataProvider";
import { cx } from "@/lib/format";

type Step = "welcome" | "choose" | "importing" | "autonomy" | "done";

interface MockLocation {
  id: string;
  name: string;
  address: string;
  rating: number;
  reviews: number;
}

const MOCK_LOCATIONS: MockLocation[] = [
  {
    id: "loc_1",
    name: "Vanguard Kickboxing & Fitness",
    address: "1847 SE Division St, Portland, OR 97202",
    rating: 4.8,
    reviews: 312,
  },
  {
    id: "loc_2",
    name: "Vanguard Kickboxing — Pearl District",
    address: "1130 NW Everett St, Portland, OR 97209",
    rating: 4.6,
    reviews: 124,
  },
];

export function OnboardingScreen() {
  const router = useRouter();
  const { connectGoogle, connection } = useAppData();
  const [step, setStep] = useState<Step>("welcome");
  const [selected, setSelected] = useState<MockLocation | null>(null);
  const [connecting, setConnecting] = useState(false);

  async function handleContinueWithGoogle() {
    setConnecting(true);
    // Simulate the OAuth popup round-trip.
    await new Promise((r) => setTimeout(r, 1200));
    setConnecting(false);
    setStep("choose");
  }

  async function handleChoose(loc: MockLocation) {
    setSelected(loc);
    setStep("importing");
    await connectGoogle({
      businessName: loc.name,
      locationAddress: loc.address,
      googleAccountEmail: "frontdesk@vanguardkickboxing.com",
    });
    setStep("autonomy");
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      {/* Brand panel (desktop) */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-brand-700 p-12 text-white lg:flex">
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
            <SparkleIcon size={22} />
          </span>
          <span className="text-lg font-bold">ReplyPilot</span>
        </div>
        <div className="relative z-10 max-w-md">
          <h2 className="text-3xl font-bold leading-tight">
            Never leave a Google review unanswered again.
          </h2>
          <p className="mt-4 text-brand-100">
            ReplyPilot drafts on-brand replies the moment a review lands. You
            approve the ones that matter in a single tap — the rest can post
            themselves.
          </p>
          <ul className="mt-8 space-y-3 text-sm">
            {[
              "AI replies that sound like you",
              "Approve from your phone in one tap",
              "Rules decide what's automatic vs. reviewed",
            ].map((line) => (
              <li key={line} className="flex items-center gap-2.5">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/15">
                  <CheckIcon size={14} />
                </span>
                {line}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative z-10 text-xs text-brand-200">
          Trusted by local businesses to protect their reputation.
        </p>
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-brand-500/40 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-10 h-80 w-80 rounded-full bg-brand-800/60 blur-3xl" />
      </aside>

      {/* Step content */}
      <main className="flex min-h-screen flex-col items-center justify-center px-5 py-10">
        <div className="w-full max-w-md">
          <Stepper step={step} />

          {step === "welcome" && (
            <div className="animate-fade-in text-center">
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-600/30 lg:hidden">
                <SparkleIcon size={26} />
              </div>
              <h1 className="text-2xl font-bold text-ink-900">
                Connect your Google Business Profile
              </h1>
              <p className="mt-2 text-ink-500">
                We'll import your reviews and start drafting replies. You stay
                in control of everything that gets posted.
              </p>
              {connection?.status === "connected" && (
                <div className="mt-4 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700 ring-1 ring-inset ring-emerald-200">
                  Already connected as{" "}
                  <strong>{connection.businessName}</strong>.{" "}
                  <button
                    onClick={() => router.push("/inbox")}
                    className="font-semibold underline"
                  >
                    Go to inbox
                  </button>
                </div>
              )}
              <Button
                block
                size="lg"
                variant="secondary"
                className="mt-6"
                iconLeft={<GoogleIcon size={20} />}
                loading={connecting}
                onClick={handleContinueWithGoogle}
              >
                Continue with Google
              </Button>
              <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-ink-400">
                <ShieldIcon size={14} />
                We only request access to your reviews and replies.
              </p>
            </div>
          )}

          {step === "choose" && (
            <div className="animate-fade-in">
              <h1 className="text-2xl font-bold text-ink-900">
                Choose a location
              </h1>
              <p className="mt-2 text-ink-500">
                We found these businesses on your Google account.
              </p>
              <div className="mt-6 space-y-3">
                {MOCK_LOCATIONS.map((loc) => (
                  <button
                    key={loc.id}
                    onClick={() => handleChoose(loc)}
                    className="flex w-full items-center gap-3 rounded-2xl border border-ink-200 bg-white p-4 text-left transition-colors hover:border-brand-300 hover:bg-brand-50/40"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-ink-900">
                        {loc.name}
                      </p>
                      <p className="truncate text-sm text-ink-500">
                        {loc.address}
                      </p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <StarRating
                          rating={Math.round(loc.rating) as 1 | 2 | 3 | 4 | 5}
                          size={13}
                        />
                        <span className="text-xs text-ink-500">
                          {loc.rating} · {loc.reviews} reviews
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === "importing" && (
            <div className="animate-fade-in py-6 text-center">
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                <Spinner size={28} />
              </div>
              <h1 className="text-xl font-bold text-ink-900">
                Importing your reviews…
              </h1>
              <p className="mt-2 text-ink-500">
                Pulling in reviews for{" "}
                <strong>{selected?.name}</strong> and generating your first
                drafts.
              </p>
            </div>
          )}

          {step === "autonomy" && (
            <div className="animate-fade-in">
              <h1 className="text-2xl font-bold text-ink-900">
                You're in control
              </h1>
              <p className="mt-2 text-ink-500">
                To start, <strong>every reply waits for your approval</strong>.
                As you get comfortable, you can let ReplyPilot auto-post the easy
                ones.
              </p>
              <div className="mt-6 space-y-3">
                <AutonomyRow
                  icon={<ZapIcon size={18} />}
                  tone="text-emerald-600 bg-emerald-50"
                  title="Auto-post"
                  desc="Posts the AI reply instantly. Great for short 5-star praise."
                />
                <AutonomyRow
                  icon={<ClockIcon size={18} />}
                  tone="text-amber-600 bg-amber-50"
                  title="Draft for approval"
                  desc="You review and approve before anything goes live."
                  badge={<Badge tone="brand">Your default</Badge>}
                />
                <AutonomyRow
                  icon={<BellIcon size={18} />}
                  tone="text-sky-600 bg-sky-50"
                  title="Notify only"
                  desc="Just a heads-up — no reply is drafted."
                />
              </div>
              <div className="mt-5 flex items-start gap-2 rounded-xl bg-amber-50 px-3.5 py-3 text-sm text-amber-800 ring-1 ring-inset ring-amber-200">
                <ShieldIcon size={18} className="mt-0.5 shrink-0" />
                Negative reviews (1–2 stars) always wait for your approval — even
                later when you automate the rest.
              </div>
              <Button
                block
                size="lg"
                className="mt-6"
                onClick={() => setStep("done")}
              >
                Continue
              </Button>
            </div>
          )}

          {step === "done" && (
            <div className="animate-fade-in py-6 text-center">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <CheckCircleIcon size={34} />
              </div>
              <h1 className="text-2xl font-bold text-ink-900">You're all set!</h1>
              <p className="mt-2 text-ink-500">
                We imported <strong>{selected?.reviews ?? 312} reviews</strong>{" "}
                and drafted replies for the ones that need you. Let's take a
                look.
              </p>
              <Button
                block
                size="lg"
                className="mt-6"
                onClick={() => router.push("/inbox")}
              >
                Go to my inbox
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function AutonomyRow({
  icon,
  tone,
  title,
  desc,
  badge,
}: {
  icon: React.ReactNode;
  tone: string;
  title: string;
  desc: string;
  badge?: React.ReactNode;
}) {
  return (
    <div className="flex gap-3 rounded-2xl border border-ink-200 bg-white p-3.5">
      <span
        className={cx(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          tone
        )}
      >
        {icon}
      </span>
      <div>
        <div className="flex items-center gap-2">
          <p className="font-semibold text-ink-900">{title}</p>
          {badge}
        </div>
        <p className="mt-0.5 text-sm text-ink-500">{desc}</p>
      </div>
    </div>
  );
}

function Stepper({ step }: { step: Step }) {
  const order: Step[] = ["welcome", "choose", "importing", "autonomy", "done"];
  const current = order.indexOf(step);
  return (
    <div className="mb-8 flex items-center gap-1.5">
      {order.map((s, i) => (
        <span
          key={s}
          className={cx(
            "h-1.5 flex-1 rounded-full transition-colors",
            i <= current ? "bg-brand-600" : "bg-ink-200"
          )}
        />
      ))}
    </div>
  );
}

import type {
  ActivityEntry,
  Connection,
  Draft,
  Review,
  Rule,
  VoiceConfig,
} from "./types";

const BUSINESS_NAME = "Vanguard Kickboxing & Fitness";

/** Minutes/hours/days ago as an ISO string, relative to now. */
function ago(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function words(text: string): number {
  const t = text.trim();
  return t === "" ? 0 : t.split(/\s+/).length;
}

function review(
  r: Omit<Review, "hasText" | "wordCount"> & { text: string }
): Review {
  return { ...r, hasText: r.text.trim().length > 0, wordCount: words(r.text) };
}

export const seedConnection: Connection = {
  status: "connected",
  businessName: BUSINESS_NAME,
  locationAddress: "1847 SE Division St, Portland, OR 97202",
  googleAccountEmail: "frontdesk@vanguardkickboxing.com",
  connectedAt: ago(60 * 24 * 9),
  importedReviewCount: 312,
};

export const seedReviews: Review[] = [
  review({
    id: "rv_1042",
    reviewerName: "Marcus Whitfield",
    rating: 5,
    text: "Down 22 pounds in four months and I can actually hold pads now without gassing out. Coach Dani breaks down technique so it finally clicks, and the 6am crew keeps me accountable. Best decision I've made for my health.",
    date: ago(34),
    status: "needs_review",
  }),
  review({
    id: "rv_1041",
    reviewerName: "Priya N.",
    rating: 2,
    text: "Tried to freeze my membership while injured and got billed two more months anyway. The classes are good but sorting out the contract has been a headache.",
    date: ago(96),
    status: "needs_review",
  }),
  review({
    id: "rv_1040",
    reviewerName: "Dana Kim",
    rating: 5,
    text: "",
    date: ago(140),
    status: "needs_review",
  }),
  review({
    id: "rv_1039",
    reviewerName: "Tom Alvarez",
    rating: 4,
    text: "Great coaching and the heavy bags are top notch. Only knock is the locker room gets packed right after the evening class.",
    date: ago(190),
    status: "needs_review",
  }),
  review({
    id: "rv_1038",
    reviewerName: "Greg Holloway",
    rating: 1,
    text: "Signed up for the intro week, showed up and there was no coach for the beginner class. Front desk was dismissive when I asked about it. Not a great first impression.",
    date: ago(260),
    status: "needs_review",
  }),
  review({
    id: "rv_1037",
    reviewerName: "Sofia Reyes",
    rating: 5,
    text: "Best workout in Portland! 🥊",
    date: ago(320),
    status: "needs_review",
  }),
  review({
    id: "rv_1036",
    reviewerName: "Aiden Brooks",
    rating: 5,
    text: "",
    date: ago(60 * 8),
    status: "auto_posted",
  }),
  review({
    id: "rv_1035",
    reviewerName: "Hannah Lee",
    rating: 5,
    text: "Six months in and the community here is unreal. Everyone from beginners to fighters trains together and pushes each other. The conditioning rounds are brutal in the best way.",
    date: ago(60 * 26),
    status: "auto_posted",
  }),
  review({
    id: "rv_1034",
    reviewerName: "Carlos M.",
    rating: 3,
    text: "Solid classes and good coaches, but parking around the gym is a nightmare at peak hours.",
    date: ago(60 * 30),
    status: "posted",
  }),
  review({
    id: "rv_1033",
    reviewerName: "Beatrice Yang",
    rating: 5,
    text: "Came in nervous as a total beginner and the coaches met me where I was. Three months later I'm sparring lightly and feel stronger than I have in years. Thank you for building such a welcoming place!",
    date: ago(60 * 52),
    status: "posted",
  }),
  review({
    id: "rv_1032",
    reviewerName: "Nathan Cole",
    rating: 4,
    text: "",
    date: ago(60 * 70),
    status: "notify_only",
  }),
  review({
    id: "rv_1031",
    reviewerName: "Ivy Sanderson",
    rating: 2,
    text: "Charged me twice for the same month and it took almost two weeks to get the refund processed.",
    date: ago(60 * 90),
    status: "skipped",
  }),
];

/** Pre-generated drafts keyed by reviewId. Star-only reviews start without one. */
export const seedDrafts: Draft[] = [
  {
    reviewId: "rv_1042",
    text: "Marcus, this absolutely made our day! 22 pounds and holding pads strong — that's all the work you've put in. Coach Dani will be fired up to read this, and the 6am crew clearly has your back. Keep showing up, we're right there with you! 💪\n\n— The Vanguard Team",
    status: "ready",
    editable: true,
    generatedBy: "ReplyPilot AI",
    updatedAt: ago(33),
  },
  {
    reviewId: "rv_1041",
    text: "Priya, we're sorry the membership freeze didn't go smoothly — getting billed while injured is the last thing you needed. That's on us to fix. Please email frontdesk@vanguardkickboxing.com and we'll sort out the refund and your freeze right away.\n\n— The Vanguard Team",
    status: "ready",
    editable: true,
    generatedBy: "ReplyPilot AI",
    updatedAt: ago(95),
  },
  {
    reviewId: "rv_1039",
    text: "Tom, appreciate the kind words on the coaching and the bags! You're right that the locker room gets tight after evening class — we're working on the flow there. See you in the next round! 🥊\n\n— The Vanguard Team",
    status: "ready",
    editable: true,
    generatedBy: "ReplyPilot AI",
    updatedAt: ago(189),
  },
  {
    reviewId: "rv_1038",
    text: "Greg, I'm sorry — a missing coach and a dismissive welcome is not how we do things, and that's a rough first impression we own completely. I'd like to make it right with a proper intro session on us. Please reach out to frontdesk@vanguardkickboxing.com.\n\n— The Vanguard Team",
    status: "ready",
    editable: true,
    generatedBy: "ReplyPilot AI",
    updatedAt: ago(259),
  },
  {
    reviewId: "rv_1037",
    text: "Thanks, Sofia! 🥊 Let's keep that energy going — see you on the bags!\n\n— The Vanguard Team",
    status: "ready",
    editable: true,
    generatedBy: "ReplyPilot AI",
    updatedAt: ago(319),
  },
  {
    reviewId: "rv_1036",
    text: "Thanks for the 5 stars, Aiden! We appreciate you being part of the crew. 👊\n\n— The Vanguard Team",
    status: "posted",
    editable: false,
    generatedBy: "ReplyPilot AI",
    updatedAt: ago(60 * 8),
  },
  {
    reviewId: "rv_1035",
    text: "Hannah, six months strong — and yeah, those conditioning rounds don't mess around! The community is everything to us, and members like you are exactly why it's so special. Keep pushing the crew! 🔥\n\n— The Vanguard Team",
    status: "posted",
    editable: false,
    generatedBy: "ReplyPilot AI",
    updatedAt: ago(60 * 26),
  },
  {
    reviewId: "rv_1034",
    text: "Thanks for the honest feedback, Carlos! Glad the classes and coaches are landing for you. We hear you on parking — we're looking into options with the lot next door. See you in class!\n\n— The Vanguard Team",
    status: "posted",
    editable: false,
    updatedAt: ago(60 * 29),
  },
  {
    reviewId: "rv_1033",
    text: "Beatrice, this is exactly what we're here for! From nervous beginner to light sparring in three months is huge — that's your courage and consistency. Thank you for trusting us, and welcome to the family. 💪\n\n— The Vanguard Team",
    status: "posted",
    editable: false,
    updatedAt: ago(60 * 51),
  },
];

export const seedRules: Rule[] = [
  {
    id: "rule_neg",
    name: "Negative reviews → always approve first",
    condition: {
      minStars: 1,
      maxStars: 2,
      minWords: null,
      maxWords: null,
      starOnly: false,
    },
    action: "draft",
    enabled: true,
    locked: true,
  },
  {
    id: "rule_5star_short",
    name: "5-star quick praise → auto-post",
    condition: {
      minStars: 5,
      maxStars: 5,
      minWords: null,
      maxWords: 15,
      starOnly: false,
    },
    action: "auto_post",
    enabled: true,
  },
  {
    id: "rule_5star_long",
    name: "5-star detailed → draft for approval",
    condition: {
      minStars: 5,
      maxStars: 5,
      minWords: 16,
      maxWords: null,
      starOnly: false,
    },
    action: "draft",
    enabled: true,
  },
  {
    id: "rule_staronly",
    name: "Star-only ratings → notify me",
    condition: {
      minStars: 3,
      maxStars: 5,
      minWords: null,
      maxWords: null,
      starOnly: true,
    },
    action: "notify",
    enabled: true,
  },
  {
    id: "rule_midrange",
    name: "3–4 star reviews → draft for approval",
    condition: {
      minStars: 3,
      maxStars: 4,
      minWords: null,
      maxWords: null,
      starOnly: false,
    },
    action: "draft",
    enabled: true,
  },
  {
    id: "rule_catch_all",
    name: "Everything else",
    condition: {
      minStars: 1,
      maxStars: 5,
      minWords: null,
      maxWords: null,
      starOnly: false,
    },
    action: "draft",
    enabled: true,
    locked: true,
    catchAll: true,
  },
];

export const seedVoiceConfig: VoiceConfig = {
  businessName: BUSINESS_NAME,
  voiceDescription:
    "Energetic, encouraging, and real — like a coach who knows your name and your goals. We hype people's wins specifically, never sound corporate, and always keep it motivating. Tough love when it fits, warmth always.",
  signOff: "— The Vanguard Team",
  allowEmoji: true,
  useFirstName: true,
  tone: "friendly",
  length: "medium",
  bannedPhrases: ["valued customer", "we apologize for any inconvenience"],
  offerToMakeItRight: true,
};

export const seedActivity: ActivityEntry[] = [
  {
    id: "act_1",
    type: "auto_posted",
    summary: "Auto-posted a reply to Aiden Brooks (5★)",
    detail: "Thanks for the 5 stars, Aiden! We appreciate you being part of the crew. 👊",
    date: ago(60 * 8),
    reviewId: "rv_1036",
    actor: "system",
  },
  {
    id: "act_2",
    type: "auto_posted",
    summary: "Auto-posted a reply to Hannah Lee (5★)",
    detail:
      "Hannah, six months strong — and yeah, those conditioning rounds don't mess around! The community is everything to us.",
    date: ago(60 * 26),
    reviewId: "rv_1035",
    actor: "system",
  },
  {
    id: "act_3",
    type: "edited_and_posted",
    summary: "You edited and posted a reply to Carlos M. (3★)",
    detail:
      "Thanks for the honest feedback, Carlos! Glad the classes and coaches are landing for you. We hear you on parking.",
    date: ago(60 * 29),
    reviewId: "rv_1034",
    actor: "you",
  },
  {
    id: "act_4",
    type: "approved",
    summary: "You approved a reply to Beatrice Yang (5★)",
    date: ago(60 * 51),
    reviewId: "rv_1033",
    actor: "you",
  },
  {
    id: "act_5",
    type: "notified",
    summary: "Notified you about Nathan Cole's 4★ star-only rating",
    date: ago(60 * 70),
    reviewId: "rv_1032",
    actor: "system",
  },
  {
    id: "act_6",
    type: "skipped",
    summary: "You skipped a reply to Ivy Sanderson (2★)",
    date: ago(60 * 89),
    reviewId: "rv_1031",
    actor: "you",
  },
  {
    id: "act_7",
    type: "rule_changed",
    summary: 'You enabled "5-star quick praise → auto-post"',
    date: ago(60 * 120),
    actor: "you",
  },
  {
    id: "act_8",
    type: "voice_changed",
    summary: "You updated your brand voice settings",
    date: ago(60 * 140),
    actor: "you",
  },
  {
    id: "act_9",
    type: "connected",
    summary: "Connected Vanguard Kickboxing & Fitness and imported 312 reviews",
    date: ago(60 * 24 * 9),
    actor: "you",
  },
];

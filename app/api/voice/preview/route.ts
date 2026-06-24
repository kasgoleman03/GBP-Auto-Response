import { previewReply } from "@/server/actions";
import type { Review, VoiceConfig } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { config, sampleReview } = (await req.json()) as {
    config: VoiceConfig;
    sampleReview: Review;
  };
  const text = await previewReply(config, sampleReview);
  return Response.json({ text });
}

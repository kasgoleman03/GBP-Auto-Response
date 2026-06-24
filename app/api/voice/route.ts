import * as repo from "@/server/db/repo";
import type { VoiceConfig } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await repo.getVoiceConfig());
}

export async function POST(req: Request) {
  const config = (await req.json()) as VoiceConfig;
  return Response.json(await repo.saveVoiceConfig(config));
}

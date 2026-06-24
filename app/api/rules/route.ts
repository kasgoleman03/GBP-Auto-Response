import * as repo from "@/server/db/repo";
import type { Rule } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await repo.listRules());
}

export async function POST(req: Request) {
  const rule = (await req.json()) as Rule;
  return Response.json(await repo.saveRule(rule));
}

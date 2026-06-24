import * as repo from "@/server/db/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await repo.getInboxStats());
}

import * as repo from "@/server/db/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { orderedIds } = (await req.json()) as { orderedIds: string[] };
  return Response.json(await repo.reorderRules(orderedIds));
}

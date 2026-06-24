import * as repo from "@/server/db/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const draft = await repo.getDraft(id);
  if (!draft) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  return Response.json(draft);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { text } = (await req.json()) as { text: string };
  return Response.json(await repo.saveDraft(id, text));
}

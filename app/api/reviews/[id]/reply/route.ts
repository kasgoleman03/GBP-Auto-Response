import * as repo from "@/server/db/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Post an owner-written reply (POST { text }). */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { text } = (await req.json()) as { text: string };
  return Response.json(await repo.postOwnReply(id, text));
}

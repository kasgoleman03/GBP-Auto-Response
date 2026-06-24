import * as repo from "@/server/db/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const review = await repo.getReview(id);
  if (!review) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  return Response.json(review);
}

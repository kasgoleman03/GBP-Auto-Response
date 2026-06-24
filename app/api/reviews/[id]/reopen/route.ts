import { reopenReview } from "@/server/actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Reopen a skipped/replied review and generate a fresh draft. */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return Response.json(await reopenReview(id));
}

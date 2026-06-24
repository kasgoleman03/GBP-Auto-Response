import * as repo from "@/server/db/repo";
import type { ReviewFilter } from "@/lib/api";
import type { Rating, ReviewStatus } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const filter: ReviewFilter = {};
  const status = sp.get("status");
  if (status) filter.status = status as ReviewStatus | "all";
  if (sp.has("minRating")) filter.minRating = Number(sp.get("minRating")) as Rating;
  if (sp.has("maxRating")) filter.maxRating = Number(sp.get("maxRating")) as Rating;
  if (sp.has("hasText")) filter.hasText = sp.get("hasText") === "true";
  const search = sp.get("search");
  if (search) filter.search = search;

  return Response.json(await repo.listReviews(filter));
}

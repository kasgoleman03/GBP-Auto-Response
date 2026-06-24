import * as repo from "@/server/db/repo";
import { verifyReviewToken } from "@/server/token";
import { magicPage } from "@/server/magicResponse";
import { serverConfig } from "@/server/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Magic-link approval from an email (GET ?token=...). Returns an HTML page. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = new URL(req.url).searchParams.get("token");
  const openInAppUrl = serverConfig.appBaseUrl
    ? `${serverConfig.appBaseUrl}/review/${id}`
    : undefined;

  const check = await verifyReviewToken(token, id);
  if (!check.valid) {
    return magicPage({
      ok: false,
      title: "Link not valid",
      message:
        check.reason === "expired"
          ? "This approval link has expired. Open the review in the app to reply."
          : "This approval link is invalid. Open the review in the app to reply.",
      openInAppUrl,
      status: 401,
    });
  }

  try {
    await repo.approveAndPost(id);
    return magicPage({
      ok: true,
      title: "Reply posted",
      message: "Your reply has been approved and posted to Google.",
      openInAppUrl,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return magicPage({
      ok: false,
      title: "Could not post",
      message,
      openInAppUrl,
      status: 500,
    });
  }
}

/** In-app approval (POST { text? }). Returns JSON. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let text: string | undefined;
  try {
    const body = (await req.json()) as { text?: string };
    text = body.text;
  } catch {
    /* no body — approve the stored draft as-is */
  }
  return Response.json(await repo.approveAndPost(id, text));
}

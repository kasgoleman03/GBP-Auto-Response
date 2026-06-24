import { regenerateAndSave } from "@/server/actions";
import { verifyReviewToken } from "@/server/token";
import { magicPage } from "@/server/magicResponse";
import { serverConfig } from "@/server/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Magic-link "Redo" from an email (GET ?token=...). Returns an HTML page. */
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
          ? "This link has expired. Open the review in the app to regenerate."
          : "This link is invalid. Open the review in the app to regenerate.",
      openInAppUrl,
      status: 401,
    });
  }

  try {
    await regenerateAndSave(id);
    return magicPage({
      ok: true,
      title: "New draft ready",
      message: "A fresh reply has been generated. Review and approve it in the app.",
      openInAppUrl,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return magicPage({
      ok: false,
      title: "Could not regenerate",
      message,
      openInAppUrl,
      status: 500,
    });
  }
}

/** In-app regenerate (POST). Returns the new draft as JSON. */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return Response.json(await regenerateAndSave(id));
}

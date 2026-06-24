/**
 * Reports whether a database is configured. The front-end calls this once to
 * decide between real DB data and the local mock/localStorage fallback.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ db: !!process.env.POSTGRES_URL });
}

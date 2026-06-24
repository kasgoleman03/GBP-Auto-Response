import * as repo from "@/server/db/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await repo.getConnection());
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    businessName: string;
    locationAddress: string;
    googleAccountEmail: string;
  };
  return Response.json(await repo.connectGoogle(body));
}

export async function DELETE() {
  return Response.json(await repo.disconnect());
}

import { verifyReceipt } from "@/lib/receipt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    return Response.json(verifyReceipt(await req.json()));
  } catch {
    return Response.json({ valid: false, reason: "not valid JSON" }, { status: 400 });
  }
}

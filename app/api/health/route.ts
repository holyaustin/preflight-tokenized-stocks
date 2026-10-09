import { recentCalls } from "@/lib/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ ok: true, hasKey: Boolean(process.env.OC_API_KEY && process.env.OC_SECRET_KEY), recentCalls: recentCalls.slice(-5) });
}

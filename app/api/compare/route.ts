import { compareVenues, isAddress } from "@/lib/preflight";
import { clientIp, limited } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    if (limited(clientIp(req), 6)) return Response.json({ error: "Too many requests. Try again in a minute." }, { status: 429 });
    const q = new URL(req.url).searchParams;
    const ticker = (q.get("ticker") ?? "").trim();
    const usd = Number(q.get("usd") ?? "5");
    const wallet = (q.get("wallet") ?? "").trim();
    if (!/^[A-Za-z.]{1,10}$/.test(ticker)) return Response.json({ error: "ticker must be 1-10 letters" }, { status: 400 });
    if (!(usd > 0 && usd <= 100000)) return Response.json({ error: "usd must be between 0 and 100000" }, { status: 400 });
    if (!isAddress(wallet)) return Response.json({ error: "wallet must be a 0x BSC address (40 hex characters)" }, { status: 400 });
    return Response.json(await compareVenues({ ticker, usd, wallet, policy: q.get("policy") ?? "balanced" }));
  } catch (e: any) {
    return Response.json({ error: e?.message ?? "internal error" }, { status: 500 });
  }
}

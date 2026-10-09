import crypto from "node:crypto";
import { PREFLIGHT_VERSION } from "./config";

// Canonical JSON (sorted keys) so the same content always hashes the same.
export function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o).sort().filter((k) => o[k] !== undefined).map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`).join(",")}}`;
  }
  return JSON.stringify(v);
}

export interface Receipt {
  id: string; // first 16 hex chars of the hash
  hash: string; // sha256 of the canonical body
  mac?: string; // optional HMAC-SHA256 if RECEIPT_SECRET is set (authenticates who issued it)
  version: string;
  body: unknown;
}

const sha = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

export function makeReceipt(body: unknown): Receipt {
  const hash = sha(canonical(body));
  const secret = process.env.RECEIPT_SECRET;
  return {
    id: hash.slice(0, 16),
    hash,
    ...(secret ? { mac: crypto.createHmac("sha256", secret).update(hash).digest("hex") } : {}),
    version: PREFLIGHT_VERSION,
    body,
  };
}

export function verifyReceipt(r: Receipt): { valid: boolean; macChecked: boolean; reason?: string } {
  if (!r?.body || !r.hash) return { valid: false, macChecked: false, reason: "malformed receipt" };
  if (sha(canonical(r.body)) !== r.hash) return { valid: false, macChecked: false, reason: "content does not match hash" };
  const secret = process.env.RECEIPT_SECRET;
  if (r.mac) {
    if (!secret) return { valid: true, macChecked: false, reason: "hash OK; set RECEIPT_SECRET to check the issuer MAC" };
    const ok = crypto.createHmac("sha256", secret).update(r.hash).digest("hex") === r.mac;
    return { valid: ok, macChecked: true, reason: ok ? undefined : "MAC mismatch" };
  }
  return { valid: true, macChecked: false };
}

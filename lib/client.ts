import crypto from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";

// Authentication doc: the base URL includes /build, and the SIGNED requestPath must include it too.
const BASE = "https://web3.binance.com/build";
const PREFIX = "/build";

export class W3Error extends Error {
  constructor(public code: number | string, msg: string, public http?: number) {
    super(`${code}: ${msg}`);
  }
}

export interface CallLogEntry {
  method: string;
  path: string;
  http: number;
  code: number | string;
  ms: number;
}

// Every API call made during one check is recorded here. It feeds the receipt AND your
// Developer Experience Report (latencies, error codes).
const als = new AsyncLocalStorage<CallLogEntry[]>();
export const recentCalls: CallLogEntry[] = [];

export async function withTrace<T>(fn: () => Promise<T>): Promise<{ result: T; calls: CallLogEntry[] }> {
  const calls: CallLogEntry[] = [];
  const result = await als.run(calls, fn);
  return { result, calls };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Docs: default 5 requests/second per endpoint. Space calls ~220ms apart.
let lastSlot = 0;
async function throttle(gapMs = 220) {
  const now = Date.now();
  const slot = Math.max(now, lastSlot + gapMs);
  lastSlot = slot;
  if (slot > now) await sleep(slot - now);
}

function creds() {
  const key = process.env.OC_API_KEY;
  const secret = process.env.OC_SECRET_KEY;
  if (!key || !secret) throw new W3Error("NO_CREDS", "Set OC_API_KEY and OC_SECRET_KEY");
  return { key, secret };
}

async function call(
  method: "GET" | "POST",
  path: string,
  params: Record<string, string> = {},
  body?: unknown,
  attempt = 0
): Promise<any> {
  const { key, secret } = creds();
  // Raw URL-encoded query, exactly as sent on the wire (no re-ordering).
  const qs = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
  const full = qs ? `${path}?${qs}` : path;
  const bodyStr = body === undefined ? "" : JSON.stringify(body);

  await throttle();
  const ts = new Date().toISOString(); // ISO 8601, milliseconds, UTC
  const preHash = ts + method + PREFIX + full + bodyStr;
  const sig = crypto.createHmac("sha256", secret).update(preHash, "utf8").digest("base64");

  const t0 = Date.now();
  const res = await fetch(BASE + full, {
    method,
    cache: "no-store",
    headers: {
      "X-OC-APIKEY": key,
      "X-OC-TIMESTAMP": ts,
      "X-OC-SIGN": sig,
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? bodyStr : undefined,
  });

  if (res.status === 429 && attempt < 2) {
    const wait = Number(res.headers.get("Retry-After") ?? "1");
    await sleep(Math.max(1, wait) * 1000);
    return call(method, path, params, body, attempt + 1);
  }

  const json: any = await res.json().catch(() => null);
  const code = json?.code ?? res.status;
  const entry: CallLogEntry = { method, path, http: res.status, code, ms: Date.now() - t0 };
  als.getStore()?.push(entry);
  recentCalls.push(entry);
  if (recentCalls.length > 200) recentCalls.shift();

  if (!res.ok || !json || json.code !== 0) {
    // 40304 = "Service not available due to compliance restriction": the API refused this server's location.
    const hint = String(code) === "40304" ? " (the API blocked this server's region: change the hosting Function Region, then redeploy)" : "";
    throw new W3Error(code, (json?.msg ?? res.statusText) + hint, res.status);
  }
  return json.data;
}

export const w3get = (path: string, params: Record<string, string> = {}) => call("GET", path, params);
export const w3post = (path: string, body: unknown) => call("POST", path, {}, body);

// Tiny TTL cache so repeated checks don't burn your rate limit.
const cache = new Map<string, { exp: number; val: unknown }>();
export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.exp > Date.now()) return hit.val as T;
  const val = await fn();
  cache.set(key, { exp: Date.now() + ttlMs, val });
  return val;
}

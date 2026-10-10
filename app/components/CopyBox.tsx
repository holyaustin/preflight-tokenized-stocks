"use client";

import { useEffect, useState } from "react";

// If NEXT_PUBLIC_SITE_URL is set (for example https://preflight-tokenized-stocks.vercel.app), the box shows that address.
// Otherwise it falls back to whatever address the page is running on.
// NEXT_PUBLIC_ values are baked in at build time, so redeploy after changing it.
const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");

export default function CopyBox({ label, value, path }: { label: string; value?: string; path?: string }) {
  const [text, setText] = useState(value ?? (SITE && path ? `${SITE}${path}` : ""));
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (path) setText(`${SITE || window.location.origin}${path}`);
  }, [path]);
  return (
    <div className="copybox">
      <span className="label">{label}</span>
      <div>
        <code>{text || "..."}</code>
        <button
          type="button"
          className="btn ghost small"
          onClick={async () => {
            try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* clipboard blocked */ }
          }}
        >{done ? "Copied" : "Copy"}</button>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";

export default function CopyBox({ label, value, path }: { label: string; value?: string; path?: string }) {
  const [text, setText] = useState(value ?? "");
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (path) setText(`${window.location.origin}${path}`);
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

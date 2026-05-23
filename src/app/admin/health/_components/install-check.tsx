"use client";

import { useEffect, useMemo, useState } from "react";

type InstallResult =
  | { ok: false; error: string; stage?: string }
  | {
      ok: true;
      status: number;
      finalUrl: string;
      snippetFound: boolean;
      hasAsync: boolean;
      hasDefer: boolean;
      src: string | null;
      anyEscapeHatchTag: boolean;
      wrongMerchantTags: Array<{ merchantId: string; src?: string }>;
    };

export function InstallCheck({
  domain,
  merchantId,
}: {
  domain: string | null;
  merchantId: string;
}) {
  const [check, setCheck] = useState<{ targetUrl: string; result: InstallResult } | null>(null);
  const targetUrl = useMemo(() => normalizeUrl(domain), [domain]);

  useEffect(() => {
    if (!targetUrl) return;
    let cancelled = false;
    fetch("/api/admin/install-check", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: targetUrl, merchantId }),
    })
      .then((r) => r.json())
      .then((json: InstallResult) => {
        if (!cancelled) setCheck({ targetUrl, result: json });
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setCheck({
            targetUrl,
            result: { ok: false, error: e instanceof Error ? e.message : "check_failed" },
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [merchantId, targetUrl]);

  if (!targetUrl) {
    return <Status tone="warn" label="No domain" detail="Add storefront domain" />;
  }
  if (!check || check.targetUrl !== targetUrl) {
    return <Status tone="muted" label="Checking" detail="Fetching storefront head" />;
  }
  const { result } = check;
  if (!result.ok) {
    return <Status tone="warn" label="Fetch failed" detail={result.stage ? `${result.stage}: ${result.error}` : result.error} />;
  }
  if (!result.snippetFound && result.anyEscapeHatchTag) {
    const found = result.wrongMerchantTags.map((t) => t.merchantId.slice(0, 8)).join(", ");
    return <Status tone="danger" label="Wrong ID" detail={`Found ${found}`} />;
  }
  if (!result.snippetFound) {
    return <Status tone="danger" label="Missing" detail="No snippet in head" />;
  }
  if (result.hasAsync || result.hasDefer) {
    return <Status tone="danger" label="Async/defer" detail="Redirect will be late" />;
  }
  return <Status tone="success" label="Installed" detail={result.src ?? "Sync snippet in head"} />;
}

function Status({
  tone,
  label,
  detail,
}: {
  tone: "success" | "warn" | "danger" | "muted";
  label: string;
  detail: string;
}) {
  const cls =
    tone === "success"
      ? "border-[var(--color-success)]/35 bg-[color-mix(in_srgb,var(--color-success)_8%,transparent)] text-[var(--color-success)]"
      : tone === "danger"
        ? "border-[var(--color-danger)]/35 bg-[var(--color-danger-soft)]/35 text-[var(--color-danger)]"
        : tone === "warn"
          ? "border-[var(--color-accent)]/35 bg-[color-mix(in_srgb,var(--color-accent)_8%,transparent)] text-[var(--color-accent)]"
          : "border-[var(--color-border-soft)] bg-[var(--color-bg-elev)]/45 text-[var(--color-fg-muted)]";

  return (
    <div className={`rounded-lg border px-3 py-2 ${cls}`}>
      <div className="text-[10px] uppercase tracking-[0.14em] font-mono">{label}</div>
      <div className="mt-1 truncate text-[11px] font-mono text-[var(--color-fg-muted)]" title={detail}>
        {detail}
      </div>
    </div>
  );
}

function normalizeUrl(domain: string | null) {
  if (!domain) return null;
  const raw = domain.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw.startsWith("http://") || raw.startsWith("https://") ? raw : `https://${raw}`);
    return url.toString();
  } catch {
    return null;
  }
}

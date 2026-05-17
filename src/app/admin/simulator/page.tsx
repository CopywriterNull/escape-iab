import { getSupabaseAdmin } from "@/lib/supabase/server";
import { TraceRunner } from "./_components/trace-runner";

export const dynamic = "force-dynamic";

export default async function AdminSimulator() {
  const admin = getSupabaseAdmin();
  const { data } = await admin!
    .from("merchants")
    .select("id, name, domain")
    .order("created_at", { ascending: false });

  const merchants = ((data ?? []) as Array<{ id: string; name: string | null; domain: string | null }>);

  return (
    <div className="space-y-7">
      <div>
        <div className="eyebrow">Admin · Simulator</div>
        <h1 className="mt-2 h-display text-[28px] tracking-tight">Snippet trace runner</h1>
        <p className="mt-1 text-[13px] text-[var(--color-fg-dim)] max-w-2xl leading-relaxed">
          Run the deployed snippet against a synthetic visitor — pick a merchant, a user-agent preset, a URL, and any cookies the test visitor should already have. The compiled JS executes in a sandboxed scope where every beacon, cookie write, sessionStorage write, and{" "}
          <code className="font-mono">location.replace</code> is captured into a step-by-step trace.
        </p>
        <p className="mt-2 text-[12px] text-[var(--color-fg-muted)] max-w-2xl leading-relaxed">
          Tests every gate up to the redirect call — paid_only / kill switch / bucket assignment / eh_force / eh_a sticky / async detection. The one thing it <em>can&apos;t</em> verify is whether iOS actually honors the{" "}
          <code className="font-mono">instagram://extbrowser/?url=…</code> handoff once we fire it; that&apos;s an OS-level behavior, not snippet logic.
        </p>
      </div>

      {merchants.length === 0 ? (
        <div className="card p-8 text-center text-[13px] text-[var(--color-fg-dim)]">
          No merchants in the database yet. Provision one from{" "}
          <a className="underline-offset-2 underline" href="/admin/merchants">/admin/merchants</a> first.
        </div>
      ) : (
        <TraceRunner merchants={merchants} />
      )}
    </div>
  );
}

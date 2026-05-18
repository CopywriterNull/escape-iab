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
          Two independent checks every run: (1) <strong>live install check</strong> — server-side fetches the target URL with an IG iOS UA and grep&apos;s the HTML for the snippet tag. Answers &quot;is it actually deployed.&quot; (2) <strong>synthetic trace</strong> — the production snippet body executes in a sandboxed scope against the chosen UA + URL + cookies. Answers &quot;would it escape if it ran.&quot;
        </p>
        <p className="mt-2 text-[12px] text-[var(--color-fg-muted)] max-w-2xl leading-relaxed">
          Together they cover every gate up to the redirect call — install status, async/defer detection, paid_only / kill switch / bucket assignment / eh_force / eh_a sticky. The one thing they <em>can&apos;t</em> verify is whether iOS actually honors the{" "}
          <code className="font-mono">instagram://extbrowser/?url=…</code> handoff once we fire it; that&apos;s OS-level, needs one real-phone test per build.
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

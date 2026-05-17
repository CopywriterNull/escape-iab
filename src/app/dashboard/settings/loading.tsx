// Streams immediately on navigation to /dashboard/settings so the user
// sees structure within ~50ms instead of waiting for the merchant +
// impersonation Supabase round trips. Mirrors the real form layout to
// prevent re-flow when data arrives.

function Block({ className = "" }: { className?: string }) {
  return <div className={`rounded bg-[var(--color-border-soft)]/70 animate-pulse ${className}`} />;
}

export default function SettingsLoading() {
  return (
    <div className="space-y-8">
      <div>
        <Block className="h-3 w-24" />
        <Block className="mt-3 h-10 w-40" />
        <Block className="mt-3 h-3 w-[min(28rem,80%)]" />
      </div>
      <Block className="h-10 w-full" />
      <div className="card-hi p-7 space-y-7">
        <div className="grid md:grid-cols-2 gap-6">
          <Field />
          <Field />
        </div>
        <div className="border-t border-[var(--color-border-soft)] pt-7 space-y-5">
          <Toggle />
          <Toggle />
          <SliderRow />
          <Toggle />
          <Field />
        </div>
        <div className="border-t border-[var(--color-border-soft)] pt-7">
          <Toggle />
        </div>
        <Block className="h-9 w-32" />
      </div>
    </div>
  );
}

function Field() {
  return (
    <div className="space-y-2">
      <Block className="h-3 w-24" />
      <Block className="h-3 w-44" />
      <Block className="h-10 w-full" />
    </div>
  );
}

function Toggle() {
  return (
    <div className="flex items-start justify-between gap-6">
      <div className="flex-1 space-y-1.5">
        <Block className="h-3.5 w-48" />
        <Block className="h-2.5 w-[min(28rem,90%)]" />
      </div>
      <Block className="h-6 w-11 rounded-full" />
    </div>
  );
}

function SliderRow() {
  return (
    <div className="space-y-3">
      <Block className="h-3.5 w-32" />
      <Block className="h-2 w-full" />
      <Block className="h-3 w-full" />
    </div>
  );
}

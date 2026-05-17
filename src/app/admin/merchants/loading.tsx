function Block({ className = "" }: { className?: string }) {
  return <div className={`rounded bg-[var(--color-border-soft)]/70 animate-pulse ${className}`} />;
}

export default function MerchantsLoading() {
  return (
    <div className="space-y-7">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <Block className="h-3 w-32" />
          <Block className="mt-3 h-8 w-44" />
          <Block className="mt-2 h-2.5 w-20" />
        </div>
      </div>
      {/* New merchant form */}
      <div className="rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-card)] p-5 space-y-4">
        <Block className="h-2.5 w-32" />
        <div className="grid sm:grid-cols-2 gap-3">
          <Block className="h-10" />
          <Block className="h-10" />
        </div>
        <Block className="h-9 w-28" />
      </div>
      {/* Merchant rows */}
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-card)] p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-2 flex-1">
              <Block className="h-4 w-48" />
              <Block className="h-2.5 w-64" />
            </div>
            <Block className="h-2.5 w-16" />
          </div>
          <Block className="h-12 w-full rounded-lg" />
          <div className="flex gap-2">
            <Block className="h-8 w-24" />
            <Block className="h-8 w-24" />
            <Block className="h-8 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

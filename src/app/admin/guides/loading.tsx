function Block({ className = "" }: { className?: string }) {
  return <div className={`rounded bg-[var(--color-border-soft)]/70 animate-pulse ${className}`} />;
}

export default function GuidesLoading() {
  return (
    <div className="space-y-7">
      <div>
        <Block className="h-3 w-28" />
        <Block className="mt-3 h-8 w-56" />
        <Block className="mt-2 h-3 w-[min(36rem,90%)]" />
      </div>
      <div className="space-y-3">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className="rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-card)] px-5 py-3.5 flex items-center justify-between gap-4">
            <div className="space-y-1.5 flex-1">
              <div className="flex items-center gap-2">
                <Block className="h-3 w-12" />
                <Block className="h-3 w-44" />
              </div>
              <Block className="h-2.5 w-[min(28rem,80%)]" />
            </div>
            <Block className="h-2.5 w-14" />
          </div>
        ))}
      </div>
    </div>
  );
}

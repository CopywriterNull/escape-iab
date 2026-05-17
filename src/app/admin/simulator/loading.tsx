function Block({ className = "" }: { className?: string }) {
  return <div className={`rounded bg-[var(--color-border-soft)]/70 animate-pulse ${className}`} />;
}

export default function SimulatorLoading() {
  return (
    <div className="space-y-7">
      <div>
        <Block className="h-3 w-32" />
        <Block className="mt-3 h-8 w-72" />
        <Block className="mt-2 h-3 w-[min(40rem,90%)]" />
        <Block className="mt-2 h-3 w-[min(36rem,80%)]" />
      </div>
      <div className="grid lg:grid-cols-[420px_1fr] gap-6">
        {/* Control panel */}
        <div className="card-hi p-5 space-y-5">
          <div className="space-y-2">
            <Block className="h-2.5 w-20" />
            <Block className="h-4 w-32" />
          </div>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-2">
              <Block className="h-3 w-28" />
              <Block className="h-2.5 w-44" />
              <Block className="h-10 w-full" />
            </div>
          ))}
          <Block className="h-11 w-full" />
        </div>
        {/* Result panel */}
        <div className="rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-card)] px-6 py-10">
          <div className="text-center space-y-2">
            <Block className="h-3 w-64 mx-auto" />
            <Block className="h-3 w-48 mx-auto" />
          </div>
        </div>
      </div>
    </div>
  );
}

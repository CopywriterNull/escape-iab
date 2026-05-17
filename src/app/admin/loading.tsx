// Admin overview shares the layout chrome with the rest of /admin/*,
// but each route segment ships its own loading.tsx so navigation within
// /admin feels instant.

function Block({ className = "" }: { className?: string }) {
  return <div className={`rounded bg-[var(--color-border-soft)]/70 animate-pulse ${className}`} />;
}

export default function AdminLoading() {
  return (
    <div className="space-y-7">
      <Heading />
      {/* KPI tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card p-4 space-y-2">
            <Block className="h-2.5 w-20" />
            <Block className="h-6 w-24" />
            <Block className="h-2.5 w-16" />
          </div>
        ))}
      </div>
      {/* Shortcuts row */}
      <div className="grid sm:grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <Block key={i} className="h-24" />
        ))}
      </div>
      {/* Recent merchants */}
      <div className="rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-card)] overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--color-border-soft)] flex items-center justify-between">
          <Block className="h-3 w-36" />
          <Block className="h-2.5 w-16" />
        </div>
        <ul>
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="px-5 py-3 border-b border-[var(--color-border-soft)] last:border-b-0 flex items-center justify-between gap-3">
              <div className="space-y-1.5 flex-1">
                <Block className="h-3 w-40" />
                <Block className="h-2.5 w-28" />
              </div>
              <Block className="h-2.5 w-12" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Heading() {
  return (
    <div>
      <Block className="h-3 w-20" />
      <Block className="mt-3 h-8 w-40" />
      <Block className="mt-2 h-3 w-72" />
    </div>
  );
}

function Block({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`rounded bg-[var(--color-border-soft)]/70 animate-pulse ${className}`} style={style} />;
}

export default function DiagnosticsLoading() {
  return (
    <div className="space-y-7">
      <div>
        <Block className="h-3 w-36" />
        <Block className="mt-3 h-8 w-56" />
        <Block className="mt-2 h-3 w-[min(40rem,90%)]" />
      </div>
      <div className="rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-card)] overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[1.4fr_0.7fr_0.7fr_0.7fr_0.7fr_0.9fr] gap-3 px-5 py-3 border-b border-[var(--color-border-soft)]">
          {[40, 24, 32, 24, 32, 28].map((w, i) => (
            <Block key={i} className="h-2.5" style={{ width: `${w}px` } as React.CSSProperties} />
          ))}
        </div>
        {/* Rows */}
        <ul>
          {[0, 1, 2, 3, 4].map((i) => (
            <li key={i} className="grid grid-cols-[1.4fr_0.7fr_0.7fr_0.7fr_0.7fr_0.9fr] gap-3 px-5 py-3 border-b border-[var(--color-border-soft)] last:border-b-0 items-center">
              <div className="space-y-1.5">
                <Block className="h-3 w-32" />
                <Block className="h-2 w-44" />
              </div>
              <Block className="h-4 w-14" />
              <Block className="h-4 w-12" />
              <Block className="h-4 w-14" />
              <Block className="h-4 w-12" />
              <div className="text-right space-y-1">
                <Block className="h-3 w-10 ml-auto" />
                <Block className="h-2 w-20 ml-auto" />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// Content-shaped skeletons. Each mirrors the real component's layout so the
// page never re-flows when data arrives.

function Block({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded bg-[var(--color-border-soft)]/70 animate-pulse ${className}`}
    />
  );
}

function CardShell({
  title,
  action,
  children,
}: {
  title?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-[var(--color-card)] border border-[var(--color-border-soft)] rounded-lg">
      {title || action ? (
        <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--color-border-soft)]">
          {title}
          {action}
        </header>
      ) : null}
      <div className="px-4 py-3">{children}</div>
    </section>
  );
}

export function HeroSkeleton() {
  return (
    <div className="px-1 py-2">
      <Block className="h-3 w-32" />
      <Block className="mt-3 h-12 w-40" />
      <Block className="mt-3 h-3 w-72" />
    </div>
  );
}

export function BannerSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-md border border-[var(--color-border-soft)] bg-[var(--color-card)]">
      <Block className="size-1.5 rounded-full shrink-0" />
      <div className="min-w-0 space-y-1.5">
        <Block className="h-3 w-56" />
        <Block className="h-2.5 w-40" />
      </div>
    </div>
  );
}

export function KPIGridSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="bg-[var(--color-card)] border border-[var(--color-border-soft)] rounded-lg px-4 py-3"
        >
          <Block className="h-2.5 w-20" />
          <Block className="mt-3 h-6 w-24" />
          <Block className="mt-2 h-2.5 w-16" />
        </div>
      ))}
    </div>
  );
}

export function FunnelSkeleton() {
  return (
    <CardShell
      title={<Block className="h-3.5 w-32" />}
    >
      <div className="hidden sm:grid grid-cols-12 px-0 py-2 border-b border-[var(--color-border-soft)] -mx-4 px-4">
        <div className="col-span-4"><Block className="h-2.5 w-16" /></div>
        <div className="col-span-3 flex justify-end"><Block className="h-2.5 w-20" /></div>
        <div className="col-span-3 flex justify-end"><Block className="h-2.5 w-20" /></div>
        <div className="col-span-1 flex justify-end"><Block className="h-2.5 w-10" /></div>
        <div className="col-span-1 flex justify-end"><Block className="h-2.5 w-6" /></div>
      </div>
      <div className="-mx-4">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="border-b border-[var(--color-border-soft)] last:border-b-0"
          >
            <div className="hidden sm:grid grid-cols-12 items-center px-4 py-2.5">
              <div className="col-span-4 space-y-1.5">
                <Block className="h-3 w-32" />
                <Block className="h-2.5 w-20" />
              </div>
              <div className="col-span-3 flex flex-col items-end gap-1.5">
                <Block className="h-3 w-14" />
                <Block className="h-2.5 w-10" />
              </div>
              <div className="col-span-3 flex flex-col items-end gap-1.5">
                <Block className="h-3 w-14" />
                <Block className="h-2.5 w-10" />
              </div>
              <div className="col-span-1 flex justify-end"><Block className="h-3 w-10" /></div>
              <div className="col-span-1 flex justify-end"><Block className="h-2.5 w-8" /></div>
            </div>
            <div className="sm:hidden px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 space-y-1.5">
                  <Block className="h-3 w-28" />
                  <Block className="h-2.5 w-20" />
                </div>
                <Block className="h-3 w-10" />
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Block className="h-10 rounded-md" />
                <Block className="h-10 rounded-md" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </CardShell>
  );
}

export function SourcesSkeleton({ rangeLabel }: { rangeLabel?: string }) {
  return (
    <CardShell
      title={<Block className="h-3.5 w-24" />}
      action={
        rangeLabel ? (
          <div className="text-[10.5px] uppercase tracking-[0.18em] font-semibold text-[var(--color-fg-muted)]">
            {rangeLabel}
          </div>
        ) : (
          <Block className="h-3 w-10" />
        )
      }
    >
      <div className="-mx-4 -my-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="flex items-center justify-between gap-4 px-4 py-2.5 border-b border-[var(--color-border-soft)] last:border-b-0"
          >
            <div className="min-w-0 space-y-1.5">
              <Block className="h-3 w-24" />
              <Block className="h-2.5 w-32" />
            </div>
            <div className="text-right shrink-0 space-y-1.5">
              <Block className="h-3 w-12 ml-auto" />
              <Block className="h-2.5 w-10 ml-auto" />
            </div>
          </div>
        ))}
      </div>
    </CardShell>
  );
}

export function ChartSkeleton({ rangeLabel }: { rangeLabel?: string }) {
  return (
    <CardShell
      title={<Block className="h-3.5 w-44" />}
      action={
        rangeLabel ? (
          <div className="text-[10.5px] uppercase tracking-[0.18em] font-semibold text-[var(--color-fg-muted)]">
            {rangeLabel}
          </div>
        ) : (
          <Block className="h-3 w-10" />
        )
      }
    >
      <Block className="h-[110px] w-full rounded" />
      <div className="mt-2 flex items-center gap-3">
        <Block className="h-2.5 w-20" />
        <Block className="h-2.5 w-16" />
      </div>
    </CardShell>
  );
}

export function SampleSizeSkeleton() {
  return (
    <CardShell
      title={<Block className="h-3.5 w-24" />}
      action={<Block className="h-3 w-32" />}
    >
      <div className="flex items-center justify-between gap-3 mb-2">
        <Block className="h-3 w-12" />
        <Block className="h-3 w-24" />
      </div>
      <Block className="h-1.5 w-full" />
      <Block className="mt-3 h-2.5 w-2/3" />
    </CardShell>
  );
}

export function ActivitySkeleton() {
  return (
    <CardShell
      title={<Block className="h-3.5 w-28" />}
      action={<Block className="h-3 w-10" />}
    >
      <div className="-mx-4 -my-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="px-4 py-2.5 border-b border-[var(--color-border-soft)] last:border-b-0"
          >
            {/* desktop */}
            <div className="hidden sm:grid grid-cols-12 items-center gap-3">
              <div className="col-span-2"><Block className="h-4 w-16" /></div>
              <div className="col-span-3 flex items-center gap-1.5">
                <Block className="h-4 w-16" />
              </div>
              <div className="col-span-3"><Block className="h-2.5 w-32" /></div>
              <div className="col-span-2 flex justify-end"><Block className="h-3 w-12" /></div>
              <div className="col-span-2 flex justify-end"><Block className="h-2.5 w-10" /></div>
            </div>
            {/* mobile */}
            <div className="sm:hidden flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Block className="h-4 w-14" />
                <Block className="h-4 w-10" />
              </div>
              <div className="text-right space-y-1">
                <Block className="h-3 w-12 ml-auto" />
                <Block className="h-2.5 w-10 ml-auto" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </CardShell>
  );
}

export function PageHeaderSkeleton() {
  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pb-3 mb-1">
      <div className="min-w-0 space-y-2">
        <Block className="h-6 w-48" />
        <Block className="h-3 w-72" />
      </div>
      <div className="flex items-center gap-2">
        <Block className="h-7 w-[280px] rounded-full" />
        <Block className="h-7 w-32 rounded-md" />
      </div>
    </div>
  );
}

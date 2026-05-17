function Block({ className = "" }: { className?: string }) {
  return <div className={`rounded bg-[var(--color-border-soft)]/70 animate-pulse ${className}`} />;
}

export default function InstallLoading() {
  return (
    <div className="space-y-8">
      <div>
        <Block className="h-3 w-28" />
        <Block className="mt-3 h-10 w-32" />
        <Block className="mt-3 h-3 w-96" />
      </div>
      <div className="card-hi p-6 flex items-center gap-4">
        <Block className="size-10 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Block className="h-2.5 w-32" />
          <Block className="h-4 w-80" />
        </div>
      </div>
      <Section />
      <Section />
      <div className="grid md:grid-cols-2 gap-4">
        <Block className="h-32" />
        <Block className="h-32" />
      </div>
    </div>
  );
}

function Section() {
  return (
    <div className="card-hi p-7 space-y-4">
      <div className="flex items-baseline gap-4">
        <Block className="h-3 w-6" />
        <div className="flex-1 space-y-2">
          <Block className="h-4 w-48" />
          <Block className="h-3 w-[min(32rem,80%)]" />
        </div>
      </div>
      <Block className="h-44 w-full rounded-xl" />
    </div>
  );
}

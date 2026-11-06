export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="h-24 mb-6 rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] motion-safe:animate-pulse" />
      <div className="h-4 w-48 mb-6 rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] motion-safe:animate-pulse" />
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-16 rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] motion-safe:animate-pulse" />
        ))}
      </div>
    </div>
  );
}

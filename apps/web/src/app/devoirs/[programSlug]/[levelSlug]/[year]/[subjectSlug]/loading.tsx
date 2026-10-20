export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="rounded-2xl bg-teal-100 h-24 mb-6 animate-pulse" />
      <div className="h-4 w-48 bg-slate-200 rounded mb-6 animate-pulse" />
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-20 rounded-xl bg-slate-100 animate-pulse" />
        ))}
      </div>
    </div>
  );
}

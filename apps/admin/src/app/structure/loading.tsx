const pulse = "rounded-[var(--radius-rounded)] bg-[color:var(--admin-card-border)] motion-safe:animate-pulse";

export default function StructureLoading() {
  return (
    <main aria-busy="true" className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <p className="sr-only" role="status">Chargement de la structure…</p>
      <div aria-hidden="true">
        <div className={`h-4 w-40 ${pulse}`} />
        <div className={`mt-4 h-8 w-64 ${pulse}`} />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className="rounded-[var(--radius-rounded)] border border-[color:var(--admin-card-border)] bg-[color:var(--admin-card-background)] p-6 shadow-[var(--admin-card-shadow)]"
            >
              <div className={`size-10 rounded-full ${pulse}`} />
              <div className={`mt-4 h-5 w-3/4 ${pulse}`} />
              <div className={`mt-3 h-4 w-1/2 ${pulse}`} />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

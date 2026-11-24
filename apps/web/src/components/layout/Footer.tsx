import Image from "next/image";

export function Footer() {
  return (
    <footer className="mt-auto bg-[color:var(--color-brand)] text-sm text-[color:var(--color-on-band-muted)]">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-6 sm:flex-row sm:px-6 lg:px-8">
        <p className="flex items-center gap-2 font-semibold text-[color:var(--color-on-band)]">
          <Image src="/icons/icon-192.png" alt="" width={28} height={28} className="rounded-md ring-1 ring-white/20" />
          Tablino
          <span className="font-normal text-[color:var(--color-on-band-muted)]">, archive num&eacute;rique universitaire</span>
        </p>
        <p className="text-xs">Accessible sur tous vos appareils</p>
      </div>
    </footer>
  );
}

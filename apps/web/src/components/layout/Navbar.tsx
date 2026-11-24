import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { focusRing } from "@/components/ui/kit";
import { NavLinks } from "./NavLinks";
import { SearchMenu } from "./SearchMenu";
import { UserMenu } from "./UserMenu";

export function Navbar({ universityId }: { universityId: string }) {
  return (
    <header className="sticky top-0 z-50 border-b border-[color:var(--color-border)] bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/75">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          <Link
            href="/"
            aria-label="Tablino — retour à l'accueil"
            className={`group flex shrink-0 items-center gap-2 rounded-[var(--radius-rounded)] ${focusRing}`}
          >
            <Image
              src="/icons/icon-192.png"
              alt=""
              width={36}
              height={36}
              priority
              className="rounded-lg transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:rotate-0 motion-reduce:group-hover:scale-100"
            />
            <span className="hidden text-lg font-bold leading-tight text-[color:var(--color-brand)] sm:block">
              Tablino
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <NavLinks />
            <Suspense fallback={null}>
              <SearchMenu />
            </Suspense>
            <Suspense fallback={null}>
              <UserMenu universityId={universityId} />
            </Suspense>
          </div>
        </div>
      </div>
    </header>
  );
}

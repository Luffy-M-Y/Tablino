import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { Suspense } from "react";
import { NavLinks } from "./NavLinks";
import { UserMenu } from "./UserMenu";

export function Navbar() {
  return (
    <header className="relative bg-uni-900 shadow-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          <Link
            href="/"
            aria-label="Tablino — retour à l'accueil"
            className="flex items-center gap-2 shrink-0"
          >
            <GraduationCap size={28} className="text-uni-100" aria-hidden="true" />
            <span className="text-white font-bold text-lg leading-tight hidden sm:block">
              Tablino
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <NavLinks />
            <Suspense fallback={null}>
              <UserMenu />
            </Suspense>
          </div>
        </div>
      </div>
    </header>
  );
}

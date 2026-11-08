import type { ReactNode } from "react";
import { Footer } from "./Footer";
import { Navbar } from "./Navbar";
import { getCurrentUniversityIdOrNull } from "@/lib/university";

export async function TenantGate({ children }: { children: ReactNode }) {
  const universityId = await getCurrentUniversityIdOrNull();

  if (!universityId) {
    return (
      <main id="main-content" className="flex flex-1 items-center justify-center px-4 py-16">
        <section className="max-w-lg text-center">
          <h1 className="mb-3 text-2xl font-bold">Adresse inconnue</h1>
          <p className="text-[color:var(--color-muted-foreground)]">
            Cette adresse ne correspond à aucune université disponible.
          </p>
        </section>
      </main>
    );
  }

  return (
    <>
      <Navbar universityId={universityId} />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <Footer />
    </>
  );
}

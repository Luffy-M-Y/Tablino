import type { ReactNode } from "react";
import { headers } from "next/headers";
import { Footer } from "./Footer";
import { Navbar } from "./Navbar";
import { AUTH_CENTRAL_ROUTE_HEADER } from "@/lib/auth-central-host.mjs";
import { getCurrentUniversityIdOrNull } from "@/lib/university";

export async function TenantGate({ children }: { children: ReactNode }) {
  const requestHeaders = await headers();
  if (requestHeaders.get(AUTH_CENTRAL_ROUTE_HEADER) === "1") {
    return children;
  }

  let universityId: string | null;
  try {
    universityId = await getCurrentUniversityIdOrNull();
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error(JSON.stringify({
        code: "tenant_gate_resolution_error",
        errorName: error instanceof Error ? error.name : "UnknownError",
      }));
    }
    throw error;
  }

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

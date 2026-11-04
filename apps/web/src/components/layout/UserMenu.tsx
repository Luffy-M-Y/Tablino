import Link from "next/link";
import { User, LogOut } from "lucide-react";
import {
  AuthorizationDeniedError,
  SessionRequiredError,
  requireRole,
} from "@tablino/auth";
import { getStudentNameById } from "@tablino/db";
import { getCurrentUniversityId } from "@/lib/university";
import { logoutAction } from "@/app/deconnexion/actions";

export async function UserMenu() {
  const universityId = await getCurrentUniversityId();
  let userId: string | null = null;
  try {
    const sessionUser = await requireRole("web", ["student"]);
    if (sessionUser.universityId === universityId) userId = sessionUser.id;
  } catch (error) {
    if (!(error instanceof SessionRequiredError || error instanceof AuthorizationDeniedError)) throw error;
  }

  if (userId === null) {
    return (
      <Link
        href="/connexion"
        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[color:var(--color-on-band-muted)] hover:bg-white/10 hover:text-[color:var(--color-on-band)] focus-visible:outline-2 focus-visible:outline-[color:var(--color-ring-on-band)]"
      >
        <User size={16} aria-hidden="true" />
        <span className="sr-only sm:not-sr-only">Connexion</span>
      </Link>
    );
  }

  const name = await getStudentNameById(userId);
  const label = name ?? "Mon compte";

  return (
    <div className="flex items-center gap-2">
      <span className="flex items-center gap-2 truncate max-w-48 text-sm text-[color:var(--color-on-band)]">
        <User size={16} aria-hidden="true" />
        <span className="hidden sm:inline truncate">{label}</span>
        <span className="sr-only sm:hidden">{label}</span>
      </span>
      <form action={logoutAction}>
        <button
          type="submit"
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[color:var(--color-on-band-muted)] hover:bg-white/10 hover:text-[color:var(--color-on-band)] focus-visible:outline-2 focus-visible:outline-[color:var(--color-ring-on-band)]"
        >
          <LogOut size={16} aria-hidden="true" />
          <span className="sr-only sm:not-sr-only">D&eacute;connexion</span>
        </button>
      </form>
    </div>
  );
}

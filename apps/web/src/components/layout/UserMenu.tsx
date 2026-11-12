import Link from "next/link";
import { User } from "lucide-react";
import {
  AuthorizationDeniedError,
  SessionRequiredError,
  requireRole,
} from "@tablino/auth";
import { getStudentEmailById, getStudentNameById } from "@tablino/db";
import { UserMenuDropdown } from "./UserMenuDropdown";

export async function UserMenu({ universityId }: { universityId: string }) {
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

  const [name, email] = await Promise.all([
    getStudentNameById(userId),
    getStudentEmailById(userId),
  ]);
  return <UserMenuDropdown name={name?.trim() || null} email={email?.trim() || null} />;
}

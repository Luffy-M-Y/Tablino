import Link from "next/link";
import { User } from "lucide-react";
import {
  AuthorizationDeniedError,
  SessionRequiredError,
  requireRole,
  type GuardUser,
} from "@tablino/auth";
import { getStudentEmailById, getStudentNameById } from "@tablino/db";
import { focusRing } from "@/components/ui/kit";
import { accessStatusLabel, accessStatusSpokenLabel, describeAccessStatus } from "@/lib/access-status.mjs";
import { UserMenuDropdown } from "./UserMenuDropdown";

export async function UserMenu({ universityId }: { universityId: string }) {
  let sessionUser: GuardUser | null = null;
  try {
    const candidate = await requireRole("web", ["student"]);
    if (candidate.universityId === universityId) sessionUser = candidate;
  } catch (error) {
    if (!(error instanceof SessionRequiredError || error instanceof AuthorizationDeniedError)) throw error;
  }

  if (sessionUser === null) {
    return (
      <Link
        href="/connexion"
        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[color:var(--color-muted-foreground)] hover:bg-[color:var(--color-background)] hover:text-[color:var(--color-primary-text)] focus-visible:outline-2 focus-visible:outline-[color:var(--color-ring)]"
      >
        <User size={16} aria-hidden="true" />
        <span className="sr-only sm:not-sr-only">Connexion</span>
      </Link>
    );
  }

  const status = describeAccessStatus(sessionUser, new Date());
  const statusLabel = accessStatusLabel(status);
  const showUpgrade = status.kind === "trial";
  const [name, email] = await Promise.all([
    getStudentNameById(sessionUser.id),
    getStudentEmailById(sessionUser.id),
  ]);
  return (
    <div className="flex items-center gap-2">
      {statusLabel !== null ? (
        <Link
          href="/choisir-acces"
          aria-label={accessStatusSpokenLabel(status) ?? undefined}
          className={`hidden h-9 items-center whitespace-nowrap rounded-full border px-3 text-sm font-semibold md:inline-flex ${
            status.kind === "pro"
              ? "border-[color:var(--color-brand)] text-[color:var(--color-brand)]"
              : "border-[color:var(--color-accent)] bg-orange-50 text-[color:var(--color-foreground)]"
          } ${focusRing}`}
        >
          {statusLabel}
        </Link>
      ) : null}
      {showUpgrade ? (
        <Link
          href="/choisir-acces"
          className={`hidden h-9 items-center whitespace-nowrap rounded-full bg-[color:var(--color-accent)] px-3 text-sm font-semibold text-[color:var(--color-on-accent)] hover:bg-[color-mix(in_srgb,var(--color-accent)_90%,black)] md:inline-flex ${focusRing}`}
        >
          Mise &agrave; niveau
        </Link>
      ) : null}
      <UserMenuDropdown
        name={name?.trim() || null}
        email={email?.trim() || null}
        statusLabel={statusLabel}
        showUpgrade={showUpgrade}
      />
    </div>
  );
}

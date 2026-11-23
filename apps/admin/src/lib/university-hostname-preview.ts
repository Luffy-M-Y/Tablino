import "server-only";

import { buildUniversitySlug } from "@tablino/db";
import { buildUniversityHostnames } from "./university-hostnames.mjs";

export type UniversityHostnamePreview =
  | {
    ok: true;
    acronym: string;
    locality: string;
    slug: string;
    students: string;
    admin: string;
  }
  | { ok: false; reason: string };

export function getUniversityHostnamePreview(acronym: string, locality?: string): UniversityHostnamePreview {
  const slugResult = buildUniversitySlug(acronym.trim(), locality);
  if (!slugResult.ok) {
    return { ok: false, reason: slugResult.reason };
  }
  if (acronym.trim().length > 20) {
    return { ok: false, reason: "acronym_too_long" };
  }

  const studentRootDomain = process.env.STUDENT_ROOT_DOMAIN;
  const adminRootDomain = process.env.ADMIN_ROOT_DOMAIN;
  if (!studentRootDomain || !adminRootDomain) {
    throw new Error("STUDENT_ROOT_DOMAIN et ADMIN_ROOT_DOMAIN doivent être configurés.");
  }

  const hostnames = buildUniversityHostnames(
    slugResult.slug,
    studentRootDomain,
    adminRootDomain,
  );
  return {
    ok: true,
    acronym: acronym.trim(),
    locality: locality?.trim() ?? "",
    slug: slugResult.slug,
    ...hostnames,
  };
}

import { getUniversitySlugFromHost } from "./university-host.mjs";

export function getTurnstileExpectedHostname(host, rootDomain, universityId, slugMap = {}) {
  if (typeof universityId !== "string" || !universityId.trim()) return null;
  if (!getUniversitySlugFromHost(host, rootDomain, slugMap)) return null;

  return new URL(`http://${host}`).hostname.toLowerCase();
}

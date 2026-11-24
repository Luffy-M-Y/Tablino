import { AuthorizationDeniedError, SessionRequiredError } from "@tablino/auth";
import { getUniversityLogo } from "@tablino/db";
import { requireRoleOnHost } from "@/lib/authorization";

// Logo de l'université de la session, sur son propre hôte admin. Aucun
// identifiant dans l'adresse : rien à énumérer.
export async function GET(request: Request) {
  let universityId: string | null;
  try {
    const user = await requireRoleOnHost(["university_admin"]);
    universityId = user.universityId ?? null;
  } catch (error) {
    if (error instanceof SessionRequiredError || error instanceof AuthorizationDeniedError) {
      return new Response(null, { status: 404 });
    }
    throw error;
  }
  if (!universityId) return new Response(null, { status: 404 });

  const logo = await getUniversityLogo(universityId);
  if (!logo) return new Response(null, { status: 404 });

  const versioned = new URL(request.url).searchParams.get("v") === String(logo.updatedAt.getTime());
  return new Response(new Uint8Array(logo.image), {
    headers: {
      "Content-Type": "image/webp",
      "Content-Length": String(logo.image.length),
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cache-Control": versioned ? "private, max-age=31536000, immutable" : "private, no-cache",
    },
  });
}

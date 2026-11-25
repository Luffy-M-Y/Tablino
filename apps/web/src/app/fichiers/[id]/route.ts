import { getStoredObjectDownloadUrl } from "@tablino/storage";
import { isFileId, isServableFileKey } from "@/lib/file-download.mjs";
import { getDownloadableFileKey } from "@/lib/queries";
import { getCurrentUniversityId } from "@/lib/university";

const NO_STORE = { "Cache-Control": "no-store" } as const;

// Téléchargement d'un fichier : session étudiante, université, publication et accès
// contrôlés, puis redirection vers un lien signé R2 de 5 minutes (domaine séparé).
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isFileId(id)) return new Response(null, { status: 404, headers: NO_STORE });

  const universityId = await getCurrentUniversityId();
  const fileKey = await getDownloadableFileKey(universityId, id);
  if (!isServableFileKey(fileKey, universityId)) return new Response(null, { status: 404, headers: NO_STORE });

  let url: string;
  try {
    url = await getStoredObjectDownloadUrl(fileKey);
  } catch {
    return new Response(null, { status: 503, headers: NO_STORE });
  }

  return new Response(null, {
    status: 302,
    headers: { ...NO_STORE, Location: url, "Referrer-Policy": "no-referrer" },
  });
}

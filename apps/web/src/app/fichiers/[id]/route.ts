import { getStoredObjectDownloadUrl } from "@tablino/storage";
import { fileKeyExtension, isFileId, isServableFileKey } from "@/lib/file-download.mjs";
import { getDownloadableFileKey } from "@/lib/queries";
import { getCurrentUniversityId } from "@/lib/university";

const NO_STORE = { "Cache-Control": "no-store" } as const;

// Téléchargement d'un fichier : session étudiante, université, publication et accès
// contrôlés, puis redirection vers un lien signé R2 de 5 minutes (domaine séparé).
// « ?format=json » : mêmes contrôles, le lien est renvoyé en JSON pour un téléchargement
// avec progression (lecture du fichier par la page ; règle CORS GET du compartiment).
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const wantsJson = new URL(request.url).searchParams.get("format") === "json";
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

  if (wantsJson) {
    return Response.json(
      { url, extension: fileKeyExtension(fileKey) },
      { headers: { ...NO_STORE, "Referrer-Policy": "no-referrer" } },
    );
  }

  return new Response(null, {
    status: 302,
    headers: { ...NO_STORE, Location: url, "Referrer-Policy": "no-referrer" },
  });
}

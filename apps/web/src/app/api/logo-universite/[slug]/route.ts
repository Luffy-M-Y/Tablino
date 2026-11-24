import { getActiveUniversityLogoBySlug } from "@tablino/db";

// Logo public d'une université active (vitrine). Le slug est déjà public.
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let logo;
  try {
    logo = await getActiveUniversityLogoBySlug(slug);
  } catch {
    return new Response(null, { status: 503 });
  }
  if (!logo) return new Response(null, { status: 404 });

  const versioned = new URL(request.url).searchParams.get("v") === String(logo.updatedAt.getTime());
  return new Response(new Uint8Array(logo.image), {
    headers: {
      "Content-Type": "image/webp",
      "Content-Length": String(logo.image.length),
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cache-Control": versioned ? "public, max-age=31536000, immutable" : "public, max-age=300",
    },
  });
}

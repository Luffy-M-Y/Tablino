import { PDFDocument } from "pdf-lib";
import { computeScaledSize } from "@/lib/scan-pages.mjs";

export async function buildPdfFromImages(files: File[]): Promise<Uint8Array> {
  if (files.length === 0) throw new Error("Aucune image.");

  const pdf = await PDFDocument.create();
  for (const file of files) {
    let bitmap: ImageBitmap;
    try {
      bitmap = await createImageBitmap(file);
    } catch {
      throw new Error("Image illisible : " + file.name);
    }

    const size = computeScaledSize(bitmap.width, bitmap.height);
    if (!size) {
      bitmap.close();
      throw new Error("Dimensions invalides.");
    }

    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      throw new Error("Contexte canvas indisponible.");
    }

    context.drawImage(bitmap, 0, 0, size.width, size.height);
    bitmap.close();

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => {
        if (!result) {
          reject(new Error("Export JPEG impossible."));
          return;
        }
        resolve(result);
      }, "image/jpeg", 0.8);
    });

    const image = await pdf.embedJpg(await blob.arrayBuffer());
    const page = pdf.addPage([size.width, size.height]);
    page.drawImage(image, {
      x: 0,
      y: 0,
      width: size.width,
      height: size.height,
    });
  }

  return await pdf.save();
}

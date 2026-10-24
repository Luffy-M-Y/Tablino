import { PDFDocument, StandardFonts } from "pdf-lib";
import { computeScaledSize } from "@/lib/scan-pages.mjs";

export async function buildPdfFromImages(
  files: File[],
  onProgress?: (current: number, total: number) => void,
): Promise<Uint8Array> {
  if (files.length === 0) throw new Error("Aucune image.");
  onProgress?.(0, files.length);

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const tesseract = await import("tesseract.js").catch(() => {
    throw new Error("OCR indisponible.");
  });
  const base = window.location.origin + "/tesseract";
  const worker = await tesseract.createWorker("fra", undefined, {
    workerPath: base + "/worker.min.js",
    corePath: base + "/tesseract-core-lstm.wasm.js",
    langPath: base + "/lang",
  }).catch(() => {
    throw new Error("OCR indisponible.");
  });

  try {
    for (const [index, file] of files.entries()) {
      onProgress?.(index + 1, files.length);
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

      const result = await worker.recognize(canvas, {}, { blocks: true }).catch(() => {
        throw new Error("OCR impossible : " + file.name);
      });

      for (const block of result.data.blocks ?? []) {
        for (const paragraph of block.paragraphs) {
          for (const line of paragraph.lines) {
            for (const word of line.words) {
              const text = word.text.trim();
              if (!text) continue;

              const height = word.bbox.y1 - word.bbox.y0;
              if (height < 1) continue;

              const options = {
                x: word.bbox.x0,
                y: size.height - word.bbox.y1,
                size: height,
                font: font,
                opacity: 0,
              };
              try {
                page.drawText(text, options);
              } catch {
                let sanitizedText = "";
                for (let index = 0; index < text.length; index += 1) {
                  const code = text.charCodeAt(index);
                  if ((code >= 32 && code <= 126) || (code >= 160 && code <= 255)) {
                    sanitizedText += text[index];
                  }
                }
                if (!sanitizedText) continue;

                try {
                  page.drawText(sanitizedText, options);
                } catch {
                  continue;
                }
              }
            }
          }
        }
      }
    }

    return await pdf.save();
  } finally {
    await worker.terminate();
  }
}

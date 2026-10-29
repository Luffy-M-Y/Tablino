import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { computeScaledSize } from "@/lib/scan-pages.mjs";

export type ScanPdfMode = "text" | "photo";

function sanitizeRecognizedWord(text: string): string {
  let sanitizedText = "";
  for (let index = 0; index < text.length; index += 1) {
    let code = text.charCodeAt(index);
    if (code === 8216 || code === 8217) code = 39;
    if (code === 8220 || code === 8221) code = 34;
    if (code === 8211 || code === 8212) code = 45;
    if (code === 339) {
      sanitizedText += "oe";
      continue;
    }
    if (code === 338) {
      sanitizedText += "OE";
      continue;
    }
    if (code === 8230) {
      sanitizedText += "...";
      continue;
    }
    if ((code >= 32 && code <= 126) || (code >= 160 && code <= 255)) {
      sanitizedText += String.fromCharCode(code);
    }
  }
  return sanitizedText;
}

function extractTextParagraphs(blocks: Array<{ paragraphs?: Array<{ lines?: Array<{ words?: Array<{ text?: string }> }> }> } | undefined>): string[] {
  const paragraphs: string[] = [];
  for (const block of blocks ?? []) {
    if (!block || !block.paragraphs) continue;
    for (const paragraph of block.paragraphs) {
      if (!paragraph || !paragraph.lines) continue;
      const lines: string[] = [];
      for (const line of paragraph.lines) {
        if (!line || !line.words) continue;
        const words: string[] = [];
        for (const word of line.words) {
          const text = word && word.text ? word.text.trim() : "";
          if (!text) continue;
          const sanitizedText = sanitizeRecognizedWord(text);
          if (!sanitizedText) continue;
          words.push(sanitizedText);
        }
        if (words.length > 0) {
          lines.push(words.join(" "));
        }
      }
      if (lines.length > 0) {
        paragraphs.push(lines.join("\n"));
      }
    }
  }
  return paragraphs;
}

function wrapTextLines(font: { widthOfTextAtSize: (value: string, size: number) => number }, text: string, maxWidth: number): string[] {
  const paragraphs = text.split("\n\n");
  const lines: string[] = [];
  const pageWidth = maxWidth;
  for (const paragraph of paragraphs) {
    const rawLines = paragraph.split("\n");
    for (const rawLine of rawLines) {
      const words = rawLine.split(" ");
      let currentLine = "";
      for (const rawWord of words) {
        const word = sanitizeRecognizedWord(rawWord);
        if (!word) continue;
        const candidate = currentLine ? currentLine + " " + word : word;
        if (font.widthOfTextAtSize(candidate, 11) <= pageWidth) {
          currentLine = candidate;
          continue;
        }
        if (currentLine) {
          lines.push(currentLine);
          currentLine = word;
          continue;
        }
        const maxChars = 1;
        if (word.length <= maxChars) {
          currentLine = word;
          continue;
        }
        let prefix = "";
        for (let index = 0; index < word.length; index += 1) {
          const candidateChar = prefix + word[index];
          if (font.widthOfTextAtSize(candidateChar, 11) <= pageWidth) {
            prefix = candidateChar;
            continue;
          }
          if (prefix) {
            lines.push(prefix);
            prefix = word[index];
          } else {
            prefix = word[index];
          }
        }
        if (prefix) {
          currentLine = prefix;
        }
      }
      if (currentLine) {
        lines.push(currentLine);
      }
    }
    lines.push("");
  }
  return lines;
}

export async function buildPdfFromImages(
  files: File[],
  onProgress?: (current: number, total: number) => void,
  mode: ScanPdfMode = "photo",
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

  let hasWrittenText = false;

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

      if (mode === "text") {
        const result = await worker.recognize(canvas, {}, { blocks: true }).catch(() => {
          throw new Error("OCR impossible : " + file.name);
        });
        const paragraphs = extractTextParagraphs(result.data.blocks ?? []);
        if (paragraphs.length > 0) {
          let page = pdf.addPage([595, 842]);
          let y = 842 - 50;
          const maxWidth = 595 - 100;
          const lines = wrapTextLines(font, paragraphs.join("\n\n"), maxWidth);
          for (const line of lines) {
            if (!line) {
              y -= 14;
              continue;
            }
            if (y - 14 < 50) {
              page = pdf.addPage([595, 842]);
              y = 842 - 50;
            }
            page.drawText(line, { x: 50, y: y, size: 11, font: font, color: rgb(0, 0, 0) });
            y -= 14;
          }
          hasWrittenText = true;
        }
        continue;
      }

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((resultBlob) => {
          if (!resultBlob) {
            reject(new Error("Export JPEG impossible."));
            return;
          }
          resolve(resultBlob);
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
                const sanitizedText = sanitizeRecognizedWord(text);
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

    if (mode === "text" && !hasWrittenText) {
      throw new Error("Aucun texte détecté.");
    }

    return await pdf.save();
  } finally {
    await worker.terminate();
  }
}

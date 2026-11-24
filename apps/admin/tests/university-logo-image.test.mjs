import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import {
  detectLogoFormat,
  LOGO_OUTPUT_SIZE,
  LOGO_UPLOAD_MAX_BYTES,
  processUniversityLogo,
} from "../src/lib/university-logo-image.mjs";

async function sample(format, width = 600, height = 400) {
  return sharp({ create: { width, height, channels: 3, background: { r: 15, g: 42, b: 94 } } })
    .toFormat(format)
    .toBuffer();
}

const asFile = (bytes, name = "logo.png", type = "image/png") => new File([bytes], name, { type });

test("detectLogoFormat reads magic bytes only", async () => {
  assert.equal(detectLogoFormat(new Uint8Array(await sample("png"))), "png");
  assert.equal(detectLogoFormat(new Uint8Array(await sample("jpeg"))), "jpeg");
  assert.equal(detectLogoFormat(new Uint8Array(await sample("webp"))), "webp");
  assert.equal(detectLogoFormat(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>')), null);
  assert.equal(detectLogoFormat(new TextEncoder().encode("GIF89a000000")), null);
  assert.equal(detectLogoFormat(new Uint8Array(4)), null);
  assert.equal(detectLogoFormat("png"), null);
});

test("a PNG, JPEG or WebP becomes a 256 px WebP", async () => {
  for (const format of ["png", "jpeg", "webp"]) {
    const result = await processUniversityLogo(asFile(await sample(format)));
    assert.equal(result.ok, true, format);
    const metadata = await sharp(result.image).metadata();
    assert.equal(metadata.format, "webp");
    assert.equal(metadata.width, LOGO_OUTPUT_SIZE);
    assert.equal(metadata.height, LOGO_OUTPUT_SIZE);
  }
});

test("metadata is stripped from the stored logo", async () => {
  const withExif = await sharp(await sample("jpeg"))
    .withExif({ IFD0: { Copyright: "secret-gps-owner" } })
    .jpeg()
    .toBuffer();
  assert.ok(withExif.includes("secret-gps-owner"));
  const result = await processUniversityLogo(asFile(withExif, "logo.jpg", "image/jpeg"));
  assert.equal(result.ok, true);
  assert.equal(result.image.includes("secret-gps-owner"), false);
  assert.equal((await sharp(result.image).metadata()).exif, undefined);
});

test("the declared name and type are ignored: an SVG renamed .png is refused", async () => {
  const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>');
  assert.deepEqual(await processUniversityLogo(asFile(svg, "logo.png", "image/png")), { ok: false, reason: "unsupported" });
});

test("a file with an image header but a corrupt body is refused", async () => {
  const fakePng = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from("<script>alert(1)</script>")]);
  assert.deepEqual(await processUniversityLogo(asFile(fakePng)), { ok: false, reason: "invalid_image" });
});

test("missing, empty and oversized files are refused", async () => {
  assert.deepEqual(await processUniversityLogo(null), { ok: false, reason: "missing" });
  assert.deepEqual(await processUniversityLogo("logo.png"), { ok: false, reason: "missing" });
  assert.deepEqual(await processUniversityLogo(asFile(new Uint8Array(0))), { ok: false, reason: "missing" });
  const big = new Uint8Array(LOGO_UPLOAD_MAX_BYTES + 1);
  assert.deepEqual(await processUniversityLogo(asFile(big)), { ok: false, reason: "too_large" });
  assert.equal(LOGO_UPLOAD_MAX_BYTES, 2 * 1024 * 1024);
});

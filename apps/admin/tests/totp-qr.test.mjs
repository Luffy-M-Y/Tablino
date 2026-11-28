import assert from "node:assert/strict";
import test from "node:test";
import QRCode from "qrcode";
import { buildQrSvgPath, formatTotpSecretForDisplay } from "../src/lib/totp-qr.mjs";

const URI = "otpauth://totp/Tablino:admin%40example.test?secret=JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP&issuer=Tablino&algorithm=SHA1&digits=6&period=30";

test("buildQrSvgPath trace un carré par module foncé, avec une marge de 4", () => {
  const qr = QRCode.create(URI, { errorCorrectionLevel: "M" });
  const result = buildQrSvgPath(URI);
  assert.ok(result);
  assert.equal(result.size, qr.modules.size + 8);
  let dark = 0;
  for (let row = 0; row < qr.modules.size; row += 1) {
    for (let col = 0; col < qr.modules.size; col += 1) {
      if (qr.modules.get(row, col)) dark += 1;
    }
  }
  assert.equal(result.path.match(/M/g)?.length, dark);
  // Coin du motif de repérage en haut à gauche : module (0, 0) foncé, décalé de la marge.
  assert.ok(result.path.startsWith("M4 4h1v1h-1z"));
  assert.match(result.path, /^(M\d+ \d+h1v1h-1z)+$/);
});

test("buildQrSvgPath refuse un texte vide, non textuel ou trop long", () => {
  assert.equal(buildQrSvgPath(""), null);
  assert.equal(buildQrSvgPath(undefined), null);
  assert.equal(buildQrSvgPath(42), null);
  assert.equal(buildQrSvgPath("a".repeat(5000)), null);
});

test("formatTotpSecretForDisplay groupe le secret par 4", () => {
  assert.equal(formatTotpSecretForDisplay("JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP"), "JBSW Y3DP EHPK 3PXP JBSW Y3DP EHPK 3PXP");
  assert.equal(formatTotpSecretForDisplay("ABCDEF"), "ABCD EF");
  assert.equal(formatTotpSecretForDisplay(""), "");
  assert.equal(formatTotpSecretForDisplay(null), "");
});

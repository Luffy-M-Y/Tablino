import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../../..");

function extractTokens(filePath) {
  const content = fs.readFileSync(filePath, "utf8").replace(/\r\n/g, "\n");
  const startMarker = "/* TABLINO-TOKENS:START */";
  const endMarker = "/* TABLINO-TOKENS:END */";

  const startIndex = content.indexOf(startMarker);
  const endIndex = content.indexOf(endMarker);

  assert.notEqual(startIndex, -1, `Start marker missing in ${filePath}`);
  assert.notEqual(endIndex, -1, `End marker missing in ${filePath}`);
  assert.ok(startIndex < endIndex, `Start marker must precede end marker in ${filePath}`);

  const tokens = content.slice(startIndex + startMarker.length, endIndex).trim();
  assert.ok(tokens.length > 0, `Tokens block must not be empty in ${filePath}`);
  return tokens;
}

test("admin and web globals.css have identical and non-empty design tokens", () => {
  const adminCssPath = path.join(rootDir, "apps/admin/src/app/globals.css");
  const webCssPath = path.join(rootDir, "apps/web/src/app/globals.css");

  const adminTokens = extractTokens(adminCssPath);
  const webTokens = extractTokens(webCssPath);

  assert.equal(adminTokens, webTokens);
});


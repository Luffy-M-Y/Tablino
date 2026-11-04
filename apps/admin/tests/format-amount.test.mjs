import assert from "node:assert/strict";
import test from "node:test";
import { formatAmount, formatXof } from "../src/lib/format-amount.mjs";

test("formatAmount formats zero and positive numbers in French locale with FCFA", () => {
  assert.equal(formatAmount(0), "0 FCFA");
  assert.equal(formatAmount(null), "0 FCFA");
  assert.equal(formatAmount(undefined), "0 FCFA");

  // Intl formatting in fr-FR produces non-breaking space (narrow or standard)
  const expected1000 = `${new Intl.NumberFormat("fr-FR").format(1000)} FCFA`;
  assert.equal(formatAmount(1000), expected1000);

  const expected15000 = `${new Intl.NumberFormat("fr-FR").format(15000)} FCFA`;
  assert.equal(formatAmount(15000), expected15000);

  const expectedBig = `${new Intl.NumberFormat("fr-FR").format(1250000)} FCFA`;
  assert.equal(formatAmount(1250000), expectedBig);
});

test("formatXof is an alias of formatAmount", () => {
  assert.equal(formatXof(5000), formatAmount(5000));
});

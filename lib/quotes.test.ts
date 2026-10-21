import assert from "node:assert/strict";
import test from "node:test";
import { buildQuoteText, calculateQuote, formatEuro } from "./quotes";

test("calculates labour, call-out, marked-up materials, and VAT", () => {
  const result = calculateQuote({
    description: "Replace kitchen tap",
    hours: 4,
    hourlyRate: 55,
    callOutFee: 20,
    vatRate: 13.5,
    materialsMarkup: 15,
    materials: [
      { name: "Tap", cost: 80 },
      { name: "Fittings", cost: 10 },
    ],
  });

  assert.equal(result.labour, 220);
  assert.ok(Math.abs(result.materialsTotal - 103.5) < 1e-9);
  assert.ok(Math.abs(result.subtotal - 343.5) < 1e-9);
  assert.ok(Math.abs(result.vatAmount - 46.3725) < 1e-9);
  assert.ok(Math.abs(result.total - 389.8725) < 1e-9);
});

test("matches the source calculator's euro format and quote breakdown", () => {
  assert.equal(formatEuro(1234.5), "€1,234.50");

  const input = {
    description: "Replace tap",
    hours: 1,
    hourlyRate: 55,
    callOutFee: 0,
    vatRate: 0,
    materialsMarkup: 15,
    materials: [],
  };
  const result = calculateQuote(input);
  assert.deepEqual(result.rows, [
    { label: "Labour (1 hrs)", amount: 55 },
    { label: "Subtotal", amount: 55 },
  ]);
  assert.equal(
    buildQuoteText(
      { name: "Acme", phone: "", email: "hello@example.com", address: "", vat_number: "" },
      input,
      result,
    ),
    "Acme\nhello@example.com\n\nQuote: Replace tap\nLabour (1 hrs): €55.00\nSubtotal: €55.00\nTotal: €55.00",
  );
});

test("rejects negative or non-finite amounts", () => {
  assert.throws(
    () =>
      calculateQuote({
        description: "",
        hours: -1,
        hourlyRate: 55,
        callOutFee: 0,
        vatRate: 23,
        materialsMarkup: 15,
        materials: [],
      }),
    /non-negative/,
  );
});

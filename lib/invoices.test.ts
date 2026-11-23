import test from "node:test";
import assert from "node:assert/strict";
import {
  getInvoiceBalance,
  getInvoiceDisplayStatus,
  parseInvoiceSnapshot,
  sumInvoicePayments,
} from "./invoices";

const today = "2026-11-23";

test("classifies invoice payment, deposit, and overdue states", () => {
  const base = { status: "sent" as const, total: 100, dueDate: "2026-11-30", today };
  assert.equal(
    getInvoiceDisplayStatus({ ...base, amountPaid: 0, depositRequired: 25 }),
    "deposit_due",
  );
  assert.equal(
    getInvoiceDisplayStatus({ ...base, amountPaid: 25, depositRequired: 25 }),
    "partially_paid",
  );
  assert.equal(
    getInvoiceDisplayStatus({ ...base, amountPaid: 100, depositRequired: 25 }),
    "paid",
  );
  assert.equal(
    getInvoiceDisplayStatus({
      ...base,
      dueDate: "2026-11-22",
      amountPaid: 25,
      depositRequired: 25,
    }),
    "overdue",
  );
  assert.equal(
    getInvoiceDisplayStatus({
      ...base,
      status: "draft",
      amountPaid: 0,
      depositRequired: 25,
    }),
    "draft",
  );
});

test("never exposes a negative invoice balance", () => {
  assert.equal(getInvoiceBalance(100, 25), 75);
  assert.equal(getInvoiceBalance(100, 110), 0);
});

test("sums decimal payment amounts in cents", () => {
  assert.equal(sumInvoicePayments([0.1, 0.2, 0.29]), 0.59);
});

test("parses the immutable business, client, and quote invoice snapshot", () => {
  const snapshot = parseInvoiceSnapshot({
    business: { name: "Trade Co", email: "", phone: "", address: "", vatNumber: "" },
    client: { name: "A Customer", email: "customer@example.com", phone: "", address: "" },
    quote: {
      quoteNumber: "PQ-1",
      description: "Repair",
      hours: 2,
      hourlyRate: 50,
      callOutFee: 0,
      vatRate: 0,
      materials: [{ name: "Part", cost: 10 }],
      materialsMarkup: 0,
      subtotal: 110,
      vatAmount: 0,
      total: 110,
    },
  });
  assert.equal(snapshot.client?.name, "A Customer");
  assert.equal(snapshot.quote.total, 110);
  assert.deepEqual(snapshot.quote.materials, [{ name: "Part", cost: 10 }]);
});

test("rejects malformed saved invoice snapshots", () => {
  assert.throws(
    () => parseInvoiceSnapshot({ business: {}, client: null, quote: {} }),
    /invalid .* details/,
  );
});

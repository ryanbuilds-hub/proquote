export type Material = {
  name: string;
  cost: number;
};

export type QuoteInput = {
  description: string;
  hours: number;
  hourlyRate: number;
  callOutFee: number;
  vatRate: number;
  materialsMarkup: number;
  materials: Material[];
};

export type QuoteCalculation = {
  labour: number;
  callOut: number;
  materialsCost: number;
  materialsTotal: number;
  subtotal: number;
  vatAmount: number;
  total: number;
  rows: { label: string; amount: number }[];
};

export function calculateQuote(input: QuoteInput): QuoteCalculation {
  const values = [
    input.hours,
    input.hourlyRate,
    input.callOutFee,
    input.vatRate,
    input.materialsMarkup,
    ...input.materials.map((material) => material.cost),
  ];

  if (values.some((value) => !Number.isFinite(value) || value < 0)) {
    throw new Error("Quote amounts must be finite, non-negative numbers.");
  }

  const labour = input.hours * input.hourlyRate;
  const materialsCost = input.materials.reduce(
    (sum, material) => sum + material.cost,
    0,
  );
  const materialsTotal = materialsCost * (1 + input.materialsMarkup / 100);
  const subtotal = labour + input.callOutFee + materialsTotal;
  const vatAmount = (subtotal * input.vatRate) / 100;
  const total = subtotal + vatAmount;
  const rows = [
    { label: `Labour (${input.hours} hrs)`, amount: labour },
    ...(input.callOutFee
      ? [{ label: "Call-out", amount: input.callOutFee }]
      : []),
    ...(materialsTotal
      ? [{ label: "Materials", amount: materialsTotal }]
      : []),
    { label: "Subtotal", amount: subtotal },
    ...(input.vatRate
      ? [{ label: `VAT ${input.vatRate}%`, amount: vatAmount }]
      : []),
  ];

  return {
    labour,
    callOut: input.callOutFee,
    materialsCost,
    materialsTotal,
    subtotal,
    vatAmount,
    total,
    rows,
  };
}

export function formatEuro(amount: number): string {
  return `€${amount.toLocaleString("en-IE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function buildQuoteText(
  business: { name: string; phone: string; email: string; address: string; vat_number: string },
  input: QuoteInput,
  calculation: QuoteCalculation,
  clientName?: string,
): string {
  const heading = [
    business.name,
    business.phone,
    business.email,
    business.address,
    business.vat_number ? `VAT no: ${business.vat_number}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  const details = [
    clientName ? `For: ${clientName}` : "",
    `Quote: ${input.description.trim() || "Job"}`,
    ...calculation.rows.map((row) => `${row.label}: ${formatEuro(row.amount)}`),
    `Total: ${formatEuro(calculation.total)}`,
  ].filter(Boolean);

  return `${heading ? `${heading}\n\n` : ""}${details.join("\n")}`;
}

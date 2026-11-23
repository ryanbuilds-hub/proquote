import type { Json } from "@/lib/database.types";
import type { Material } from "@/lib/quotes";

export const invoicePaymentMethods = ["cash", "bank_transfer", "card", "other"] as const;

export type InvoicePaymentMethod = (typeof invoicePaymentMethods)[number];
export type InvoiceRecordStatus = "draft" | "sent";
export type InvoiceDisplayStatus =
  | InvoiceRecordStatus
  | "deposit_due"
  | "partially_paid"
  | "overdue"
  | "paid";

export type InvoiceSnapshot = {
  business: {
    name: string;
    email: string;
    phone: string;
    address: string;
    vatNumber: string;
  };
  client: {
    name: string;
    email: string;
    phone: string;
    address: string;
  } | null;
  quote: {
    quoteNumber: string;
    description: string;
    hours: number;
    hourlyRate: number;
    callOutFee: number;
    vatRate: number;
    materials: Material[];
    materialsMarkup: number;
    subtotal: number;
    vatAmount: number;
    total: number;
  };
};

function isRecord(value: Json | undefined): value is { [key: string]: Json | undefined } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(
  value: { [key: string]: Json | undefined },
  key: string,
): string {
  const field = value[key];
  if (typeof field !== "string") {
    throw new Error(`Saved invoice contains invalid ${key} details.`);
  }
  return field;
}

function requiredNumber(
  value: { [key: string]: Json | undefined },
  key: string,
): number {
  const field = value[key];
  if (typeof field !== "number" || !Number.isFinite(field)) {
    throw new Error(`Saved invoice contains invalid ${key} details.`);
  }
  return field;
}

export function parseInvoiceSnapshot(value: Json): InvoiceSnapshot {
  if (!isRecord(value) || !isRecord(value.business) || !isRecord(value.quote)) {
    throw new Error("Saved invoice contains invalid snapshot details.");
  }

  const rawClient = value.client;
  let client: InvoiceSnapshot["client"] = null;
  if (rawClient !== null && rawClient !== undefined) {
    if (!isRecord(rawClient)) throw new Error("Saved invoice contains invalid client details.");
    client = {
      name: requiredString(rawClient, "name"),
      email: requiredString(rawClient, "email"),
      phone: requiredString(rawClient, "phone"),
      address: requiredString(rawClient, "address"),
    };
  }

  const rawQuote = value.quote;
  const rawMaterials = rawQuote.materials;
  if (!Array.isArray(rawMaterials)) {
    throw new Error("Saved invoice contains invalid material details.");
  }
  const materials: Material[] = rawMaterials.map((material) => {
    if (
      !isRecord(material) ||
      typeof material.name !== "string" ||
      typeof material.cost !== "number" ||
      !Number.isFinite(material.cost)
    ) {
      throw new Error("Saved invoice contains invalid material details.");
    }
    return { name: material.name, cost: material.cost };
  });

  return {
    business: {
      name: requiredString(value.business, "name"),
      email: requiredString(value.business, "email"),
      phone: requiredString(value.business, "phone"),
      address: requiredString(value.business, "address"),
      vatNumber: requiredString(value.business, "vatNumber"),
    },
    client,
    quote: {
      quoteNumber: requiredString(rawQuote, "quoteNumber"),
      description: requiredString(rawQuote, "description"),
      hours: requiredNumber(rawQuote, "hours"),
      hourlyRate: requiredNumber(rawQuote, "hourlyRate"),
      callOutFee: requiredNumber(rawQuote, "callOutFee"),
      vatRate: requiredNumber(rawQuote, "vatRate"),
      materials,
      materialsMarkup: requiredNumber(rawQuote, "materialsMarkup"),
      subtotal: requiredNumber(rawQuote, "subtotal"),
      vatAmount: requiredNumber(rawQuote, "vatAmount"),
      total: requiredNumber(rawQuote, "total"),
    },
  };
}

export function getInvoiceDisplayStatus({
  status,
  total,
  amountPaid,
  depositRequired,
  dueDate,
  today,
}: {
  status: InvoiceRecordStatus;
  total: number;
  amountPaid: number;
  depositRequired: number;
  dueDate: string;
  today: string;
}): InvoiceDisplayStatus {
  if (status === "draft") return "draft";
  if (amountPaid >= total) return "paid";
  if (dueDate < today && amountPaid < total) return "overdue";
  if (depositRequired > amountPaid) return "deposit_due";
  if (amountPaid > 0) return "partially_paid";
  return "sent";
}

export function getInvoiceBalance(total: number, amountPaid: number): number {
  return Math.max(0, Math.round((total - amountPaid) * 100) / 100);
}

export function sumInvoicePayments(amounts: number[]): number {
  const totalCents = amounts.reduce((sum, amount) => sum + Math.round(amount * 100), 0);
  return totalCents / 100;
}

export function formatInvoiceDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-IE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { calculateQuote, type Material } from "@/lib/quotes";
import type { Json } from "@/lib/database.types";
import { invoicePaymentMethods, type InvoicePaymentMethod } from "@/lib/invoices";
import { parseFollowUpDate } from "@/lib/quote-follow-up";
import { isQuoteStatus } from "@/lib/quote-status";
import { requireWorkspace } from "@/lib/workspace";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

function textField(formData: FormData, key: string, maxLength: number): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function numberField(formData: FormData, key: string): number | null {
  const value = formData.get(key);
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

async function requirePaidWorkspace() {
  const workspace = await requireWorkspace();
  if (!workspace.isPaid) redirect("/billing?required=1");
  return workspace;
}

type ParsedQuote = {
  description: string;
  clientId: string | null;
  hours: number;
  hourlyRate: number;
  callOutFee: number;
  vatRate: number;
  materialsMarkup: number;
  materials: Material[];
  calculation: ReturnType<typeof calculateQuote>;
};

type QuoteFormResult =
  | { ok: true; quote: ParsedQuote }
  | { ok: false; error: string };

function parseQuoteForm(formData: FormData): QuoteFormResult {
  const description = textField(formData, "description", 500) || "Job";
  const hours = numberField(formData, "hours");
  const hourlyRate = numberField(formData, "hourly_rate");
  const callOutFee = numberField(formData, "call_out_fee");
  const vatRate = numberField(formData, "vat_rate");
  const materialsMarkup = numberField(formData, "materials_markup");
  const clientId = textField(formData, "client_id", 36) || null;
  let materials: Material[];

  try {
    const rawMaterials = JSON.parse(textField(formData, "materials", 10000)) as unknown;
    if (
      !Array.isArray(rawMaterials) ||
      rawMaterials.length > 100 ||
      rawMaterials.some(
        (material) =>
          typeof material !== "object" ||
          material === null ||
          Array.isArray(material) ||
          typeof material.name !== "string" ||
          typeof material.cost !== "number",
      )
    ) {
      return { ok: false, error: "Materials are invalid. Review the quote and try again." };
    }
    materials = rawMaterials.map((material) => ({
      name: material.name.trim().slice(0, 160),
      cost: material.cost,
    }));
  } catch {
    return { ok: false, error: "Materials are invalid. Review the quote and try again." };
  }

  if (
    hours === null ||
    hourlyRate === null ||
    callOutFee === null ||
    vatRate === null ||
    materialsMarkup === null
  ) {
    return { ok: false, error: "Complete the quote fields with valid non-negative amounts." };
  }
  if (![0, 13.5, 23].includes(vatRate)) {
    return { ok: false, error: "Choose one of the available VAT rates." };
  }

  try {
    const calculation = calculateQuote({
      description,
      hours,
      hourlyRate,
      callOutFee,
      vatRate,
      materialsMarkup,
      materials,
    });
    return {
      ok: true,
      quote: {
        description,
        clientId,
        hours,
        hourlyRate,
        callOutFee,
        vatRate,
        materialsMarkup,
        materials,
        calculation,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Quote amounts are invalid.",
    };
  }
}

export async function createClientRecord(formData: FormData): Promise<ActionResult> {
  const { supabase, business } = await requirePaidWorkspace();
  const name = textField(formData, "name", 160);
  if (!name) return { ok: false, error: "Enter a client name." };

  const { error } = await supabase.from("clients").insert({
    business_id: business.id,
    name,
    email: textField(formData, "email", 254),
    phone: textField(formData, "phone", 60),
    address: textField(formData, "address", 500),
    notes: textField(formData, "notes", 2000),
  });
  if (error) return { ok: false, error: `Could not save client: ${error.message}` };

  revalidatePath("/clients");
  revalidatePath("/dashboard");
  return { ok: true, message: "Client saved." };
}

export async function archiveClient(clientId: string): Promise<ActionResult> {
  const { supabase, business } = await requirePaidWorkspace();
  if (!/^[0-9a-f-]{36}$/i.test(clientId)) {
    return { ok: false, error: "Invalid client." };
  }

  const { data, error } = await supabase
    .from("clients")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", clientId)
    .eq("business_id", business.id)
    .is("archived_at", null)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: `Could not archive client: ${error.message}` };
  if (!data) return { ok: false, error: "Client not found in your active directory." };

  revalidatePath("/clients");
  return { ok: true, message: "Client archived." };
}

export async function createQuote(formData: FormData): Promise<ActionResult> {
  const { supabase, business } = await requirePaidWorkspace();
  const parsed = parseQuoteForm(formData);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const quote = parsed.quote;

  if (quote.clientId) {
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id")
      .eq("id", quote.clientId)
      .eq("business_id", business.id)
      .is("archived_at", null)
      .maybeSingle();
    if (clientError) return { ok: false, error: `Could not verify client: ${clientError.message}` };
    if (!client) return { ok: false, error: "Choose a client from your directory." };
  }

  const { error } = await supabase.from("quotes").insert({
    business_id: business.id,
    client_id: quote.clientId,
    quote_number: `PQ-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID()
      .slice(0, 6)
      .toUpperCase()}`,
    description: quote.description,
    hours: quote.hours,
    hourly_rate: quote.hourlyRate,
    call_out_fee: quote.callOutFee,
    vat_rate: quote.vatRate,
    materials: quote.materials.map(
      (material): Json => ({ name: material.name, cost: material.cost }),
    ),
    materials_markup: quote.materialsMarkup,
    subtotal: quote.calculation.subtotal,
    vat_amount: quote.calculation.vatAmount,
    total: quote.calculation.total,
  });

  if (error) return { ok: false, error: `Could not save quote: ${error.message}` };

  revalidatePath("/quotes");
  revalidatePath("/dashboard");
  return { ok: true, message: "Quote saved to your account." };
}

export async function updateQuote(
  quoteId: string,
  formData: FormData,
): Promise<ActionResult> {
  const { supabase, business } = await requirePaidWorkspace();
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(quoteId)) {
    return { ok: false, error: "Invalid quote." };
  }

  const { data: existingQuote, error: quoteError } = await supabase
    .from("quotes")
    .select("id,client_id")
    .eq("id", quoteId)
    .eq("business_id", business.id)
    .maybeSingle();
  if (quoteError) return { ok: false, error: `Could not load quote: ${quoteError.message}` };
  if (!existingQuote) return { ok: false, error: "Quote not found in your account." };
  const { data: existingInvoice, error: invoiceError } = await supabase
    .from("invoices")
    .select("id")
    .eq("business_id", business.id)
    .eq("quote_id", quoteId)
    .maybeSingle();
  if (invoiceError) return { ok: false, error: `Could not check for an existing invoice: ${invoiceError.message}` };
  if (existingInvoice) {
    return { ok: false, error: "This accepted quote has an invoice and can no longer be edited." };
  }

  const parsed = parseQuoteForm(formData);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const quote = parsed.quote;

  if (quote.clientId) {
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id,archived_at")
      .eq("id", quote.clientId)
      .eq("business_id", business.id)
      .maybeSingle();
    if (clientError) return { ok: false, error: `Could not verify client: ${clientError.message}` };
    if (!client) return { ok: false, error: "Choose a client from your directory." };
    if (client.archived_at && client.id !== existingQuote.client_id) {
      return { ok: false, error: "Choose an active client from your directory." };
    }
  }

  const { data, error } = await supabase
    .from("quotes")
    .update({
      client_id: quote.clientId,
      description: quote.description,
      hours: quote.hours,
      hourly_rate: quote.hourlyRate,
      call_out_fee: quote.callOutFee,
      vat_rate: quote.vatRate,
      materials: quote.materials.map(
        (material): Json => ({ name: material.name, cost: material.cost }),
      ),
      materials_markup: quote.materialsMarkup,
      subtotal: quote.calculation.subtotal,
      vat_amount: quote.calculation.vatAmount,
      total: quote.calculation.total,
      status: "draft",
    })
    .eq("id", quoteId)
    .eq("business_id", business.id)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: `Could not update quote: ${error.message}` };
  if (!data) return { ok: false, error: "Quote not found in your account." };

  revalidatePath(`/quotes/${quoteId}`);
  revalidatePath(`/quotes/${quoteId}/edit`);
  revalidatePath("/quotes");
  revalidatePath("/dashboard");
  return { ok: true, message: "Quote updated and moved back to Draft." };
}

export async function updateQuoteStatus(
  quoteId: string,
  status: string,
): Promise<ActionResult> {
  const { supabase, business } = await requirePaidWorkspace();
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(quoteId)) {
    return { ok: false, error: "Invalid quote." };
  }
  if (!isQuoteStatus(status)) {
    return { ok: false, error: "Choose a valid quote status." };
  }
  const { data: existingInvoice, error: invoiceError } = await supabase
    .from("invoices")
    .select("id")
    .eq("business_id", business.id)
    .eq("quote_id", quoteId)
    .maybeSingle();
  if (invoiceError) return { ok: false, error: `Could not check for an existing invoice: ${invoiceError.message}` };
  if (existingInvoice) {
    return { ok: false, error: "This quote already has an invoice, so its status cannot be changed." };
  }

  const { data, error } = await supabase
    .from("quotes")
    .update({ status })
    .eq("id", quoteId)
    .eq("business_id", business.id)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: `Could not update quote: ${error.message}` };
  if (!data) return { ok: false, error: "Quote not found in your account." };

  revalidatePath(`/quotes/${quoteId}`);
  revalidatePath("/quotes");
  revalidatePath("/dashboard");
  return { ok: true, message: "Quote status updated." };
}

export async function updateQuoteFollowUpDate(
  quoteId: string,
  value: string,
): Promise<ActionResult> {
  const { supabase, business } = await requirePaidWorkspace();
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(quoteId)) {
    return { ok: false, error: "Invalid quote." };
  }
  if (typeof value !== "string") {
    return { ok: false, error: "Choose a valid follow-up date." };
  }

  const followUpDate = parseFollowUpDate(value);
  if (followUpDate === undefined) {
    return { ok: false, error: "Choose a valid follow-up date." };
  }

  const { data, error } = await supabase
    .from("quotes")
    .update({ follow_up_date: followUpDate })
    .eq("id", quoteId)
    .eq("business_id", business.id)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: `Could not save follow-up reminder: ${error.message}` };
  if (!data) return { ok: false, error: "Quote not found in your account." };

  revalidatePath(`/quotes/${quoteId}`);
  revalidatePath("/quotes");
  revalidatePath("/dashboard");
  return {
    ok: true,
    message: followUpDate ? "Follow-up reminder saved." : "Follow-up reminder cleared.",
  };
}

export type CreateInvoiceResult =
  | { ok: true; invoiceId: string }
  | { ok: false; error: string };

export async function createInvoiceFromAcceptedQuote(
  quoteId: string,
  dueDateValue: string,
  depositValue: string,
): Promise<CreateInvoiceResult> {
  const { supabase } = await requirePaidWorkspace();
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(quoteId)) {
    return { ok: false, error: "Invalid quote." };
  }
  if (typeof dueDateValue !== "string" || typeof depositValue !== "string") {
    return { ok: false, error: "Enter a valid due date and deposit amount." };
  }

  const dueDate = parseFollowUpDate(dueDateValue);
  if (!dueDate) return { ok: false, error: "Choose a valid invoice due date." };
  if (dueDate < new Date().toISOString().slice(0, 10)) {
    return { ok: false, error: "The invoice due date cannot be in the past." };
  }
  const depositRequired = Number(depositValue);
  if (
    depositValue.trim() === "" ||
    !/^\d+(?:\.\d{1,2})?$/.test(depositValue.trim()) ||
    !Number.isFinite(depositRequired) ||
    depositRequired < 0 ||
    Math.round(depositRequired * 100) !== depositRequired * 100
  ) {
    return { ok: false, error: "Enter a valid deposit amount, or use 0 for no deposit." };
  }

  const { data, error } = await supabase.rpc("create_invoice_from_accepted_quote", {
    p_quote_id: quoteId,
    p_due_date: dueDate,
    p_deposit_required: depositRequired,
  });
  if (error) {
    const messages: Record<string, string> = {
      quote_not_accepted: "Only accepted quotes can be converted into invoices.",
      invoice_deposit_exceeds_total: "The deposit cannot be greater than the quote total.",
      invoice_due_date_invalid: "Choose a valid invoice due date.",
      invoice_already_exists: "This quote already has an invoice.",
    };
    return { ok: false, error: messages[error.message] ?? `Could not create invoice: ${error.message}` };
  }
  if (!data) return { ok: false, error: "The invoice could not be created." };

  revalidatePath("/invoices");
  revalidatePath(`/quotes/${quoteId}`);
  revalidatePath("/dashboard");
  return { ok: true, invoiceId: data };
}

export async function markInvoiceAsSent(invoiceId: string): Promise<ActionResult> {
  const { supabase } = await requirePaidWorkspace();
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(invoiceId)) {
    return { ok: false, error: "Invalid invoice." };
  }
  const { error } = await supabase.rpc("set_invoice_status", {
    p_invoice_id: invoiceId,
    p_status: "sent",
  });
  if (error) {
    const messages: Record<string, string> = {
      invoice_not_found: "Invoice not found in your account.",
      invoice_status_transition_invalid: "Only draft invoices can be marked as sent.",
    };
    return { ok: false, error: messages[error.message] ?? `Could not update invoice: ${error.message}` };
  }
  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/invoices");
  revalidatePath("/dashboard");
  return { ok: true, message: "Invoice marked as sent." };
}

export async function recordInvoicePayment(
  invoiceId: string,
  formData: FormData,
): Promise<ActionResult> {
  const { supabase, business } = await requirePaidWorkspace();
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(invoiceId)) {
    return { ok: false, error: "Invalid invoice." };
  }
  const amountValue = textField(formData, "amount", 32);
  const amount = Number(amountValue);
  const paidOn = parseFollowUpDate(textField(formData, "paid_on", 10));
  const method = textField(formData, "method", 32);
  if (
    !amountValue ||
    !/^\d+(?:\.\d{1,2})?$/.test(amountValue) ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    Math.round(amount * 100) !== amount * 100
  ) {
    return { ok: false, error: "Enter a payment amount greater than zero with up to two decimal places." };
  }
  if (!paidOn || paidOn > new Date().toISOString().slice(0, 10)) {
    return { ok: false, error: "Choose a valid payment date that is not in the future." };
  }
  if (!invoicePaymentMethods.includes(method as InvoicePaymentMethod)) {
    return { ok: false, error: "Choose a valid payment method." };
  }

  const { error } = await supabase.from("invoice_payments").insert({
    business_id: business.id,
    invoice_id: invoiceId,
    amount,
    paid_on: paidOn,
    method: method as InvoicePaymentMethod,
    note: textField(formData, "note", 500),
  });
  if (error) {
    const messages: Record<string, string> = {
      invoice_must_be_sent_before_payment: "Mark this invoice as sent before recording a payment.",
      invoice_payment_exceeds_balance: "That payment is greater than the remaining invoice balance.",
      invoice_not_found: "Invoice not found in your account.",
    };
    return { ok: false, error: messages[error.message] ?? `Could not record payment: ${error.message}` };
  }
  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/invoices");
  revalidatePath("/dashboard");
  return { ok: true, message: "Payment recorded." };
}

export async function updateBusinessProfile(formData: FormData): Promise<ActionResult> {
  const { supabase, business } = await requireWorkspace();
  const name = textField(formData, "name", 120);
  const email = textField(formData, "email", 254);
  if (!name) return { ok: false, error: "Enter your business name." };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Enter a valid business email address." };
  }

  const { error } = await supabase
    .from("businesses")
    .update({
      name,
      email,
      phone: textField(formData, "phone", 60),
      address: textField(formData, "address", 500),
      vat_number: textField(formData, "vat_number", 80),
    })
    .eq("id", business.id);

  if (error) return { ok: false, error: `Could not save business profile: ${error.message}` };
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { ok: true, message: "Business profile saved." };
}

export async function setBusinessSuspension(
  businessId: string,
  suspended: boolean,
): Promise<ActionResult> {
  const { supabase, isPlatformAdmin } = await requireWorkspace();
  if (!isPlatformAdmin) return { ok: false, error: "Platform owner access is required." };
  if (!/^[0-9a-f-]{36}$/i.test(businessId)) {
    return { ok: false, error: "Invalid business account." };
  }

  const { error } = await supabase.rpc("set_business_suspension", {
    p_business_id: businessId,
    p_suspended: suspended,
  });
  if (error) return { ok: false, error: `Could not update account: ${error.message}` };

  revalidatePath("/admin");
  return { ok: true, message: suspended ? "Business access suspended." : "Business access restored." };
}

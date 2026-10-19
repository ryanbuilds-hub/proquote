"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { calculateQuote, type Material } from "@/lib/quotes";
import type { Json } from "@/lib/database.types";
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
  if (clientId) {
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id")
      .eq("id", clientId)
      .eq("business_id", business.id)
      .is("archived_at", null)
      .maybeSingle();
    if (clientError) return { ok: false, error: `Could not verify client: ${clientError.message}` };
    if (!client) return { ok: false, error: "Choose a client from your directory." };
  }

  let calculation;
  try {
    calculation = calculateQuote({
      description,
      hours,
      hourlyRate,
      callOutFee,
      vatRate,
      materialsMarkup,
      materials,
    });
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Quote amounts are invalid.",
    };
  }

  const { error } = await supabase.from("quotes").insert({
    business_id: business.id,
    client_id: clientId,
    quote_number: `PQ-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID()
      .slice(0, 6)
      .toUpperCase()}`,
    description,
    hours,
    hourly_rate: hourlyRate,
    call_out_fee: callOutFee,
    vat_rate: vatRate,
    materials: materials.map(
      (material): Json => ({ name: material.name, cost: material.cost }),
    ),
    materials_markup: materialsMarkup,
    subtotal: calculation.subtotal,
    vat_amount: calculation.vatAmount,
    total: calculation.total,
  });

  if (error) return { ok: false, error: `Could not save quote: ${error.message}` };

  revalidatePath("/quotes");
  revalidatePath("/dashboard");
  return { ok: true, message: "Quote saved to your account." };
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

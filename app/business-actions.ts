"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { identifyBusinessLogoFormat } from "@/lib/business-logo";
import { requireWorkspace } from "@/lib/workspace";

type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

function textField(formData: FormData, key: string, maxLength: number): string {
  return String(formData.get(key) ?? "").trim().slice(0, maxLength);
}

export async function updateBusinessProfile(formData: FormData): Promise<ActionResult> {
  const { supabase, business } = await requireWorkspace();
  const name = textField(formData, "name", 120);
  const email = textField(formData, "email", 254);
  const removeLogo = formData.get("remove_logo") === "on";
  const logoFile = formData.get("logo");

  if (!name) return { ok: false, error: "Enter your business name." };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Enter a valid business email address." };
  }
  if (removeLogo && logoFile instanceof File && logoFile.size > 0) {
    return { ok: false, error: "Choose a new logo or remove the current logo, not both." };
  }
  if (!(logoFile instanceof File) && logoFile !== null) {
    return { ok: false, error: "Choose a valid logo image." };
  }
  if (logoFile instanceof File && logoFile.size > 2 * 1024 * 1024) {
    return { ok: false, error: "Choose a logo smaller than 2 MB." };
  }

  let uploadedLogoPath: string | null = null;
  let nextLogoPath = business.logo_path;
  if (logoFile instanceof File && logoFile.size > 0) {
    const format = identifyBusinessLogoFormat(
      logoFile.type,
      new Uint8Array(await logoFile.arrayBuffer()),
    );
    if (!format) {
      return { ok: false, error: "Use a valid PNG, JPG, or WebP logo image." };
    }

    uploadedLogoPath = `${business.id}/logo-${randomUUID()}.${format.extension}`;
    const { error: uploadError } = await supabase.storage
      .from("business-logos")
      .upload(uploadedLogoPath, logoFile, {
        contentType: format.contentType,
        cacheControl: "31536000",
      });
    if (uploadError) {
      return { ok: false, error: `Could not upload business logo: ${uploadError.message}` };
    }
    nextLogoPath = uploadedLogoPath;
  } else if (removeLogo) {
    nextLogoPath = null;
  }

  const { error } = await supabase
    .from("businesses")
    .update({
      name,
      email,
      phone: textField(formData, "phone", 60),
      address: textField(formData, "address", 500),
      vat_number: textField(formData, "vat_number", 80),
      logo_path: nextLogoPath,
    })
    .eq("id", business.id);

  if (error) {
    if (uploadedLogoPath) {
      const { error: cleanupError } = await supabase.storage
        .from("business-logos")
        .remove([uploadedLogoPath]);
      if (cleanupError) {
        return {
          ok: false,
          error: `Could not save business profile: ${error.message}. The uploaded logo also could not be removed: ${cleanupError.message}`,
        };
      }
    }
    return { ok: false, error: `Could not save business profile: ${error.message}` };
  }

  let cleanupWarning = "";
  const previousLogoPath = business.logo_path;
  if (previousLogoPath && previousLogoPath !== nextLogoPath) {
    const { error: cleanupError } = await supabase.storage
      .from("business-logos")
      .remove([previousLogoPath]);
    if (cleanupError) {
      cleanupWarning = ` The previous logo could not be removed from storage: ${cleanupError.message}`;
    }
  }

  revalidatePath("/settings");
  revalidatePath("/quotes");
  revalidatePath("/dashboard");
  return {
    ok: true,
    message: `Business profile saved.${cleanupWarning}`,
  };
}

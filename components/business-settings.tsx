"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateBusinessProfile } from "@/app/actions";

type Business = {
  name: string;
  email: string;
  phone: string;
  address: string;
  vat_number: string;
};

export function BusinessSettings({ business }: { business: Business }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await updateBusinessProfile(formData);
      if (!result.ok) setError(result.error);
      else {
        setMessage(result.message ?? "Business profile saved.");
        router.refresh();
      }
    });
  }

  return (
    <section className="panel">
      <form className="form-stack" onSubmit={submit}>
        <label>Business name<input name="name" required maxLength={120} defaultValue={business.name} autoComplete="organization" /></label>
        <label>Email<input name="email" type="email" maxLength={254} defaultValue={business.email} autoComplete="email" /></label>
        <label>Phone<input name="phone" type="tel" maxLength={60} defaultValue={business.phone} autoComplete="tel" /></label>
        <label>Address<input name="address" maxLength={500} defaultValue={business.address} autoComplete="street-address" /></label>
        <label>VAT number (optional)<input name="vat_number" maxLength={80} defaultValue={business.vat_number} /></label>
        {error && <p className="form-message error-text" role="alert">{error}</p>}
        {message && <p className="form-message success-text" role="status">{message}</p>}
        <button className="button button-primary" disabled={pending}>
          {pending ? "Saving…" : "Save business details"}
        </button>
      </form>
    </section>
  );
}

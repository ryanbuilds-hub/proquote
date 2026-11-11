"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function PasswordSettings({ email }: { email: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!email) {
      setError("This account does not have an email address for password verification.");
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    const currentPassword = String(formData.get("current_password") ?? "");
    const newPassword = String(formData.get("new_password") ?? "");
    const confirmPassword = String(formData.get("confirm_password") ?? "");

    if (newPassword.length < 8) {
      setError("Your new password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("The new passwords do not match.");
      return;
    }
    if (newPassword === currentPassword) {
      setError("Choose a new password that is different from your current one.");
      return;
    }

    setPending(true);
    try {
      const supabase = createClient();
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });

      if (verifyError) {
        setError("Your current password is incorrect. Check it and try again.");
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) {
        setError(updateError.message);
        return;
      }

      form.reset();
      setMessage("Your password has been changed.");
    } catch {
      setError("We couldn't change your password. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="panel">
      <form className="form-stack" onSubmit={submit}>
        <label>
          Current password
          <input
            name="current_password"
            type="password"
            autoComplete="current-password"
            required
          />
        </label>
        <label>
          New password
          <input
            name="new_password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>
        <label>
          Confirm new password
          <input
            name="confirm_password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>
        {error && <p className="form-message error-text" role="alert">{error}</p>}
        {message && <p className="form-message success-text" role="status">{message}</p>}
        <button className="button button-primary" type="submit" disabled={pending}>
          {pending ? "Changing password…" : "Change password"}
        </button>
      </form>
    </section>
  );
}

"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function AuthForm({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!configured) return;
    setBusy(true);
    setError("");
    setMessage("");
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const businessName = String(formData.get("business_name") ?? "").trim();
    const supabase = createClient();

    if (mode === "signup") {
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { business_name: businessName },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (authError) {
        setError(authError.message);
      } else if (data.session) {
        router.replace("/dashboard");
        router.refresh();
      } else {
        setMessage("Check your email to confirm your account, then come back to sign in.");
        setMode("login");
      }
    } else {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) {
        setError(authError.message);
      } else {
        router.replace("/dashboard");
        router.refresh();
      }
    }
    setBusy(false);
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <Link className="brand-lockup" href="/">
          <span className="brand-mark">P</span><span>ProQuote</span>
        </Link>
        <p className="eyebrow">{mode === "signup" ? "Built for the job" : "Welcome back"}</p>
        <h1>{mode === "signup" ? "Get your quoting in order." : "Sign in to ProQuote."}</h1>
        <p className="muted">
          Keep client details, job estimates and business information together.
        </p>

        {!configured && (
          <div className="notice notice-error">
            Supabase is not configured. Add the project URL and anon key from
            <code> .env.local</code> to start the app.
          </div>
        )}

        <form className="form-stack" onSubmit={submit}>
          {mode === "signup" && (
            <label>
              Business name
              <input
                name="business_name"
                autoComplete="organization"
                maxLength={120}
                required
                placeholder="e.g. Murphy Plumbing"
              />
            </label>
          )}
          <label>
            Email
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              minLength={8}
              required
            />
          </label>
          {error && <p className="form-message error-text" role="alert">{error}</p>}
          {message && <p className="form-message success-text" role="status">{message}</p>}
          <button className="button button-primary button-full" disabled={!configured || busy}>
            {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
          </button>
        </form>
        <p className="auth-switch">
          {mode === "signup" ? "Already have an account?" : "New to ProQuote?"}{" "}
          <button
            type="button"
            className="text-button"
            onClick={() => {
              setMode(mode === "signup" ? "login" : "signup");
              setError("");
              setMessage("");
            }}
          >
            {mode === "signup" ? "Sign in" : "Create an account"}
          </button>
        </p>
      </section>
      <aside className="auth-aside">
        <div className="auth-aside-inner">
          <p className="eyebrow">Made for tradespeople</p>
          <h2>Less time chasing paperwork. More time on the tools.</h2>
          <ul>
            <li>One private folder for all your clients</li>
            <li>Clear quotes with labour, materials and VAT</li>
            <li>Your business details ready to share</li>
          </ul>
        </div>
      </aside>
    </main>
  );
}

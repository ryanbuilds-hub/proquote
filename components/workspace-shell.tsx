"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const links = [
  { href: "/dashboard", label: "Overview" },
  { href: "/clients", label: "Clients" },
  { href: "/quotes", label: "Quotes" },
  { href: "/settings", label: "Business details" },
  { href: "/billing", label: "Subscription" },
];

export function WorkspaceShell({
  businessName,
  isPlatformAdmin,
  children,
}: {
  businessName: string;
  isPlatformAdmin: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    const { error } = await createClient().auth.signOut();
    if (error) {
      setSigningOut(false);
      return;
    }
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="app-frame">
      <aside className="sidebar">
        <Link href="/dashboard" className="brand-lockup">
          <span className="brand-mark">P</span><span>ProQuote</span>
        </Link>
        <div className="sidebar-business">
          <span className="avatar">{businessName.slice(0, 1).toUpperCase()}</span>
          <span><strong>{businessName}</strong><small>Business workspace</small></span>
        </div>
        <nav className="main-nav" aria-label="Main navigation">
          {links.map((link) => (
            <Link
              className={`nav-link${pathname === link.href || pathname.startsWith(`${link.href}/`) ? " active" : ""}`}
              href={link.href}
              key={link.href}
            >
              {link.label}
            </Link>
          ))}
          {isPlatformAdmin && (
            <Link
              className={`nav-link${pathname.startsWith("/admin") ? " active" : ""}`}
              href="/admin"
            >
              Platform accounts
            </Link>
          )}
        </nav>
        <div className="sidebar-bottom">
          <p>Quote simply. Get back to work.</p>
          <button className="signout-button" onClick={signOut} disabled={signingOut}>
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </aside>
      <main className="workspace-main">{children}</main>
    </div>
  );
}

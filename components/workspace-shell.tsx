"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const links = [
  { href: "/dashboard", label: "Home", mobileLabel: "Home", symbol: "H" },
  { href: "/clients", label: "Clients", mobileLabel: "Clients", symbol: "C" },
  { href: "/quotes", label: "Quotes", mobileLabel: "Quotes", symbol: "Q" },
  { href: "/invoices", label: "Invoices", mobileLabel: "Invoices", symbol: "I" },
  { href: "/settings", label: "Business profile", mobileLabel: "Profile", symbol: "B" },
  { href: "/billing", label: "Billing", mobileLabel: "Billing", symbol: "€" },
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
          <p className="nav-caption">YOUR WORKSPACE</p>
          {links.map((link) => (
            <Link
              className={`nav-link${pathname === link.href || pathname.startsWith(`${link.href}/`) ? " active" : ""}`}
              href={link.href}
              key={link.href}
              aria-current={pathname === link.href || pathname.startsWith(`${link.href}/`) ? "page" : undefined}
            >
              <span className="nav-symbol" aria-hidden="true">{link.symbol}</span>
              <span className="nav-label">{link.label}</span>
              <span className="mobile-nav-label" aria-hidden="true">{link.mobileLabel}</span>
            </Link>
          ))}
          {isPlatformAdmin && (
            <div className="owner-nav">
              <p className="nav-caption">OWNER ONLY</p>
              <Link
                className={`nav-link${pathname.startsWith("/admin") ? " active owner-link" : " owner-link"}`}
                href="/admin"
                aria-current={pathname.startsWith("/admin") ? "page" : undefined}
              >
                <span className="nav-symbol owner-symbol" aria-hidden="true">✦</span>
                <span className="nav-label">Owner dashboard</span>
                <span className="mobile-nav-label" aria-hidden="true">Owner</span>
              </Link>
            </div>
          )}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-tip">
            <span aria-hidden="true">✦</span>
            <p><strong>Quick tip</strong><br />Save a client once, then attach them to every quote.</p>
          </div>
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

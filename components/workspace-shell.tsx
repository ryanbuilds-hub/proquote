"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const links = [
  { href: "/dashboard", label: "Home", symbol: "H" },
  { href: "/clients", label: "Clients", symbol: "C" },
  { href: "/quotes", label: "Quotes", symbol: "Q" },
  { href: "/settings", label: "Business profile", symbol: "B" },
  { href: "/billing", label: "Billing", symbol: "€" },
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
            >
              <span className="nav-symbol" aria-hidden="true">{link.symbol}</span>
              <span>{link.label}</span>
            </Link>
          ))}
          {isPlatformAdmin && (
            <div className="owner-nav">
              <p className="nav-caption">OWNER ONLY</p>
              <Link
                className={`nav-link${pathname.startsWith("/admin") ? " active owner-link" : " owner-link"}`}
                href="/admin"
              >
                <span className="nav-symbol owner-symbol" aria-hidden="true">✦</span>
                <span>Owner dashboard</span>
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

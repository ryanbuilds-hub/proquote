import { BusinessSettings } from "@/components/business-settings";
import { PasswordSettings } from "@/components/password-settings";
import { requireWorkspace } from "@/lib/workspace";

export default async function SettingsPage() {
  const { business, supabase, user } = await requireWorkspace();
  const logoUrl = business.logo_path
    ? supabase.storage.from("business-logos").getPublicUrl(business.logo_path).data.publicUrl
    : null;
  return (
    <div className="page-content narrow-content">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Workspace settings</p>
          <h1>Business details</h1>
          <p className="muted">Your business details appear on quotes you share, and your logo appears on printable quotes and PDFs.</p>
        </div>
      </header>
      <BusinessSettings business={business} logoUrl={logoUrl} />
      <section className="settings-section">
        <header className="page-heading">
          <div>
            <p className="eyebrow">Account security</p>
            <h2>Change password</h2>
            <p className="muted">Confirm your current password before choosing a new one.</p>
          </div>
        </header>
        <PasswordSettings email={user.email ?? ""} />
      </section>
    </div>
  );
}

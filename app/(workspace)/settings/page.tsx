import { BusinessSettings } from "@/components/business-settings";
import { PasswordSettings } from "@/components/password-settings";
import { requireWorkspace } from "@/lib/workspace";

export default async function SettingsPage() {
  const { business, user } = await requireWorkspace();
  return (
    <div className="page-content narrow-content">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Workspace settings</p>
          <h1>Business details</h1>
          <p className="muted">These details appear at the top of quotes you share.</p>
        </div>
      </header>
      <BusinessSettings business={business} />
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

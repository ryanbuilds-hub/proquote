import { BusinessSettings } from "@/components/business-settings";
import { requireWorkspace } from "@/lib/workspace";

export default async function SettingsPage() {
  const { business } = await requireWorkspace();
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
    </div>
  );
}

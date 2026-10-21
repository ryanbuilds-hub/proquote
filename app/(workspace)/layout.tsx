import { WorkspaceShell } from "@/components/workspace-shell";
import { requireWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function WorkspaceLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { business, isPlatformAdmin } = await requireWorkspace();
  return (
    <WorkspaceShell
      businessName={business.name}
      isPlatformAdmin={isPlatformAdmin}
    >
      {children}
    </WorkspaceShell>
  );
}

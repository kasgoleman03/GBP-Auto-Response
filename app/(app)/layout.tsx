import { RequireConnection } from "@/components/RequireConnection";
import { AppShell } from "@/components/AppShell";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RequireConnection>
      <AppShell>{children}</AppShell>
    </RequireConnection>
  );
}

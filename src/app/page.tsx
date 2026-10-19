import { AdminShell } from "@/components/admin/admin-shell";
import { Dashboard } from "@/features/dashboard/dashboard";
import { AuthGuard } from "@/features/auth/auth-guard";

export default function Home() {
  return (
    <AuthGuard>
      <AdminShell>
        <Dashboard />
      </AdminShell>
    </AuthGuard>
  );
}

import { AdminShell } from "@/components/admin/admin-shell";
import { AuthGuard } from "@/features/auth/auth-guard";
import { Sales } from "@/features/sales/sales";

export default function SalesPage() {
  return (
    <AuthGuard>
      <AdminShell currentPage="Ventas">
        <Sales />
      </AdminShell>
    </AuthGuard>
  );
}

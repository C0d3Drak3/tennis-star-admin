import { AdminShell } from "@/components/admin/admin-shell";
import { AuthGuard } from "@/features/auth/auth-guard";
import { Customers } from "@/features/customers/customers";

export default function CustomersPage() {
  return (
    <AuthGuard>
      <AdminShell currentPage="Clientes">
        <Customers />
      </AdminShell>
    </AuthGuard>
  );
}

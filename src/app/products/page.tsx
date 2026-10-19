import { AdminShell } from "@/components/admin/admin-shell";
import { AuthGuard } from "@/features/auth/auth-guard";
import { Products } from "@/features/products/products";

export default function ProductsPage() {
  return (
    <AuthGuard>
      <AdminShell currentPage="Productos">
        <Products />
      </AdminShell>
    </AuthGuard>
  );
}

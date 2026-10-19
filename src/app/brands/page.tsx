import { AdminShell } from "@/components/admin/admin-shell";
import { AuthGuard } from "@/features/auth/auth-guard";
import { Brands } from "@/features/brands/brands";

export default function BrandsPage() {
  return (
    <AuthGuard>
      <AdminShell currentPage="Marcas">
        <Brands />
      </AdminShell>
    </AuthGuard>
  );
}

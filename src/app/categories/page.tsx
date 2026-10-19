import { AdminShell } from "@/components/admin/admin-shell";
import { AuthGuard } from "@/features/auth/auth-guard";
import { Categories } from "@/features/categories/categories";

export default function CategoriesPage() {
  return (
    <AuthGuard>
      <AdminShell currentPage="Categorías">
        <Categories />
      </AdminShell>
    </AuthGuard>
  );
}

import type { ReactNode } from "react";
import { AdminHeader } from "@/components/admin/admin-header";
import { AdminSidebar } from "@/components/admin/admin-sidebar";

export function AdminShell({
  children,
  currentPage,
}: {
  children: ReactNode;
  currentPage?: string;
}) {
  return (
    <div className="min-h-screen bg-background md:flex">
      <AdminSidebar activeLabel={currentPage} />
      <div className="min-w-0 flex-1">
        <AdminHeader />
        <main className="mx-auto w-full max-w-[1500px] p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Panel de administración | Tennis Star",
  description: "Panel administrativo de Tennis Star.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}

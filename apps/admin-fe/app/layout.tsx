import type { Metadata } from "next";
import "./globals.css";
import { AdminAuthProvider } from "@/contexts/AdminAuthContext";

export const metadata: Metadata = {
  title: "Bloom Admin Dashboard",
  description: "Admin dashboard for Bloom Meeting Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AdminAuthProvider>{children}</AdminAuthProvider>
      </body>
    </html>
  );
}


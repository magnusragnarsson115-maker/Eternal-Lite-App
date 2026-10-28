import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BRAK AI",
  description: "Gdzie firma traci klientów i pieniądze — i jak je odzyskać",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <body>{children}</body>
    </html>
  );
}

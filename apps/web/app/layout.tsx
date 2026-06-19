import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vera — copiloto de recrutamento",
  description: "App interno da IRIS Tech (Vera / motor Lince).",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-PT">
      <body>{children}</body>
    </html>
  );
}

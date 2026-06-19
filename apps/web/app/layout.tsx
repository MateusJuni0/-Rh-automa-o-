import "@rh/ui/styles/tokens.css";
import "@rh/ui/styles/ui.css";
import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { NavBar } from "./components/NavBar";

export const metadata: Metadata = {
  title: "Vera — copiloto de recrutamento",
  description: "App interno da IRIS Tech (Vera / motor Lince).",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-PT">
      <body className="min-h-screen bg-surface text-ink">
        <NavBar />
        <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}

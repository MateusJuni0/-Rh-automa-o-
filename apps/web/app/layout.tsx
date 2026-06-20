import "@rh/ui/styles/tokens.css";
import "@rh/ui/styles/ui.css";
import "./globals.css";
import type { Metadata } from "next";
import { Bricolage_Grotesque } from "next/font/google";
import type { ReactNode } from "react";
import { NavBar } from "./components/NavBar";

/** Display font (Bricolage Grotesque) — só títulos/marca. O corpo mantém-se Inter (tokens LOCKED). */
const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Vera — copiloto de recrutamento",
  description: "App interno da IRIS Tech (Vera / motor Lince).",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-PT" className={display.variable}>
      <body className="min-h-screen bg-surface text-ink antialiased">
        <NavBar />
        <main className="mx-auto w-full max-w-6xl px-6 py-10 md:py-12">{children}</main>
      </body>
    </html>
  );
}

import "@rh/ui/styles/tokens.css";
import "@rh/ui/styles/ui.css";
import "./globals.css";
import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import type { ReactNode } from "react";
import { NavBar } from "./components/NavBar";

/** Display font (Space Grotesk) — títulos/marca bold e graphic. O corpo mantém-se Inter. */
const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display-grotesk",
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

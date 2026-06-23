import "@rh/ui/styles/tokens.css";
import "@rh/ui/styles/ui.css";
import "./globals.css";
import { schema } from "@rh/db";
import { and, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import type { ReactNode } from "react";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";
import { Sidebar } from "./components/Sidebar";

/** Display font (Space Grotesk) — títulos/marca bold e graphic. O corpo mantém-se Inter. */
const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display-grotesk",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "IRIS — copiloto de recrutamento",
  description: "App interno da IRIS Tech (IRIS / motor Lince).",
};

/** Nome do recrutador para a sidebar (undefined no login / sem sessão — falha silenciosa de propósito). */
async function currentName(): Promise<string | undefined> {
  try {
    const { agencyId, recruiterId } = await getSession();
    const [me] = await getDb()
      .select({ name: schema.recruiter.name })
      .from(schema.recruiter)
      .where(and(eq(schema.recruiter.id, recruiterId), eq(schema.recruiter.agencyId, agencyId)));
    return me?.name ?? undefined;
  } catch {
    return undefined;
  }
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const userName = await currentName();
  return (
    <html lang="pt-PT" className={display.variable}>
      <body className="bg-surface text-ink antialiased">
        <div className="flex min-h-screen">
          <Sidebar userName={userName} />
          <main className="min-w-0 flex-1">
            <div className="mx-auto max-w-5xl px-6 py-8 md:px-10 md:py-10">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}

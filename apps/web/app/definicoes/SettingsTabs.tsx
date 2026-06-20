"use client";

import { type TabItem, Tabs } from "@rh/ui";
import { type ReactNode, useState } from "react";

interface SettingsTabsProps {
  items: TabItem[];
  /** Painéis por id de tab. O painel ativo é o único renderizado. */
  panels: Record<string, ReactNode>;
  /** Id do separador inicial. */
  initial: string;
}

/**
 * Casca client das Definições: detém o separador ativo e mostra só o painel correspondente.
 * Os painéis são RSC pré-renderizados (passados como `children`), por isso não há fetch no cliente.
 */
export function SettingsTabs({ items, panels, initial }: SettingsTabsProps) {
  const [active, setActive] = useState(initial);
  return (
    <div className="flex flex-col gap-6">
      <Tabs items={items} value={active} onValueChange={setActive} />
      <div>{panels[active]}</div>
    </div>
  );
}

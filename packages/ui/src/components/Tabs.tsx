import type { ReactNode } from "react";
import { cx } from "../cx";

export interface TabItem {
  id: string;
  label: ReactNode;
}

export interface TabsProps {
  items: TabItem[];
  value: string;
  onValueChange?: (id: string) => void;
  className?: string;
}

/** Tabs controlado (presentational): o pai detém `value` e renderiza o painel ativo. */
export function Tabs({ items, value, onValueChange, className }: TabsProps) {
  return (
    <div className={cx("vera-tabs", className)} role="tablist">
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            className={cx("vera-tab", active && "vera-tab--active")}
            onClick={onValueChange ? () => onValueChange(item.id) : undefined}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

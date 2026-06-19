import type { ButtonHTMLAttributes } from "react";
import { cx } from "../cx";

export type ButtonVariant = "primary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

/** Botão base do HUD. `type` é "button" por defeito (evita submits acidentais). */
export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx("vera-btn", `vera-btn--${variant}`, `vera-btn--${size}`, className)}
      {...rest}
    >
      {children}
    </button>
  );
}

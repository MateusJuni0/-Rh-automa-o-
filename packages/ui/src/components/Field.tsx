import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { cx } from "../cx";

export interface FieldProps {
  label: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  error?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** Wrapper rótulo+controlo com hint/erro (3 estados de validação na fronteira). */
export function Field({ label, htmlFor, hint, error, className, children }: FieldProps) {
  return (
    <label className={cx("vera-field", className)} htmlFor={htmlFor}>
      <span className="vera-field__label">{label}</span>
      {children}
      {hint !== undefined ? <span className="vera-field__hint">{hint}</span> : null}
      {error !== undefined ? <span className="vera-field__error">{error}</span> : null}
    </label>
  );
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx("vera-input", className)} {...rest} />;
}

export function Textarea({
  className,
  rows = 3,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx("vera-textarea", className)} rows={rows} {...rest} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx("vera-select", className)} {...rest}>
      {children}
    </select>
  );
}

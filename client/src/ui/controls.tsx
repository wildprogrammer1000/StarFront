import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "md" | "sm";
  block?: boolean;
  sub?: string;
}

export function Button({
  variant = "secondary",
  size = "md",
  block = false,
  sub,
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  const cls = [
    "sf-btn",
    `sf-btn-${variant}`,
    size === "sm" ? "sf-btn-sm" : "",
    block ? "sf-btn-block" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button type={type} className={cls} {...rest}>
      <span className="sf-btn-label">{children}</span>
      {sub && <span className="sf-btn-sub">{sub}</span>}
    </button>
  );
}

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const TextField = forwardRef<HTMLInputElement, FieldProps>(
  function TextField({ label, id, className, ...rest }, ref) {
    return (
      <label className="sf-field" htmlFor={id}>
        {label && <span className="sf-field-label">{label}</span>}
        <input
          ref={ref}
          id={id}
          className={className ? `sf-input ${className}` : "sf-input"}
          {...rest}
        />
      </label>
    );
  }
);

interface SwitchProps {
  checked: boolean;
  label: string;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}

export function Switch({ checked, label, disabled, onChange }: SwitchProps) {
  return (
    <button
      type="button"
      className={checked ? "sf-switch is-on" : "sf-switch"}
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span>{label}</span>
      <span className="sf-switch-track" aria-hidden="true">
        <span className="sf-switch-knob" />
      </span>
    </button>
  );
}

export function Banner({ children }: { children: ReactNode }) {
  return (
    <div className="sf-banner" role="alert">
      {children}
    </div>
  );
}

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
}

/** SC 메탈 콘솔용 커스텀 드롭다운 (네이티브 select 대체) */
export function MetalSelect<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
}: {
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className={
        open
          ? `metal-select is-open${className ? ` ${className}` : ""}`
          : `metal-select${className ? ` ${className}` : ""}`
      }
    >
      <button
        type="button"
        className="metal-select-trigger"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="metal-select-value">{selected?.label ?? ""}</span>
        <span className="metal-select-caret" aria-hidden="true" />
      </button>
      {open && (
        <ul id={listId} className="metal-select-menu" role="listbox" aria-label={label}>
          {options.map((opt) => {
            const on = opt.value === value;
            return (
              <li key={opt.value} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={on}
                  className={on ? "metal-select-option is-on" : "metal-select-option"}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                >
                  {opt.label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

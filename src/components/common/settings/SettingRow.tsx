import { type ReactNode } from "react";

interface SettingRowProps {
  label: string;
  description?: string;
  children: ReactNode;
  vertical?: boolean;
  required?: boolean;
  className?: string;
}

export function SettingRow({
  label,
  description,
  children,
  vertical = false,
  required = false,
  className = "",
}: SettingRowProps) {
  if (vertical) {
    return (
      <div className={`space-y-1.5 ${className}`}>
        <div>
          <label className="text-[12.5px] font-medium text-foreground">
            {label} {required && <span className="text-red-400">*</span>}
          </label>
          {description && <p className="text-[11px] text-muted-foreground">{description}</p>}
        </div>
        <div>{children}</div>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-2.5 border-b border-brand/5 last:border-b-0 ${className}`}
    >
      <div className="max-w-[65%]">
        <p className="text-[12.5px] font-medium text-foreground">
          {label} {required && <span className="text-red-400">*</span>}
        </p>
        {description && <p className="text-[11px] text-muted-foreground leading-snug">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

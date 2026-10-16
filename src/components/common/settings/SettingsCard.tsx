import { type ReactNode } from "react";

interface SettingsCardProps {
  title: string;
  subtitle?: string;
  description?: string;
  badge?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function SettingsCard({
  title,
  subtitle,
  description,
  badge,
  action,
  children,
  className = "",
}: SettingsCardProps) {
  const subText = subtitle || description;

  return (
    <div className={`card-interactive rounded-xl border border-brand/20 bg-panel/85 p-5 shadow-lg ${className}`}>
      {/* Card Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-brand/10 pb-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-display text-[15px] font-bold text-foreground text-glow">{title}</h3>
            {badge && (
              <span className="rounded-full border border-brand-bright/40 bg-brand/20 px-2 py-0.5 text-[10px] font-mono font-medium text-brand-bright">
                {badge}
              </span>
            )}
          </div>
          {subText && <p className="text-[12px] text-muted-foreground mt-0.5">{subText}</p>}
        </div>
        {action && <div className="flex items-center gap-2">{action}</div>}
      </div>

      {/* Card Body */}
      <div>{children}</div>
    </div>
  );
}


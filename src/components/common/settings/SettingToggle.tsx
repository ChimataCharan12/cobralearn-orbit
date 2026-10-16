interface SettingToggleProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function SettingToggle({ label, description, checked, onChange, disabled = false }: SettingToggleProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 border-b border-brand/5 last:border-b-0">
      <div className="max-w-[75%]">
        <p className="text-[12.5px] font-medium text-foreground">{label}</p>
        {description && <p className="text-[11px] text-muted-foreground leading-snug">{description}</p>}
      </div>

      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed ${
          checked ? "bg-brand-bright shadow-[0_0_10px_rgba(0,255,170,0.3)]" : "bg-muted-foreground/30"
        }`}
      >
        <span
          className={`pointer-events-none inline-block size-4 transform rounded-full bg-background shadow ring-0 transition duration-200 ease-in-out ${
            checked ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

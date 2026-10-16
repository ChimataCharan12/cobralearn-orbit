import { useState } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";

export function LocalizationCard() {
  const [defaultLang, setDefaultLang] = useState("English");
  const [supportedLangs, setSupportedLangs] = useState(["English", "Hindi", "Telugu"]);
  const [defaultCountry, setDefaultCountry] = useState("India");
  const [currency, setCurrency] = useState("INR (₹) - Indian Rupee");

  const handleRemoveLang = (lang: string) => {
    if (supportedLangs.length <= 1) {
      toast.error("At least one supported language is required.");
      return;
    }
    setSupportedLangs((prev) => prev.filter((l) => l !== lang));
  };

  const handleAddLang = () => {
    const lang = prompt("Enter language name (e.g. Spanish, German, Tamil):");
    if (lang && !supportedLangs.includes(lang.trim())) {
      setSupportedLangs((prev) => [...prev, lang.trim()]);
      toast.success(`Added ${lang.trim()} to supported languages.`);
    }
  };

  return (
    <div className="card-interactive rounded-xl border border-brand/20 bg-panel/85 p-4 shadow-lg">
      <div className="pb-3">
        <h3 className="font-display text-[15px] font-bold text-foreground text-glow">Localization</h3>
        <p className="text-[12px] text-muted-foreground">Set your website's language and region settings.</p>
      </div>

      <div className="space-y-3 pt-1">
        {/* Row 1: Default Lang & Supported Langs */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="text-[11.5px] font-medium text-foreground/80">Default Language</label>
            <select
              value={defaultLang}
              onChange={(e) => setDefaultLang(e.target.value)}
              className="mt-1 w-full rounded-lg border border-brand/20 bg-background/70 px-3 py-2 text-[12.5px] text-foreground focus:border-brand-bright focus:outline-none"
            >
              <option value="English">English</option>
              <option value="Hindi">Hindi</option>
              <option value="Telugu">Telugu</option>
              <option value="Spanish">Spanish</option>
            </select>
          </div>

          <div>
            <label className="text-[11.5px] font-medium text-foreground/80">Supported Languages</label>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {supportedLangs.map((lang) => (
                <span
                  key={lang}
                  className="flex items-center gap-1 rounded-md border border-brand-cyan/40 bg-brand-cyan/15 px-2 py-1 text-[11px] font-semibold text-brand-cyan"
                >
                  <span>{lang}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveLang(lang)}
                    aria-label={`Remove ${lang}`}
                    className="hover:text-white"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}

              <button
                type="button"
                onClick={handleAddLang}
                className="flex items-center gap-1 rounded-md border border-brand/30 bg-background/60 px-2 py-1 text-[11px] font-medium text-brand-bright hover:border-brand-bright"
              >
                <Plus className="size-3" />
                <span>Add Language</span>
              </button>
            </div>
          </div>
        </div>

        {/* Row 2: Default Country & Currency */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="text-[11.5px] font-medium text-foreground/80">Default Country/Region</label>
            <select
              value={defaultCountry}
              onChange={(e) => setDefaultCountry(e.target.value)}
              className="mt-1 w-full rounded-lg border border-brand/20 bg-background/70 px-3 py-2 text-[12.5px] text-foreground focus:border-brand-bright focus:outline-none"
            >
              <option value="India">India</option>
              <option value="United States">United States</option>
              <option value="United Kingdom">United Kingdom</option>
              <option value="Canada">Canada</option>
              <option value="Germany">Germany</option>
            </select>
          </div>

          <div>
            <label className="text-[11.5px] font-medium text-foreground/80">Currency</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="mt-1 w-full rounded-lg border border-brand/20 bg-background/70 px-3 py-2 text-[12.5px] text-foreground focus:border-brand-bright focus:outline-none"
            >
              <option value="INR (₹) - Indian Rupee">INR (₹) - Indian Rupee</option>
              <option value="USD ($) - US Dollar">USD ($) - US Dollar</option>
              <option value="EUR (€) - Euro">EUR (€) - Euro</option>
              <option value="GBP (£) - British Pound">GBP (£) - British Pound</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

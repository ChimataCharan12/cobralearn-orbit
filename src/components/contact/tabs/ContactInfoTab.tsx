import { useState } from "react";
import { Mail, Phone, MapPin, Clock, RotateCcw, Check } from "lucide-react";
import { toast } from "sonner";
import { useContactConfig } from "@/lib/contact-store";

interface ContactInfoTabProps {
  onMarkDirty?: () => void;
}

export function ContactInfoTab({ onMarkDirty }: ContactInfoTabProps) {
  const { config, updateConfig, resetContactInfoToDefault } = useContactConfig();
  const info = config.contactInfo;

  const handleFieldChange = (field: string, value: string) => {
    updateConfig((prev) => ({
      ...prev,
      contactInfo: {
        ...prev.contactInfo,
        [field]: value,
      },
    }));
    onMarkDirty?.();
  };

  const handleReset = () => {
    resetContactInfoToDefault();
    toast.info("Contact information reset to empty defaults.");
    onMarkDirty?.();
  };

  const hasAnyChannel = Boolean(info.email?.trim() || info.phone?.trim() || info.location?.trim());

  return (
    <div className="space-y-6">
      {/* 2-Column Grid: Left (Form Controls), Right (Preview) */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.45fr_1fr] gap-6 items-start">
        {/* Left Column: Form Cards */}
        <div className="space-y-6">
          {/* Main Card */}
          <div className="rounded-2xl border border-brand/25 bg-panel/85 p-5 sm:p-6 backdrop-blur-xl shadow-lg space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-brand/15">
              <div className="flex items-center gap-2.5">
                <div className="grid size-8 place-items-center rounded-lg border border-brand/35 bg-brand/10 text-brand-bright">
                  <Phone className="size-4" />
                </div>
                <div>
                  <h3 className="font-display text-[15px] font-bold text-foreground text-glow">
                    Direct Contact Channels
                  </h3>
                  <p className="text-[12px] text-muted-foreground">
                    Public customer contact email, phone line, business hours and office location.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleReset}
                className="flex items-center gap-1.5 rounded-lg border border-brand/20 bg-background/50 px-2.5 py-1.5 text-[11.5px] font-medium text-muted-foreground transition hover:border-brand-bright/40 hover:text-foreground cursor-pointer"
              >
                <RotateCcw className="size-3.5" />
                <span>Reset to Default</span>
              </button>
            </div>

            {/* Email Section */}
            <div className="rounded-xl border border-brand/20 bg-background/40 p-4 space-y-3">
              <div className="flex items-center gap-2 text-brand-bright font-display text-[13px] font-bold">
                <Mail className="size-4" />
                <span>Email Channel</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="contactEmail" className="block text-[11.5px] font-semibold text-foreground/80 mb-1">
                    Primary Contact Email
                  </label>
                  <input
                    id="contactEmail"
                    type="email"
                    value={info.email}
                    onChange={(e) => handleFieldChange("email", e.target.value)}
                    placeholder="e.g. contact@yourdomain.com"
                    className="h-9 w-full rounded-lg border border-brand/25 bg-background/70 px-3 text-[12.5px] text-foreground focus:border-brand-bright focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="emailDescription" className="block text-[11.5px] font-semibold text-foreground/80 mb-1">
                    Email Description / Subtitle
                  </label>
                  <input
                    id="emailDescription"
                    type="text"
                    value={info.emailDescription}
                    onChange={(e) => handleFieldChange("emailDescription", e.target.value)}
                    placeholder="For general inquiries and business discussions"
                    className="h-9 w-full rounded-lg border border-brand/25 bg-background/70 px-3 text-[12.5px] text-foreground focus:border-brand-bright focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Phone Section */}
            <div className="rounded-xl border border-brand/20 bg-background/40 p-4 space-y-3">
              <div className="flex items-center gap-2 text-brand-bright font-display text-[13px] font-bold">
                <Phone className="size-4" />
                <span>Telephone & Operating Hours</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="contactPhone" className="block text-[11.5px] font-semibold text-foreground/80 mb-1">
                    Inbound Phone Number
                  </label>
                  <input
                    id="contactPhone"
                    type="text"
                    value={info.phone}
                    onChange={(e) => handleFieldChange("phone", e.target.value)}
                    placeholder="e.g. +1 (555) 012-3456"
                    className="h-9 w-full rounded-lg border border-brand/25 bg-background/70 px-3 text-[12.5px] text-foreground focus:border-brand-bright focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="businessHours" className="block text-[11.5px] font-semibold text-foreground/80 mb-1">
                    Operating Schedule & Timezone
                  </label>
                  <input
                    id="businessHours"
                    type="text"
                    value={info.businessHours}
                    onChange={(e) => handleFieldChange("businessHours", e.target.value)}
                    placeholder="Mon - Fri, 10:00 AM - 6:00 PM (IST)"
                    className="h-9 w-full rounded-lg border border-brand/25 bg-background/70 px-3 text-[12.5px] text-foreground focus:border-brand-bright focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Location Section */}
            <div className="rounded-xl border border-brand/20 bg-background/40 p-4 space-y-3">
              <div className="flex items-center gap-2 text-brand-bright font-display text-[13px] font-bold">
                <MapPin className="size-4" />
                <span>Headquarters & Visiting Details</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="contactLocation" className="block text-[11.5px] font-semibold text-foreground/80 mb-1">
                    Location / City
                  </label>
                  <input
                    id="contactLocation"
                    type="text"
                    value={info.location}
                    onChange={(e) => handleFieldChange("location", e.target.value)}
                    placeholder="e.g. City, State, Country"
                    className="h-9 w-full rounded-lg border border-brand/25 bg-background/70 px-3 text-[12.5px] text-foreground focus:border-brand-bright focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="locationDescription" className="block text-[11.5px] font-semibold text-foreground/80 mb-1">
                    Appointment / Onsite Note
                  </label>
                  <input
                    id="locationDescription"
                    type="text"
                    value={info.locationDescription}
                    onChange={(e) => handleFieldChange("locationDescription", e.target.value)}
                    placeholder="Open for onsite meetings (by appointment)"
                    className="h-9 w-full rounded-lg border border-brand/25 bg-background/70 px-3 text-[12.5px] text-foreground focus:border-brand-bright focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live Card Preview */}
        <div className="sticky top-4 rounded-2xl border border-brand/30 bg-panel-strong/90 p-5 backdrop-blur-xl shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-brand/15">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-brand-bright animate-pulse" />
              <h3 className="font-display text-[14.5px] font-bold text-white tracking-wide">
                Get In Touch Preview
              </h3>
            </div>
          </div>

          <p className="text-[11.5px] text-muted-foreground">
            How your contact information appears inside the right-hand panel on `/contact`. Empty channels are hidden from visitors.
          </p>

          {/* Mini Get In Touch Card */}
          <div className="rounded-xl border border-brand/35 bg-[#040e08] p-4 text-left shadow-inner space-y-3">
            <h4 className="font-display text-[15px] font-bold text-white uppercase">
              GET IN TOUCH
            </h4>
            <div className="h-[2px] w-10 bg-gradient-to-r from-brand-bright to-transparent rounded-full" />
            <p className="text-[11px] text-[#94a3b8]">
              Here are the best ways to reach us.
            </p>

            <div className="space-y-2.5 pt-1">
              {/* Email */}
              {info.email?.trim() ? (
                <div className="flex items-start gap-2.5 p-2 rounded-lg border border-brand/20 bg-[#021008]/60">
                  <div className="size-7 rounded-lg border border-brand/40 bg-[#022010] flex items-center justify-center text-brand-bright shrink-0">
                    <Mail className="size-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[9.5px] font-bold uppercase tracking-wider text-[#64748b]">
                      Email
                    </p>
                    <p className="text-[11.5px] font-semibold text-[#00ff87] truncate">
                      {info.email}
                    </p>
                    {info.emailDescription && (
                      <p className="text-[10px] text-[#94a3b8] truncate">
                        {info.emailDescription}
                      </p>
                    )}
                  </div>
                </div>
              ) : null}

              {/* Phone */}
              {info.phone?.trim() ? (
                <div className="flex items-start gap-2.5 p-2 rounded-lg border border-brand/20 bg-[#021008]/60">
                  <div className="size-7 rounded-lg border border-brand/40 bg-[#022010] flex items-center justify-center text-brand-bright shrink-0">
                    <Phone className="size-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[9.5px] font-bold uppercase tracking-wider text-[#64748b]">
                      Phone
                    </p>
                    <p className="text-[11.5px] font-semibold text-white truncate">
                      {info.phone}
                    </p>
                    {info.businessHours && (
                      <p className="text-[10px] text-[#94a3b8] truncate">
                        {info.businessHours}
                      </p>
                    )}
                  </div>
                </div>
              ) : null}

              {/* Location */}
              {info.location?.trim() ? (
                <div className="flex items-start gap-2.5 p-2 rounded-lg border border-brand/20 bg-[#021008]/60">
                  <div className="size-7 rounded-lg border border-brand/40 bg-[#022010] flex items-center justify-center text-brand-bright shrink-0">
                    <MapPin className="size-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[9.5px] font-bold uppercase tracking-wider text-[#64748b]">
                      Location
                    </p>
                    <p className="text-[11.5px] font-semibold text-[#00ff87] truncate">
                      {info.location}
                    </p>
                    {info.locationDescription && (
                      <p className="text-[10px] text-[#94a3b8] truncate">
                        {info.locationDescription}
                      </p>
                    )}
                  </div>
                </div>
              ) : null}

              {!hasAnyChannel && (
                <div className="p-3 rounded-lg border border-dashed border-brand/20 text-center text-[11px] text-muted-foreground/60">
                  No direct contact channels configured. Channels will be hidden from public view.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

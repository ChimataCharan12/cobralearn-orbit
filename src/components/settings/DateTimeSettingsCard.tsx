import { useState } from "react";

export function DateTimeSettingsCard() {
  const [timezone, setTimezone] = useState("(GMT+5:30) Asia/Kolkata");
  const [dateFormat, setDateFormat] = useState("DD MMM, YYYY (e.g., 25 Sep, 2026)");
  const [timeFormat, setTimeFormat] = useState("12 Hour (e.g., 03:30 PM)");
  const [weekStart, setWeekStart] = useState("Monday");

  return (
    <div className="card-interactive rounded-xl border border-brand/20 bg-panel/85 p-4 shadow-lg">
      <div className="pb-3">
        <h3 className="font-display text-[15px] font-bold text-foreground text-glow">Date & Time Settings</h3>
        <p className="text-[12px] text-muted-foreground">Configure timezone, date and time formats.</p>
      </div>

      <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-2">
        <div>
          <label className="text-[11.5px] font-medium text-foreground/80">Timezone</label>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="mt-1 w-full rounded-lg border border-brand/20 bg-background/70 px-3 py-2 text-[12.5px] text-foreground focus:border-brand-bright focus:outline-none"
          >
            <option value="(GMT+5:30) Asia/Kolkata">(GMT+5:30) Asia/Kolkata</option>
            <option value="(GMT+0:00) UTC">(GMT+0:00) UTC</option>
            <option value="(GMT-5:00) America/New_York">(GMT-5:00) America/New_York</option>
            <option value="(GMT+1:00) Europe/London">(GMT+1:00) Europe/London</option>
            <option value="(GMT+8:00) Asia/Singapore">(GMT+8:00) Asia/Singapore</option>
          </select>
        </div>

        <div>
          <label className="text-[11.5px] font-medium text-foreground/80">Date Format</label>
          <select
            value={dateFormat}
            onChange={(e) => setDateFormat(e.target.value)}
            className="mt-1 w-full rounded-lg border border-brand/20 bg-background/70 px-3 py-2 text-[12.5px] text-foreground focus:border-brand-bright focus:outline-none"
          >
            <option value="DD MMM, YYYY (e.g., 25 Sep, 2026)">DD MMM, YYYY (e.g., 25 Sep, 2026)</option>
            <option value="YYYY-MM-DD (e.g., 2026-09-25)">YYYY-MM-DD (e.g., 2026-09-25)</option>
            <option value="MM/DD/YYYY (e.g., 09/25/2026)">MM/DD/YYYY (e.g., 09/25/2026)</option>
          </select>
        </div>

        <div>
          <label className="text-[11.5px] font-medium text-foreground/80">Time Format</label>
          <select
            value={timeFormat}
            onChange={(e) => setTimeFormat(e.target.value)}
            className="mt-1 w-full rounded-lg border border-brand/20 bg-background/70 px-3 py-2 text-[12.5px] text-foreground focus:border-brand-bright focus:outline-none"
          >
            <option value="12 Hour (e.g., 03:30 PM)">12 Hour (e.g., 03:30 PM)</option>
            <option value="24 Hour (e.g., 15:30)">24 Hour (e.g., 15:30)</option>
          </select>
        </div>

        <div>
          <label className="text-[11.5px] font-medium text-foreground/80">Week Start Day</label>
          <select
            value={weekStart}
            onChange={(e) => setWeekStart(e.target.value)}
            className="mt-1 w-full rounded-lg border border-brand/20 bg-background/70 px-3 py-2 text-[12.5px] text-foreground focus:border-brand-bright focus:outline-none"
          >
            <option value="Monday">Monday</option>
            <option value="Sunday">Sunday</option>
            <option value="Saturday">Saturday</option>
          </select>
        </div>
      </div>
    </div>
  );
}

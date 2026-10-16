import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import { useState } from "react";

import { Input } from "@/components/ui/input";

export function PasswordInput() {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative flex items-center">
      <LockKeyhole
        aria-hidden="true"
        className="pointer-events-none absolute left-3.5 top-1/2 z-10 size-[17px] -translate-y-1/2 text-[#00ff87]"
      />
      <Input
        id="password"
        name="password"
        type={visible ? "text" : "password"}
        autoComplete="current-password"
        placeholder="Enter your password"
        required
        className="h-[40px] xl:h-[44px] w-full rounded-[10px] border border-[#00ff87]/25 bg-[#020905]/80 pl-10 pr-10 text-[13px] text-white placeholder:text-[#64748b] focus-visible:border-[#00ff87] focus-visible:ring-1 focus-visible:ring-[#00ff87]/40 focus-visible:ring-offset-0 shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)]"
      />
      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        aria-label={visible ? "Hide password" : "Show password"}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8] transition-colors hover:text-white cursor-pointer"
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}
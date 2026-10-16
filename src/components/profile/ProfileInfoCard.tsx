import { useState, useRef } from "react";
import { Lock, Camera, Crown, Shield, ShieldCheck, Loader2, AlertTriangle, RotateCcw } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import type { AdminProfile } from "@prisma/client";

export interface ProfileFormData {
  fullName: string;
  phone: string;
  designation: string;
  bio: string;
  avatarUrl: string | null;
}

interface ProfileInfoCardProps {
  profile: AdminProfile | null;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  formData: ProfileFormData;
  onChange: (updates: Partial<ProfileFormData>) => void;
  onUploadAvatar?: (file: File) => Promise<boolean>;
  onRemoveAvatar?: () => Promise<boolean> | void;
}

export function ProfileInfoCard({
  profile,
  isLoading = false,
  error = null,
  onRetry,
  formData,
  onChange,
  onUploadAvatar,
  onRemoveAvatar,
}: ProfileInfoCardProps) {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleChangePassword = () => {
    navigate({ to: "/admin/profile/change-password" });
  };

  const handleAvatarAction = async (action: "change" | "remove") => {
    if (action === "change") {
      fileInputRef.current?.click();
    } else {
      if (onRemoveAvatar) {
        await onRemoveAvatar();
      }
      onChange({ avatarUrl: null });
      toast.info("Avatar reset to default placeholder.");
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input value so re-selecting same file works
    e.target.value = "";

    const allowedMimes = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];
    if (!allowedMimes.includes(file.type.toLowerCase())) {
      toast.error("Unsupported file format. Please upload JPEG, PNG, WebP, GIF, or AVIF.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("File size exceeds maximum allowed 2.0 MB.");
      return;
    }

    if (onUploadAvatar) {
      setIsUploading(true);
      await onUploadAvatar(file);
      setIsUploading(false);
    } else {
      toast.error("Avatar upload handler is not configured.");
    }
  };

  // Determine role display and avatar initial
  const displayName = formData.fullName || profile?.fullName || "Administrator";
  const avatarLetter = (displayName.trim()[0] || "A").toUpperCase();
  const currentRole = profile?.role || "ADMIN";
  const currentEmail = profile?.email || "admin@cobralearn.com";

  return (
    <div className="card-interactive rounded-xl border border-brand/20 bg-panel/85 p-4 shadow-lg">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
        <div>
          <h3 className="font-display text-[15px] font-bold text-foreground text-glow">Profile Information</h3>
          <p className="text-[12px] text-muted-foreground">Update your personal and professional details.</p>
        </div>

        <button
          type="button"
          onClick={handleChangePassword}
          className="flex items-center gap-1.5 rounded-lg border border-brand/30 bg-background/60 px-3 py-1.5 text-[12px] font-medium text-foreground transition hover:border-brand-bright/50 hover:bg-brand/10 hover:text-brand-bright cursor-pointer"
        >
          <Lock className="size-3.5" />
          <span>Change Password</span>
        </button>
      </div>

      {isLoading ? (
        <div className="flex min-h-[220px] items-center justify-center py-8">
          <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
            <Loader2 className="size-5 animate-spin text-brand-bright" />
            <span>Loading verified administrator profile...</span>
          </div>
        </div>
      ) : (
        <>
          {error && !profile && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-[12.5px] text-amber-300">
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-4 shrink-0 text-amber-400" />
                <span>{error}</span>
              </div>
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="flex items-center gap-1 rounded border border-amber-400/40 bg-amber-400/15 px-2.5 py-1 text-[11.5px] font-semibold text-amber-300 hover:bg-amber-400/25 cursor-pointer"
                >
                  <RotateCcw className="size-3" />
                  <span>Retry</span>
                </button>
              )}
            </div>
          )}
          <div className="grid grid-cols-1 gap-6 pt-2 md:grid-cols-[180px_1fr]">
          {/* Left Avatar Column */}
          <div className="flex flex-col items-center text-center">
            <div className="relative">
              {/* Avatar Circle */}
              {formData.avatarUrl ? (
                <img
                  src={formData.avatarUrl}
                  alt={displayName}
                  className="size-24 rounded-full object-cover border-2 border-brand/50 shadow-[0_0_20px_rgba(0,255,170,0.35)]"
                />
              ) : (
                <div className="flex size-24 items-center justify-center rounded-full bg-gradient-to-tr from-brand/80 to-brand-cyan text-[36px] font-bold text-background shadow-[0_0_20px_rgba(0,255,170,0.35)]">
                  {avatarLetter}
                </div>
              )}

              {/* Camera Overlay Badge */}
              <div className="absolute bottom-0 right-0 flex size-7 items-center justify-center rounded-full border border-brand-bright/70 bg-background/90 text-brand-bright shadow">
                <Camera className="size-3.5" />
              </div>
            </div>

            <p className="mt-3 font-display text-[16px] font-bold text-foreground text-glow truncate max-w-[160px]">
              {displayName}
            </p>
            <p className="text-[12px] text-muted-foreground truncate max-w-[160px]">
              {formData.designation || profile?.designation || "Administrator"}
            </p>

            {/* Role Badge */}
            <div className="mt-2">
              {currentRole === "SUPER_ADMIN" ? (
                <div className="flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.2)]">
                  <Crown className="size-3" />
                  <span>Super Admin</span>
                </div>
              ) : currentRole === "ADMIN" ? (
                <div className="flex items-center gap-1 rounded-full border border-brand/40 bg-brand/15 px-2.5 py-0.5 text-[11px] font-semibold text-brand-bright">
                  <ShieldCheck className="size-3" />
                  <span>Administrator</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 rounded-full border border-cyan-500/40 bg-cyan-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-cyan-400">
                  <Shield className="size-3" />
                  <span>Editor</span>
                </div>
              )}
            </div>

            <p className="mt-3 text-[10.5px] text-muted-foreground">PNG, JPG (Max 2MB)</p>

            {/* Hidden file input for avatar upload */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileInputChange}
              accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
              className="hidden"
              aria-label="Upload profile photo"
            />

            {/* Action Buttons */}
            <div className="mt-3 flex w-full flex-col gap-2">
              <button
                type="button"
                disabled={isUploading || isLoading}
                onClick={() => handleAvatarAction("change")}
                className="w-full rounded-lg border border-brand/35 bg-brand/10 py-1.5 text-[12px] font-medium text-brand-bright transition hover:bg-brand/20 cursor-pointer disabled:opacity-50"
              >
                {isUploading ? (
                  <span className="flex items-center justify-center gap-1.5">
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>Uploading...</span>
                  </span>
                ) : (
                  "Change Photo"
                )}
              </button>
              <button
                type="button"
                disabled={isUploading || isLoading}
                onClick={() => handleAvatarAction("remove")}
                className="w-full rounded-lg border border-red-500/35 bg-red-950/20 py-1.5 text-[12px] font-medium text-red-400 transition hover:bg-red-950/40 cursor-pointer disabled:opacity-50"
              >
                Remove
              </button>
            </div>
          </div>

          {/* Right Form Fields */}
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-[11.5px] font-medium text-foreground/80">
                  Full Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => onChange({ fullName: e.target.value })}
                  placeholder="Enter full name"
                  required
                  className="mt-1 w-full rounded-lg border border-brand/20 bg-background/70 px-3 py-2 text-[12.5px] text-foreground focus:border-brand-bright focus:outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="text-[11.5px] font-medium text-foreground/80">
                    Email Address <span className="text-red-400">*</span>
                  </label>
                  <span className="text-[10px] text-muted-foreground">Managed by Auth</span>
                </div>
                <input
                  type="email"
                  value={currentEmail}
                  disabled
                  readOnly
                  aria-readonly="true"
                  className="mt-1 w-full rounded-lg border border-brand/15 bg-background/40 px-3 py-2 text-[12.5px] text-muted-foreground cursor-not-allowed select-none"
                />
              </div>
            </div>

            <div>
              <label className="text-[11.5px] font-medium text-foreground/80">Phone Number</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => onChange({ phone: e.target.value })}
                placeholder="+91 98765 43210"
                className="mt-1 w-full rounded-lg border border-brand/20 bg-background/70 px-3 py-2 text-[12.5px] text-foreground focus:border-brand-bright focus:outline-none placeholder:text-muted-foreground/60"
              />
            </div>

            <div>
              <label className="text-[11.5px] font-medium text-foreground/80">Designation</label>
              <input
                type="text"
                value={formData.designation}
                onChange={(e) => onChange({ designation: e.target.value })}
                placeholder="e.g. Chief Technology Officer"
                className="mt-1 w-full rounded-lg border border-brand/20 bg-background/70 px-3 py-2 text-[12.5px] text-foreground focus:border-brand-bright focus:outline-none placeholder:text-muted-foreground/60"
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="text-[11.5px] font-medium text-foreground/80">Bio / About</label>
                <span className="text-[10.5px] text-muted-foreground">{formData.bio.length}/300</span>
              </div>
              <textarea
                rows={3}
                value={formData.bio}
                maxLength={300}
                onChange={(e) => onChange({ bio: e.target.value })}
                placeholder="Brief administrative bio or responsibility area..."
                className="mt-1 w-full rounded-lg border border-brand/20 bg-background/70 p-3 text-[12.5px] leading-relaxed text-foreground focus:border-brand-bright focus:outline-none resize-none placeholder:text-muted-foreground/60"
              />
            </div>
          </div>
        </div>
      </>
      )}
    </div>
  );
}

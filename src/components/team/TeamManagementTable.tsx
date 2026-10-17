import { useState, useEffect, useCallback } from "react";
import {
  Users,
  ShieldCheck,
  ShieldAlert,
  Crown,
  Shield,
  RotateCcw,
  Loader2,
  CheckCircle2,
  XCircle,
  MoreVertical,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { adminClient } from "@/lib/api/admin-client";
import { useAuth } from "@/lib/auth/use-auth";
import type { AdminProfile, AdminRole } from "@prisma/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type RosterProfile = Omit<AdminProfile, "avatarUrl" | "bio" | "phone">;

export function TeamManagementTable() {
  const { adminProfile } = useAuth();
  const isSuperAdminViewer = adminProfile?.role === "SUPER_ADMIN";
  const currentAdminId = adminProfile?.id;

  const [profiles, setProfiles] = useState<RosterProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Role Change Modal state
  const [roleModalTarget, setRoleModalTarget] = useState<RosterProfile | null>(null);
  const [selectedRole, setSelectedRole] = useState<AdminRole>("ADMIN");
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);

  // Status Change Modal state
  const [statusModalTarget, setStatusModalTarget] = useState<RosterProfile | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Emergency MFA Reset Modal state (Phase 4.6 Track A)
  const [mfaModalTarget, setMfaModalTarget] = useState<RosterProfile | null>(null);
  const [mfaConfirmEmail, setMfaConfirmEmail] = useState("");
  const [mfaJustification, setMfaJustification] = useState("");
  const [isResettingMfa, setIsResettingMfa] = useState(false);
  const [mfaModalError, setMfaModalError] = useState<string | null>(null);

  const fetchRoster = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const res = await adminClient.listTeamProfiles();
    if (res.success && res.data) {
      setProfiles(res.data);
    } else {
      setError(res.error || "Unable to load administrator roster. ADMIN_READ permission required.");
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchRoster();
  }, [fetchRoster]);

  const handleOpenRoleModal = (profile: RosterProfile) => {
    setRoleModalTarget(profile);
    setSelectedRole(profile.role);
  };

  const handleConfirmRoleChange = async () => {
    if (!roleModalTarget) return;
    if (roleModalTarget.role === selectedRole) {
      setRoleModalTarget(null);
      return;
    }

    setIsUpdatingRole(true);
    const res = await adminClient.assignAdminRole(roleModalTarget.id, selectedRole);
    setIsUpdatingRole(false);

    if (res.success) {
      toast.success(`Updated role for ${roleModalTarget.email} to ${selectedRole}.`);
      setRoleModalTarget(null);
      await fetchRoster();
    } else {
      toast.error(res.error || "Failed to update role. ROLE_ASSIGN permission required.");
    }
  };

  const handleOpenStatusModal = (profile: RosterProfile) => {
    setStatusModalTarget(profile);
  };

  const handleConfirmStatusToggle = async () => {
    if (!statusModalTarget) return;

    const newStatus = !statusModalTarget.isActive;
    setIsUpdatingStatus(true);
    const res = await adminClient.updateAdminStatus(statusModalTarget.id, newStatus);
    setIsUpdatingStatus(false);

    if (res.success) {
      toast.success(
        `Administrator ${statusModalTarget.email} has been ${newStatus ? "activated" : "deactivated"}.`
      );
      setStatusModalTarget(null);
      await fetchRoster();
    } else {
      toast.error(res.error || "Failed to update administrator status. ADMIN_MANAGE permission required.");
    }
  };

  const handleOpenMfaModal = (profile: RosterProfile) => {
    setMfaModalTarget(profile);
    setMfaConfirmEmail("");
    setMfaJustification("");
    setMfaModalError(null);
  };

  const handleConfirmMfaReset = async () => {
    if (!mfaModalTarget) return;

    if (mfaConfirmEmail.trim().toLowerCase() !== mfaModalTarget.email.toLowerCase()) {
      setMfaModalError("Confirmation email does not match target email address.");
      return;
    }

    if (mfaJustification.trim().length < 10) {
      setMfaModalError("Justification must be at least 10 characters long.");
      return;
    }

    setIsResettingMfa(true);
    setMfaModalError(null);

    const res = await adminClient.emergencyMfaReset(
      mfaModalTarget.id,
      mfaConfirmEmail.trim(),
      mfaJustification.trim()
    );

    setIsResettingMfa(false);

    if (res.success) {
      toast.success(
        `Emergency MFA recovery initiated for ${mfaModalTarget.email}. Verified factor deleted and account quarantined.`
      );
      setMfaModalTarget(null);
      await fetchRoster();
    } else {
      setMfaModalError(res.error || "Failed to initiate emergency MFA reset.");
      toast.error(res.error || "Failed to initiate emergency MFA reset.");
    }
  };

  return (
    <div className="card-interactive rounded-xl border border-brand/20 bg-panel/85 p-5 shadow-lg">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-brand/15">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 border border-brand/20 text-brand-bright">
            <Users className="size-5" />
          </div>
          <div>
            <h3 className="font-display text-[16px] font-bold text-foreground text-glow">
              Administrative Team Roster
            </h3>
            <p className="text-[12px] text-muted-foreground">
              Manage authorized administrator accounts, roles, and governance permissions.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchRoster}
          disabled={isLoading}
          className="flex items-center gap-1.5 rounded-lg border border-brand/30 bg-background/60 px-3 py-1.5 text-[12px] font-medium text-foreground transition hover:border-brand-bright/50 hover:bg-brand/10 hover:text-brand-bright cursor-pointer disabled:opacity-50"
        >
          <RotateCcw className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} />
          <span>Refresh Roster</span>
        </button>
      </div>

      {/* Roster Table Content */}
      {isLoading ? (
        <div className="flex min-h-[220px] items-center justify-center py-10">
          <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
            <Loader2 className="size-5 animate-spin text-brand-bright" />
            <span>Loading verified administrator profiles...</span>
          </div>
        </div>
      ) : error ? (
        <div className="my-6 rounded-lg border border-red-500/30 bg-red-950/20 p-5 text-center">
          <AlertTriangle className="mx-auto size-7 text-red-400 mb-2" />
          <p className="text-[13px] font-semibold text-red-300">{error}</p>
          <p className="text-[11.5px] text-muted-foreground mt-1">
            Access to administrator governance requires privileged SUPER_ADMIN or ADMIN role.
          </p>
          <button
            type="button"
            onClick={fetchRoster}
            className="mt-3 rounded-lg border border-red-500/40 bg-red-950/30 px-4 py-1.5 text-[12px] font-medium text-red-300 transition hover:bg-red-950/50 cursor-pointer"
          >
            Retry Loading
          </button>
        </div>
      ) : profiles.length === 0 ? (
        <div className="my-8 text-center py-8 border border-dashed border-brand/15 rounded-lg">
          <Users className="mx-auto size-8 text-muted-foreground/50 mb-2" />
          <p className="text-[13px] font-medium text-foreground/80">No administrator profiles found</p>
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border border-brand/15 bg-background/50">
          <table className="w-full text-left text-[12.5px]">
            <thead className="border-b border-brand/15 bg-brand/5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              <tr>
                <th className="py-3 px-3.5">Administrator</th>
                <th className="py-3 px-3.5">Role</th>
                <th className="py-3 px-3.5">Status</th>
                <th className="py-3 px-3.5">Last Login</th>
                <th className="py-3 px-3.5">Joined</th>
                <th className="py-3 px-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand/10">
              {profiles.map((admin) => {
                const isSuperAdmin = admin.role === "SUPER_ADMIN";
                const isAdminRole = admin.role === "ADMIN";

                return (
                  <tr key={admin.id} className="hover:bg-brand/5 transition-colors">
                    {/* Name & Email */}
                    <td className="py-3 px-3.5">
                      <div className="font-semibold text-foreground">{admin.fullName || "Administrator"}</div>
                      <div className="text-[11px] font-mono text-muted-foreground">{admin.email}</div>
                    </td>

                    {/* Role Badge */}
                    <td className="py-3 px-3.5">
                      {isSuperAdmin ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-amber-400">
                          <Crown className="size-3" />
                          <span>Super Admin</span>
                        </span>
                      ) : isAdminRole ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-brand/40 bg-brand/15 px-2.5 py-0.5 text-[11px] font-semibold text-brand-bright">
                          <ShieldCheck className="size-3" />
                          <span>Administrator</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-cyan-500/40 bg-cyan-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-cyan-400">
                          <Shield className="size-3" />
                          <span>Editor</span>
                        </span>
                      )}
                    </td>

                    {/* Active Status */}
                    <td className="py-3 px-3.5">
                      <div className="flex flex-col gap-1">
                        {admin.isActive ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-brand-bright/15 border border-brand-bright/40 px-2.5 py-0.5 text-[11px] font-semibold text-brand-bright w-fit">
                            <CheckCircle2 className="size-3" />
                            <span>Active</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 border border-red-500/40 px-2.5 py-0.5 text-[11px] font-semibold text-red-400 w-fit">
                            <XCircle className="size-3" />
                            <span>Deactivated</span>
                          </span>
                        )}
                        {admin.mfaRecoveryPending && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/40 px-2.5 py-0.5 text-[10px] font-semibold text-amber-400 w-fit">
                            <ShieldAlert className="size-3" />
                            <span>Reset Pending</span>
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Last Login */}
                    <td className="py-3 px-3.5 text-muted-foreground">
                      {admin.lastLoginAt
                        ? new Date(admin.lastLoginAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "Never"}
                    </td>

                    {/* Joined Date */}
                    <td className="py-3 px-3.5 text-muted-foreground">
                      {new Date(admin.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-3.5 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => handleOpenRoleModal(admin)}
                        className="rounded border border-brand/25 bg-background/60 px-2.5 py-1 text-[11.5px] font-medium text-foreground transition hover:border-brand-bright/50 hover:bg-brand/10 hover:text-brand-bright cursor-pointer"
                      >
                        Change Role
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenStatusModal(admin)}
                        className={`rounded border px-2.5 py-1 text-[11.5px] font-medium transition cursor-pointer ${
                          admin.isActive
                            ? "border-red-500/35 bg-red-950/20 text-red-400 hover:bg-red-950/40 hover:border-red-500/70"
                            : "border-brand-bright/40 bg-brand/15 text-brand-bright hover:bg-brand/25"
                        }`}
                      >
                        {admin.isActive ? "Deactivate" : "Activate"}
                      </button>

                      {isSuperAdminViewer && (
                        admin.role === "SUPER_ADMIN" ? (
                          <span
                            title="Web recovery unavailable for Super Admins. Use break-glass CLI."
                            className="inline-block rounded border border-zinc-700/50 bg-zinc-900/40 px-2.5 py-1 text-[11.5px] font-medium text-zinc-500 cursor-not-allowed"
                          >
                            CLI Recovery
                          </span>
                        ) : admin.id === currentAdminId ? (
                          <span
                            title="Self-reset through web portal is prohibited."
                            className="inline-block rounded border border-zinc-700/50 bg-zinc-900/40 px-2.5 py-1 text-[11.5px] font-medium text-zinc-500 cursor-not-allowed"
                          >
                            Self-Reset
                          </span>
                        ) : admin.mfaRecoveryPending ? (
                          <span
                            title="Emergency recovery already in progress for this administrator."
                            className="inline-block rounded border border-amber-500/30 bg-amber-950/20 px-2.5 py-1 text-[11.5px] font-medium text-amber-400 cursor-not-allowed"
                          >
                            Recovery Pending
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenMfaModal(admin)}
                            className="rounded border border-amber-500/40 bg-amber-950/20 px-2.5 py-1 text-[11.5px] font-medium text-amber-400 transition hover:bg-amber-900/40 hover:border-amber-400 cursor-pointer"
                          >
                            Reset MFA
                          </button>
                        )
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Role Assignment Modal */}
      <Dialog open={Boolean(roleModalTarget)} onOpenChange={(open) => !open && setRoleModalTarget(null)}>
        <DialogContent className="border border-brand/30 bg-[#040e08]/95 p-6 backdrop-blur-2xl text-foreground max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="font-display text-[17px] font-bold text-foreground flex items-center gap-2">
              <Crown className="size-5 text-amber-400" />
              Change Administrator Role
            </DialogTitle>
            <DialogDescription className="text-[12.5px] text-muted-foreground pt-1">
              Select new role for <strong className="text-foreground">{roleModalTarget?.email}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-3">
            <label className="text-[12px] font-medium text-foreground/80">Select Role</label>
            <div className="space-y-2">
              {(["SUPER_ADMIN", "ADMIN", "EDITOR"] as AdminRole[]).map((role) => (
                <label
                  key={role}
                  className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition ${
                    selectedRole === role
                      ? "border-brand-bright bg-brand/15 text-brand-bright"
                      : "border-brand/15 bg-background/50 text-foreground/80 hover:bg-brand/5"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <input
                      type="radio"
                      name="role-select"
                      value={role}
                      checked={selectedRole === role}
                      onChange={() => setSelectedRole(role)}
                      className="accent-[#00ffaa]"
                    />
                    <span className="text-[13px] font-semibold">{role}</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    {role === "SUPER_ADMIN" ? "All Permissions" : role === "ADMIN" ? "Manager" : "Content Editor"}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-4">
            <button
              type="button"
              onClick={() => setRoleModalTarget(null)}
              className="rounded-lg border border-brand/25 bg-background/60 px-4 py-2 text-[12.5px] font-medium text-foreground transition hover:bg-background/90 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isUpdatingRole}
              onClick={handleConfirmRoleChange}
              className="rounded-lg border border-brand-bright/80 bg-gradient-to-r from-brand to-brand-bright px-5 py-2 text-[12.5px] font-bold text-background shadow transition hover:brightness-110 disabled:opacity-50 cursor-pointer"
            >
              {isUpdatingRole ? "Saving..." : "Update Role"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Status Toggle Modal */}
      <Dialog open={Boolean(statusModalTarget)} onOpenChange={(open) => !open && setStatusModalTarget(null)}>
        <DialogContent className="border border-brand/30 bg-[#040e08]/95 p-6 backdrop-blur-2xl text-foreground max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="font-display text-[17px] font-bold text-foreground flex items-center gap-2">
              <ShieldAlert className="size-5 text-amber-400" />
              {statusModalTarget?.isActive ? "Deactivate Administrator" : "Activate Administrator"}
            </DialogTitle>
            <DialogDescription className="text-[12.5px] text-muted-foreground pt-1">
              Are you sure you want to {statusModalTarget?.isActive ? "deactivate" : "activate"}{" "}
              <strong className="text-foreground">{statusModalTarget?.email}</strong>?
              {statusModalTarget?.isActive && (
                <span className="block mt-1 text-amber-400/90 text-[11.5px]">
                  Deactivated administrators cannot log in or perform administrative actions.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-end gap-2.5 pt-4">
            <button
              type="button"
              onClick={() => setStatusModalTarget(null)}
              className="rounded-lg border border-brand/25 bg-background/60 px-4 py-2 text-[12.5px] font-medium text-foreground transition hover:bg-background/90 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isUpdatingStatus}
              onClick={handleConfirmStatusToggle}
              className={`rounded-lg border px-5 py-2 text-[12.5px] font-bold transition disabled:opacity-50 cursor-pointer ${
                statusModalTarget?.isActive
                  ? "border-red-500/40 bg-red-950/30 text-red-400 hover:bg-red-950/50"
                  : "border-brand-bright/80 bg-gradient-to-r from-brand to-brand-bright text-background hover:brightness-110"
              }`}
            >
              {isUpdatingStatus ? "Processing..." : statusModalTarget?.isActive ? "Confirm Deactivation" : "Confirm Activation"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Emergency MFA Reset Confirmation Modal (Phase 4.6 Track A) */}
      <Dialog
        open={Boolean(mfaModalTarget)}
        onOpenChange={(open) => !open && !isResettingMfa && setMfaModalTarget(null)}
      >
        <DialogContent className="border border-amber-500/30 bg-[#040e08]/95 p-6 backdrop-blur-2xl text-foreground max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="font-display text-[17px] font-bold text-foreground flex items-center gap-2">
              <ShieldAlert className="size-5 text-amber-400" />
              <span>Emergency MFA Reset</span>
            </DialogTitle>
            <DialogDescription className="text-[12.5px] text-muted-foreground mt-1">
              Controlled peer recovery for locked-out administrators.
            </DialogDescription>
          </DialogHeader>

          {mfaModalTarget && (
            <div className="mt-4 space-y-4">
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3.5 text-[12px] text-amber-300 leading-relaxed">
                <p className="font-semibold text-amber-200 mb-1 flex items-center gap-1.5">
                  <AlertTriangle className="size-4 shrink-0 text-amber-400" />
                  Mandatory Security Notice
                </p>
                This action immediately deletes the target administrator's verified TOTP factor and places their account into quarantined re-enrollment mode. You must independently verify their identity through an established out-of-band process before proceeding.
              </div>

              <div className="rounded-lg border border-border/50 bg-background/50 p-3 space-y-1.5 text-[12px]">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Target Name:</span>
                  <span className="font-medium text-foreground">{mfaModalTarget.fullName || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Target Role:</span>
                  <span className="font-medium text-cyan-400">{mfaModalTarget.role}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Target Email:</span>
                  <span className="font-mono text-brand-bright">{mfaModalTarget.email}</span>
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-medium text-muted-foreground mb-1.5">
                  Confirm Target Email Address <span className="text-red-400">*</span>
                </label>
                <input
                  type="email"
                  value={mfaConfirmEmail}
                  onChange={(e) => setMfaConfirmEmail(e.target.value)}
                  placeholder={mfaModalTarget.email}
                  disabled={isResettingMfa}
                  className="w-full rounded-lg border border-brand/25 bg-background/70 px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground/40 focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[12px] font-medium text-muted-foreground mb-1.5">
                  Mandatory Justification (min 10 characters) <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={mfaJustification}
                  onChange={(e) => setMfaJustification(e.target.value)}
                  placeholder="e.g., Administrator lost device; identity verified via out-of-band video call."
                  rows={3}
                  disabled={isResettingMfa}
                  className="w-full rounded-lg border border-brand/25 bg-background/70 px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground/40 focus:border-amber-400 focus:outline-none resize-none"
                />
              </div>

              {mfaModalError && (
                <div className="rounded-lg border border-red-500/30 bg-red-950/30 p-2.5 text-[12px] text-red-300">
                  {mfaModalError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setMfaModalTarget(null)}
                  disabled={isResettingMfa}
                  className="rounded-lg border border-border/50 px-3.5 py-1.5 text-[12.5px] font-medium text-muted-foreground hover:bg-muted/30 transition disabled:opacity-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmMfaReset}
                  disabled={
                    isResettingMfa ||
                    mfaConfirmEmail.trim().toLowerCase() !== mfaModalTarget.email.toLowerCase() ||
                    mfaJustification.trim().length < 10
                  }
                  className="flex items-center gap-1.5 rounded-lg border border-amber-500/50 bg-amber-500/20 px-3.5 py-1.5 text-[12.5px] font-semibold text-amber-300 hover:bg-amber-500/30 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isResettingMfa && <Loader2 className="size-3.5 animate-spin" />}
                  <span>Initiate Emergency Reset</span>
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

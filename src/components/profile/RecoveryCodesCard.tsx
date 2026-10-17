import { useState, useEffect, useRef } from "react";
import {
  KeyRound,
  ShieldCheck,
  AlertTriangle,
  Copy,
  Check,
  Download,
  RefreshCw,
  Loader2,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth/use-auth";
import { adminClient, type RecoveryCodeStatusResult } from "@/lib/api/admin-client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function RecoveryCodesCard() {
  const { user, currentAal } = useAuth();

  // Status state
  const [status, setStatus] = useState<RecoveryCodeStatusResult | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [statusError, setStatusError] = useState<string | null>(null);

  // Generation & Display state (Strictly transient in-memory state)
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCodes, setGeneratedCodes] = useState<string[] | null>(null);
  const [confirmRegenerateOpen, setConfirmRegenerateOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const isMountedRef = useRef(true);

  // Security: Guarantee transient plaintext codes are purged on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      setGeneratedCodes(null);
    };
  }, []);

  const loadStatus = async () => {
    setIsLoadingStatus(true);
    setStatusError(null);
    try {
      const res = await adminClient.getRecoveryCodeStatus();
      if (!isMountedRef.current) return;
      if (res.success && res.data) {
        setStatus(res.data);
      } else {
        setStatusError(res.error || "Failed to load recovery code status.");
      }
    } catch {
      if (!isMountedRef.current) return;
      setStatusError("Failed to load recovery code status.");
    } finally {
      if (isMountedRef.current) {
        setIsLoadingStatus(false);
      }
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  // Execution: Generates a fresh set of 8 recovery codes
  const handleExecuteGeneration = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    setConfirmRegenerateOpen(false);

    try {
      const res = await adminClient.generateRecoveryCodes();
      if (!isMountedRef.current) return;

      if (res.success && res.data?.codes && res.data.codes.length > 0) {
        setGeneratedCodes(res.data.codes);
        setCopied(false);
        toast.success("New recovery codes generated successfully.");
        // Refresh count status in background
        await loadStatus();
      } else {
        toast.error(res.error || "Failed to generate recovery codes.");
      }
    } catch (err: unknown) {
      if (!isMountedRef.current) return;
      const msg = err instanceof Error ? err.message : "Failed to generate recovery codes.";
      toast.error(msg);
    } finally {
      if (isMountedRef.current) {
        setIsGenerating(false);
      }
    }
  };

  const handleStartGeneration = () => {
    if (status?.hasCodes && status.remainingCodes > 0) {
      setConfirmRegenerateOpen(true);
    } else {
      handleExecuteGeneration();
    }
  };

  // Close generated codes modal (Purges plaintext codes from memory forever)
  const handleCloseCodesModal = () => {
    setGeneratedCodes(null);
    setCopied(false);
    loadStatus();
  };

  // Format recovery codes export text
  const getFormattedExportText = () => {
    if (!generatedCodes) return "";
    const dateStr = new Date().toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });
    return [
      "===========================================================",
      "COBRALEARN ORBIT — EMERGENCY MFA RECOVERY CODES",
      "===========================================================",
      `Account: ${user?.email || "Administrator"}`,
      `Generated: ${dateStr}`,
      "",
      "IMPORTANT NOTICE:",
      "- Each recovery code can be used ONLY ONCE.",
      "- Store these codes in a secure password manager or safe vault.",
      "- If you generate a new set of codes, these codes become invalid.",
      "",
      ...generatedCodes.map((c, idx) => `${idx + 1}. ${c}`),
      "===========================================================",
    ].join("\n");
  };

  // Copy all codes to clipboard
  const handleCopyAll = async () => {
    if (!generatedCodes) return;
    try {
      await navigator.clipboard.writeText(getFormattedExportText());
      setCopied(true);
      toast.success("Recovery codes copied to clipboard.");
      setTimeout(() => {
        if (isMountedRef.current) setCopied(false);
      }, 3000);
    } catch {
      toast.error("Failed to copy codes to clipboard.");
    }
  };

  // Download recovery codes as text file
  const handleDownload = () => {
    if (!generatedCodes) return;
    try {
      const text = getFormattedExportText();
      const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `cobralearn-orbit-recovery-codes-${Date.now()}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("Recovery codes downloaded.");
    } catch {
      toast.error("Failed to download recovery codes.");
    }
  };

  const isAal2 = currentAal === "aal2";

  return (
    <>
      {/* 1. MAIN RECOVERY CODES CARD */}
      <div className="card-interactive rounded-xl border border-brand/20 bg-panel/85 p-5 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 border border-brand/20 text-brand-bright">
            <KeyRound className="size-5" />
          </div>
          <div>
            <h3 className="font-display text-[15px] font-bold text-foreground text-glow">
              Single-Use Recovery Codes
            </h3>
            <p className="text-[12px] text-muted-foreground">
              Backup access codes to sign in if you lose access to your authenticator app.
            </p>
          </div>
        </div>

        {/* Status Section */}
        <div className="mt-4 flex flex-col gap-3 rounded-lg border border-brand/15 bg-background/50 p-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            {isLoadingStatus ? (
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand-bright">
                <Loader2 className="size-4 animate-spin" />
              </div>
            ) : status?.hasCodes && status.remainingCodes > 0 ? (
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand-bright">
                <ShieldCheck className="size-4" />
              </div>
            ) : (
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <AlertTriangle className="size-4" />
              </div>
            )}

            <div>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Backup Protection Status
              </p>
              {isLoadingStatus ? (
                <p className="text-[13px] font-semibold text-muted-foreground">
                  Checking recovery code status...
                </p>
              ) : statusError ? (
                <p className="text-[13px] font-semibold text-destructive">{statusError}</p>
              ) : status?.hasCodes && status.remainingCodes > 0 ? (
                <p className="text-[13px] font-semibold text-foreground">
                  <span className="text-brand-bright font-bold">{status.remainingCodes}</span> of{" "}
                  {status.totalCodes} recovery codes remaining
                </p>
              ) : (
                <p className="text-[13px] font-semibold text-amber-400">
                  No recovery codes available
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {statusError && (
              <button
                type="button"
                onClick={loadStatus}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-brand/20 bg-brand/10 px-3 py-1.5 text-[12px] font-semibold text-brand-bright transition hover:bg-brand/20"
              >
                <RefreshCw className="size-3.5" />
                <span>Retry</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleStartGeneration}
              disabled={isGenerating || !isAal2}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-brand-bright/70 bg-brand/15 px-4 py-2 text-[12.5px] font-bold text-brand-bright shadow-[0_0_14px_rgba(0,255,170,0.22)] transition hover:bg-brand/25 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Generating Codes...</span>
                </>
              ) : status?.hasCodes && status.remainingCodes > 0 ? (
                <span>Regenerate Codes</span>
              ) : (
                <span>Generate Recovery Codes</span>
              )}
            </button>
          </div>
        </div>

        {/* Policy & Guidance Information */}
        {!isAal2 && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-300">
            <Lock className="size-4 shrink-0" />
            <span>
              Elevated AAL2 session required to generate recovery codes. Please sign in with MFA.
            </span>
          </div>
        )}

        <div className="mt-3 text-[12px] text-muted-foreground leading-relaxed">
          <p>
            Recovery codes are single-use credentials used to regain access if you lose your phone or
            authenticator app. Keep them in a safe, offline location.
          </p>
        </div>
      </div>

      {/* 2. REPLACEMENT CONFIRMATION MODAL */}
      <Dialog open={confirmRegenerateOpen} onOpenChange={setConfirmRegenerateOpen}>
        <DialogContent className="max-w-[440px] border-amber-500/30 bg-[#06120b]/95 p-6 backdrop-blur-xl text-foreground">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <AlertTriangle className="size-5" />
              </div>
              <DialogTitle className="text-[17px] font-bold text-foreground">
                Replace Existing Recovery Codes?
              </DialogTitle>
            </div>
            <DialogDescription className="mt-2 text-[13px] text-muted-foreground leading-relaxed">
              Generating a new set of recovery codes will{" "}
              <strong className="text-amber-300 font-semibold">
                immediately invalidate all {status?.remainingCodes || 0} existing recovery codes
              </strong>
              . Anyone holding previous codes will no longer be able to use them.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setConfirmRegenerateOpen(false)}
              className="rounded-lg border border-border px-3.5 py-1.5 text-[12.5px] font-medium text-muted-foreground hover:bg-muted/50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleExecuteGeneration}
              disabled={isGenerating}
              className="flex items-center gap-1.5 rounded-lg border border-amber-500/60 bg-amber-500/20 px-4 py-1.5 text-[12.5px] font-bold text-amber-300 hover:bg-amber-500/30 transition cursor-pointer disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Replacing...</span>
                </>
              ) : (
                <span>Confirm & Replace</span>
              )}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 3. ONE-TIME RECOVERY CODES DISPLAY MODAL */}
      <Dialog
        open={Boolean(generatedCodes && generatedCodes.length > 0)}
        onOpenChange={(open) => {
          if (!open) handleCloseCodesModal();
        }}
      >
        <DialogContent className="max-w-[500px] border-brand/30 bg-[#06120b]/95 p-6 backdrop-blur-xl text-foreground shadow-[0_0_50px_rgba(0,255,170,0.15)]">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 border border-brand/20 text-brand-bright">
                <ShieldCheck className="size-5" />
              </div>
              <DialogTitle className="text-[17px] font-bold text-foreground text-glow">
                Your New Recovery Codes
              </DialogTitle>
            </div>
            <DialogDescription className="mt-2 text-[12.5px] text-muted-foreground leading-relaxed">
              Store these recovery codes in a secure password manager. Each code can be used{" "}
              <strong className="text-brand-bright font-semibold">only once</strong> to access your
              account.
            </DialogDescription>
          </DialogHeader>

          {/* Critical Warning Callout */}
          <div className="mt-2 flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-[12px] text-amber-200">
            <AlertTriangle className="size-4 shrink-0 text-amber-400 mt-0.5" />
            <span>
              <strong>Crucial:</strong> These codes will{" "}
              <span className="underline decoration-amber-400 font-semibold">never</span> be
              displayed again. If you close this window without saving them, you must regenerate a
              new set.
            </span>
          </div>

          {/* 8 Codes Grid */}
          <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg border border-brand/20 bg-background/60 p-3.5">
            {generatedCodes?.map((code, idx) => (
              <div
                key={idx}
                className="flex items-center justify-center rounded-md border border-brand/15 bg-panel/80 px-2.5 py-1.5 font-mono text-[13px] font-bold text-brand-bright tracking-wider shadow-inner"
              >
                {code}
              </div>
            ))}
          </div>

          {/* Actions: Copy & Download */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyAll}
                className="flex items-center gap-1.5 rounded-lg border border-brand/30 bg-brand/10 px-3 py-1.5 text-[12px] font-semibold text-brand-bright hover:bg-brand/20 transition cursor-pointer"
              >
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                <span>{copied ? "Copied All" : "Copy Codes"}</span>
              </button>

              <button
                type="button"
                onClick={handleDownload}
                className="flex items-center gap-1.5 rounded-lg border border-brand/30 bg-brand/10 px-3 py-1.5 text-[12px] font-semibold text-brand-bright hover:bg-brand/20 transition cursor-pointer"
              >
                <Download className="size-3.5" />
                <span>Download (.txt)</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleCloseCodesModal}
              className="rounded-lg border border-brand-bright/70 bg-brand/20 px-4 py-1.5 text-[12.5px] font-bold text-brand-bright hover:bg-brand/30 transition cursor-pointer shadow-[0_0_12px_rgba(0,255,170,0.2)]"
            >
              I Have Saved My Codes
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

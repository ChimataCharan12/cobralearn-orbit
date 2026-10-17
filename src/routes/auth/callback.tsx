import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";

import { authService } from "@/lib/auth/auth-service";
import { safeRedirect } from "@/lib/auth/safe-redirect";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { adminClient } from "@/lib/api/admin-client";
import environment from "@/assets/cobralearn-admin-environment.jpg";
import emblem from "@/assets/cobralearn-emblem.png";

interface CallbackSearch {
  code?: string | undefined;
  token_hash?: string | undefined;
  type?: string | undefined;
  next?: string | undefined;
  error?: string | undefined;
  error_description?: string | undefined;
  error_code?: string | undefined;
}

export const Route = createFileRoute("/auth/callback")({
  validateSearch: (search: Record<string, unknown>): CallbackSearch => {
    return {
      code: typeof search["code"] === "string" ? search["code"] : undefined,
      token_hash: typeof search["token_hash"] === "string" ? search["token_hash"] : undefined,
      type: typeof search["type"] === "string" ? search["type"] : undefined,
      next: typeof search["next"] === "string" ? search["next"] : undefined,
      error: typeof search["error"] === "string" ? search["error"] : undefined,
      error_description: typeof search["error_description"] === "string" ? search["error_description"] : undefined,
      error_code: typeof search["error_code"] === "string" ? search["error_code"] : undefined,
    };
  },
  head: () => ({
    meta: [
      { title: "Authenticating — CobraLearn Innotechcore" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const search = useSearch({ from: "/auth/callback" });
  const navigate = useNavigate();
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    let isMounted = true;

    async function handleCallback() {
      try {
        // 1. Inspect URL hash parameters if present (implicit grant, recovery hash, or hash errors)
        let hashParams: URLSearchParams | null = null;
        if (typeof window !== "undefined" && window.location.hash) {
          try {
            const rawHash = window.location.hash.startsWith("#")
              ? window.location.hash.substring(1)
              : window.location.hash;
            hashParams = new URLSearchParams(rawHash);
          } catch {
            // Malformed hash fallback
          }
        }

        const hashError = hashParams?.get("error");
        const hashErrorDescription = hashParams?.get("error_description");

        // 2. Error parameters in query string or URL hash fragment
        if (search.error || search.error_description || hashError || hashErrorDescription) {
          if (!isMounted) return;
          setStatus("error");
          setErrorMessage(
            hashErrorDescription ||
              search.error_description ||
              "The authentication or recovery link is invalid or has expired."
          );
          return;
        }

        const isRecovery =
          search.type === "recovery" ||
          hashParams?.get("type") === "recovery" ||
          (typeof window !== "undefined" && window.location.hash.includes("type=recovery"));

        // 3. Modern token-hash verification (OTP / token_hash flow)
        if (search.token_hash) {
          const { error: otpError } = await authService.verifyOtp({
            token_hash: search.token_hash,
            type: (search.type as any) || "recovery",
          });
          if (otpError) {
            if (!isMounted) return;
            setStatus("error");
            setErrorMessage(otpError.message || "Failed to verify the password recovery link. It may be invalid or expired.");
            return;
          }
        }

        // 4. PKCE Code Exchange
        if (search.code) {
          const { error: exchangeError } = await authService.exchangeCodeForSession(search.code);
          if (exchangeError) {
            if (!isMounted) return;
            setStatus("error");
            setErrorMessage("Failed to authenticate with the provided verification code. It may have expired.");
            return;
          }
        }

        // 5. Implicit grant hash tokens (#access_token=...&refresh_token=...)
        const hashAccessToken = hashParams?.get("access_token");
        const hashRefreshToken = hashParams?.get("refresh_token");
        if (hashAccessToken && hashRefreshToken) {
          try {
            await authService.setSession({
              access_token: hashAccessToken,
              refresh_token: hashRefreshToken,
            });
          } catch (err) {
            console.warn("[AuthCallback] Non-fatal setSession error from hash:", err);
          }
        }

        // 6. Check for active session with bounded hydration polling
        let session = await authService.getSession();
        if (!session) {
          for (let attempt = 0; attempt < 4; attempt++) {
            await new Promise((resolve) => setTimeout(resolve, 80));
            if (!isMounted) return;
            session = await authService.getSession();
            if (session) break;
          }
        }

        // 7. Require established session before navigating
        if (!session) {
          if (!isMounted) return;
          setStatus("error");
          setErrorMessage(
            isRecovery
              ? "Password recovery session could not be established. The link may be invalid or expired."
              : "No valid authentication session could be verified."
          );
          return;
        }

        if (!isMounted) return;
        setStatus("success");

        // Record verified admin login session (excluding recovery flows)
        if (!isRecovery && session.access_token) {
          try {
            await adminClient.recordLoginHistory(session.access_token);
          } catch (err) {
            console.warn("[AuthCallback] Non-fatal: failed to record login history", err);
          }
        }

        const targetDestination = isRecovery
          ? safeRedirect(search.next, "/admin/reset-password")
          : safeRedirect(search.next, "/admin/dashboard");

        setTimeout(() => {
          if (isMounted) {
            navigate({ to: targetDestination });
          }
        }, 350);
      } catch {
        if (!isMounted) return;
        setStatus("error");
        setErrorMessage("An unexpected error occurred during authentication synchronization.");
      }
    }

    handleCallback();

    return () => {
      isMounted = false;
    };
  }, [search, navigate]);

  return (
    <main className="relative min-h-screen lg:h-dvh w-full overflow-hidden bg-[#020604] flex items-center justify-center select-none px-4">
      {/* Background Plate */}
      <img
        src={environment}
        alt=""
        aria-hidden="true"
        className="fixed inset-0 h-full w-full object-cover object-center pointer-events-none z-0 opacity-40"
      />

      {/* Glass Card Container */}
      <div className="relative z-10 w-full max-w-[420px] overflow-hidden rounded-[20px] border-[1.5px] border-[#00ff87]/50 bg-[#040e08]/90 p-6 sm:p-8 backdrop-blur-2xl shadow-[0_0_25px_rgba(0,255,135,0.3),0_0_60px_rgba(0,255,135,0.12),0_30px_80px_rgba(0,0,0,0.9),inset_0_0_25px_rgba(0,255,135,0.05)] text-center">
        {/* Glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-[#00ff87]/20 blur-2xl"
        />

        {/* Top Border Line */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-0 h-[1px] w-[50%] -translate-x-1/2 bg-gradient-to-r from-transparent via-[#00ff87]/60 to-transparent"
        />

        <img
          src={emblem}
          alt="CobraLearn"
          className="mx-auto size-14 object-contain brand-glow mb-4"
        />

        {status === "processing" && (
          <div className="space-y-3">
            <div className="flex justify-center">
              <Loader2 className="size-7 animate-spin text-[#00ff87]" />
            </div>
            <h2 className="font-sans text-[20px] font-bold text-white">
              Authenticating <span className="text-[#00ff87]">Session</span>
            </h2>
            <p className="text-[13px] text-[#94a3b8]">
              Verifying security credentials and synchronizing session...
            </p>
          </div>
        )}

        {status === "success" && (
          <div className="space-y-3">
            <div className="flex justify-center">
              <CheckCircle2 className="size-7 text-[#00ff87]" />
            </div>
            <h2 className="font-sans text-[20px] font-bold text-white">
              Authentication <span className="text-[#00ff87]">Verified</span>
            </h2>
            <p className="text-[13px] text-[#94a3b8]">
              Session established successfully. Redirecting...
            </p>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-4">
            <div className="flex justify-center">
              <AlertTriangle className="size-8 text-red-400" />
            </div>
            <h2 className="font-sans text-[20px] font-bold text-white">
              Authentication <span className="text-red-400">Error</span>
            </h2>
            <p className="text-[13px] text-[#94a3b8] leading-relaxed">
              {errorMessage || "Unable to verify the authentication link."}
            </p>
            <button
              type="button"
              onClick={() => navigate({ to: "/admin" })}
              className="mt-2 flex h-[40px] w-full items-center justify-center gap-2 rounded-[10px] bg-gradient-to-r from-[#00ff87] via-[#00f28f] to-[#00d68f] text-[14px] font-bold text-[#02180c] shadow-[0_0_20px_rgba(0,255,135,0.4)] hover:brightness-105 transition-all cursor-pointer"
            >
              <span>Return to Admin Login</span>
              <ArrowRight className="size-4" />
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

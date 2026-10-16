import { getEmailConfig, type EmailConfig } from "./email-config";

export interface SendEmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string | undefined;
  replyTo?: string | undefined;
  idempotencyKey?: string | undefined;
}

export interface SendEmailResponse {
  provider: "resend";
  providerMessageId: string;
}

export interface EmailClient {
  sendEmail(options: SendEmailOptions): Promise<SendEmailResponse>;
}

/**
 * Safely sanitizes provider error messages to prevent leaking secrets,
 * authorization headers, recipient email addresses, or internal server details.
 */
export function sanitizeProviderError(rawMessage?: string | null): string {
  if (!rawMessage || typeof rawMessage !== "string") {
    return "Unknown provider error";
  }

  return rawMessage
    // Redact Bearer tokens and Resend API keys (re_...)
    .replace(/re_[a-zA-Z0-9_\-]{16,}/gi, "[redacted-key]")
    .replace(/bearer\s+[a-zA-Z0-9_\.\-]+/gi, "Bearer [redacted]")
    // Redact email addresses to prevent leaking recipient/sender PII
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi, "[redacted-email]")
    // Normalize newlines/tabs to single spaces
    .replace(/[\r\n\t]+/g, " ")
    .trim()
    .slice(0, 300);
}

export class ResendEmailClient implements EmailClient {
  private config: EmailConfig;
  private fetchImpl: typeof fetch;

  constructor(config?: EmailConfig, fetchImpl: typeof fetch = globalThis.fetch) {
    this.config = config || getEmailConfig();
    this.fetchImpl = fetchImpl;
  }

  async sendEmail(options: SendEmailOptions): Promise<SendEmailResponse> {
    if (!options.to || typeof options.to !== "string" || !options.to.includes("@")) {
      throw new Error("Invalid recipient email address.");
    }

    if (!options.subject || typeof options.subject !== "string" || !options.subject.trim()) {
      throw new Error("Email subject cannot be empty.");
    }

    if (!options.text || typeof options.text !== "string" || !options.text.trim()) {
      throw new Error("Email message body cannot be empty.");
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.config.resendApiKey}`,
      "Content-Type": "application/json",
      "User-Agent": "CobraLearn-Innotechcore-Portal/1.0",
    };

    if (options.idempotencyKey) {
      headers["Idempotency-Key"] = options.idempotencyKey;
    }

    const requestBody: Record<string, any> = {
      from: this.config.fromAddress,
      to: [options.to.trim()],
      subject: options.subject.trim(),
      text: options.text,
    };

    if (options.html) {
      requestBody.html = options.html;
    }

    const replyTo = options.replyTo || this.config.replyTo;
    if (replyTo) {
      requestBody.reply_to = replyTo;
    }

    let response: Response;
    try {
      response = await this.fetchImpl("https://api.resend.com/emails", {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });
    } catch (err: any) {
      if (err?.name === "TimeoutError" || err?.name === "AbortError") {
        throw new Error(
          `Email service timed out after ${this.config.timeoutMs / 1000} seconds. Please check network connectivity and retry.`
        );
      }
      throw new Error(`Email delivery request failed: ${err?.message || "Network error"}`);
    }

    if (!response.ok) {
      let errorData: any = null;
      try {
        errorData = await response.json();
      } catch {
        // Response was not JSON
      }

      const rawErrorMessage =
        errorData?.message ||
        errorData?.error ||
        `HTTP ${response.status} ${response.statusText}`;

      const sanitizedError = sanitizeProviderError(rawErrorMessage);

      if (response.status === 401) {
        throw new Error("Email provider authentication failed. Please verify the server RESEND_API_KEY.");
      }

      if (response.status === 403) {
        throw new Error(`Email provider access denied (403): ${sanitizedError}`);
      }

      if (response.status === 422) {
        throw new Error(`Email provider rejected request (422): ${sanitizedError}`);
      }

      if (response.status === 429) {
        throw new Error("Email provider rate limit exceeded. Please wait a moment before retrying.");
      }

      if (response.status >= 500) {
        throw new Error(`Email provider service temporarily unavailable (status ${response.status}).`);
      }

      throw new Error(`Failed to send email via Resend: ${sanitizedError}`);
    }

    let responseData: any;
    try {
      responseData = await response.json();
    } catch (err: any) {
      throw new Error("Email provider returned invalid response format.");
    }

    if (!responseData || !responseData.id) {
      throw new Error("Email provider did not return an acceptance ID.");
    }

    return {
      provider: "resend",
      providerMessageId: responseData.id,
    };
  }
}

export function createResendEmailClient(
  config?: EmailConfig,
  fetchImpl?: typeof fetch
): EmailClient {
  return new ResendEmailClient(config, fetchImpl);
}

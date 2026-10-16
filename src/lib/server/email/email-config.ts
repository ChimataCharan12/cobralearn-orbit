/**
 * Outbound Email Server Configuration Contract
 * 
 * Strict server-only configuration loader for email operations.
 * Never import this module in client components or prefix variables with VITE_.
 */

export interface EmailConfig {
  resendApiKey: string;
  fromAddress: string;
  replyTo?: string | undefined;
  timeoutMs: number;
}

export function getEmailConfig(): EmailConfig {
  const apiKey = process.env["RESEND_API_KEY"]?.trim();
  const fromAddress = process.env["EMAIL_FROM_ADDRESS"]?.trim();
  const replyTo = process.env["EMAIL_REPLY_TO"]?.trim() || undefined;

  if (!apiKey) {
    throw new Error(
      "Outbound email service is not configured. Missing RESEND_API_KEY environment variable."
    );
  }

  if (!fromAddress) {
    throw new Error(
      "Outbound email sender identity is not configured. Missing EMAIL_FROM_ADDRESS environment variable."
    );
  }

  return {
    resendApiKey: apiKey,
    fromAddress,
    replyTo,
    timeoutMs: 10000, // 10 second timeout
  };
}

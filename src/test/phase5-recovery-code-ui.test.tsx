import React from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { RecoveryCodesCard } from "@/components/profile/RecoveryCodesCard";
import { SecurityTab } from "@/components/profile/SecurityTab";
import { adminClient } from "@/lib/api/admin-client";
import * as useAuthModule from "@/lib/auth/use-auth";

// Mock @tanstack/react-router
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
}));

// Mock sonner toast
const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
};
vi.mock("sonner", () => ({
  toast: {
    success: (...args: any[]) => mockToast.success(...args),
    error: (...args: any[]) => mockToast.error(...args),
  },
}));

// Mock adminClient
vi.mock("@/lib/api/admin-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/admin-client")>();
  return {
    ...actual,
    adminClient: {
      ...actual.adminClient,
      getRecoveryCodeStatus: vi.fn(),
      generateRecoveryCodes: vi.fn(),
    },
  };
});

describe("Phase 5.3: Recovery-Code Security Tab UI", () => {
  const mockSampleCodes = [
    "2345-6789-ABCD",
    "EFGH-JKMN-PQRT",
    "VWXY-2345-6789",
    "ABCD-EFGH-JKMN",
    "PQRT-VWXY-2345",
    "6789-ABCD-EFGH",
    "JKMN-PQRT-VWXY",
    "2345-ABCD-6789",
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock user at AAL2
    vi.spyOn(useAuthModule, "useAuth").mockReturnValue({
      user: { id: "admin-1", email: "admin@cobralearn.com" } as any,
      session: { user: { id: "admin-1" }, access_token: "mock-token" } as any,
      isAuthenticated: true,
      isLoading: false,
      isMfaEnrolled: true,
      currentAal: "aal2",
      verifiedFactorId: "factor-123",
      signOut: vi.fn(),
      checkMfaState: vi.fn(),
      adminProfile: { id: "admin-1", email: "admin@cobralearn.com", role: "SUPER_ADMIN" } as any,
      refreshProfile: vi.fn(),
    } as any);

    // Mock clipboard
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });

    // Mock URL.createObjectURL and revokeObjectURL
    global.URL.createObjectURL = vi.fn().mockReturnValue("blob:mock-url");
    global.URL.revokeObjectURL = vi.fn();
    HTMLAnchorElement.prototype.click = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("1. Renders initial loading state and displays 'No recovery codes' when unenrolled", async () => {
    vi.mocked(adminClient.getRecoveryCodeStatus).mockResolvedValueOnce({
      success: true,
      data: {
        success: true,
        hasCodes: false,
        totalCodes: 0,
        remainingCodes: 0,
      },
    });

    render(<RecoveryCodesCard />);

    // Shows loading or checks status
    await waitFor(() => {
      expect(screen.getByText("No recovery codes available")).toBeDefined();
    });

    expect(screen.getByRole("button", { name: "Generate Recovery Codes" })).toBeDefined();
  });

  it("2. Displays remaining count and 'Regenerate Codes' button when codes exist", async () => {
    vi.mocked(adminClient.getRecoveryCodeStatus).mockResolvedValueOnce({
      success: true,
      data: {
        success: true,
        hasCodes: true,
        totalCodes: 8,
        remainingCodes: 6,
      },
    });

    render(<RecoveryCodesCard />);

    await waitFor(() => {
      expect(screen.getByText(/6/)).toBeDefined();
      expect(screen.getByText(/of 8 recovery codes remaining/)).toBeDefined();
    });

    expect(screen.getByRole("button", { name: "Regenerate Codes" })).toBeDefined();
  });

  it("3. Disables generate button and displays policy warning if session is not AAL2", async () => {
    // Session at AAL1 (not elevated)
    vi.spyOn(useAuthModule, "useAuth").mockReturnValue({
      user: { id: "admin-1", email: "admin@cobralearn.com" } as any,
      isAuthenticated: true,
      isLoading: false,
      currentAal: "aal1", // Not AAL2!
    } as any);

    vi.mocked(adminClient.getRecoveryCodeStatus).mockResolvedValueOnce({
      success: true,
      data: { success: true, hasCodes: false, totalCodes: 0, remainingCodes: 0 },
    });

    render(<RecoveryCodesCard />);

    await waitFor(() => {
      expect(
        screen.getByText(/Elevated AAL2 session required to generate recovery codes/)
      ).toBeDefined();
    });

    const button = screen.getByRole("button", { name: "Generate Recovery Codes" });
    expect(button).toHaveProperty("disabled", true);
  });

  it("4. Generates codes directly when no prior codes exist and opens one-time modal", async () => {
    vi.mocked(adminClient.getRecoveryCodeStatus).mockResolvedValue({
      success: true,
      data: { success: true, hasCodes: false, totalCodes: 0, remainingCodes: 0 },
    });

    vi.mocked(adminClient.generateRecoveryCodes).mockResolvedValueOnce({
      success: true,
      data: {
        success: true,
        codes: mockSampleCodes,
      },
    });

    render(<RecoveryCodesCard />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Generate Recovery Codes" })).toBeDefined();
    });

    const genBtn = screen.getByRole("button", { name: "Generate Recovery Codes" });
    await act(async () => {
      fireEvent.click(genBtn);
    });

    // One-time modal should open
    await waitFor(() => {
      expect(screen.getByText("Your New Recovery Codes")).toBeDefined();
      expect(screen.getByText(/Crucial:/)).toBeDefined();
      expect(screen.getByText("2345-6789-ABCD")).toBeDefined();
      expect(screen.getByText("EFGH-JKMN-PQRT")).toBeDefined();
    });

    expect(mockToast.success).toHaveBeenCalledWith("New recovery codes generated successfully.");
  });

  it("5. Opens replacement confirmation dialog before regenerating existing codes", async () => {
    vi.mocked(adminClient.getRecoveryCodeStatus).mockResolvedValue({
      success: true,
      data: { success: true, hasCodes: true, totalCodes: 8, remainingCodes: 8 },
    });

    vi.mocked(adminClient.generateRecoveryCodes).mockResolvedValueOnce({
      success: true,
      data: {
        success: true,
        codes: mockSampleCodes,
      },
    });

    render(<RecoveryCodesCard />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Regenerate Codes" })).toBeDefined();
    });

    // Click Regenerate
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Regenerate Codes" }));
    });

    // Confirmation modal should be visible
    expect(screen.getByText("Replace Existing Recovery Codes?")).toBeDefined();
    expect(screen.getByText(/immediately invalidate all 8 existing recovery codes/)).toBeDefined();

    // Confirm replacement
    const confirmBtn = screen.getByRole("button", { name: "Confirm & Replace" });
    await act(async () => {
      fireEvent.click(confirmBtn);
    });

    // Generated codes modal should open
    await waitFor(() => {
      expect(screen.getByText("Your New Recovery Codes")).toBeDefined();
      expect(screen.getByText("2345-6789-ABCD")).toBeDefined();
    });

    expect(adminClient.generateRecoveryCodes).toHaveBeenCalled();
  });

  it("6. Allows copying codes to clipboard with formatted template", async () => {
    vi.mocked(adminClient.getRecoveryCodeStatus).mockResolvedValue({
      success: true,
      data: { success: true, hasCodes: false, totalCodes: 0, remainingCodes: 0 },
    });
    vi.mocked(adminClient.generateRecoveryCodes).mockResolvedValueOnce({
      success: true,
      data: { success: true, codes: mockSampleCodes },
    });

    render(<RecoveryCodesCard />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Generate Recovery Codes" })).toBeDefined();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Generate Recovery Codes" }));
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Copy Codes" })).toBeDefined();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy Codes" }));
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalled();
    const copiedText = vi.mocked(navigator.clipboard.writeText).mock.calls[0]?.[0];
    expect(copiedText).toContain("COBRALEARN ORBIT — EMERGENCY MFA RECOVERY CODES");
    expect(copiedText).toContain("1. 2345-6789-ABCD");
    expect(mockToast.success).toHaveBeenCalledWith("Recovery codes copied to clipboard.");
  });

  it("7. Allows downloading codes as a text file", async () => {
    vi.mocked(adminClient.getRecoveryCodeStatus).mockResolvedValue({
      success: true,
      data: { success: true, hasCodes: false, totalCodes: 0, remainingCodes: 0 },
    });
    vi.mocked(adminClient.generateRecoveryCodes).mockResolvedValueOnce({
      success: true,
      data: { success: true, codes: mockSampleCodes },
    });

    render(<RecoveryCodesCard />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Generate Recovery Codes" })).toBeDefined();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Generate Recovery Codes" }));
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Download (.txt)" })).toBeDefined();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Download (.txt)" }));
    });

    expect(global.URL.createObjectURL).toHaveBeenCalled();
    expect(mockToast.success).toHaveBeenCalledWith("Recovery codes downloaded.");
  });

  it("8. Purges plaintext codes from DOM and state when 'I Have Saved My Codes' is clicked", async () => {
    vi.mocked(adminClient.getRecoveryCodeStatus).mockResolvedValue({
      success: true,
      data: { success: true, hasCodes: false, totalCodes: 0, remainingCodes: 0 },
    });
    vi.mocked(adminClient.generateRecoveryCodes).mockResolvedValueOnce({
      success: true,
      data: { success: true, codes: mockSampleCodes },
    });

    render(<RecoveryCodesCard />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Generate Recovery Codes" })).toBeDefined();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Generate Recovery Codes" }));
    });

    await waitFor(() => {
      expect(screen.getByText("2345-6789-ABCD")).toBeDefined();
    });

    // Click "I Have Saved My Codes"
    const closeBtn = screen.getByRole("button", { name: "I Have Saved My Codes" });
    await act(async () => {
      fireEvent.click(closeBtn);
    });

    // Plaintext codes should be completely purged from the DOM
    await waitFor(() => {
      expect(screen.queryByText("2345-6789-ABCD")).toBeNull();
      expect(screen.queryByText("Your New Recovery Codes")).toBeNull();
    });
  });

  it("9. Integrates cleanly inside SecurityTab", async () => {
    vi.mocked(adminClient.getRecoveryCodeStatus).mockResolvedValue({
      success: true,
      data: { success: true, hasCodes: true, totalCodes: 8, remainingCodes: 8 },
    });

    render(<SecurityTab />);

    await waitFor(() => {
      expect(screen.getByText("Single-Use Recovery Codes")).toBeDefined();
      expect(screen.getByText("Multi-Factor Authentication (MFA)")).toBeDefined();
      expect(screen.getByText("Password Management")).toBeDefined();
      expect(screen.getByText("Connected Devices")).toBeDefined();
    });
  });
});

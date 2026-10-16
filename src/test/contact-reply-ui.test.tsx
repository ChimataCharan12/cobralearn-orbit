import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MessageDetailModal } from "@/components/contact/messages/MessageDetailModal";
import { adminClient } from "@/lib/api/admin-client";
import { type ContactMessage } from "@/lib/contact-data";
import { toast } from "sonner";

vi.mock("@/lib/api/admin-client", () => ({
  adminClient: {
    sendAdminContactMessageReply: vi.fn(),
    listAdminContactMessageReplies: vi.fn(),
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe("In-Admin Email Reply UI & Modal Component Suite", () => {
  const mockMessage: ContactMessage = {
    id: "msg-ui-1",
    fullName: "Alex Rivera",
    email: "alex@example.com",
    subject: "Platform Partnership",
    message: "We would like to partner with CobraLearn on an AI curriculum.",
    status: "new",
    createdAt: new Date().toISOString(),
    replies: [
      {
        id: "rep-1",
        messageId: "msg-ui-1",
        adminEmail: "support@cobralearn.com",
        toEmail: "alex@example.com",
        subject: "Re: Platform Partnership — CobraLearn Innotechcore",
        bodyText: "Hello Alex, thank you for reaching out. We received your note.",
        provider: "resend",
        status: "SENT",
        createdAt: new Date(Date.now() - 3600000).toISOString(),
      },
    ],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    (adminClient.listAdminContactMessageReplies as any).mockResolvedValue({
      success: true,
      data: mockMessage.replies,
    });
  });

  it("renders message details and existing durable reply history", async () => {
    render(
      <MessageDetailModal
        message={mockMessage}
        open={true}
        onClose={vi.fn()}
        onUpdateStatus={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByText("Alex Rivera")).toBeInTheDocument();
    expect(screen.getByText("alex@example.com")).toBeInTheDocument();
    expect(screen.getByText("Platform Partnership")).toBeInTheDocument();
    expect(screen.getByText(/We would like to partner with CobraLearn/i)).toBeInTheDocument();

    // Verify durable reply history is visible
    expect(screen.getByText(/Durable Reply History \(1\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Hello Alex, thank you for reaching out/i)).toBeInTheDocument();
    expect(screen.getByText("RESEND")).toBeInTheDocument();
  });

  it("does NOT trigger mailto when Reply via Email is clicked; instead opens in-portal composer", async () => {
    render(
      <MessageDetailModal
        message={mockMessage}
        open={true}
        onClose={vi.fn()}
        onUpdateStatus={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    // Initial state: composer should not be visible
    expect(screen.queryByText("Compose Email Reply")).not.toBeInTheDocument();

    const replyButton = screen.getByRole("button", { name: /Reply via Email/i });
    fireEvent.click(replyButton);

    // After click: composer opens
    expect(screen.getByText("Compose Email Reply")).toBeInTheDocument();
    expect(screen.getByText(/Locked Recipient \(Anti-Relay\)/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue(/Re: Platform Partnership/i)).toBeInTheDocument();
  });

  it("validates body length and disables Send Reply button when body is too short", async () => {
    render(
      <MessageDetailModal
        message={mockMessage}
        open={true}
        onClose={vi.fn()}
        onUpdateStatus={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Reply via Email/i }));

    const bodyTextarea = screen.getByLabelText(/Message Body/i);
    fireEvent.change(bodyTextarea, { target: { value: "Short" } });

    const sendButton = screen.getByRole("button", { name: /Send Reply/i });
    expect(sendButton).toBeDisabled();
  });

  it("successfully submits reply, calls adminClient, updates status, and appends to thread", async () => {
    const onUpdateStatusSpy = vi.fn();
    const onReplySentSpy = vi.fn();

    (adminClient.sendAdminContactMessageReply as any).mockResolvedValue({
      success: true,
      data: {
        success: true,
        reply: {
          id: "rep-2",
          messageId: "msg-ui-1",
          adminEmail: "superadmin@cobralearn.com",
          toEmail: "alex@example.com",
          subject: "Re: Platform Partnership",
          bodyText: "Thank you Alex. Let's schedule a call this Wednesday.",
          provider: "resend",
          providerMessageId: "resend_123",
          status: "SENT",
          createdAt: new Date().toISOString(),
        },
        message: {
          ...mockMessage,
          status: "replied",
          repliedAt: new Date().toISOString(),
        },
      },
    });

    render(
      <MessageDetailModal
        message={mockMessage}
        open={true}
        onClose={vi.fn()}
        onUpdateStatus={onUpdateStatusSpy}
        onDelete={vi.fn()}
        onReplySent={onReplySentSpy}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Reply via Email/i }));

    const bodyTextarea = screen.getByLabelText(/Message Body/i);
    fireEvent.change(bodyTextarea, {
      target: { value: "Thank you Alex. Let's schedule a call this Wednesday." },
    });

    const sendButton = screen.getByRole("button", { name: /Send Reply/i });
    expect(sendButton).not.toBeDisabled();
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(adminClient.sendAdminContactMessageReply).toHaveBeenCalledWith(
        expect.objectContaining({
          messageId: "msg-ui-1",
          subject: expect.stringContaining("Platform Partnership"),
          body: "Thank you Alex. Let's schedule a call this Wednesday.",
        })
      );
    });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("Email reply dispatched"));
      expect(onUpdateStatusSpy).toHaveBeenCalledWith("msg-ui-1", "replied");
      expect(onReplySentSpy).toHaveBeenCalled();
      // Verify newly appended reply in UI
      expect(screen.getByText("Thank you Alex. Let's schedule a call this Wednesday.")).toBeInTheDocument();
    });
  });
});

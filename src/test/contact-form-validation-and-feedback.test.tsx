import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import ContactPage from "@/routes/contact";
import { adminClient } from "@/lib/api/admin-client";
import { toast } from "sonner";

// Mock TanStack router navigation and route hooks
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => () => ({
    component: vi.fn(),
    useLoaderData: () => ({
      publicNavData: { navItems: [], footerSections: [], socialLinks: [] },
      publicContactData: {
        formSettings: {
          title: "Send Us A Message",
          subtitle: "Have a project or partnership in mind? Drop us a line.",
          successMessage: "Thank you! Your message has been received.",
          submitButtonText: "Send Message",
          errorMessage: "Please check the required fields and try again.",
          subjectOptions: ["General Inquiry", "Project Collaboration", "Web Development"],
        },
      },
      contactLoadError: null,
    }),
  }),
  useRouterState: ({ select }: any = {}) =>
    select ? select({ location: { pathname: "/contact" } }) : { location: { pathname: "/contact" } },
  Link: ({ children, to, className }: any) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
}));

// Mock Sonner toast and Toaster
vi.mock("sonner", () => {
  const toastObj = {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  };
  return {
    toast: toastObj,
    Toaster: ({ toastOptions, ...props }: any) => (
      <div data-testid="sonner-toaster" className="toaster group" {...props}>
        <div data-testid="toaster-container" />
      </div>
    ),
  };
});

// Mock adminClient API methods
vi.mock("@/lib/api/admin-client", () => ({
  adminClient: {
    submitPublicContactMessage: vi.fn(),
    getPublicNavigationAndFooter: vi.fn().mockResolvedValue({ success: true, data: {} }),
    getPublicContactConfig: vi.fn().mockResolvedValue({ success: true, data: {} }),
  },
}));

describe("Public Contact Form — Visible Validation, Field Highlighting & Toast Feedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const getFormElements = () => {
    const nameInput = screen.getByPlaceholderText(/enter your full name/i) as HTMLInputElement;
    const emailInput = screen.getByPlaceholderText(/name@company\.com/i) as HTMLInputElement;
    const subjectSelect = screen.getByRole("combobox") as HTMLSelectElement;
    const messageInput = screen.getByPlaceholderText(/tell us about your project/i) as HTMLTextAreaElement;
    const submitButton = screen.getByRole("button", { name: /send message/i }) as HTMLButtonElement;
    return { nameInput, emailInput, subjectSelect, messageInput, submitButton };
  };

  // 1. Untouched fields do not show premature validation errors
  it("1. Untouched fields do not show premature validation errors on initial render", () => {
    render(<ContactPage />);
    const { nameInput, emailInput, subjectSelect, messageInput } = getFormElements();

    expect(nameInput.getAttribute("aria-invalid")).toBe("false");
    expect(emailInput.getAttribute("aria-invalid")).toBe("false");
    expect(subjectSelect.getAttribute("aria-invalid")).toBe("false");
    expect(messageInput.getAttribute("aria-invalid")).toBe("false");

    expect(nameInput.className).not.toContain("border-red-500");
    expect(emailInput.className).not.toContain("border-red-500");
    expect(subjectSelect.className).not.toContain("border-red-500");
    expect(messageInput.className).not.toContain("border-red-500");

    expect(screen.queryByText(/please enter your full name/i)).toBeNull();
    expect(screen.queryByText(/please enter a valid email address/i)).toBeNull();
    expect(screen.queryByText(/please select a subject/i)).toBeNull();
    expect(screen.queryByText(/please enter a message of at least 10 characters/i)).toBeNull();

    expect(toast.error).not.toHaveBeenCalled();
    // Helper hint must be visible
    expect(screen.getByText("Minimum 10 characters")).toBeDefined();
    // Placeholder must match name@company.com
    expect(emailInput.placeholder).toBe("name@company.com");
  });

  // 2. Invalid email highlights the email field and displays an inline error
  it("2. Invalid email highlights the email field and displays an inline error after interaction", () => {
    render(<ContactPage />);
    const { emailInput, nameInput, messageInput } = getFormElements();

    // Type invalid email (missing domain & TLD)
    fireEvent.change(emailInput, { target: { value: "invalid-email@" } });
    fireEvent.blur(emailInput);

    expect(emailInput.getAttribute("aria-invalid")).toBe("true");
    expect(emailInput.className).toContain("border-red-500");
    expect(screen.getByText("Please enter a valid email address.")).toBeDefined();

    // Untouched fields must NOT show premature errors
    expect(nameInput.getAttribute("aria-invalid")).toBe("false");
    expect(messageInput.getAttribute("aria-invalid")).toBe("false");
  });

  // 3. A short message shows the minimum-length hint and submission error
  it("3. A short message shows the persistent hint and displays an inline error when shorter than 10 chars", () => {
    render(<ContactPage />);
    const { messageInput } = getFormElements();

    // Persistent helper is visible
    expect(screen.getByText("Minimum 10 characters")).toBeDefined();

    // Enter message under 10 characters and blur
    fireEvent.change(messageInput, { target: { value: "Hello" } });
    fireEvent.blur(messageInput);

    expect(messageInput.getAttribute("aria-invalid")).toBe("true");
    expect(messageInput.className).toContain("border-red-500");
    expect(screen.getByText("Please enter a message of at least 10 characters.")).toBeDefined();
    expect(screen.getByText("5/1000")).toBeDefined();
  });

  // 4. Correcting invalid input clears the corresponding error
  it("4. Correcting invalid input clears the corresponding error immediately", () => {
    render(<ContactPage />);
    const { emailInput, messageInput } = getFormElements();

    // Invalidate email
    fireEvent.change(emailInput, { target: { value: "bad@" } });
    fireEvent.blur(emailInput);
    expect(screen.getByText("Please enter a valid email address.")).toBeDefined();

    // Correct email
    fireEvent.change(emailInput, { target: { value: "client@innotechcore.com" } });
    expect(emailInput.getAttribute("aria-invalid")).toBe("false");
    expect(emailInput.className).not.toContain("border-red-500");
    expect(screen.queryByText("Please enter a valid email address.")).toBeNull();

    // Invalidate message
    fireEvent.change(messageInput, { target: { value: "short" } });
    fireEvent.blur(messageInput);
    expect(screen.getByText("Please enter a message of at least 10 characters.")).toBeDefined();

    // Correct message (>= 10 characters)
    fireEvent.change(messageInput, {
      target: { value: "This is a comprehensive inquiry message." },
    });
    expect(messageInput.getAttribute("aria-invalid")).toBe("false");
    expect(messageInput.className).not.toContain("border-red-500");
    expect(screen.queryByText("Please enter a message of at least 10 characters.")).toBeNull();
  });

  // 5. Invalid input prevents the server submission function from being called, shows one toast, and focuses first invalid field
  it("5. Invalid input prevents server submission, highlights invalid fields, shows one toast, and focuses the first invalid field", () => {
    render(<ContactPage />);
    const { nameInput, emailInput, subjectSelect, messageInput, submitButton } = getFormElements();

    // Name is valid, but email is invalid, subject is valid, message is short
    fireEvent.change(nameInput, { target: { value: "Sarah Connor" } });
    fireEvent.change(emailInput, { target: { value: "incomplete-email@" } });
    fireEvent.change(subjectSelect, { target: { value: "General Inquiry" } });
    fireEvent.change(messageInput, { target: { value: "Too short" } });

    fireEvent.click(submitButton);

    // Server must NOT be called
    expect(adminClient.submitPublicContactMessage).not.toHaveBeenCalled();

    // Email and Message are highlighted
    expect(emailInput.getAttribute("aria-invalid")).toBe("true");
    expect(emailInput.className).toContain("border-red-500");
    expect(screen.getByText("Please enter a valid email address.")).toBeDefined();

    expect(messageInput.getAttribute("aria-invalid")).toBe("true");
    expect(messageInput.className).toContain("border-red-500");
    expect(screen.getByText("Please enter a message of at least 10 characters.")).toBeDefined();

    // Exactly one concise toast for the first invalid field (email)
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith("Please enter a valid email address.");

    // Focus set to the first invalid field (emailInput)
    expect(document.activeElement).toBe(emailInput);
  });

  // 6. Server/database failure displays an error and preserves entered values
  it("6. Server/database failure displays a safe error and preserves entered values", async () => {
    (adminClient.submitPublicContactMessage as any).mockResolvedValueOnce({
      success: false,
      error: "PrismaClientKnownRequestError: Can't reach database server at localhost:5432. SQL query execution failed.",
    });

    render(<ContactPage />);
    const { nameInput, emailInput, subjectSelect, messageInput, submitButton } = getFormElements();

    fireEvent.change(nameInput, { target: { value: "John Reese" } });
    fireEvent.change(emailInput, { target: { value: "john.reese@domain.com" } });
    fireEvent.change(subjectSelect, { target: { value: "Project Collaboration" } });
    fireEvent.change(messageInput, { target: { value: "We have an urgent digital transformation project to discuss." } });

    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(adminClient.submitPublicContactMessage).toHaveBeenCalledTimes(1);
    });

    // Sanitized error must not expose raw SQL or Prisma internals
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(toast.error).not.toHaveBeenCalledWith(expect.stringContaining("PrismaClient"));
    expect(toast.error).not.toHaveBeenCalledWith(expect.stringContaining("SQL query"));
    expect(toast.error).toHaveBeenCalledWith("Please check the required fields and try again.");

    // Form inputs must be PRESERVED
    expect(nameInput.value).toBe("John Reese");
    expect(emailInput.value).toBe("john.reese@domain.com");
    expect(subjectSelect.value).toBe("Project Collaboration");
    expect(messageInput.value).toBe("We have an urgent digital transformation project to discuss.");

    // Success banner must NOT appear
    expect(screen.queryByText("Thank you! Your message has been received.")).toBeNull();
    expect(toast.success).not.toHaveBeenCalled();
  });

  // 7. Success feedback appears only after confirmed successful submission
  it("7. Success feedback appears only after confirmed successful submission and resets the form", async () => {
    (adminClient.submitPublicContactMessage as any).mockResolvedValueOnce({
      success: true,
      data: { success: true, id: "msg-verified-uuid-123" },
    });

    render(<ContactPage />);
    const { nameInput, emailInput, subjectSelect, messageInput, submitButton } = getFormElements();

    fireEvent.change(nameInput, { target: { value: "Thomas Anderson" } });
    fireEvent.change(emailInput, { target: { value: "neo@matrix.io" } });
    fireEvent.change(subjectSelect, { target: { value: "Web Development" } });
    fireEvent.change(messageInput, { target: { value: "Requesting a quote for custom full-stack web application development." } });

    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(adminClient.submitPublicContactMessage).toHaveBeenCalledWith({
        fullName: "Thomas Anderson",
        email: "neo@matrix.io",
        subject: "Web Development",
        message: "Requesting a quote for custom full-stack web application development.",
        honeypot: "",
      });
    });

    // Success toast shown
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Thank you! Your message has been received.");
    });

    // Success banner appears
    expect(screen.getByText("Thank you! Your message has been received.")).toBeDefined();

    // Form fields are cleanly reset
    expect(nameInput.value).toBe("");
    expect(emailInput.value).toBe("");
    expect(subjectSelect.value).toBe("");
    expect(messageInput.value).toBe("");
  });

  // 8. Duplicate submissions are prevented while a request is pending
  it("8. Duplicate submissions are prevented while a request is pending", async () => {
    let resolvePromise: (val: any) => void = () => {};
    const pendingPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });

    (adminClient.submitPublicContactMessage as any).mockReturnValueOnce(pendingPromise);

    render(<ContactPage />);
    const { nameInput, emailInput, subjectSelect, messageInput, submitButton } = getFormElements();

    fireEvent.change(nameInput, { target: { value: "Grace Hopper" } });
    fireEvent.change(emailInput, { target: { value: "hopper@navy.mil" } });
    fireEvent.change(subjectSelect, { target: { value: "General Inquiry" } });
    fireEvent.change(messageInput, { target: { value: "Inquiry regarding the latest compiler optimizations and systems." } });

    // First click
    fireEvent.click(submitButton);

    expect(submitButton).toBeDisabled();
    expect(screen.getByText("Sending...")).toBeDefined();

    // Attempt second click while request is pending
    fireEvent.click(submitButton);

    // Call count must remain 1
    expect(adminClient.submitPublicContactMessage).toHaveBeenCalledTimes(1);

    // Resolve request
    resolvePromise({ success: true, data: { success: true, id: "msg-pending-1" } });

    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
      expect(screen.getByText("Send Message")).toBeDefined();
    });
  });

  // 9. Toast notifications are mounted and visible through the existing UI setup
  it("9. Toast notifications container is mounted within the Contact page DOM", () => {
    render(<ContactPage />);
    const toasterElement = screen.getByTestId("sonner-toaster");
    expect(toasterElement).toBeDefined();
    expect(toasterElement.className).toContain("toaster");
  });
});

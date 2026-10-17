import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { WebsiteForm, type WebsiteFormData } from "@/components/websites/WebsiteForm";
import type { WebsiteItem } from "@/lib/websites-data";
import { toast } from "sonner";

// Mock toast to inspect error notifications and verify no false success notifications
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

// Mock MediaLibraryPicker
let thumbnailPickerProps: any = null;
let galleryPickerProps: any = null;

vi.mock("@/components/media/MediaLibraryPicker", () => ({
  MediaLibraryPicker: (props: any) => {
    if (props.title?.includes("Cover")) {
      thumbnailPickerProps = props;
    } else {
      galleryPickerProps = props;
    }
    if (!props.open) return null;
    return (
      <div data-testid="media-library-picker">
        <span>Picker Open: {props.title}</span>
        <button
          data-testid="mock-select-thumbnail-btn"
          onClick={() =>
            props.onSelect([
              {
                id: "media-asset-thumb-456",
                name: "Screenshot.png",
                url: "https://storage.example.com/screenshot.png",
                thumbnail: "https://storage.example.com/screenshot-thumb.png",
              },
            ])
          }
        >
          Select Media
        </button>
      </div>
    );
  },
}));

describe("WebsiteForm Lifecycle & Validation Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    thumbnailPickerProps = null;
    galleryPickerProps = null;
  });

  it("strictly rejects Save as Draft if thumbnail is missing", () => {
    const onSave = vi.fn();
    render(
      <WebsiteForm
        onSave={onSave}
        onCancel={vi.fn()}
      />
    );

    // Fill name & description, leave thumbnail empty
    const nameInput = screen.getByPlaceholderText(/CobraLearn Platform/i);
    const descInput = screen.getByPlaceholderText(/Brief summary of the website/i);

    fireEvent.change(nameInput, { target: { value: "My Draft Website" } });
    fireEvent.change(descInput, { target: { value: "A useful draft website" } });

    // Click Save as Draft
    const draftBtn = screen.getByRole("button", { name: /save as draft/i });
    fireEvent.click(draftBtn);

    expect(onSave).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringMatching(/cover screenshot or thumbnail/i)
    );
    expect(
      screen.getByText(/cover screenshot or thumbnail is required before saving/i)
    ).toBeInTheDocument();
  });

  it("strictly rejects Publish if thumbnail is missing", () => {
    const onSave = vi.fn();
    render(
      <WebsiteForm
        onSave={onSave}
        onCancel={vi.fn()}
      />
    );

    const nameInput = screen.getByPlaceholderText(/CobraLearn Platform/i);
    const urlInput = screen.getByPlaceholderText(/https:\/\/cobralearn.dev/i);
    const descInput = screen.getByPlaceholderText(/Brief summary of the website/i);

    fireEvent.change(nameInput, { target: { value: "My Published Website" } });
    fireEvent.change(urlInput, { target: { value: "https://published.example.com" } });
    fireEvent.change(descInput, { target: { value: "A published site" } });

    // Click Publish
    const publishBtn = screen.getByRole("button", { name: /publish website/i });
    fireEvent.click(publishBtn);

    expect(onSave).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringMatching(/cover screenshot or thumbnail/i)
    );
    expect(
      screen.getByText(/cover screenshot or thumbnail is required before saving/i)
    ).toBeInTheDocument();
  });

  it("allows Save as Draft with empty Live Website URL once thumbnail is provided", () => {
    const onSave = vi.fn();
    render(
      <WebsiteForm
        onSave={onSave}
        onCancel={vi.fn()}
      />
    );

    const nameInput = screen.getByPlaceholderText(/CobraLearn Platform/i);
    const urlInput = screen.getByPlaceholderText(/https:\/\/cobralearn.dev/i);
    const descInput = screen.getByPlaceholderText(/Brief summary of the website/i);

    fireEvent.change(nameInput, { target: { value: "Draft Concept" } });
    fireEvent.change(urlInput, { target: { value: "" } }); // Empty URL
    fireEvent.change(descInput, { target: { value: "Site in stealth development" } });

    // Attach thumbnail via picker
    const libraryBtn = screen.getByRole("button", { name: /select from library/i });
    fireEvent.click(libraryBtn);

    const selectThumbBtn = screen.getByTestId("mock-select-thumbnail-btn");
    fireEvent.click(selectThumbBtn);

    // Save as draft
    const draftBtn = screen.getByRole("button", { name: /save as draft/i });
    fireEvent.click(draftBtn);

    expect(onSave).toHaveBeenCalledTimes(1);
    const firstCall = onSave.mock.calls[0];
    expect(firstCall).toBeDefined();
    if (!firstCall) {
      throw new Error("Expected onSave to have been called");
    }
    const [savedData, savedStatus] = firstCall;
    expect(savedStatus).toBe("Draft");
    expect(savedData.name).toBe("Draft Concept");
    expect(savedData.url).toBe("");
    expect(savedData.thumbnailId).toBe("media-asset-thumb-456");
  });

  it("strictly rejects Publish if Live Website URL is empty", () => {
    const onSave = vi.fn();
    render(
      <WebsiteForm
        onSave={onSave}
        onCancel={vi.fn()}
      />
    );

    const nameInput = screen.getByPlaceholderText(/CobraLearn Platform/i);
    const urlInput = screen.getByPlaceholderText(/https:\/\/cobralearn.dev/i);
    const descInput = screen.getByPlaceholderText(/Brief summary of the website/i);

    fireEvent.change(nameInput, { target: { value: "Launched Site" } });
    fireEvent.change(urlInput, { target: { value: "" } }); // Missing URL
    fireEvent.change(descInput, { target: { value: "Launched site description" } });

    // Attach thumbnail
    const libraryBtn = screen.getByRole("button", { name: /select from library/i });
    fireEvent.click(libraryBtn);
    fireEvent.click(screen.getByTestId("mock-select-thumbnail-btn"));

    // Attempt to Publish
    const publishBtn = screen.getByRole("button", { name: /publish website/i });
    fireEvent.click(publishBtn);

    expect(onSave).not.toHaveBeenCalled();
    expect(
      screen.getByText(/Live Website URL is required to publish a website/i)
    ).toBeInTheDocument();
  });

  it("rejects dangerous URL schemes for both Draft and Publish", () => {
    const onSave = vi.fn();
    render(
      <WebsiteForm
        onSave={onSave}
        onCancel={vi.fn()}
      />
    );

    const nameInput = screen.getByPlaceholderText(/CobraLearn Platform/i);
    const urlInput = screen.getByPlaceholderText(/https:\/\/cobralearn.dev/i);
    const descInput = screen.getByPlaceholderText(/Brief summary of the website/i);

    fireEvent.change(nameInput, { target: { value: "Malicious Site" } });
    fireEvent.change(descInput, { target: { value: "Testing XSS URL vector" } });

    // Attach thumbnail
    const libraryBtn = screen.getByRole("button", { name: /select from library/i });
    fireEvent.click(libraryBtn);
    fireEvent.click(screen.getByTestId("mock-select-thumbnail-btn"));

    // 1. Try Draft with javascript:
    fireEvent.change(urlInput, { target: { value: "javascript:alert('pwned')" } });
    const draftBtn = screen.getByRole("button", { name: /save as draft/i });
    fireEvent.click(draftBtn);

    expect(onSave).not.toHaveBeenCalled();
    expect(
      screen.getByText(/Dangerous or unsupported URL scheme is not allowed/i)
    ).toBeInTheDocument();

    // 2. Try Publish with data:
    fireEvent.change(urlInput, { target: { value: "data:text/html,<script>alert(1)</script>" } });
    const publishBtn = screen.getByRole("button", { name: /publish website/i });
    fireEvent.click(publishBtn);

    expect(onSave).not.toHaveBeenCalled();
    expect(
      screen.getByText(/Dangerous or unsupported URL scheme is not allowed/i)
    ).toBeInTheDocument();
  });

  it("allows Publish with safe HTTP or HTTPS URL", () => {
    const onSave = vi.fn();
    render(
      <WebsiteForm
        onSave={onSave}
        onCancel={vi.fn()}
      />
    );

    const nameInput = screen.getByPlaceholderText(/CobraLearn Platform/i);
    const urlInput = screen.getByPlaceholderText(/https:\/\/cobralearn.dev/i);
    const descInput = screen.getByPlaceholderText(/Brief summary of the website/i);

    fireEvent.change(nameInput, { target: { value: "Safe Portal" } });
    fireEvent.change(urlInput, { target: { value: "https://portal.cobralearn.com" } });
    fireEvent.change(descInput, { target: { value: "Fully valid showcase site" } });

    // Attach thumbnail
    const libraryBtn = screen.getByRole("button", { name: /select from library/i });
    fireEvent.click(libraryBtn);
    fireEvent.click(screen.getByTestId("mock-select-thumbnail-btn"));

    const publishBtn = screen.getByRole("button", { name: /publish website/i });
    fireEvent.click(publishBtn);

    expect(onSave).toHaveBeenCalledTimes(1);
    const firstCall = onSave.mock.calls[0];
    expect(firstCall).toBeDefined();
    if (!firstCall) {
      throw new Error("Expected onSave to have been called");
    }
    const [savedData, savedStatus] = firstCall;
    expect(savedStatus).toBe("Published");
    expect(savedData.url).toBe("https://portal.cobralearn.com");
  });

  it("preserves correct thumbnail hydration when editing existing websites", () => {
    const existingWebsite: WebsiteItem = {
      id: "web-99",
      name: "Existing Deployed Portal",
      slug: "existing-deployed-portal",
      url: "https://existing.portal.com",
      description: "Existing production portal.",
      fullDescription: "Long description.",
      status: "Published",
      featured: true,
      category: "Education",
      order: 1,
      technologies: ["Next.js", "Tailwind CSS"],
      tags: ["Education"],
      thumbnailId: "media-existing-cover",
      image: "https://storage.example.com/existing-cover.png",
      gallery: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const onSave = vi.fn();
    render(
      <WebsiteForm
        website={existingWebsite}
        isEdit={true}
        onSave={onSave}
        onCancel={vi.fn()}
      />
    );

    // Verify thumbnail is pre-hydrated and rendered
    const coverImg = screen.getByAltText(/Website screenshot/i);
    expect(coverImg).toHaveAttribute("src", "https://storage.example.com/existing-cover.png");

    // Click Update Website (Published)
    const updateBtn = screen.getByRole("button", { name: /update website/i });
    fireEvent.click(updateBtn);

    expect(onSave).toHaveBeenCalledTimes(1);
    const firstCall = onSave.mock.calls[0];
    expect(firstCall).toBeDefined();
    if (!firstCall) {
      throw new Error("Expected onSave to have been called");
    }
    const [savedData] = firstCall;
    expect(savedData.thumbnailId).toBe("media-existing-cover");
  });

  it("Save as Draft explicitly submits DRAFT and succeeds even when the Status dropdown is set to Published", () => {
    const onSave = vi.fn();
    render(
      <WebsiteForm
        onSave={onSave}
        onCancel={vi.fn()}
      />
    );

    const nameInput = screen.getByPlaceholderText(/CobraLearn Platform/i);
    const urlInput = screen.getByPlaceholderText(/https:\/\/cobralearn.dev/i);
    const descInput = screen.getByPlaceholderText(/Brief summary of the website/i);

    fireEvent.change(nameInput, { target: { value: "Draft With Dropdown Changed" } });
    fireEvent.change(urlInput, { target: { value: "" } }); // Empty URL
    fireEvent.change(descInput, { target: { value: "A stealth draft site" } });

    // Attach thumbnail
    const libraryBtn = screen.getByRole("button", { name: /select from library/i });
    fireEvent.click(libraryBtn);
    fireEvent.click(screen.getByTestId("mock-select-thumbnail-btn"));

    // Explicitly set the Status dropdown to "Published"
    const statusSelect = screen.getByDisplayValue("Draft");
    fireEvent.change(statusSelect, { target: { value: "Published" } });
    expect(screen.getByDisplayValue("Published")).toBeInTheDocument();

    // Now click "Save as Draft"
    const draftBtn = screen.getByRole("button", { name: /save as draft/i });
    fireEvent.click(draftBtn);

    // Should NOT throw or fail; should submit as "Draft" with empty URL
    expect(onSave).toHaveBeenCalledTimes(1);
    const firstCall = onSave.mock.calls[0];
    expect(firstCall).toBeDefined();
    if (!firstCall) {
      throw new Error("Expected onSave to have been called");
    }
    const [savedData, savedStatus] = firstCall;
    expect(savedStatus).toBe("Draft");
    expect(savedData.status).toBe("Draft");
    expect(savedData.url).toBe("");

    // The Status dropdown in the UI should update to "Draft" to prevent contradiction
    expect(screen.getByDisplayValue("Draft")).toBeInTheDocument();
  });

  it("allows updating an existing Draft website with empty URL via Update Website", () => {
    const draftWebsite: WebsiteItem = {
      id: "web-draft-1",
      name: "Existing Draft Website",
      slug: "existing-draft-website",
      url: "",
      description: "Still in drafting phase.",
      status: "Draft",
      featured: false,
      category: "Education",
      order: 1,
      technologies: ["React"],
      tags: [],
      thumbnailId: "media-existing-cover",
      image: "https://storage.example.com/draft-cover.png",
      gallery: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const onSave = vi.fn();
    render(
      <WebsiteForm
        website={draftWebsite}
        isEdit={true}
        onSave={onSave}
        onCancel={vi.fn()}
      />
    );

    // Click Update Website (which uses form.status, which is "Draft")
    const updateBtn = screen.getByRole("button", { name: /update website/i });
    fireEvent.click(updateBtn);

    expect(onSave).toHaveBeenCalledTimes(1);
    const firstCall = onSave.mock.calls[0];
    expect(firstCall).toBeDefined();
    if (!firstCall) {
      throw new Error("Expected onSave to have been called");
    }
    const [savedData, savedStatus] = firstCall;
    expect(savedStatus).toBe("Draft");
    expect(savedData.url).toBe("");
  });
});

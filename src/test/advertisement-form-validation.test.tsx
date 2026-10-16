import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import React from "react";
import {
  AdvertisementForm,
  type AdvertisementFormData,
} from "@/components/advertisements/AdvertisementForm";
import type { AdvertisementItem } from "@/lib/advertisements-data";
import { toast } from "sonner";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

let bannerPickerProps: any = null;

vi.mock("@/components/media/MediaLibraryPicker", () => ({
  MediaLibraryPicker: (props: any) => {
    bannerPickerProps = props;
    if (!props.open) return null;
    return (
      <div data-testid="media-library-picker">
        <span>Picker Open: {props.title}</span>
        <button
          data-testid="mock-select-banner-btn"
          onClick={() =>
            props.onSelect([
              {
                id: "media-asset-thumb-456",
                name: "Banner.jpg",
                url: "https://storage.example.com/banner.jpg",
                thumbnail: "https://storage.example.com/banner-thumb.jpg",
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

describe("AdvertisementForm Lifecycle & Validation Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    bannerPickerProps = null;
  });

  it("initializes creation form with clean empty inputs and Draft default status", () => {
    render(<AdvertisementForm onSave={vi.fn()} onCancel={vi.fn()} />);

    const titleInput = screen.getByPlaceholderText(/enter advertisement title/i) as HTMLInputElement;
    const campaignInput = screen.getByPlaceholderText(/enter campaign name/i) as HTMLInputElement;
    const brandInput = screen.getByPlaceholderText(/e\.g\. CobraLearn, Google/i) as HTMLInputElement;
    const descInput = screen.getByPlaceholderText(/brief description/i) as HTMLTextAreaElement;
    const urlInput = screen.getByPlaceholderText(/https:\/\/example\.com/i) as HTMLInputElement;

    expect(titleInput.value).toBe("");
    expect(campaignInput.value).toBe("");
    expect(brandInput.value).toBe("");
    expect(descInput.value).toBe("");
    expect(urlInput.value).toBe("");
    expect(screen.getByText(/select or upload main banner image/i)).toBeInTheDocument();
  });

  it("strictly rejects Save as Draft if thumbnail is missing", () => {
    const onSave = vi.fn();
    render(<AdvertisementForm onSave={onSave} onCancel={vi.fn()} />);

    const titleInput = screen.getByPlaceholderText(/enter advertisement title/i);
    const campaignInput = screen.getByPlaceholderText(/enter campaign name/i);
    const brandInput = screen.getByPlaceholderText(/e\.g\. CobraLearn, Google/i);
    const descInput = screen.getByPlaceholderText(/brief description/i);

    fireEvent.change(titleInput, { target: { value: "Draft Ad Title" } });
    fireEvent.change(campaignInput, { target: { value: "Spring Campaign" } });
    fireEvent.change(brandInput, { target: { value: "CobraLearn" } });
    fireEvent.change(descInput, { target: { value: "Short promo description." } });

    const draftBtn = screen.getByRole("button", { name: /save as draft/i });
    fireEvent.click(draftBtn);

    expect(onSave).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringMatching(/banner image.*from the Media Library/i)
    );
    expect(
      screen.getByText(/banner image or thumbnail is required before saving/i)
    ).toBeInTheDocument();
  });

  it("strictly rejects Publish if thumbnail is missing", () => {
    const onSave = vi.fn();
    render(<AdvertisementForm onSave={onSave} onCancel={vi.fn()} />);

    const titleInput = screen.getByPlaceholderText(/enter advertisement title/i);
    const campaignInput = screen.getByPlaceholderText(/enter campaign name/i);
    const brandInput = screen.getByPlaceholderText(/e\.g\. CobraLearn, Google/i);
    const descInput = screen.getByPlaceholderText(/brief description/i);

    fireEvent.change(titleInput, { target: { value: "Published Ad" } });
    fireEvent.change(campaignInput, { target: { value: "Summer Campaign" } });
    fireEvent.change(brandInput, { target: { value: "CobraLearn" } });
    fireEvent.change(descInput, { target: { value: "Valid description." } });

    const publishBtn = screen.getByRole("button", { name: /create advertisement/i });
    fireEvent.click(publishBtn);

    expect(onSave).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringMatching(/banner image.*from the Media Library/i)
    );
    expect(
      screen.getByText(/banner image or thumbnail is required before saving/i)
    ).toBeInTheDocument();
  });

  it("validates campaignUrl to reject dangerous schemes", () => {
    const onSave = vi.fn();
    render(<AdvertisementForm onSave={onSave} onCancel={vi.fn()} />);

    const titleInput = screen.getByPlaceholderText(/enter advertisement title/i);
    const campaignInput = screen.getByPlaceholderText(/enter campaign name/i);
    const brandInput = screen.getByPlaceholderText(/e\.g\. CobraLearn, Google/i);
    const descInput = screen.getByPlaceholderText(/brief description/i);
    const urlInput = screen.getByPlaceholderText(/https:\/\/example\.com/i);

    fireEvent.change(titleInput, { target: { value: "Ad With Bad URL" } });
    fireEvent.change(campaignInput, { target: { value: "Security Test" } });
    fireEvent.change(brandInput, { target: { value: "Test Brand" } });
    fireEvent.change(descInput, { target: { value: "Test description" } });
    fireEvent.change(urlInput, { target: { value: "javascript:alert('xss')" } });

    const draftBtn = screen.getByRole("button", { name: /save as draft/i });
    fireEvent.click(draftBtn);

    expect(onSave).not.toHaveBeenCalled();
    expect(
      screen.getByText(/dangerous or unsupported url scheme is not allowed/i)
    ).toBeInTheDocument();
  });

  it("successfully submits when all required fields and valid thumbnail are supplied", () => {
    const onSave = vi.fn();
    render(<AdvertisementForm onSave={onSave} onCancel={vi.fn()} />);

    const titleInput = screen.getByPlaceholderText(/enter advertisement title/i);
    const campaignInput = screen.getByPlaceholderText(/enter campaign name/i);
    const brandInput = screen.getByPlaceholderText(/e\.g\. CobraLearn, Google/i);
    const descInput = screen.getByPlaceholderText(/brief description/i);
    const urlInput = screen.getByPlaceholderText(/https:\/\/example\.com/i);

    fireEvent.change(titleInput, { target: { value: "Complete Campaign" } });
    fireEvent.change(campaignInput, { target: { value: "Autumn 2026" } });
    fireEvent.change(brandInput, { target: { value: "CobraLearn" } });
    fireEvent.change(descInput, { target: { value: "Valid short description." } });
    fireEvent.change(urlInput, { target: { value: "https://cobralearn.com/promo" } });

    // Open library picker
    const selectLibraryBtn = screen.getByRole("button", { name: /select from library/i });
    fireEvent.click(selectLibraryBtn);

    expect(screen.getByTestId("media-library-picker")).toBeInTheDocument();

    // Select media
    const selectBtn = screen.getByTestId("mock-select-banner-btn");
    fireEvent.click(selectBtn);

    // Save as Published
    const publishBtn = screen.getByRole("button", { name: /create advertisement/i });
    fireEvent.click(publishBtn);

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Complete Campaign",
        campaign: "Autumn 2026",
        brand: "CobraLearn",
        description: "Valid short description.",
        campaignUrl: "https://cobralearn.com/promo",
        thumbnailId: "media-asset-thumb-456",
        status: "Published",
      }),
      "Published"
    );
  });

  it("accurately hydrates existing advertisement values and thumbnail in edit mode", () => {
    const existingAd: AdvertisementItem = {
      id: "ad-edit-1",
      slug: "tech-summit-2026",
      name: "Global Tech Summit",
      campaign: "Summit 2026",
      brand: "InnoTech",
      description: "Annual conference for builders.",
      fullDescription: "Detailed agenda and speaker line-up.",
      campaignType: "Workshop",
      startDate: "2026-11-01",
      endDate: "2026-11-03",
      campaignUrl: "https://summit.example.com",
      order: 4,
      status: "Published",
      showOnHomepage: true,
      thumbnailId: "media-existing-thumb-99",
      image: "https://storage.example.com/summit-banner.jpg",
      date: "Nov 2026",
    };

    render(
      <AdvertisementForm
        ad={existingAd}
        isEdit={true}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    const titleInput = screen.getByPlaceholderText(/enter advertisement title/i) as HTMLInputElement;
    const campaignInput = screen.getByPlaceholderText(/enter campaign name/i) as HTMLInputElement;
    const brandInput = screen.getByPlaceholderText(/e\.g\. CobraLearn, Google/i) as HTMLInputElement;
    const descInput = screen.getByPlaceholderText(/brief description/i) as HTMLTextAreaElement;
    const urlInput = screen.getByPlaceholderText(/https:\/\/example\.com/i) as HTMLInputElement;

    expect(titleInput.value).toBe("Global Tech Summit");
    expect(campaignInput.value).toBe("Summit 2026");
    expect(brandInput.value).toBe("InnoTech");
    expect(descInput.value).toBe("Annual conference for builders.");
    expect(urlInput.value).toBe("https://summit.example.com");

    // Banner image preview should be displayed
    const previewImg = screen.getByAltText(/banner preview/i) as HTMLImageElement;
    expect(previewImg.src).toBe("https://storage.example.com/summit-banner.jpg");

    expect(screen.getByRole("button", { name: /update advertisement/i })).toBeInTheDocument();
  });
});

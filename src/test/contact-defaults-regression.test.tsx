import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { DEFAULT_CONTACT_CONFIG } from "@/lib/contact-data";
import { contactStore } from "@/lib/contact-store";
import { ContactInfoTab } from "@/components/contact/tabs/ContactInfoTab";
import {
  getPublicContactConfigOperation,
  updateAdminContactConfigOperation,
  getAdminContactConfigOperation,
} from "@/lib/server/contact-operations";
import { getSupabaseServerClient } from "@/lib/supabase/server";

// Mock supabase server auth
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: vi.fn(),
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock @tanstack/react-router
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, className }: any) => <a href={to} className={className}>{children}</a>,
}));

describe("Contact Module — Clear Incorrect Defaults & Persistence Regression Tests", () => {
  const adminId = "11111111-1111-4111-8111-111111111111";

  beforeEach(() => {
    vi.clearAllMocks();
    contactStore.resetConfigToDefault();

    (getSupabaseServerClient as any).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: adminId,
              email: "admin@cobralearn.com",
              aud: "authenticated",
            },
          },
          error: null,
        }),
      },
    });
  });

  const createAuthRequest = (): Request => {
    return new Request("https://api.internal/admin/contact/config", {
      headers: {
        Authorization: "Bearer mock-admin-token",
        Cookie: "sb-mock-token=valid",
      },
    });
  };

  describe("1. Default Configuration and Store State", () => {
    it("has empty strings for default contact email, phone, and location in DEFAULT_CONTACT_CONFIG", () => {
      expect(DEFAULT_CONTACT_CONFIG.contactInfo.email).toBe("");
      expect(DEFAULT_CONTACT_CONFIG.contactInfo.phone).toBe("");
      expect(DEFAULT_CONTACT_CONFIG.contactInfo.location).toBe("");
      // Unrelated defaults must remain preserved
      expect(DEFAULT_CONTACT_CONFIG.hero.sectionLabel).toBe("CONTACT");
      expect(DEFAULT_CONTACT_CONFIG.seo.pageTitle).toContain("Contact Us");
      expect(DEFAULT_CONTACT_CONFIG.socialLinks.length).toBeGreaterThan(0);
      expect(DEFAULT_CONTACT_CONFIG.faqs.length).toBeGreaterThan(0);
      expect(DEFAULT_CONTACT_CONFIG.highlights.length).toBeGreaterThan(0);
    });

    it("resets contact info to empty defaults on resetContactInfoToDefault() while preserving other sections", () => {
      contactStore.updateConfig({
        hero: { ...contactStore.getConfigSnapshot().hero, mainHeading: "CUSTOM HEADING" },
        seo: { pageTitle: "Custom Title", metaDescription: "Custom Meta" },
        contactInfo: {
          email: "custom@example.com",
          emailDescription: "Custom desc",
          phone: "+1 234 567 8900",
          businessHours: "9-5",
          location: "San Francisco, CA",
          locationDescription: "Main office",
        },
      });

      expect(contactStore.getConfigSnapshot().contactInfo.email).toBe("custom@example.com");
      expect(contactStore.getConfigSnapshot().hero.mainHeading).toBe("CUSTOM HEADING");
      expect(contactStore.getConfigSnapshot().seo.pageTitle).toBe("Custom Title");

      // Reset contact info only
      contactStore.resetContactInfoToDefault();

      const snapshot = contactStore.getConfigSnapshot();
      expect(snapshot.contactInfo.email).toBe("");
      expect(snapshot.contactInfo.phone).toBe("");
      expect(snapshot.contactInfo.location).toBe("");
      // Hero and SEO must NOT be wiped out
      expect(snapshot.hero.mainHeading).toBe("CUSTOM HEADING");
      expect(snapshot.seo.pageTitle).toBe("Custom Title");
    });

    it("initializeFromServer preserves intentional empty string values without falling back to sample data", () => {
      contactStore.initializeFromServer({
        config: {
          heroSectionNumber: "01",
          heroSectionLabel: "CONTACT",
          heroTitle: "LET'S BUILD",
          heroSubtitle: "Sub",
          heroKeywords: ["A", "B"],
          seoPageTitle: "Contact Page",
          seoMetaDescription: "Meta",
          contactEmailDescription: "Email desc",
          contactLocationDescription: "Loc desc",
          highlights: [],
          faqs: [],
          socialLinks: [],
        },
        siteSettings: {
          contactEmail: "",
          contactPhone: "",
          contactAddress: "",
          businessHours: "Mon-Fri 9-5",
        },
      });

      const snapshot = contactStore.getConfigSnapshot();
      expect(snapshot.contactInfo.email).toBe("");
      expect(snapshot.contactInfo.phone).toBe("");
      expect(snapshot.contactInfo.location).toBe("");
    });
  });

  describe("2. ContactInfoTab UI & Reset Behavior", () => {
    it("clears contact email, phone, and location when 'Reset to Default' is clicked in ContactInfoTab", () => {
      const handleDirty = vi.fn();

      contactStore.updateConfig((prev) => ({
        ...prev,
        contactInfo: {
          ...prev.contactInfo,
          email: "populated@example.com",
          phone: "+1 800 555 1234",
          location: "Dallas, TX",
        },
      }));

      render(<ContactInfoTab onMarkDirty={handleDirty} />);

      const emailInput = screen.getByLabelText(/primary contact email/i) as HTMLInputElement;
      const phoneInput = screen.getByLabelText(/inbound phone number/i) as HTMLInputElement;
      const locationInput = screen.getByLabelText(/location \/ city/i) as HTMLInputElement;

      expect(emailInput.value).toBe("populated@example.com");
      expect(phoneInput.value).toBe("+1 800 555 1234");
      expect(locationInput.value).toBe("Dallas, TX");

      // Click Reset to Default
      const resetButton = screen.getByRole("button", { name: /reset to default/i });
      fireEvent.click(resetButton);

      // Verify fields are cleared
      expect(emailInput.value).toBe("");
      expect(phoneInput.value).toBe("");
      expect(locationInput.value).toBe("");
      expect(handleDirty).toHaveBeenCalled();
    });

    it("does not render fake sample cards in the ContactInfoTab live preview when fields are empty", () => {
      contactStore.updateConfig((prev) => ({
        ...prev,
        contactInfo: {
          ...prev.contactInfo,
          email: "",
          phone: "",
          location: "",
        },
      }));

      render(<ContactInfoTab />);

      expect(
        screen.getByText(/no direct contact channels configured\. channels will be hidden from public view/i)
      ).toBeDefined();

      expect(screen.queryByText("contact@cobralearn.com")).toBeNull();
      expect(screen.queryByText("+91 98765 43210")).toBeNull();
      expect(screen.queryByText("Hyderabad, Telangana, India")).toBeNull();
    });
  });

  describe("3. Server Operations & Database Persistence for Empty Values", () => {
    it("updateAdminContactConfigOperation persists explicitly entered empty values to siteSettings", async () => {
      const upsertMock = vi.fn().mockImplementation(({ update }: any) => Promise.resolve({ id: "default", ...update }));
      const mockPrisma: any = {
        $transaction: vi.fn().mockImplementation(async (callback) => callback(mockPrisma)),
        adminProfile: {
          findUnique: vi.fn().mockResolvedValue({
            id: adminId,
            email: "admin@cobralearn.com",
            fullName: "Test Admin",
            role: "ADMIN",
            isActive: true,
          }),
        },
        contactPageConfig: {
          upsert: vi.fn().mockResolvedValue({
            id: "default",
            heroBackgroundAsset: null,
            highlights: [],
            faqs: [],
            socialLinks: [],
          }),
          findUnique: vi.fn().mockResolvedValue({
            id: "default",
            heroBackgroundAsset: null,
            highlights: [],
            faqs: [],
            socialLinks: [],
          }),
        },
        siteSettings: {
          upsert: upsertMock,
        },
        adminAuditLog: {
          create: vi.fn().mockResolvedValue({ id: "log-1" }),
        },
      };

      const req = createAuthRequest();

      // Saving intentionally empty fields
      await updateAdminContactConfigOperation(
        req,
        {
          contactInfo: {
            email: "",
            phone: "",
            location: "",
            businessHours: "Mon - Fri: 9:00 AM - 6:00 PM IST",
          },
        },
        mockPrisma
      );

      // Verify siteSettings.upsert was called with empty strings rather than ignored
      expect(upsertMock).toHaveBeenCalledTimes(1);
      const callArg = upsertMock.mock.calls[0]![0];
      expect(callArg.update.contactEmail).toBe("");
      expect(callArg.update.contactPhone).toBe("");
      expect(callArg.update.contactAddress).toBe("");
    });

    it("getPublicContactConfigOperation returns empty strings when fields are empty or siteSettings is null", async () => {
      const mockPrismaNull: any = {
        contactPageConfig: { findUnique: vi.fn().mockResolvedValue(null) },
        siteSettings: { findUnique: vi.fn().mockResolvedValue(null) },
      };

      const publicConfigNull = await getPublicContactConfigOperation(mockPrismaNull);
      expect(publicConfigNull.contactInfo.email).toBe("");
      expect(publicConfigNull.contactInfo.phone).toBe("");
      expect(publicConfigNull.contactInfo.location).toBe("");

      // When record exists with empty strings
      const mockPrismaEmpty: any = {
        contactPageConfig: { findUnique: vi.fn().mockResolvedValue(null) },
        siteSettings: {
          findUnique: vi.fn().mockResolvedValue({
            contactEmail: "",
            contactPhone: "",
            contactAddress: "",
            businessHours: "10am - 6pm",
          }),
        },
      };

      const publicConfigEmpty = await getPublicContactConfigOperation(mockPrismaEmpty);
      expect(publicConfigEmpty.contactInfo.email).toBe("");
      expect(publicConfigEmpty.contactInfo.phone).toBe("");
      expect(publicConfigEmpty.contactInfo.location).toBe("");
    });

    it("getAdminContactConfigOperation returns empty strings in fallback siteSettings", async () => {
      const mockPrisma: any = {
        adminProfile: {
          findUnique: vi.fn().mockResolvedValue({
            id: adminId,
            email: "admin@cobralearn.com",
            fullName: "Test Admin",
            role: "ADMIN",
            isActive: true,
          }),
        },
        contactPageConfig: {
          upsert: vi.fn().mockResolvedValue({
            id: "default",
            heroBackgroundAsset: null,
            highlights: [],
            faqs: [],
            socialLinks: [],
          }),
        },
        siteSettings: {
          findUnique: vi.fn().mockResolvedValue(null),
        },
      };

      const req = createAuthRequest();

      const res = await getAdminContactConfigOperation(req, mockPrisma);
      expect(res.siteSettings.contactEmail).toBe("");
      expect(res.siteSettings.contactPhone).toBe("");
      expect(res.siteSettings.contactAddress).toBe("");
    });
  });
});

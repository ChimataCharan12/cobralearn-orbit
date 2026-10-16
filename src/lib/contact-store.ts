import { useSyncExternalStore } from "react";
import {
  DEFAULT_CONTACT_CONFIG,
  INITIAL_MESSAGES,
  type ContactHighlight,
  type ContactFaq,
  type ContactMessage,
  type ContactPageConfig,
  type ContactSocialLink,
  type HeroKeyword,
  type MessageStatus,
} from "./contact-data";

class ContactStore {
  private config: ContactPageConfig = JSON.parse(JSON.stringify(DEFAULT_CONTACT_CONFIG));
  private messages: ContactMessage[] = [...INITIAL_MESSAGES];
  private listeners: Set<() => void> = new Set();

  private notify() {
    this.listeners.forEach((listener) => listener());
  }

  public subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  public getConfigSnapshot = (): ContactPageConfig => {
    return this.config;
  };

  public getMessagesSnapshot = (): ContactMessage[] => {
    return this.messages;
  };

  // Config Actions
  public updateConfig = (newConfig: Partial<ContactPageConfig> | ((prev: ContactPageConfig) => ContactPageConfig)) => {
    if (typeof newConfig === "function") {
      this.config = newConfig(this.config);
    } else {
      this.config = { ...this.config, ...newConfig };
    }
    this.notify();
  };

  public resetConfigToDefault = () => {
    this.config = JSON.parse(JSON.stringify(DEFAULT_CONTACT_CONFIG));
    this.notify();
  };

  public resetContactInfoToDefault = () => {
    this.config = {
      ...this.config,
      contactInfo: {
        ...this.config.contactInfo,
        email: "",
        phone: "",
        location: "",
      },
    };
    this.notify();
  };

  public initializeFromServer = (serverData: { config: any; siteSettings: any }) => {
    if (!serverData || !serverData.config) return;
    const { config, siteSettings } = serverData;
    this.config = {
      hero: {
        sectionNumber: config.heroSectionNumber || "01",
        sectionLabel: config.heroSectionLabel || "CONTACT",
        mainHeading: config.heroTitle || DEFAULT_CONTACT_CONFIG.hero.mainHeading,
        highlightHeading: config.heroHighlightHeading || DEFAULT_CONTACT_CONFIG.hero.highlightHeading,
        description: config.heroDescription || config.heroSubtitle || DEFAULT_CONTACT_CONFIG.hero.description,
        backgroundImage: config.heroBackgroundAsset?.publicUrl || null,
        backgroundImageId: config.heroBackgroundAssetId || config.heroBackgroundAsset?.id || null,
        keywords: Array.isArray(config.heroKeywords) && config.heroKeywords.length > 0
          ? config.heroKeywords.map((k: string, i: number) => ({ id: `kw-${i}`, text: k, order: i + 1 }))
          : DEFAULT_CONTACT_CONFIG.hero.keywords,
      },
      seo: {
        pageTitle: config.seoPageTitle || DEFAULT_CONTACT_CONFIG.seo.pageTitle,
        metaDescription: config.seoMetaDescription || DEFAULT_CONTACT_CONFIG.seo.metaDescription,
      },
      contactInfo: {
        email: siteSettings?.contactEmail ?? "",
        emailDescription: config.contactEmailDescription || DEFAULT_CONTACT_CONFIG.contactInfo.emailDescription,
        phone: siteSettings?.contactPhone ?? "",
        businessHours: siteSettings?.businessHours || DEFAULT_CONTACT_CONFIG.contactInfo.businessHours,
        location: siteSettings?.contactAddress ?? "",
        locationDescription: config.contactLocationDescription || DEFAULT_CONTACT_CONFIG.contactInfo.locationDescription,
      },
      socialLinks: Array.isArray(config.socialLinks) && config.socialLinks.length > 0
        ? config.socialLinks.map((s: any, i: number) => ({
            id: s.id,
            platform: s.platform,
            label: s.label || s.platform,
            url: s.url,
            icon: s.iconName,
            order: s.displayOrder !== undefined ? s.displayOrder : i + 1,
            enabled: s.isEnabled ?? true,
          }))
        : DEFAULT_CONTACT_CONFIG.socialLinks,
      highlights: Array.isArray(config.highlights) && config.highlights.length > 0
        ? config.highlights.map((h: any, i: number) => ({
            id: h.id,
            title: h.title,
            description: h.description,
            icon: h.iconName,
            accent: (h.accentColor?.toLowerCase() as any) || "emerald",
            order: h.displayOrder !== undefined ? h.displayOrder : i + 1,
            isActive: h.isEnabled ?? true,
          }))
        : DEFAULT_CONTACT_CONFIG.highlights,
      faqs: Array.isArray(config.faqs) && config.faqs.length > 0
        ? config.faqs.map((f: any, i: number) => ({
            id: f.id,
            question: f.question,
            answer: f.answer,
            icon: f.iconName || "Briefcase",
            order: f.displayOrder !== undefined ? f.displayOrder : i + 1,
            isActive: f.isEnabled ?? true,
          }))
        : DEFAULT_CONTACT_CONFIG.faqs,
      formSettings: {
        heading: config.formTitle || DEFAULT_CONTACT_CONFIG.formSettings.heading,
        description: config.formSubtitle || DEFAULT_CONTACT_CONFIG.formSettings.description,
        subjectOptions: Array.isArray(config.subjectOptions) && config.subjectOptions.length > 0
          ? config.subjectOptions
          : DEFAULT_CONTACT_CONFIG.formSettings.subjectOptions,
        submitButtonText: config.formSubmitButtonText || DEFAULT_CONTACT_CONFIG.formSettings.submitButtonText,
        successMessage: config.formSuccessMessage || DEFAULT_CONTACT_CONFIG.formSettings.successMessage,
        errorMessage: config.formErrorMessage || DEFAULT_CONTACT_CONFIG.formSettings.errorMessage,
        enableFaqSection: config.enableFaqSection ?? true,
        enableHighlights: config.enableHighlights ?? true,
      },
    };
    this.notify();
  };

  public initializeMessagesFromServer = (serverMessages: any[]) => {
    if (!Array.isArray(serverMessages)) return;
    this.messages = serverMessages.map((m: any) => ({
      id: m.id,
      fullName: m.fullName,
      email: m.email,
      subject: m.subject,
      message: m.message,
      status: (m.status?.toLowerCase() as MessageStatus) || "new",
      createdAt: typeof m.createdAt === "string" ? m.createdAt : new Date(m.createdAt).toISOString(),
      readAt: m.readAt ? (typeof m.readAt === "string" ? m.readAt : new Date(m.readAt).toISOString()) : null,
      repliedAt: m.repliedAt ? (typeof m.repliedAt === "string" ? m.repliedAt : new Date(m.repliedAt).toISOString()) : null,
      notes: m.adminNotes || undefined,
    }));
    this.notify();
  };

  // Hero Keyword Actions
  public addKeyword = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const newKeyword: HeroKeyword = {
      id: `kw-${Date.now()}`,
      text: trimmed.toUpperCase(),
      order: this.config.hero.keywords.length + 1,
    };
    this.config = {
      ...this.config,
      hero: {
        ...this.config.hero,
        keywords: [...this.config.hero.keywords, newKeyword],
      },
    };
    this.notify();
  };

  public removeKeyword = (id: string) => {
    this.config = {
      ...this.config,
      hero: {
        ...this.config.hero,
        keywords: this.config.hero.keywords.filter((k) => k.id !== id),
      },
    };
    this.notify();
  };

  public reorderKeywords = (keywords: HeroKeyword[]) => {
    this.config = {
      ...this.config,
      hero: {
        ...this.config.hero,
        keywords,
      },
    };
    this.notify();
  };

  // Social Links Actions
  public addSocialLink = (link: Omit<ContactSocialLink, "id" | "order">) => {
    const newLink: ContactSocialLink = {
      ...link,
      id: `social-${Date.now()}`,
      order: this.config.socialLinks.length + 1,
    };
    this.config = {
      ...this.config,
      socialLinks: [...this.config.socialLinks, newLink],
    };
    this.notify();
  };

  public updateSocialLink = (id: string, updates: Partial<ContactSocialLink>) => {
    this.config = {
      ...this.config,
      socialLinks: this.config.socialLinks.map((l) => (l.id === id ? { ...l, ...updates } : l)),
    };
    this.notify();
  };

  public deleteSocialLink = (id: string) => {
    this.config = {
      ...this.config,
      socialLinks: this.config.socialLinks.filter((l) => l.id !== id),
    };
    this.notify();
  };

  public reorderSocialLinks = (links: ContactSocialLink[]) => {
    this.config = {
      ...this.config,
      socialLinks: links.map((l, index) => ({ ...l, order: index + 1 })),
    };
    this.notify();
  };

  // Highlights Actions
  public addHighlight = (highlight: Omit<ContactHighlight, "id" | "order">) => {
    const newHl: ContactHighlight = {
      ...highlight,
      id: `hl-${Date.now()}`,
      order: this.config.highlights.length + 1,
    };
    this.config = {
      ...this.config,
      highlights: [...this.config.highlights, newHl],
    };
    this.notify();
  };

  public updateHighlight = (id: string, updates: Partial<ContactHighlight>) => {
    this.config = {
      ...this.config,
      highlights: this.config.highlights.map((h) => (h.id === id ? { ...h, ...updates } : h)),
    };
    this.notify();
  };

  public deleteHighlight = (id: string) => {
    this.config = {
      ...this.config,
      highlights: this.config.highlights.filter((h) => h.id !== id),
    };
    this.notify();
  };

  public reorderHighlights = (highlights: ContactHighlight[]) => {
    this.config = {
      ...this.config,
      highlights: highlights.map((h, index) => ({ ...h, order: index + 1 })),
    };
    this.notify();
  };

  // FAQs Actions
  public addFaq = (faq: Omit<ContactFaq, "id" | "order">) => {
    const newFaq: ContactFaq = {
      ...faq,
      id: `faq-${Date.now()}`,
      order: this.config.faqs.length + 1,
    };
    this.config = {
      ...this.config,
      faqs: [...this.config.faqs, newFaq],
    };
    this.notify();
  };

  public updateFaq = (id: string, updates: Partial<ContactFaq>) => {
    this.config = {
      ...this.config,
      faqs: this.config.faqs.map((f) => (f.id === id ? { ...f, ...updates } : f)),
    };
    this.notify();
  };

  public deleteFaq = (id: string) => {
    this.config = {
      ...this.config,
      faqs: this.config.faqs.filter((f) => f.id !== id),
    };
    this.notify();
  };

  public reorderFaqs = (faqs: ContactFaq[]) => {
    this.config = {
      ...this.config,
      faqs: faqs.map((f, index) => ({ ...f, order: index + 1 })),
    };
    this.notify();
  };

  // Subject Options Actions
  public addSubjectOption = (option: string) => {
    const trimmed = option.trim();
    if (!trimmed || this.config.formSettings.subjectOptions.includes(trimmed)) return;
    this.config = {
      ...this.config,
      formSettings: {
        ...this.config.formSettings,
        subjectOptions: [...this.config.formSettings.subjectOptions, trimmed],
      },
    };
    this.notify();
  };

  public updateSubjectOption = (index: number, newOption: string) => {
    const trimmed = newOption.trim();
    if (!trimmed) return;
    const copy = [...this.config.formSettings.subjectOptions];
    copy[index] = trimmed;
    this.config = {
      ...this.config,
      formSettings: {
        ...this.config.formSettings,
        subjectOptions: copy,
      },
    };
    this.notify();
  };

  public deleteSubjectOption = (index: number) => {
    this.config = {
      ...this.config,
      formSettings: {
        ...this.config.formSettings,
        subjectOptions: this.config.formSettings.subjectOptions.filter((_, i) => i !== index),
      },
    };
    this.notify();
  };

  public reorderSubjectOptions = (options: string[]) => {
    this.config = {
      ...this.config,
      formSettings: {
        ...this.config.formSettings,
        subjectOptions: options,
      },
    };
    this.notify();
  };

  // Messages Actions
  public addMessage = (message: Omit<ContactMessage, "id" | "createdAt" | "status">): ContactMessage => {
    const newMsg: ContactMessage = {
      ...message,
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      status: "new",
      createdAt: new Date().toISOString(),
      readAt: null,
      repliedAt: null,
    };
    this.messages = [newMsg, ...this.messages];
    this.notify();
    return newMsg;
  };

  public updateMessageStatus = (id: string, status: MessageStatus) => {
    this.messages = this.messages.map((m) => {
      if (m.id !== id) return m;
      const updates: Partial<ContactMessage> = { status };
      if (status === "read" && !m.readAt) {
        updates.readAt = new Date().toISOString();
      }
      if (status === "replied" && !m.repliedAt) {
        updates.repliedAt = new Date().toISOString();
      }
      return { ...m, ...updates };
    });
    this.notify();
  };

  public deleteMessage = (id: string) => {
    this.messages = this.messages.filter((m) => m.id !== id);
    this.notify();
  };

  public bulkUpdateStatus = (ids: string[], status: MessageStatus) => {
    this.messages = this.messages.map((m) => (ids.includes(m.id) ? { ...m, status } : m));
    this.notify();
  };

  public bulkDelete = (ids: string[]) => {
    this.messages = this.messages.filter((m) => !ids.includes(m.id));
    this.notify();
  };
}

export const contactStore = new ContactStore();

export function useContactConfig() {
  const config = useSyncExternalStore(
    contactStore.subscribe,
    contactStore.getConfigSnapshot,
    contactStore.getConfigSnapshot
  );

  return {
    config,
    updateConfig: contactStore.updateConfig,
    resetConfigToDefault: contactStore.resetConfigToDefault,
    resetContactInfoToDefault: contactStore.resetContactInfoToDefault,
    addKeyword: contactStore.addKeyword,
    removeKeyword: contactStore.removeKeyword,
    reorderKeywords: contactStore.reorderKeywords,
    addSocialLink: contactStore.addSocialLink,
    updateSocialLink: contactStore.updateSocialLink,
    deleteSocialLink: contactStore.deleteSocialLink,
    reorderSocialLinks: contactStore.reorderSocialLinks,
    addHighlight: contactStore.addHighlight,
    updateHighlight: contactStore.updateHighlight,
    deleteHighlight: contactStore.deleteHighlight,
    reorderHighlights: contactStore.reorderHighlights,
    addFaq: contactStore.addFaq,
    updateFaq: contactStore.updateFaq,
    deleteFaq: contactStore.deleteFaq,
    reorderFaqs: contactStore.reorderFaqs,
    addSubjectOption: contactStore.addSubjectOption,
    updateSubjectOption: contactStore.updateSubjectOption,
    deleteSubjectOption: contactStore.deleteSubjectOption,
    reorderSubjectOptions: contactStore.reorderSubjectOptions,
    initializeFromServer: contactStore.initializeFromServer,
  };
}

export function useContactMessages() {
  const messages = useSyncExternalStore(
    contactStore.subscribe,
    contactStore.getMessagesSnapshot,
    contactStore.getMessagesSnapshot
  );

  return {
    messages,
    addMessage: contactStore.addMessage,
    updateMessageStatus: contactStore.updateMessageStatus,
    deleteMessage: contactStore.deleteMessage,
    bulkUpdateStatus: contactStore.bulkUpdateStatus,
    bulkDelete: contactStore.bulkDelete,
    initializeMessagesFromServer: contactStore.initializeMessagesFromServer,
  };
}

export function getContactConfig(): ContactPageConfig {
  return contactStore.getConfigSnapshot();
}

export function getContactMessages(): ContactMessage[] {
  return contactStore.getMessagesSnapshot();
}

export function submitContactMessage(message: Omit<ContactMessage, "id" | "createdAt" | "status">): ContactMessage {
  return contactStore.addMessage(message);
}

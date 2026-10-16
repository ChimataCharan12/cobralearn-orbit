import heroImage from "@/assets/cobralearn-hero.jpg";

export type HighlightAccent = "emerald" | "amber" | "cyan";

export interface HeroKeyword {
  id: string;
  text: string;
  order: number;
}

export interface ContactSocialLink {
  id: string;
  platform: string;
  label: string;
  url: string;
  icon: string;
  order: number;
  enabled: boolean;
}

export interface ContactHighlight {
  id: string;
  title: string;
  description: string;
  icon: string;
  accent: HighlightAccent;
  order: number;
  isActive: boolean;
}

export interface ContactFaq {
  id: string;
  question: string;
  answer: string;
  icon: string;
  order: number;
  isActive: boolean;
}

export interface ContactPageConfig {
  hero: {
    sectionNumber: string;
    sectionLabel: string;
    mainHeading: string;
    highlightHeading: string;
    description: string;
    backgroundImage: string | null;
    backgroundImageId?: string | null;
    keywords: HeroKeyword[];
  };
  seo: {
    pageTitle: string;
    metaDescription: string;
  };
  contactInfo: {
    email: string;
    emailDescription: string;
    phone: string;
    businessHours: string;
    location: string;
    locationDescription: string;
  };
  socialLinks: ContactSocialLink[];
  highlights: ContactHighlight[];
  faqs: ContactFaq[];
  formSettings: {
    heading: string;
    description: string;
    subjectOptions: string[];
    submitButtonText: string;
    successMessage: string;
    errorMessage: string;
    enableFaqSection?: boolean;
    enableHighlights?: boolean;
  };
}

export type MessageStatus = "new" | "read" | "replied" | "archived";

export interface ContactMessageReply {
  id: string;
  messageId: string;
  adminId?: string | null;
  adminEmail: string;
  toEmail: string;
  subject: string;
  bodyText: string;
  bodyHtml?: string | null;
  provider: string;
  providerMessageId?: string | null;
  status: string;
  errorMessage?: string | null;
  idempotencyKey?: string | null;
  createdAt: string;
}

export interface ContactMessage {
  id: string;
  fullName: string;
  email: string;
  subject: string;
  message: string;
  status: MessageStatus;
  createdAt: string;
  readAt?: string | null;
  repliedAt?: string | null;
  notes?: string;
  replies?: ContactMessageReply[];
}

export const DEFAULT_CONTACT_CONFIG: ContactPageConfig = {
  hero: {
    sectionNumber: "01",
    sectionLabel: "CONTACT",
    mainHeading: "LET'S BUILD",
    highlightHeading: "SOMETHING TOGETHER",
    description:
      "Have a project, partnership, or idea in mind? We'd love to hear from you. Let's connect and create impactful digital experiences together.",
    backgroundImage: heroImage,
    keywords: [
      { id: "kw-1", text: "IDEAS", order: 1 },
      { id: "kw-2", text: "PARTNERSHIPS", order: 2 },
      { id: "kw-3", text: "GROWTH", order: 3 },
      { id: "kw-4", text: "TOGETHER", order: 4 },
    ],
  },
  seo: {
    pageTitle: "Contact Us — CobraLearn Innotechcore",
    metaDescription:
      "Have a project, partnership, or idea in mind? Connect with CobraLearn Innotechcore to build impactful digital experiences.",
  },
  contactInfo: {
    email: "",
    emailDescription: "For general inquiries and business discussions",
    phone: "",
    businessHours: "Mon - Fri, 10:00 AM - 6:00 PM (IST)",
    location: "",
    locationDescription: "Open for onsite meetings (by appointment)",
  },
  socialLinks: [
    {
      id: "social-li",
      platform: "LinkedIn",
      label: "LinkedIn",
      url: "https://linkedin.com",
      icon: "Linkedin",
      order: 1,
      enabled: true,
    },
    {
      id: "social-ig",
      platform: "Instagram",
      label: "Instagram",
      url: "https://instagram.com",
      icon: "Instagram",
      order: 2,
      enabled: true,
    },
    {
      id: "social-yt",
      platform: "YouTube",
      label: "YouTube",
      url: "https://youtube.com",
      icon: "Youtube",
      order: 3,
      enabled: true,
    },
    {
      id: "social-x",
      platform: "X (Twitter)",
      label: "X",
      url: "https://x.com",
      icon: "X",
      order: 4,
      enabled: true,
    },
    {
      id: "social-gh",
      platform: "GitHub",
      label: "GitHub",
      url: "https://github.com",
      icon: "Github",
      order: 5,
      enabled: true,
    },
  ],
  highlights: [
    {
      id: "hl-1",
      title: "New Opportunities",
      description: "We're open to collaborations",
      icon: "Briefcase",
      accent: "emerald",
      order: 1,
      isActive: true,
    },
    {
      id: "hl-2",
      title: "Business Inquiries",
      description: "Let's discuss your ideas",
      icon: "Sparkles",
      accent: "amber",
      order: 2,
      isActive: true,
    },
    {
      id: "hl-3",
      title: "Strategic Partnerships",
      description: "Building a better digital future",
      icon: "ShieldCheck",
      accent: "cyan",
      order: 3,
      isActive: true,
    },
  ],
  faqs: [
    {
      id: "faq-1",
      question: "Do you take freelance or custom projects?",
      answer:
        "Yes! We take on select custom software development, modern web applications, and digital campaigns tailored to specific business goals and innovation initiatives.",
      icon: "Briefcase",
      order: 1,
      isActive: true,
    },
    {
      id: "faq-2",
      question: "How can we collaborate or partner with you?",
      answer:
        "You can reach out via our contact form or email us directly at contact@cobralearn.com. We collaborate with engineering teams, institutions, and innovative brands on digital experiences and showcases.",
      icon: "Users",
      order: 2,
      isActive: true,
    },
    {
      id: "faq-3",
      question: "What is the typical response time?",
      answer:
        "Our team typically reviews all inquiries and responds within 24 to 48 business hours. For immediate project inquiries, you can also reach us via phone during regular IST business hours.",
      icon: "Clock",
      order: 3,
      isActive: true,
    },
  ],
  formSettings: {
    heading: "SEND US A MESSAGE",
    description: "Fill out the form below and we'll get back to you as soon as possible.",
    subjectOptions: [
      "Project Inquiry / Custom Development",
      "Website Development",
      "Advertisement & Campaign Production",
      "Strategic Partnership & Collaboration",
      "Technical Consultation",
      "General Inquiry",
    ],
    submitButtonText: "Send Message",
    successMessage: "Thank you! Your message has been received. We will get back to you soon.",
    errorMessage: "Please check the required fields and try again.",
  },
};

export const INITIAL_MESSAGES: ContactMessage[] = [];

import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, type FormEvent } from "react";
import {
  Briefcase,
  ChevronDown,
  Clock,
  Github,
  Globe,
  Instagram,
  Linkedin,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Send,
  ShieldCheck,
  Sparkles,
  Tag,
  User,
  Users,
  Youtube,
  ArrowRight,
  CheckCircle2,
  Zap,
  Layers,
  HelpCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Header } from "@/components/public/Header";
import { Footer } from "@/components/public/Footer";
import defaultHeroImage from "@/assets/cobralearn-hero.jpg";
import { useContactConfig } from "@/lib/contact-store";
import { adminClient } from "@/lib/api/admin-client";

export const Route = createFileRoute("/contact")({
  staleTime: 0,
  shouldReload: true,
  loader: async () => {
    const [navRes, contactRes] = await Promise.all([
      adminClient.getPublicNavigationAndFooter(),
      adminClient.getPublicContactConfig(),
    ]);
    return {
      publicNavData: navRes.success && navRes.data ? navRes.data : { navItems: [], footerSections: [], socialLinks: [] },
      publicContactData: contactRes.success && contactRes.data ? contactRes.data : null,
      contactLoadError: contactRes.success ? null : (contactRes.error || "Unable to retrieve contact configuration"),
    };
  },
  head: ({ loaderData }: any) => {
    const seo = loaderData?.publicContactData?.seo;
    return {
      meta: [
        { title: seo?.pageTitle || "Contact Us — CobraLearn Innotechcore" },
        {
          name: "description",
          content:
            seo?.metaDescription ||
            "Have a project, partnership, or idea in mind? Connect with CobraLearn Innotechcore to build impactful digital experiences.",
        },
        { property: "og:title", content: seo?.pageTitle || "Contact Us — CobraLearn Innotechcore" },
        {
          property: "og:description",
          content:
            seo?.metaDescription ||
            "Connect with CobraLearn Innotechcore for projects, websites, advertisements, and strategic partnerships.",
        },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: ContactPage,
});

function isSafeUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  const trimmed = url.trim().toLowerCase();
  return (
    trimmed.startsWith("https://") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("mailto:") ||
    trimmed.startsWith("tel:")
  );
}

function sanitizeErrorMessage(serverError: unknown, fallback: string): string {
  if (typeof serverError !== "string" || !serverError.trim()) {
    return fallback;
  }
  const clean = serverError.trim();
  if (clean.startsWith("Validation Error: ")) {
    return clean.replace(/^Validation Error:\s*/, "");
  }
  if (clean.startsWith("Rate Limit Exceeded: ")) {
    return clean.replace(/^Rate Limit Exceeded:\s*/, "");
  }
  const lower = clean.toLowerCase();
  if (
    lower.includes("prisma") ||
    lower.includes("sql") ||
    lower.includes("syntax") ||
    lower.includes("relation") ||
    lower.includes("table") ||
    lower.includes("connection") ||
    lower.includes("econnrefused") ||
    lower.includes("null constraint") ||
    lower.includes("foreign key") ||
    lower.includes("database") ||
    lower.includes("column") ||
    lower.includes("transaction")
  ) {
    return fallback;
  }
  return clean;
}

function ContactPage({ loaderDataOverride }: { loaderDataOverride?: any } = {}) {
  let routeLoaderData: any = null;
  try {
    if (typeof Route?.useLoaderData === "function") {
      routeLoaderData = Route.useLoaderData();
    }
  } catch {
    // Graceful fallback when rendered in isolated unit tests
  }
  const loaderData = loaderDataOverride || routeLoaderData;
  const publicNavData = loaderData?.publicNavData;
  const publicContactData = loaderData?.publicContactData;
  const contactLoadError = loaderData?.contactLoadError;
  const { config } = useContactConfig();

  // Prefer server data, with graceful fallback to store defaults
  const hero = {
    sectionNumber: publicContactData?.hero?.sectionNumber ?? config.hero.sectionNumber,
    sectionLabel: publicContactData?.hero?.sectionLabel ?? config.hero.sectionLabel,
    mainHeading: publicContactData?.hero?.heroTitle ?? config.hero.mainHeading,
    highlightHeading: publicContactData?.hero?.highlightHeading ?? config.hero.highlightHeading,
    description: publicContactData?.hero?.description ?? publicContactData?.hero?.heroSubtitle ?? config.hero.description,
    backgroundImage: publicContactData?.hero?.backgroundImage || config.hero.backgroundImage,
    keywords: publicContactData?.hero?.keywords
      ? publicContactData.hero.keywords.map((kw: string, i: number) => ({ id: String(i), text: kw }))
      : config.hero.keywords,
  };

  const contactInfo = {
    email: publicContactData?.contactInfo?.email ?? config.contactInfo.email,
    emailDescription: publicContactData?.contactInfo?.emailDescription ?? config.contactInfo.emailDescription,
    phone: publicContactData?.contactInfo?.phone ?? config.contactInfo.phone,
    businessHours: publicContactData?.contactInfo?.businessHours ?? config.contactInfo.businessHours,
    location: publicContactData?.contactInfo?.location ?? config.contactInfo.location,
    locationDescription: publicContactData?.contactInfo?.locationDescription ?? config.contactInfo.locationDescription,
  };

  const socialLinks = publicContactData?.socialLinks
    ? publicContactData.socialLinks.map((s: any) => ({
        id: s.id,
        platform: s.platform,
        url: s.url,
        icon: s.iconName || s.platform,
        label: s.label || s.platform,
        enabled: true,
      }))
    : config.socialLinks.filter((s) => s.enabled);

  const showHighlights = publicContactData?.formSettings?.enableHighlights ?? true;
  const highlights = showHighlights
    ? (publicContactData?.highlights
        ? publicContactData.highlights.map((h: any) => ({
            id: h.id,
            title: h.title,
            description: h.description,
            icon: h.iconName,
            accent: (h.accentColor || "emerald").toLowerCase(),
            isActive: true,
          }))
        : config.highlights.filter((h) => h.isActive))
  : [];

  const showFaqs = publicContactData?.formSettings?.enableFaqSection ?? true;
  const faqs = showFaqs
    ? (publicContactData?.faqs
        ? publicContactData.faqs.map((f: any) => ({
            id: f.id,
            question: f.question,
            answer: f.answer,
            icon: f.iconName || "HelpCircle",
            isActive: true,
          }))
        : config.faqs.filter((f) => f.isActive))
    : [];

  const formSettings = {
    heading: publicContactData?.formSettings?.title ?? config.formSettings.heading,
    description: publicContactData?.formSettings?.subtitle ?? config.formSettings.description,
    successMessage: publicContactData?.formSettings?.successMessage ?? config.formSettings.successMessage,
    submitButtonText: publicContactData?.formSettings?.submitButtonText ?? config.formSettings.submitButtonText,
    errorMessage: publicContactData?.formSettings?.errorMessage ?? "Please check the required fields and try again.",
    subjectOptions: publicContactData?.formSettings?.subjectOptions ?? config.formSettings.subjectOptions,
  };

  // Form state
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  // Field interaction and submission attempt tracking
  const [touched, setTouched] = useState({
    fullName: false,
    email: false,
    subject: false,
    message: false,
  });
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);

  // Input refs for auto-focusing first invalid field
  const fullNameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const subjectRef = useRef<HTMLSelectElement>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);

  // Validation predicates
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isFullNameValid = (val: string) => val.trim().length >= 2 && val.trim().length <= 100;
  const isEmailValid = (val: string) => emailRegex.test(val.trim());
  const isSubjectValid = (val: string) => Boolean(val && val.trim().length > 0);
  const isMessageValid = (val: string) => val.trim().length >= 10 && val.length <= 1000;

  const showFullNameError = (touched.fullName || hasAttemptedSubmit) && !isFullNameValid(fullName);
  const showEmailError = (touched.email || hasAttemptedSubmit) && !isEmailValid(email);
  const showSubjectError = (touched.subject || hasAttemptedSubmit) && !isSubjectValid(subject);
  const showMessageError = (touched.message || hasAttemptedSubmit) && !isMessageValid(message);

  // FAQ accordion state (null or faq id)
  const [openFaq, setOpenFaq] = useState<string | null>(null);

  const toggleFaq = (id: string) => {
    setOpenFaq((prev) => (prev === id ? null : id));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (isSubmitting) return;

    setHasAttemptedSubmit(true);
    setTouched({
      fullName: true,
      email: true,
      subject: true,
      message: true,
    });

    const fullNameOk = isFullNameValid(fullName);
    const emailOk = isEmailValid(email);
    const subjectOk = isSubjectValid(subject);
    const messageOk = isMessageValid(message);

    if (!fullNameOk) {
      fullNameRef.current?.focus();
      toast.error("Please enter your full name.");
      return;
    }

    if (!emailOk) {
      emailRef.current?.focus();
      toast.error("Please enter a valid email address.");
      return;
    }

    if (!subjectOk) {
      subjectRef.current?.focus();
      toast.error("Please select a subject.");
      return;
    }

    if (!messageOk) {
      messageRef.current?.focus();
      toast.error("Please enter a message of at least 10 characters.");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await adminClient.submitPublicContactMessage({
        fullName: fullName.trim(),
        email: email.trim(),
        subject,
        message: message.trim(),
        honeypot: honeypot.trim(),
      });

      setIsSubmitting(false);

      if (res.success && res.data?.id) {
        setSubmittedSuccess(true);
        toast.success(formSettings.successMessage || "Thank you! Your message has been received.");
        setFullName("");
        setEmail("");
        setSubject("");
        setMessage("");
        setHoneypot("");
        setTouched({ fullName: false, email: false, subject: false, message: false });
        setHasAttemptedSubmit(false);
      } else {
        const safeError = sanitizeErrorMessage(
          res.error,
          formSettings.errorMessage || "Failed to submit message. Please try again."
        );
        toast.error(safeError);
      }
    } catch (err: unknown) {
      setIsSubmitting(false);
      const rawMsg = err instanceof Error ? err.message : String(err || "");
      const safeError = sanitizeErrorMessage(
        rawMsg,
        formSettings.errorMessage || "An unexpected error occurred. Please try again later."
      );
      toast.error(safeError);
    }
  };

  const renderHighlightIcon = (iconName: string, accent: string) => {
    let colorClass = "text-[#00ff87]";
    if (accent === "amber") colorClass = "text-[#f59e0b]";
    if (accent === "cyan") colorClass = "text-[#00d2ff]";

    switch (iconName) {
      case "Sparkles":
        return <Sparkles className={`size-4 ${colorClass}`} />;
      case "ShieldCheck":
        return <ShieldCheck className={`size-4 ${colorClass}`} />;
      case "Zap":
        return <Zap className={`size-4 ${colorClass}`} />;
      case "Layers":
        return <Layers className={`size-4 ${colorClass}`} />;
      default:
        return <Briefcase className={`size-4 ${colorClass}`} />;
    }
  };

  const renderFaqIcon = (iconName: string) => {
    switch (iconName) {
      case "Users":
        return <Users className="size-4 text-[#f59e0b]" />;
      case "Clock":
        return <Clock className="size-4 text-[#f59e0b]" />;
      case "Sparkles":
        return <Sparkles className="size-4 text-[#f59e0b]" />;
      case "Briefcase":
        return <Briefcase className="size-4 text-[#f59e0b]" />;
      default:
        return <HelpCircle className="size-4 text-[#f59e0b]" />;
    }
  };

  const renderSocialIcon = (iconName: string) => {
    switch (iconName.toLowerCase()) {
      case "linkedin":
        return <Linkedin className="size-4" />;
      case "instagram":
        return <Instagram className="size-4" />;
      case "youtube":
        return <Youtube className="size-4" />;
      case "github":
        return <Github className="size-4" />;
      case "x":
        return <span className="font-display font-bold text-[13px]">𝕏</span>;
      default:
        return <Globe className="size-4" />;
    }
  };

  return (
    <main id="contact" className="site-shell contact-page-root">
      <Header navItems={publicNavData?.navItems} />

      {/* Advisory Banner when Live Configuration Read Fails */}
      {contactLoadError && (
        <div className="relative z-20 max-w-[1380px] mx-auto px-4 sm:px-6 lg:px-8 pt-24 -mb-20">
          <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-950/50 text-amber-200 text-[12.5px] backdrop-blur-md flex items-center justify-between gap-3 shadow-lg">
            <span>Notice: Unable to reach configuration service ({contactLoadError}). Displaying verified fallback contact information.</span>
          </div>
        </div>
      )}

      {/* Hero Container with Cinematic Background */}
      <section className="relative min-h-[580px] pt-[100px] pb-12 px-4 sm:px-6 lg:px-8 max-w-[1380px] mx-auto overflow-hidden">
        {/* Cinematic Backdrop Image */}
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
          <img
            src={hero.backgroundImage || defaultHeroImage}
            alt=""
            aria-hidden="true"
            className="w-full h-full object-cover object-center opacity-35 filter brightness-90"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#020806]/85 via-[#020806]/75 to-[#020806]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(0,255,135,0.12),transparent_60%)]" />
        </div>

        {/* Hero Top Content */}
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] items-start gap-8 pt-4">
          <div>
            {/* Section Eyebrow */}
            <div className="flex items-center gap-2 mb-3">
              <span className="font-display text-[13px] font-bold text-[#f59e0b] tracking-wider">
                {hero.sectionNumber}
              </span>
              <span className="h-[1px] w-4 bg-[#f59e0b]/60" />
              <span className="font-display text-[12px] font-bold text-[#00ff87] tracking-[0.25em] uppercase">
                {hero.sectionLabel}
              </span>
              <span className="h-[1px] w-6 bg-[#00ff87]/40" />
            </div>

            {/* Main Title */}
            <h1 className="font-display text-[38px] sm:text-[48px] lg:text-[56px] font-extrabold leading-[1.05] tracking-tight text-white uppercase drop-shadow-[0_2px_15px_rgba(0,0,0,0.8)]">
              {hero.mainHeading}
              <br />
              <span className="text-[#00ff87] drop-shadow-[0_0_25px_rgba(0,255,135,0.6)]">
                {hero.highlightHeading}
              </span>
            </h1>

            {/* Subtitle */}
            <p className="mt-4 font-sans text-[14px] sm:text-[15px] leading-relaxed text-[#94a3b8] max-w-xl">
              {hero.description}
            </p>

            {/* Highlight Cards */}
            {highlights.length > 0 && (
              <div className="mt-7 grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl">
                {highlights.map((hl) => {
                  let borderClass = "border-[#00ff87]/20 bg-[#041209]/70";
                  let iconBorderClass = "border-[#00ff87]/40 bg-[#022010] shadow-[0_0_12px_rgba(0,255,135,0.25)]";

                  if (hl.accent === "amber") {
                    borderClass = "border-[#f59e0b]/20 bg-[#041209]/70";
                    iconBorderClass = "border-[#f59e0b]/40 bg-[#201502] shadow-[0_0_12px_rgba(245,158,11,0.25)]";
                  } else if (hl.accent === "cyan") {
                    borderClass = "border-[#00d2ff]/20 bg-[#041209]/70";
                    iconBorderClass = "border-[#00d2ff]/40 bg-[#021820] shadow-[0_0_12px_rgba(0,210,255,0.25)]";
                  }

                  return (
                    <div
                      key={hl.id}
                      className={`flex items-center gap-3 p-2.5 rounded-xl border ${borderClass} backdrop-blur-md`}
                    >
                      <div className={`size-9 rounded-lg border ${iconBorderClass} flex items-center justify-center shrink-0`}>
                        {renderHighlightIcon(hl.icon, hl.accent)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-display text-[12px] font-bold text-white leading-tight truncate">
                          {hl.title}
                        </p>
                        <p className="font-sans text-[10.5px] text-[#94a3b8] truncate">
                          {hl.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Hero Decorative HUD / Keywords */}
          {hero.keywords.length > 0 && (
            <div className="hidden lg:flex flex-col items-end justify-center pt-8 pr-6">
              <div className="p-4 rounded-2xl border border-[#00ff87]/25 bg-[#02140a]/60 backdrop-blur-md shadow-[0_0_25px_rgba(0,255,135,0.15)] text-right">
                {hero.keywords.map((kw, i) => {
                  let colorClass = "text-[#00ff87]";
                  if (i % 4 === 1) colorClass = "text-[#38ef7d]";
                  if (i % 4 === 2) colorClass = "text-[#00d2ff]";
                  if (i % 4 === 3) colorClass = "text-white";

                  return (
                    <p
                      key={kw.id}
                      className={`font-display text-[11px] font-bold tracking-[0.3em] ${colorClass} ${
                        i < hero.keywords.length - 1 ? "mb-1" : ""
                      }`}
                    >
                      {kw.text}
                    </p>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Main Two-Column Content Section */}
      <section className="relative z-10 max-w-[1380px] mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-[1.58fr_1fr] gap-6 lg:gap-8 items-start">
          {/* Left Column: Send Us A Message Form Card */}
          <div className="relative rounded-[22px] border border-[#00ff87]/35 bg-[#040e08]/90 p-6 sm:p-8 backdrop-blur-xl shadow-[0_0_35px_rgba(0,255,135,0.12),0_20px_60px_rgba(0,0,0,0.85)]">
            {/* Top-left Corner Chamfer Amber Accent */}
            <div className="absolute top-0 left-0 size-8 border-t-2 border-l-2 border-[#f59e0b] rounded-tl-[22px] pointer-events-none" />

            {/* Header */}
            <div className="mb-6">
              <h2 className="font-display text-[22px] sm:text-[25px] font-bold text-white tracking-wide uppercase flex items-center gap-3">
                <span>{formSettings.heading}</span>
              </h2>
              <div className="mt-1 h-[2px] w-12 bg-gradient-to-r from-[#00ff87] to-transparent rounded-full" />
              <p className="mt-2 font-sans text-[13px] text-[#94a3b8]">
                {formSettings.description}
              </p>
            </div>

            {submittedSuccess && (
              <div className="mb-6 flex items-center gap-3 p-4 rounded-xl border border-[#00ff87]/40 bg-[#022010]/90 text-[#00ff87] text-[13px]">
                <CheckCircle2 className="size-5 shrink-0" />
                <span>{formSettings.successMessage}</span>
              </div>
            )}

            {/* Form */}
            <form noValidate onSubmit={handleSubmit} className="space-y-4">
              {/* Anti-spam honeypot (hidden from human visitors) */}
              <div style={{ display: "none" }} aria-hidden="true">
                <input
                  type="text"
                  name="_gotcha"
                  tabIndex={-1}
                  autoComplete="off"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                />
              </div>

              {/* Row 1: Name & Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Full Name */}
                <div>
                  <label htmlFor="fullName" className="block font-sans text-[12.5px] font-semibold text-[#e2e8f0] mb-1.5">
                    Full Name <span className="text-[#00ff87]">*</span>
                  </label>
                  <div className="relative flex items-center">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-[#00ff87]/70 pointer-events-none" />
                    <input
                      ref={fullNameRef}
                      id="fullName"
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      onBlur={() => setTouched((prev) => ({ ...prev, fullName: true }))}
                      placeholder="Enter your full name"
                      aria-invalid={showFullNameError}
                      aria-describedby={showFullNameError ? "fullName-error" : undefined}
                      className={`h-[44px] w-full rounded-xl bg-[#020b06]/85 pl-10 pr-3.5 text-[13px] text-white placeholder:text-[#64748b] transition-all focus:outline-none ${
                        showFullNameError
                          ? "border border-red-500/80 focus:border-red-400 focus:ring-1 focus:ring-red-500/50 shadow-[0_0_12px_rgba(239,68,68,0.25)]"
                          : "border border-[#00ff87]/25 focus:border-[#00ff87] focus:ring-1 focus:ring-[#00ff87]/50"
                      }`}
                    />
                  </div>
                  {showFullNameError && (
                    <p id="fullName-error" className="mt-1.5 font-sans text-[11.5px] text-red-400">
                      Please enter your full name.
                    </p>
                  )}
                </div>

                {/* Email Address */}
                <div>
                  <label htmlFor="email" className="block font-sans text-[12.5px] font-semibold text-[#e2e8f0] mb-1.5">
                    Email Address <span className="text-[#00ff87]">*</span>
                  </label>
                  <div className="relative flex items-center">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-[#00ff87]/70 pointer-events-none" />
                    <input
                      ref={emailRef}
                      id="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onBlur={() => setTouched((prev) => ({ ...prev, email: true }))}
                      placeholder="name@company.com"
                      aria-invalid={showEmailError}
                      aria-describedby={showEmailError ? "email-error" : undefined}
                      className={`h-[44px] w-full rounded-xl bg-[#020b06]/85 pl-10 pr-3.5 text-[13px] text-white placeholder:text-[#64748b] transition-all focus:outline-none ${
                        showEmailError
                          ? "border border-red-500/80 focus:border-red-400 focus:ring-1 focus:ring-red-500/50 shadow-[0_0_12px_rgba(239,68,68,0.25)]"
                          : "border border-[#00ff87]/25 focus:border-[#00ff87] focus:ring-1 focus:ring-[#00ff87]/50"
                      }`}
                    />
                  </div>
                  {showEmailError && (
                    <p id="email-error" className="mt-1.5 font-sans text-[11.5px] text-red-400">
                      Please enter a valid email address.
                    </p>
                  )}
                </div>
              </div>

              {/* Row 2: Subject */}
              <div>
                <label htmlFor="subject" className="block font-sans text-[12.5px] font-semibold text-[#e2e8f0] mb-1.5">
                  Subject <span className="text-[#00ff87]">*</span>
                </label>
                <div className="relative flex items-center">
                  <Tag className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-[#00ff87]/70 pointer-events-none" />
                  <select
                    ref={subjectRef}
                    id="subject"
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    onBlur={() => setTouched((prev) => ({ ...prev, subject: true }))}
                    aria-invalid={showSubjectError}
                    aria-describedby={showSubjectError ? "subject-error" : undefined}
                    className={`h-[44px] w-full appearance-none rounded-xl bg-[#020b06]/85 pl-10 pr-10 text-[13px] text-white transition-all cursor-pointer focus:outline-none ${
                      showSubjectError
                        ? "border border-red-500/80 focus:border-red-400 focus:ring-1 focus:ring-red-500/50 shadow-[0_0_12px_rgba(239,68,68,0.25)]"
                        : "border border-[#00ff87]/25 focus:border-[#00ff87] focus:ring-1 focus:ring-[#00ff87]/50"
                    }`}
                  >
                    <option value="" disabled className="bg-[#040e08] text-[#64748b]">
                      Select a subject
                    </option>
                    {formSettings.subjectOptions.map((opt) => (
                      <option key={opt} value={opt} className="bg-[#040e08] text-white">
                        {opt}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 size-4 text-[#64748b] pointer-events-none" />
                </div>
                {showSubjectError && (
                  <p id="subject-error" className="mt-1.5 font-sans text-[11.5px] text-red-400">
                    Please select a subject.
                  </p>
                )}
              </div>

              {/* Row 3: Message Textarea */}
              <div>
                <label htmlFor="message" className="block font-sans text-[12.5px] font-semibold text-[#e2e8f0] mb-1.5">
                  Message <span className="text-[#00ff87]">*</span>
                </label>
                <div className="relative">
                  <MessageSquare className="absolute left-3.5 top-3.5 size-4 text-[#00ff87]/70 pointer-events-none" />
                  <textarea
                    ref={messageRef}
                    id="message"
                    required
                    rows={4}
                    maxLength={1000}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onBlur={() => setTouched((prev) => ({ ...prev, message: true }))}
                    placeholder="Tell us about your project, idea or query..."
                    aria-invalid={showMessageError}
                    aria-describedby={showMessageError ? "message-error message-helper" : "message-helper"}
                    className={`w-full rounded-xl bg-[#020b06]/85 pl-10 pr-3.5 pt-3 pb-3 text-[13px] text-white placeholder:text-[#64748b] transition-all resize-none focus:outline-none ${
                      showMessageError
                        ? "border border-red-500/80 focus:border-red-400 focus:ring-1 focus:ring-red-500/50 shadow-[0_0_12px_rgba(239,68,68,0.25)]"
                        : "border border-[#00ff87]/25 focus:border-[#00ff87] focus:ring-1 focus:ring-[#00ff87]/50"
                    }`}
                  />
                </div>
                {/* Character Counter & Minimum 10 characters hint */}
                <div id="message-helper" className="flex items-center justify-between mt-1">
                  <span className="font-sans text-[11px] text-[#64748b]">
                    Minimum 10 characters
                  </span>
                  <span className="font-mono text-[11px] text-[#64748b]">
                    {message.length}/1000
                  </span>
                </div>
                {showMessageError && (
                  <p id="message-error" className="mt-1.5 font-sans text-[11.5px] text-red-400">
                    Please enter a message of at least 10 characters.
                  </p>
                )}
              </div>

              {/* Row 4: Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex h-[46px] items-center justify-between gap-3 px-6 rounded-xl bg-gradient-to-r from-[#f59e0b] via-[#38ef7d] to-[#00ff87] text-[#02180c] font-display text-[13.5px] font-bold shadow-[0_0_25px_rgba(0,255,135,0.45)] hover:shadow-[0_0_35px_rgba(0,255,135,0.7)] hover:brightness-105 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  <span className="flex items-center gap-2">
                    <Send className="size-4" />
                    <span>{isSubmitting ? "Sending..." : formSettings.submitButtonText || "Send Message"}</span>
                  </span>
                  <ArrowRight className="size-4 stroke-[2.5]" />
                </button>
              </div>
            </form>
          </div>

          {/* Right Column: Get In Touch Card */}
          <div className="relative rounded-[22px] border border-[#00ff87]/35 bg-[#040e08]/90 p-6 sm:p-8 backdrop-blur-xl shadow-[0_0_35px_rgba(0,255,135,0.12),0_20px_60px_rgba(0,0,0,0.85)]">
            {/* Top-left Corner Chamfer Accent */}
            <div className="absolute top-0 left-0 size-8 border-t-2 border-l-2 border-[#00ff87] rounded-tl-[22px] pointer-events-none" />

            {/* Header */}
            <div className="mb-6">
              <h2 className="font-display text-[22px] sm:text-[25px] font-bold text-white tracking-wide uppercase">
                GET IN TOUCH
              </h2>
              <div className="mt-1 h-[2px] w-12 bg-gradient-to-r from-[#00ff87] to-transparent rounded-full" />
              <p className="mt-2 font-sans text-[13px] text-[#94a3b8]">
                Here are the best ways to reach us.
              </p>
            </div>

            {/* Contact Items List */}
            <div className="space-y-4">
              {/* Email */}
              {Boolean(contactInfo.email && contactInfo.email.trim()) && (
                <div className="flex items-start gap-3.5 p-3 rounded-xl border border-[#00ff87]/15 bg-[#021008]/60 hover:border-[#00ff87]/35 transition-colors">
                  <div className="size-10 rounded-xl border border-[#00ff87]/40 bg-[#022010] flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(0,255,135,0.25)]">
                    <Mail className="size-5 text-[#00ff87]" />
                  </div>
                  <div>
                    <p className="font-sans text-[11px] font-semibold uppercase tracking-wider text-[#64748b]">
                      Email
                    </p>
                    <a
                      href={`mailto:${contactInfo.email.trim()}`}
                      className="font-sans text-[13.5px] font-semibold text-[#00ff87] hover:underline"
                    >
                      {contactInfo.email.trim()}
                    </a>
                    {contactInfo.emailDescription && (
                      <p className="font-sans text-[11px] text-[#94a3b8] mt-0.5">
                        {contactInfo.emailDescription}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Phone */}
              {Boolean(contactInfo.phone && contactInfo.phone.trim()) && (
                <div className="flex items-start gap-3.5 p-3 rounded-xl border border-[#00ff87]/15 bg-[#021008]/60 hover:border-[#00ff87]/35 transition-colors">
                  <div className="size-10 rounded-xl border border-[#00ff87]/40 bg-[#022010] flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(0,255,135,0.25)]">
                    <Phone className="size-5 text-[#00ff87]" />
                  </div>
                  <div>
                    <p className="font-sans text-[11px] font-semibold uppercase tracking-wider text-[#64748b]">
                      Phone
                    </p>
                    <a
                      href={`tel:${contactInfo.phone.replace(/\s+/g, "")}`}
                      className="font-sans text-[13.5px] font-semibold text-white hover:text-[#00ff87] transition-colors"
                    >
                      {contactInfo.phone.trim()}
                    </a>
                    {contactInfo.businessHours && (
                      <p className="font-sans text-[11px] text-[#94a3b8] mt-0.5">
                        {contactInfo.businessHours}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Location */}
              {Boolean(contactInfo.location && contactInfo.location.trim()) && (
                <div className="flex items-start gap-3.5 p-3 rounded-xl border border-[#00ff87]/15 bg-[#021008]/60 hover:border-[#00ff87]/35 transition-colors">
                  <div className="size-10 rounded-xl border border-[#00ff87]/40 bg-[#022010] flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(0,255,135,0.25)]">
                    <MapPin className="size-5 text-[#00ff87]" />
                  </div>
                  <div>
                    <p className="font-sans text-[11px] font-semibold uppercase tracking-wider text-[#64748b]">
                      Location
                    </p>
                    <p className="font-sans text-[13.5px] font-semibold text-[#00ff87]">
                      {contactInfo.location.trim()}
                    </p>
                    {contactInfo.locationDescription && (
                      <p className="font-sans text-[11px] text-[#94a3b8] mt-0.5">
                        {contactInfo.locationDescription}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Section: Follow Our Journey */}
            {socialLinks.length > 0 && (
              <div className="mt-6 pt-5 border-t border-[#00ff87]/20">
                <p className="font-display text-[12.5px] font-bold text-white tracking-wide">
                  Follow Our Journey
                </p>
                <p className="font-sans text-[11.5px] text-[#94a3b8] mt-0.5 mb-3.5">
                  Stay connected for our latest updates and work.
                </p>

                {/* Social Buttons */}
                <div className="flex flex-wrap items-center gap-2.5">
                  {socialLinks
                    .filter((link) => isSafeUrl(link.url))
                    .map((link) => (
                      <a
                        key={link.id}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={link.label || link.platform}
                        className="size-10 rounded-xl border border-[#00ff87]/25 bg-[#02140a] flex items-center justify-center text-[#94a3b8] hover:text-[#00ff87] hover:border-[#00ff87] hover:shadow-[0_0_15px_rgba(0,255,135,0.35)] transition-all"
                      >
                        {renderSocialIcon(link.icon || link.platform)}
                      </a>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      {faqs.length > 0 && (
        <section className="relative z-10 max-w-[1380px] mx-auto px-4 sm:px-6 lg:px-8 pb-20">
          <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6 lg:gap-8 items-start">
            {/* FAQ Left Header */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="font-display text-[13px] font-bold text-[#f59e0b] tracking-wider">
                  02
                </span>
                <span className="h-[1px] w-4 bg-[#f59e0b]/60" />
              </div>
              <h2 className="font-display text-[22px] sm:text-[26px] font-bold leading-tight uppercase">
                <span className="text-white">FREQUENTLY ASKED</span>
                <br />
                <span className="text-[#f59e0b] drop-shadow-[0_0_15px_rgba(245,158,11,0.5)]">
                  QUESTIONS
                </span>
              </h2>
              <p className="mt-2 font-sans text-[12.5px] text-[#94a3b8]">
                Quick answers to common queries.
              </p>
            </div>

            {/* FAQ Right Accordion Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {faqs.map((faq) => {
                const isOpen = openFaq === faq.id;

                return (
                  <div
                    key={faq.id}
                    className={`rounded-2xl border transition-all duration-300 ${
                      isOpen
                        ? "border-[#f59e0b]/60 bg-[#08120a] shadow-[0_0_20px_rgba(245,158,11,0.2)]"
                        : "border-[#00ff87]/20 bg-[#040e08]/80 hover:border-[#00ff87]/40"
                    } p-4 backdrop-blur-md flex flex-col justify-between`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleFaq(faq.id)}
                      className="w-full flex items-start gap-3 text-left cursor-pointer"
                    >
                      <div className="size-9 rounded-xl border border-[#f59e0b]/40 bg-[#201502] flex items-center justify-center shrink-0 shadow-[0_0_10px_rgba(245,158,11,0.2)] mt-0.5">
                        {renderFaqIcon(faq.icon)}
                      </div>
                      <div className="flex-1 min-w-0 pr-1">
                        <p className="font-display text-[13px] font-bold text-white leading-snug">
                          {faq.question}
                        </p>
                      </div>
                      <ChevronDown
                        className={`size-4 text-[#94a3b8] transition-transform duration-200 shrink-0 mt-1 ${
                          isOpen ? "rotate-180 text-[#f59e0b]" : ""
                        }`}
                      />
                    </button>

                    {isOpen && (
                      <div className="mt-3 pt-3 border-t border-[#f59e0b]/20 animate-in fade-in slide-in-from-top-1 duration-200">
                        <p className="font-sans text-[12px] leading-relaxed text-[#cbd5e1]">
                          {faq.answer}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <Footer
        sections={publicNavData?.footerSections}
        socialLinks={publicNavData?.socialLinks}
      />
      <Toaster />
    </main>
  );
}

export default ContactPage;

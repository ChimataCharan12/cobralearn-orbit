export interface HomepageSection {
  id: string;
  order: number;
  name: string;
  iconName: string;
  enabled: boolean;
  title: string;
  subtitle: string;
  primaryButtonLabel?: string;
  primaryButtonLink?: string;
  secondaryButtonLabel?: string;
  secondaryButtonLink?: string;
  badge?: string;
}

export const INITIAL_HOMEPAGE_SECTIONS: HomepageSection[] = [
  {
    id: "sec-hero",
    order: 1,
    name: "Hero Section",
    iconName: "Home",
    enabled: true,
    badge: "LEARN • BUILD • GROW",
    title: "CobraLearn Innotechcore",
    subtitle: "A cinematic showcase of digital innovation, web experiences, real-time projects and achievements.",
    primaryButtonLabel: "Explore Projects",
    primaryButtonLink: "#projects",
    secondaryButtonLabel: "View Websites",
    secondaryButtonLink: "#websites",
  },
  {
    id: "sec-featured",
    order: 2,
    name: "Featured Showcase",
    iconName: "Star",
    enabled: true,
    title: "Featured Innovations & Experiences",
    subtitle: "Highlighting flagship projects, digital web experiences, and key achievements.",
    primaryButtonLabel: "View Showcase",
    primaryButtonLink: "#projects",
  },
  {
    id: "sec-projects",
    order: 3,
    name: "Recent Projects",
    iconName: "Box",
    enabled: true,
    title: "Curated Showcase Portfolio",
    subtitle: "Explore production web apps, modern software systems, and innovative campaigns.",
    primaryButtonLabel: "View All Projects",
    primaryButtonLink: "/admin/projects",
  },
  {
    id: "sec-cta",
    order: 4,
    name: "Call to Action",
    iconName: "Megaphone",
    enabled: true,
    title: "Innovate, Learn & Achieve",
    subtitle: "Empowering creators and engineering teams to build next-generation digital reality.",
    primaryButtonLabel: "Get In Touch",
    primaryButtonLink: "#contact",
  },
];

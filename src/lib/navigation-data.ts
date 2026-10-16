export type NavItemType = "Internal" | "External" | "Button";
export type NavItemStatus = "Active" | "Inactive";

export interface NavigationMenuItem {
  id: string;
  order: number;
  label: string;
  link: string;
  type: NavItemType;
  status: NavItemStatus;
  iconName?: string;
  openInNewTab?: boolean;
  buttonStyle?: "Primary (Filled)" | "Outline" | "Ghost";
}

export interface FooterSectionItem {
  id: string;
  title: string;
  iconName: string;
  linksCount: number;
  links: Array<{ label: string; url: string }>;
}

export const INITIAL_NAV_ITEMS: NavigationMenuItem[] = [
  { id: "nav-1", order: 1, label: "Home", link: "/", type: "Internal", status: "Active", iconName: "Home" },
  { id: "nav-2", order: 2, label: "Projects", link: "#projects", type: "Internal", status: "Active", iconName: "Box" },
  { id: "nav-3", order: 3, label: "Websites", link: "#websites", type: "Internal", status: "Active", iconName: "LayoutGrid" },
  { id: "nav-4", order: 4, label: "Advertisements", link: "#advertisements", type: "Internal", status: "Active", iconName: "Megaphone" },
  { id: "nav-5", order: 5, label: "Awards", link: "#awards", type: "Internal", status: "Active", iconName: "Award" },
  { id: "nav-6", order: 6, label: "Contact", link: "#contact", type: "Internal", status: "Active", iconName: "Mail" },
  { id: "nav-7", order: 7, label: "Explore Showcase", link: "#projects", type: "Button", status: "Active", iconName: "Zap", buttonStyle: "Primary (Filled)" },
];

export const INITIAL_FOOTER_SECTIONS: FooterSectionItem[] = [
  {
    id: "footer-showcase",
    title: "Showcase",
    iconName: "Box",
    linksCount: 4,
    links: [
      { label: "Projects", url: "#projects" },
      { label: "Websites", url: "#websites" },
      { label: "Advertisements", url: "#advertisements" },
      { label: "Awards & Achievements", url: "#awards" },
    ],
  },
  {
    id: "footer-company",
    title: "Company",
    iconName: "Info",
    linksCount: 3,
    links: [
      { label: "About Innotechcore", url: "#home" },
      { label: "Milestones", url: "#awards" },
      { label: "Contact", url: "#contact" },
    ],
  },
  {
    id: "footer-legal",
    title: "Legal",
    iconName: "BookOpen",
    linksCount: 2,
    links: [
      { label: "Privacy Policy", url: "#privacy" },
      { label: "Terms of Service", url: "#terms" },
    ],
  },
  {
    id: "footer-contact",
    title: "Contact",
    iconName: "Mail",
    linksCount: 3,
    links: [
      { label: "support@cobralearn.in", url: "mailto:support@cobralearn.in" },
      { label: "+91 98765 43210", url: "tel:+919876543210" },
      { label: "Hyderabad, India", url: "#location" },
    ],
  },
  {
    id: "footer-social",
    title: "Social Media",
    iconName: "Share2",
    linksCount: 4,
    links: [
      { label: "LinkedIn", url: "https://linkedin.com" },
      { label: "GitHub", url: "https://github.com" },
      { label: "YouTube", url: "https://youtube.com" },
      { label: "X (Twitter)", url: "https://x.com" },
    ],
  },
];

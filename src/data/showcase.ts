import projectImage from "@/assets/project-smart-home.jpg";
import websiteImage from "@/assets/website-learning.jpg";
import advertisementImage from "@/assets/advertising-campaign.jpg";
import awardImage from "@/assets/awards-trophies.jpg";

export type Accent = "orange" | "green" | "red" | "gold";
export type ShowcaseType = "projects" | "websites" | "advertisements" | "awards";

export interface ShowcaseItem {
  id: string;
  title: string;
  slug: string;
  description: string;
  image: string;
  accent: Accent;
  published: boolean;
  order: number;
}

export interface ShowcaseSectionData {
  index: string;
  type: ShowcaseType;
  label: string;
  title: string;
  description: string;
  action: string;
  accent: Accent;
  items: ShowcaseItem[];
}

export const projects: ShowcaseItem[] = [];

export const websites: ShowcaseItem[] = [];

export const advertisements: ShowcaseItem[] = [];

export const awards: ShowcaseItem[] = [];

export const sections: ShowcaseSectionData[] = [
  { index: "01", type: "projects", label: "OUR", title: "PROJECTS", description: "Explore our innovative projects built with creativity, technology and real-world problem solving.", action: "View Projects", accent: "orange", items: projects },
  { index: "02", type: "websites", label: "OUR", title: "WEBSITES", description: "Modern, responsive and user-friendly websites designed for a better digital experience.", action: "View Websites", accent: "green", items: websites },
  { index: "03", type: "advertisements", label: "OUR", title: "ADVERTISEMENTS", description: "Creative campaigns that inform, inspire and make an impact.", action: "View Advertisements", accent: "red", items: advertisements },
  { index: "04", type: "awards", label: "OUR", title: "AWARDS &\nACHIEVEMENTS", description: "Recognizing our milestones, hard work and the trust of our learners.", action: "View All Awards", accent: "gold", items: awards },
];

export const collectionByType: Record<ShowcaseType, ShowcaseItem[]> = {
  projects,
  websites,
  advertisements,
  awards,
};

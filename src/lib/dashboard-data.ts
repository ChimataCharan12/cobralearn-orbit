// Mock dashboard data — swap these exports for real queries later.
import project from "@/assets/thumb-project.jpg";
import website from "@/assets/thumb-website.jpg";
import ad from "@/assets/thumb-ad.jpg";
import award from "@/assets/thumb-award.jpg";
import env from "@/assets/cobralearn-admin-environment.jpg";

export type Accent = "gold" | "green" | "red" | "amber";
export type Status = "Published" | "Draft";

export const images = { project, website, ad, award, env };

export const stats = [
  { key: "projects", title: "Projects", value: 0, delta: 0, published: 0, draft: 0, accent: "amber" as Accent },
  { key: "websites", title: "Websites", value: 0, delta: 0, published: 0, draft: 0, accent: "green" as Accent },
  { key: "ads", title: "Advertisements", value: 0, delta: 0, published: 0, draft: 0, accent: "red" as Accent },
  { key: "awards", title: "Awards", value: 0, delta: 0, published: 0, draft: 0, accent: "gold" as Accent },
];

export interface ActivityItem {
  title: string;
  item: string;
  time: string;
  img: string | null;
  dot: "green" | "red" | "muted";
}

export interface RecentProjectItem {
  name: string;
  tags: string[];
  status: Status;
  img: string;
}

export interface RecentCardItem {
  name: string;
  status: Status;
  img: string;
}

export const activity: ActivityItem[] = [];

export const recentProjects: RecentProjectItem[] = [];

export const recentAds: RecentCardItem[] = [];

export const recentAwards: RecentCardItem[] = [];

import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Header } from "@/components/public/Header";
import { Hero } from "@/components/public/Hero";
import { ShowcaseSection } from "@/components/public/ShowcaseSection";
import { PublicCmsSection } from "@/components/public/PublicCmsSection";
import { Footer } from "@/components/public/Footer";
import { sections } from "@/data/showcase";
import { adminClient } from "@/lib/api/admin-client";
import { getPublicMetaTags } from "@/lib/public-metadata";
import { projectToShowcaseItem } from "@/lib/projects-data";
import { websiteToShowcaseItem } from "@/lib/websites-data";
import { advertisementToShowcaseItem } from "@/lib/advertisements-data";
import { awardToShowcaseItem } from "@/lib/awards-data";

export const Route = createFileRoute("/")({
  staleTime: 0,
  shouldReload: true,
  loader: async () => {
    const [projRes, webRes, adRes, awardRes, homepageRes, navRes, settingsRes] = await Promise.all([
      adminClient.getPublicProjects(),
      adminClient.getPublicWebsites(),
      adminClient.getPublicAdvertisements(),
      adminClient.getPublicAwards(),
      adminClient.getPublicHomepageSections(),
      adminClient.getPublicNavigationAndFooter(),
      adminClient.getPublicSiteSettings(),
    ]);
    const publicProjects = projRes.success && projRes.data ? projRes.data.map(projectToShowcaseItem) : [];
    const publicWebsites = webRes.success && webRes.data ? webRes.data.map(websiteToShowcaseItem) : [];
    const publicAdvertisements = adRes.success && adRes.data ? adRes.data.map(advertisementToShowcaseItem) : [];
    const publicAwards = awardRes.success && awardRes.data ? awardRes.data.map(awardToShowcaseItem) : [];
    const publicHomepageSections = homepageRes.success && homepageRes.data ? homepageRes.data : [];
    const publicNavData = navRes.success && navRes.data ? navRes.data : { navItems: [], footerSections: [], socialLinks: [] };
    const publicSettings = settingsRes?.success && settingsRes?.data ? settingsRes.data : null;

    return {
      publicProjects,
      publicWebsites,
      publicAdvertisements,
      publicAwards,
      publicHomepageSections,
      publicNavData,
      publicSettings,
    };
  },
  head: ({ loaderData }: any) => getPublicMetaTags(loaderData?.publicSettings),
  component: Index,
});

function Index() {
  const {
    publicProjects,
    publicWebsites,
    publicAdvertisements,
    publicAwards,
    publicHomepageSections,
    publicNavData,
  } = Route.useLoaderData();

  const projectsConfig = publicHomepageSections.find((s) => s.id === "sec-projects");

  // Sorted list of enabled CMS sections respecting persisted displayOrder
  const orderedEnabledSections = useMemo(() => {
    return [...publicHomepageSections]
      .filter((s) => s.enabled !== false)
      .sort((a, b) => a.displayOrder - b.displayOrder);
  }, [publicHomepageSections]);

  const dynamicSections = useMemo(() => {
    // If projects showcase is explicitly disabled in CMS, filter it out
    const activeShowcaseSections = sections.filter((section) => {
      if (section.type === "projects" && projectsConfig?.enabled === false) {
        return false;
      }
      return true;
    });

    return activeShowcaseSections.map((section) => {
      if (section.type === "projects") {
        return {
          ...section,
          // Preserve category heading "PROJECTS" distinct from CMS section title
          title: section.title,
          description: projectsConfig?.subtitle || section.description,
          items: publicProjects,
        };
      }
      if (section.type === "websites") {
        return {
          ...section,
          title: section.title,
          items: publicWebsites,
        };
      }
      if (section.type === "advertisements") {
        return {
          ...section,
          title: section.title,
          items: publicAdvertisements,
        };
      }
      if (section.type === "awards") {
        return {
          ...section,
          title: section.title,
          items: publicAwards,
        };
      }
      return section;
    });
  }, [publicProjects, publicWebsites, publicAdvertisements, publicAwards, projectsConfig]);

  // Lookup map of showcase section configurations by type
  const showcaseMap = useMemo(() => {
    const map = new Map<string, (typeof dynamicSections)[number]>();
    for (const sec of dynamicSections) {
      map.set(sec.type, sec);
    }
    return map;
  }, [dynamicSections]);

  // Build top-level elements respecting CMS order without nesting all showcases inside sec-projects
  const renderedSections = useMemo(() => {
    const elements: React.ReactNode[] = [];
    const unrenderedShowcases = new Set<string>(["projects", "websites", "advertisements", "awards"]);

    for (const section of orderedEnabledSections) {
      if (section.id === "sec-hero") {
        elements.push(<Hero key={section.id} section={section} />);
        continue;
      }

      if (section.id === "sec-featured") {
        elements.push(<PublicCmsSection key={section.id} section={section} variant="featured" />);
        continue;
      }

      if (section.id === "sec-projects") {
        const proj = showcaseMap.get("projects");
        if (proj) {
          elements.push(<ShowcaseSection key="projects" section={proj} />);
        }
        unrenderedShowcases.delete("projects");

        // Render remaining showcase categories as top-level sections if not mapped to a dedicated CMS section
        const remainingTypes = ["websites", "advertisements", "awards"];
        for (const type of remainingTypes) {
          const hasDedicatedCmsSection = orderedEnabledSections.some((s) => s.id === `sec-${type}`);
          if (!hasDedicatedCmsSection) {
            const showcaseSec = showcaseMap.get(type);
            if (showcaseSec) {
              elements.push(<ShowcaseSection key={type} section={showcaseSec} />);
              unrenderedShowcases.delete(type);
            }
          }
        }
        continue;
      }

      if (section.id === "sec-websites") {
        const s = showcaseMap.get("websites");
        if (s) elements.push(<ShowcaseSection key="websites" section={s} />);
        unrenderedShowcases.delete("websites");
        continue;
      }

      if (section.id === "sec-advertisements") {
        const s = showcaseMap.get("advertisements");
        if (s) elements.push(<ShowcaseSection key="advertisements" section={s} />);
        unrenderedShowcases.delete("advertisements");
        continue;
      }

      if (section.id === "sec-awards") {
        const s = showcaseMap.get("awards");
        if (s) elements.push(<ShowcaseSection key="awards" section={s} />);
        unrenderedShowcases.delete("awards");
        continue;
      }

      if (section.id === "sec-cta") {
        // If sec-projects was disabled in CMS, ensure remaining non-project showcases render before CTA
        for (const type of unrenderedShowcases) {
          if (type !== "projects") {
            const s = showcaseMap.get(type);
            if (s) elements.push(<ShowcaseSection key={type} section={s} />);
          }
        }
        unrenderedShowcases.clear();
        elements.push(<PublicCmsSection key={section.id} section={section} variant="cta" />);
        continue;
      }

      // Custom CMS sections created by administrator
      elements.push(<PublicCmsSection key={section.id} section={section} variant="custom" />);
    }

    // Fallback: if sec-cta was not present, flush any remaining showcases
    for (const type of unrenderedShowcases) {
      if (type !== "projects" || projectsConfig?.enabled !== false) {
        const s = showcaseMap.get(type);
        if (s) elements.push(<ShowcaseSection key={type} section={s} />);
      }
    }

    return elements;
  }, [orderedEnabledSections, showcaseMap, projectsConfig]);

  return (
    <main className="site-shell">
      <Header navItems={publicNavData?.navItems} />

      {/* Render top-level sections */}
      {renderedSections}

      {/* Footer */}
      <Footer
        sections={publicNavData?.footerSections}
        socialLinks={publicNavData?.socialLinks}
      />
    </main>
  );
}

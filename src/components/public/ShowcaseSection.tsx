import { ArrowRight } from "lucide-react";
import { motion } from "motion/react";
import type { ShowcaseSectionData } from "@/data/showcase";
import { ShowcaseCarousel } from "./ShowcaseCarousel";
import { PublicEmptyState } from "./PublicEmptyState";
import { Button } from "@/components/ui/button";

export function ShowcaseSection({ section }: { section: ShowcaseSectionData }) {
  const hasItems = section.items && section.items.length > 0;

  return (
    <section id={section.type} className={`showcase-section accent-${section.accent}`} data-showcase-section={section.index}>
      <div className="section-atmosphere" />
      <motion.div className="section-copy" initial={{ opacity: 0, x: -24 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, amount: 0.35 }} transition={{ duration: 0.55 }}>
        <div className="section-number"><span>{section.index}</span><i /></div>
        <p>{section.label}</p>
        <h2>{section.title.split("\n").map((line) => <span key={line}>{line}</span>)}</h2>
        <small>{section.description}</small>
        <Button variant="outline" asChild className="section-button"><a href={`#${section.type}`}><span>{section.action}</span><ArrowRight /></a></Button>
      </motion.div>
      {hasItems ? (
        <ShowcaseCarousel items={section.items} accent={section.accent} sectionType={section.type} />
      ) : (
        <div className="w-full max-w-xl my-auto">
          <PublicEmptyState
            title="Nothing Here Yet"
            description="This section is currently empty.&#10;Check back later for exciting updates!"
            ctaText="Explore CobraLearn"
            ctaLink="/"
          />
        </div>
      )}
      <div className="section-indicator" aria-hidden="true">
        {["01", "02", "03", "04"].map((number) => <span className={number === section.index ? "active" : ""} key={number}><i />{number}</span>)}
      </div>
    </section>
  );
}

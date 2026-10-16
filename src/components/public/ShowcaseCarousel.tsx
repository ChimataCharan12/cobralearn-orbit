import { useEffect, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { motion, useReducedMotion } from "motion/react";
import type { Accent, ShowcaseItem, ShowcaseType } from "@/data/showcase";

interface ShowcaseCarouselProps {
  items: ShowcaseItem[];
  accent: Accent;
  sectionType: ShowcaseType;
  autoPlay?: boolean;
  autoPlaySpeed?: number;
}

export function ShowcaseCarousel({ items, accent, sectionType, autoPlay = true, autoPlaySpeed = 3800 }: ShowcaseCarouselProps) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!autoPlay || paused || reduceMotion) return;
    const timer = window.setTimeout(() => setActive((value) => (value + 1) % items.length), autoPlaySpeed);
    return () => window.clearTimeout(timer);
  }, [active, autoPlay, autoPlaySpeed, items.length, paused, reduceMotion]);

  return (
    <div className={`showcase-carousel accent-${accent}`} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)} aria-label={`${sectionType} carousel`}>
      <div className="carousel-stage">
        {items.map((item, index) => {
          let offset = index - active;
          if (offset > items.length / 2) offset -= items.length;
          if (offset < -items.length / 2) offset += items.length;
          const isActive = offset === 0;
          return (
            <motion.div
              className="carousel-slot"
              key={item.id}
              animate={{ x: `${offset * 54}%`, scale: isActive ? 1 : 0.78, rotateY: offset * -13, opacity: Math.abs(offset) > 2 ? 0 : isActive ? 1 : 0.58, zIndex: 10 - Math.abs(offset) }}
              transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
            >
              <Link to={`/${sectionType}/$slug`} params={{ slug: item.slug }} className={isActive ? "showcase-card active" : "showcase-card"} onClick={() => setActive(index)}>
                {item.image ? (
                  <img src={item.image} alt="" loading="lazy" width={1280} height={720} />
                ) : (
                  <div className="showcase-card-placeholder flex h-full w-full items-center justify-center bg-panel/80">
                    <span className="text-xs font-semibold uppercase text-muted-foreground">{item.title}</span>
                  </div>
                )}
                <span className="card-scrim" />
                <span className="card-copy"><strong>{item.title}</strong><small>{item.description}</small></span>
                <span className="card-arrow"><ArrowUpRight /></span>
              </Link>
            </motion.div>
          );
        })}
      </div>
      <div className="carousel-dots" aria-label="Choose slide">
        {items.map((item, index) => <button key={item.id} onClick={() => setActive(index)} className={index === active ? "active" : ""} aria-label={`Show ${item.title}`} />)}
      </div>
    </div>
  );
}

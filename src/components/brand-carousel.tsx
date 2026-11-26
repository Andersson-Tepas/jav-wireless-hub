import { useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";

// Illustrative, editable display list only; not connected to stock or partnerships.
// Plain brand-name wordmarks intentionally avoid unofficial or fabricated logos.
export const homeBrands = [
  "Apple", "Samsung", "Motorola", "Google", "Xiaomi", "JBL", "Sony", "LG",
];

export function BrandCarousel() {
  const [viewportRef, carousel] = useEmblaCarousel({ loop: true, align: "start" });
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(preference.matches);
    update();
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!carousel || hovered || focused || paused || reducedMotion) return;
    const timer = window.setInterval(() => carousel.scrollNext(), 4000);
    return () => window.clearInterval(timer);
  }, [carousel, hovered, focused, paused, reducedMotion]);

  return (
    <section
      className="bg-primary py-10 text-primary-foreground lg:py-12"
      aria-labelledby="brand-carousel-heading"
      aria-roledescription="carousel"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
    >
      <div className="container-page">
        <h2 id="brand-carousel-heading" className="text-center font-display text-2xl font-bold sm:text-3xl">
          Top Brands at JAV Wireless
        </h2>
        <div className="relative mt-7 px-12 sm:px-14">
          <Button
            size="icon"
            className="absolute left-0 top-1/2 z-10 -translate-y-1/2 rounded-full border border-primary-foreground/40 focus-visible:ring-primary-foreground"
            aria-label="Previous brands"
            aria-controls="brand-carousel-track"
            title="Previous brands"
            onClick={() => carousel?.scrollPrev(reducedMotion)}
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          <div
            ref={viewportRef}
            id="brand-carousel-track"
            className="overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground"
            tabIndex={0}
            aria-label="Brand names"
            onKeyDown={(event) => {
              if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                event.preventDefault();
                if (event.key === "ArrowLeft") carousel?.scrollPrev(reducedMotion);
                else carousel?.scrollNext(reducedMotion);
              }
            }}
          >
            <div className="flex touch-pan-y gap-4">
              {homeBrands.map((brand, index) => (
                <div
                  key={brand}
                  className="flex h-28 min-w-0 shrink-0 grow-0 basis-[78%] items-center justify-center rounded-lg bg-surface px-4 text-foreground sm:basis-[38%] lg:basis-[21%]"
                  role="group"
                  aria-roledescription="slide"
                  aria-label={`${brand}, ${index + 1} of ${homeBrands.length}`}
                >
                  <span className="text-2xl font-bold sm:text-3xl">{brand}</span>
                </div>
              ))}
            </div>
          </div>
          <Button
            size="icon"
            className="absolute right-0 top-1/2 z-10 -translate-y-1/2 rounded-full border border-primary-foreground/40 focus-visible:ring-primary-foreground"
            aria-label="Next brands"
            aria-controls="brand-carousel-track"
            title="Next brands"
            onClick={() => carousel?.scrollNext(reducedMotion)}
          >
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>
        <div className="mt-5 flex items-center justify-center gap-3">
          <p className="max-w-lg text-center text-xs leading-relaxed text-primary-foreground/75">
            Brands shown for illustration only. Availability varies; no official partnership is implied.
          </p>
          {!reducedMotion && (
            <Button
              size="icon"
              className="shrink-0 rounded-full border border-primary-foreground/40 focus-visible:ring-primary-foreground"
              aria-label={paused ? "Resume brand auto-advance" : "Pause brand auto-advance"}
              title={paused ? "Resume brand auto-advance" : "Pause brand auto-advance"}
              onClick={() => setPaused((value) => !value)}
            >
              {paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
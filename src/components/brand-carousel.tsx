import { useEffect, useRef, useState, type PointerEvent } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";

// Illustrative, editable display list only; not connected to stock or partnerships.
// Plain brand-name wordmarks intentionally avoid unofficial or fabricated logos.
export const homeBrands = [
  "Apple", "Samsung", "Motorola", "Google", "Xiaomi", "JBL", "Sony", "LG",
];

export function BrandCarousel() {
  const sectionRef = useRef<HTMLElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const offset = useRef(0);
  const loopWidth = useRef(0);
  const cardStep = useRef(0);
  const manualMove = useRef<{ start: number; distance: number; time: number | null } | null>(null);
  const drag = useRef<{ id: number; x: number; y: number; lastX: number; horizontal: boolean } | null>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [interacting, setInteracting] = useState(false);
  const [onScreen, setOnScreen] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const [motionVersion, setMotionVersion] = useState(0);

  function paint(next: number) {
    const width = loopWidth.current;
    if (!width || !trackRef.current) return;
    offset.current = ((next % width) + width) % width;
    trackRef.current.style.transform = `translate3d(${-offset.current}px, 0, 0)`;
  }

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(preference.matches);
    update();
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    const section = sectionRef.current;
    if (!viewport || !track || !section) return;

    const measure = () => {
      const first = track.children.item(0);
      const second = track.children.item(1);
      const duplicate = track.children.item(homeBrands.length);
      if (!first || !second || !duplicate) return;
      const oldWidth = loopWidth.current;
      // Measuring copy-to-copy includes every card and the final inter-card gap.
      loopWidth.current = duplicate.getBoundingClientRect().left - first.getBoundingClientRect().left;
      cardStep.current = second.getBoundingClientRect().left - first.getBoundingClientRect().left;
      manualMove.current = null;
      paint(oldWidth ? offset.current * loopWidth.current / oldWidth : 0);
    };
    measure();
    const resize = new ResizeObserver(measure);
    resize.observe(viewport);
    const intersection = new IntersectionObserver(([entry]) => {
      setOnScreen(entry?.isIntersecting ?? false);
    });
    intersection.observe(section);
    const visibility = () => setPageVisible(!document.hidden);
    visibility();
    document.addEventListener("visibilitychange", visibility);
    return () => {
      resize.disconnect();
      intersection.disconnect();
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);

  useEffect(() => {
    if (!onScreen || !pageVisible || interacting) return;
    const auto = !hovered && !focused && !paused && !reducedMotion;
    if (!auto && !manualMove.current) return;
    let frame = 0;
    let previous: number | null = null;
    const tick = (time: number) => {
      if (document.hidden) return;
      const movement = manualMove.current;
      if (movement) {
        if (movement.time === null) movement.time = time;
        const progress = Math.min((time - movement.time) / 320, 1);
        paint(movement.start + movement.distance * (1 - Math.cos(progress * Math.PI)) / 2);
        if (progress === 1) manualMove.current = null;
      } else if (auto && previous !== null) {
        // Constant CSS-pixel speed, independent of refresh rate and card size.
        paint(offset.current + 82 * (time - previous) / 1000);
      }
      previous = time;
      if (manualMove.current || auto) frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [hovered, focused, paused, reducedMotion, interacting, onScreen, pageVisible, motionVersion]);

  function move(direction: number) {
    const distance = direction * cardStep.current;
    if (reducedMotion) {
      manualMove.current = null;
      paint(offset.current + distance);
    } else {
      manualMove.current = { start: offset.current, distance, time: null };
      setMotionVersion((value) => value + 1);
    }
  }

  function finishDrag(event: PointerEvent<HTMLDivElement>) {
    if (drag.current?.id !== event.pointerId) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setInteracting(false);
  }

  return (
    <section
      ref={sectionRef}
      className="bg-primary py-10 text-primary-foreground lg:py-12"
      aria-labelledby="brand-carousel-heading"
      aria-roledescription="carousel"
      onPointerEnter={(event) => { if (event.pointerType === "mouse") setHovered(true); }}
      onPointerLeave={(event) => { if (event.pointerType === "mouse") setHovered(false); }}
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
            onClick={() => move(-1)}
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          <div
            ref={viewportRef}
            id="brand-carousel-track"
            className="touch-pan-y select-none overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground"
            tabIndex={0}
            aria-label="Brand names"
            onPointerDown={(event) => {
              if (!event.isPrimary || event.button !== 0) return;
              if (event.pointerType === "touch") event.preventDefault();
              manualMove.current = null;
              drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, lastX: event.clientX, horizontal: false };
              setInteracting(true);
            }}
            onPointerMove={(event) => {
              const gesture = drag.current;
              if (!gesture || gesture.id !== event.pointerId) return;
              if (!gesture.horizontal) {
                const dx = Math.abs(event.clientX - gesture.x);
                const dy = Math.abs(event.clientY - gesture.y);
                if (dx < 6 || dx <= dy) return;
                gesture.horizontal = true;
                event.currentTarget.setPointerCapture(event.pointerId);
              }
              paint(offset.current + gesture.lastX - event.clientX);
              gesture.lastX = event.clientX;
            }}
            onPointerUp={finishDrag}
            onPointerCancel={finishDrag}
            onLostPointerCapture={finishDrag}
            onPointerLeave={(event) => {
              if (!drag.current?.horizontal) finishDrag(event);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                event.preventDefault();
                move(event.key === "ArrowLeft" ? -1 : 1);
              }
            }}
          >
            <div ref={trackRef} className="relative flex gap-4 will-change-transform">
              {[...homeBrands, ...homeBrands].map((brand, index) => (
                <div
                  key={`${brand}-${index}`}
                  className="flex h-28 min-w-0 shrink-0 grow-0 basis-[78%] items-center justify-center rounded-lg bg-surface px-4 text-foreground sm:basis-[38%] lg:basis-[21%]"
                  role="group"
                  aria-roledescription="slide"
                  aria-hidden={index >= homeBrands.length ? true : undefined}
                  aria-label={index < homeBrands.length ? `${brand}, ${index + 1} of ${homeBrands.length}` : undefined}
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
            onClick={() => move(1)}
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
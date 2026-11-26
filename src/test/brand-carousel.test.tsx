import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BrandCarousel } from "@/components/brand-carousel";

let time = 0;
let frameId = 0;
const frames = new Map<number, FrameRequestCallback>();

beforeEach(() => {
  time = 0;
  frames.clear();
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.set(++frameId, callback);
    return frameId;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  vi.stubGlobal("ResizeObserver", class {
    observe() {}
    disconnect() {}
  });
  vi.stubGlobal("IntersectionObserver", class {
    constructor(private callback: (entries: { isIntersecting: boolean }[]) => void) {}
    observe() { this.callback([{ isIntersecting: true }]); }
    disconnect() {}
  });
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    const parent = this.parentElement;
    const index = parent?.parentElement?.id === "brand-carousel-track"
      ? Array.from(parent.children).indexOf(this) : 0;
    const x = index * 100;
    return { x, y: 0, left: x, right: x + 80, top: 0, bottom: 112, width: 80, height: 112, toJSON: () => ({}) };
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function advance(duration: number) {
  const end = time + duration;
  while (time < end) {
    time = Math.min(time + 16, end);
    const callbacks = [...frames.values()];
    frames.clear();
    act(() => { callbacks.forEach((callback) => callback(time)); });
  }
}

function position() {
  const track = screen.getByLabelText("Brand names").firstElementChild;
  if (!(track instanceof HTMLElement)) throw new Error("Missing carousel track");
  return -Number(track.style.transform.match(/translate3d\(([-\d.]+)px/)?.[1]);
}

describe("Home brand carousel behavior", () => {
  it("moves at 82 CSS pixels per second and wraps at the measured 800-pixel copy boundary", () => {
    render(<BrandCarousel />);
    advance(16);
    advance(1000);
    expect(position()).toBeCloseTo(82, 5);
    advance(10000);
    expect(position()).toBeCloseTo(102, 5);
  });

  it("pauses while a control has focus and supports arrow keys", () => {
    render(<BrandCarousel />);
    const track = screen.getByLabelText("Brand names");
    fireEvent.focus(track);
    const start = position();
    advance(1000);
    expect(position()).toBe(start);
    fireEvent.keyDown(track, { key: "ArrowRight" });
    advance(352);
    expect(position()).toBeCloseTo((start + 100) % 800);
    fireEvent.keyDown(track, { key: "ArrowLeft" });
    advance(352);
    expect(position()).toBeCloseTo(start);
    fireEvent.blur(track, { relatedTarget: null });
    advance(16);
    advance(1000);
    expect(position()).toBeCloseTo((start + 82) % 800);
  });

  it("keeps auto-advance paused until explicitly resumed", () => {
    render(<BrandCarousel />);
    fireEvent.click(screen.getByRole("button", { name: "Pause brand auto-advance" }));
    const start = position();
    advance(1000);
    expect(position()).toBe(start);
    fireEvent.click(screen.getByRole("button", { name: "Resume brand auto-advance" }));
    advance(16);
    advance(1000);
    expect(position()).toBeCloseTo((start + 82) % 800);
  });

  it("disables automatic motion and jumps on manual navigation when reduced motion is requested", () => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    vi.spyOn(window, "matchMedia").mockReturnValue({ ...preference, matches: true });
    render(<BrandCarousel />);
    const start = position();
    advance(1000);
    expect(position()).toBe(start);
    fireEvent.click(screen.getByRole("button", { name: "Next brands" }));
    expect(position()).toBeCloseTo((start + 100) % 800);
    fireEvent.click(screen.getByRole("button", { name: "Previous brands" }));
    expect(position()).toBeCloseTo(start);
  });
});
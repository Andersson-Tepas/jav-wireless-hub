import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BrandCarousel } from "@/components/brand-carousel";

const controls = vi.hoisted(() => ({ scrollNext: vi.fn(), scrollPrev: vi.fn() }));
vi.mock("embla-carousel-react", () => ({ default: () => [() => {}, controls] }));

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
const advance = () => act(() => { vi.advanceTimersByTime(4000); });

describe("Home brand carousel behavior", () => {
  it("advances automatically and pauses while hovered", () => {
    render(<BrandCarousel />);
    advance();
    expect(controls.scrollNext).toHaveBeenCalledTimes(1);
    const carousel = screen.getByRole("region");
    fireEvent.mouseEnter(carousel);
    advance();
    expect(controls.scrollNext).toHaveBeenCalledTimes(1);
    fireEvent.mouseLeave(carousel);
    advance();
    expect(controls.scrollNext).toHaveBeenCalledTimes(2);
  });

  it("pauses while a control has focus and supports arrow keys", () => {
    render(<BrandCarousel />);
    const track = screen.getByLabelText("Brand names");
    fireEvent.focus(track);
    advance();
    expect(controls.scrollNext).not.toHaveBeenCalled();
    fireEvent.keyDown(track, { key: "ArrowRight" });
    expect(controls.scrollNext).toHaveBeenCalledWith(false);
    fireEvent.keyDown(track, { key: "ArrowLeft" });
    expect(controls.scrollPrev).toHaveBeenCalledWith(false);
    fireEvent.blur(track, { relatedTarget: null });
    advance();
    expect(controls.scrollNext).toHaveBeenCalledTimes(2);
  });

  it("keeps auto-advance paused until explicitly resumed", () => {
    render(<BrandCarousel />);
    fireEvent.click(screen.getByRole("button", { name: "Pause brand auto-advance" }));
    advance();
    expect(controls.scrollNext).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Resume brand auto-advance" }));
    advance();
    expect(controls.scrollNext).toHaveBeenCalledTimes(1);
  });

  it("disables automatic motion and jumps on manual navigation when reduced motion is requested", () => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    vi.spyOn(window, "matchMedia").mockReturnValue({ ...preference, matches: true });
    render(<BrandCarousel />);
    advance();
    expect(controls.scrollNext).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Next brands" }));
    expect(controls.scrollNext).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByRole("button", { name: "Previous brands" }));
    expect(controls.scrollPrev).toHaveBeenCalledWith(true);
  });
});
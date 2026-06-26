import { describe, expect, it } from "vitest";
import {
  bulletsFromMultilineText,
  moveSlideInDeck,
  removeSlideFromDeck,
  updateSlideInDeck
} from "@/lib/presentation/deck-mutations";
import type { PresentationDeck } from "@/lib/presentation/types";

const sampleDeck: PresentationDeck = {
  projectName: "Demo",
  projectType: "office",
  versionLabel: "V1",
  generatedAt: "2026-06-26T00:00:00.000Z",
  slides: [
    { id: "s1", kind: "cover", title: "Cover", bullets: ["A"] },
    { id: "s2", kind: "plan", title: "Plan", bullets: ["B"] },
    { id: "s3", kind: "cost", title: "Cost", bullets: ["C"] }
  ]
};

describe("deck-mutations", () => {
  it("updates slide copy", () => {
    const next = updateSlideInDeck(sampleDeck, "s2", { title: "Updated plan", bullets: ["B1", "B2"] });
    expect(next.slides[1]?.title).toBe("Updated plan");
    expect(next.slides[1]?.bullets).toEqual(["B1", "B2"]);
  });

  it("removes slide when more than one remain", () => {
    const next = removeSlideFromDeck(sampleDeck, "s2");
    expect(next.slides.map((slide) => slide.id)).toEqual(["s1", "s3"]);
  });

  it("reorders slides", () => {
    const next = moveSlideInDeck(sampleDeck, 2, 0);
    expect(next.slides.map((slide) => slide.id)).toEqual(["s3", "s1", "s2"]);
  });

  it("parses multiline bullets", () => {
    expect(bulletsFromMultilineText("one\n\ntwo\n")).toEqual(["one", "two"]);
  });
});

import { describe, expect, it } from "vitest";
import { constrainFurniturePosition, furnitureFitsInRoom } from "@/lib/furniture-placement";

const room: [number, number][] = [
  [0, 0],
  [10, 0],
  [10, 8],
  [0, 8]
];

describe("furniture-placement", () => {
  it("accepts a position when the full footprint stays inside the room", () => {
    const item = { width: 2, depth: 1.5, rotationDeg: 0 };
    const position = constrainFurniturePosition([5, 4], item, room);

    expect(position).toEqual([5, 4]);
    expect(furnitureFitsInRoom({ ...item, position: position! }, room)).toBe(true);
  });

  it("rejects a position outside the room polygon", () => {
    const item = { width: 2, depth: 1.5, rotationDeg: 0 };
    const position = constrainFurniturePosition([12, 4], item, room);

    expect(position).toBeNull();
  });

  it("snaps dragged positions to the plan grid", () => {
    const item = { width: 1, depth: 1, rotationDeg: 0 };
    const position = constrainFurniturePosition([5.04, 4.06], item, room);

    expect(position?.[0]).toBe(5);
    expect(position?.[1]).toBeCloseTo(4.1, 5);
  });
});

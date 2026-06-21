import { describe, test, expect } from "vitest";
import type { Room, Point } from "@/lib/project-types";
import {
  distance,
  polygonCentroid,
  polygonArea,
  snapToGrid,
  rectangleFromDrag,
  simplifyPolygon,
  moveRoom,
  scaleRoom,
  rotateRoom,
  mirrorRoom,
  alignRooms,
  pointInPolygon,
  hitTestRoom
} from "@/lib/manual-drawing-utils";

describe("manual-drawing-utils", () => {
  describe("基础几何运算", () => {
    test("distance计算两点间距离", () => {
      expect(distance([0, 0], [3, 4])).toBe(5);
      expect(distance([1, 1], [1, 1])).toBe(0);
    });

    test("polygonCentroid计算多边形中心点", () => {
      const square: Point[] = [[0, 0], [2, 0], [2, 2], [0, 2]];
      const center = polygonCentroid(square);
      expect(center).toEqual([1, 1]);
    });

    test("polygonArea计算多边形面积", () => {
      const square: Point[] = [[0, 0], [2, 0], [2, 2], [0, 2]];
      expect(polygonArea(square)).toBe(4);

      const triangle: Point[] = [[0, 0], [4, 0], [2, 3]];
      expect(polygonArea(triangle)).toBe(6);
    });
  });

  describe("网格吸附", () => {
    test("snapToGrid吸附到网格", () => {
      expect(snapToGrid([1.3, 2.7], 0.5)).toEqual([1.5, 2.5]);
      expect(snapToGrid([3.2, 4.8], 1.0)).toEqual([3, 5]);
      expect(snapToGrid([0.24, 0.26], 0.25)).toEqual([0.25, 0.25]);
    });
  });

  describe("矩形绘制", () => {
    test("rectangleFromDrag从拖拽创建矩形", () => {
      const rect = rectangleFromDrag([0, 0], [10, 5]);
      expect(rect).toEqual([
        [0, 0],
        [10, 0],
        [10, 5],
        [0, 5]
      ]);

      // 反向拖拽也应正确处理
      const rect2 = rectangleFromDrag([10, 5], [0, 0]);
      expect(rect2).toEqual([
        [0, 0],
        [10, 0],
        [10, 5],
        [0, 5]
      ]);
    });
  });

  describe("多边形简化", () => {
    test("simplifyPolygon简化复杂多边形", () => {
      // 接近直线的点应该被简化
      const complex: Point[] = [
        [0, 0],
        [1, 0.05],
        [2, 0],
        [3, 0.05],
        [4, 0]
      ];
      const simplified = simplifyPolygon(complex, 0.1);
      expect(simplified.length).toBeLessThan(complex.length);
    });
  });

  describe("房间变换", () => {
    function createTestRoom(polygon: Point[]): Room {
      return {
        id: "test-room",
        name: "Test Room",
        type: "office",
        zone: "private",
        polygon,
        areaSqm: polygonArea(polygon),
        ceilingHeight: 3.0,
        doors: [],
        windows: []
      };
    }

    test("moveRoom移动房间", () => {
      const room = createTestRoom([[0, 0], [2, 0], [2, 2], [0, 2]]);
      const moved = moveRoom(room, [5, 5]);

      expect(moved.polygon).toEqual([
        [5, 5],
        [7, 5],
        [7, 7],
        [5, 7]
      ]);
    });

    test("scaleRoom缩放房间", () => {
      const room = createTestRoom([[0, 0], [2, 0], [2, 2], [0, 2]]);
      const scaled = scaleRoom(room, 2, [0, 0]);

      expect(scaled.polygon).toEqual([
        [0, 0],
        [4, 0],
        [4, 4],
        [0, 4]
      ]);
      expect(scaled.areaSqm).toBe(16); // 面积变为4倍
    });

    test("rotateRoom旋转房间90度", () => {
      const room = createTestRoom([[0, 0], [2, 0], [2, 2], [0, 2]]);
      const rotated = rotateRoom(room, 90, [1, 1]);

      // 90度旋转后，每个点应该相对于中心(1,1)旋转
      rotated.polygon.forEach((point, idx) => {
        const [x, y] = point;
        expect(Math.abs(x - Math.round(x))).toBeLessThan(0.01);
        expect(Math.abs(y - Math.round(y))).toBeLessThan(0.01);
      });
    });

    test("mirrorRoom镜像房间", () => {
      const room = createTestRoom([[0, 0], [2, 0], [2, 1], [0, 1]]);
      const mirrored = mirrorRoom(room, "x", [1, 0]);

      expect(mirrored.polygon[0]).toEqual([2, 0]);
      expect(mirrored.polygon[1]).toEqual([0, 0]);
    });

    test("alignRooms对齐多个房间", () => {
      const room1 = createTestRoom([[0, 0], [2, 0], [2, 2], [0, 2]]);
      const room2 = createTestRoom([[5, 1], [7, 1], [7, 3], [5, 3]]);

      const aligned = alignRooms([room1, room2], "left");

      // 两个房间的左边缘应该对齐
      const minX1 = Math.min(...aligned[0].polygon.map(([x]) => x));
      const minX2 = Math.min(...aligned[1].polygon.map(([x]) => x));
      expect(minX1).toBe(minX2);
    });
  });

  describe("碰撞检测", () => {
    test("pointInPolygon检测点是否在多边形内", () => {
      const square: Point[] = [[0, 0], [2, 0], [2, 2], [0, 2]];

      expect(pointInPolygon([1, 1], square)).toBe(true);
      expect(pointInPolygon([3, 3], square)).toBe(false);
      expect(pointInPolygon([0, 0], square)).toBe(true); // 边界上
    });

    test("hitTestRoom检测点击命中房间", () => {
      const room: Room = {
        id: "test-room",
        name: "Test Room",
        type: "office",
        zone: "private",
        polygon: [[0, 0], [2, 0], [2, 2], [0, 2]],
        areaSqm: 4,
        ceilingHeight: 3.0,
        doors: [],
        windows: []
      };

      expect(hitTestRoom([1, 1], room)).toBe(true);
      expect(hitTestRoom([5, 5], room)).toBe(false);
    });
  });
});

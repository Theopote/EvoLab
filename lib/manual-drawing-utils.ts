import type { Point, Room } from "@/lib/project-types";
import type { SnapOptions, TransformHandles } from "@/lib/manual-drawing-types";

/**
 * 计算两点间距离
 */
export function distance(a: Point, b: Point): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

/**
 * 计算多边形中心点
 */
export function polygonCentroid(polygon: Point[]): Point {
  if (polygon.length === 0) {
    return [0, 0];
  }
  const total = polygon.reduce((acc, [x, y]) => [acc[0] + x, acc[1] + y] as Point, [0, 0]);
  return [total[0] / polygon.length, total[1] / polygon.length];
}

/**
 * 计算多边形面积
 */
export function polygonArea(points: Point[]): number {
  if (points.length < 3) {
    return 0;
  }
  const area = points.reduce((total, [x, y], index) => {
    const [nextX, nextY] = points[(index + 1) % points.length];
    return total + x * nextY - nextX * y;
  }, 0);
  return Math.abs(area) / 2;
}

/**
 * 网格吸附
 */
export function snapToGrid(point: Point, gridSize: number): Point {
  return [
    Math.round(point[0] / gridSize) * gridSize,
    Math.round(point[1] / gridSize) * gridSize
  ];
}

/**
 * 角度吸附（吸附到指定角度的倍数）
 */
export function snapAngle(angle: number, snapDegrees: number): number {
  const snapRadians = (snapDegrees * Math.PI) / 180;
  return Math.round(angle / snapRadians) * snapRadians;
}

/**
 * 距离吸附（吸附到最近的点）
 */
export function snapToPoint(point: Point, targets: Point[], threshold: number): Point {
  let closest = point;
  let minDist = threshold;

  for (const target of targets) {
    const dist = distance(point, target);
    if (dist < minDist) {
      minDist = dist;
      closest = target;
    }
  }

  return closest;
}

/**
 * 智能吸附（综合网格、角度、距离）
 */
export function smartSnap(
  point: Point,
  snapOptions: SnapOptions,
  existingPoints: Point[] = []
): Point {
  let snapped = point;

  // 网格吸附
  if (snapOptions.grid) {
    snapped = snapToGrid(snapped, snapOptions.gridSize);
  }

  // 距离吸附到已有点
  if (snapOptions.distance > 0 && existingPoints.length > 0) {
    snapped = snapToPoint(snapped, existingPoints, snapOptions.distance);
  }

  return snapped;
}

/**
 * 从拖拽创建矩形
 */
export function rectangleFromDrag(start: Point, end: Point): Point[] {
  const [x1, y1] = start;
  const [x2, y2] = end;
  return [
    [Math.min(x1, x2), Math.min(y1, y2)],
    [Math.max(x1, x2), Math.min(y1, y2)],
    [Math.max(x1, x2), Math.max(y1, y2)],
    [Math.min(x1, x2), Math.max(y1, y2)]
  ];
}

/**
 * 简化多边形（Douglas-Peucker算法）
 */
export function simplifyPolygon(points: Point[], tolerance: number): Point[] {
  if (points.length < 3) {
    return points;
  }

  // 找到距离线段最远的点
  function perpendicularDistance(point: Point, lineStart: Point, lineEnd: Point): number {
    const [x0, y0] = point;
    const [x1, y1] = lineStart;
    const [x2, y2] = lineEnd;

    const numerator = Math.abs((y2 - y1) * x0 - (x2 - x1) * y0 + x2 * y1 - y2 * x1);
    const denominator = Math.sqrt((y2 - y1) ** 2 + (x2 - x1) ** 2);

    return denominator === 0 ? 0 : numerator / denominator;
  }

  function douglasPeucker(pts: Point[], epsilon: number): Point[] {
    if (pts.length < 3) {
      return pts;
    }

    const start = pts[0];
    const end = pts[pts.length - 1];

    let maxDist = 0;
    let maxIndex = 0;

    for (let index = 1; index < pts.length - 1; index += 1) {
      const dist = perpendicularDistance(pts[index], start, end);
      if (dist > maxDist) {
        maxDist = dist;
        maxIndex = index;
      }
    }

    if (maxDist > epsilon) {
      const left = douglasPeucker(pts.slice(0, maxIndex + 1), epsilon);
      const right = douglasPeucker(pts.slice(maxIndex), epsilon);
      return [...left.slice(0, -1), ...right];
    }

    return [start, end];
  }

  const simplified = douglasPeucker(points, tolerance);
  // 确保首尾相连（如果原始多边形是闭合的）
  if (distance(points[0], points[points.length - 1]) < 0.1 && 
      distance(simplified[0], simplified[simplified.length - 1]) > 0.1) {
    return [...simplified, simplified[0]];
  }
  return simplified;
}

/**
 * 计算房间的变换手柄位置
 */
export function calculateTransformHandles(room: Room): TransformHandles {
  const polygon = room.polygon;
  if (polygon.length < 3) {
    const center: Point = [0, 0];
    return { corners: [], edges: [], center };
  }

  // 计算包围盒
  const xs = polygon.map(([x]) => x);
  const ys = polygon.map(([, y]) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const center = polygonCentroid(polygon);

  // 四角手柄
  const corners: Point[] = [
    [minX, minY], // 左上
    [maxX, minY], // 右上
    [maxX, maxY], // 右下
    [minX, maxY]  // 左下
  ];

  // 边中点手柄
  const edges: Point[] = [
    [(minX + maxX) / 2, minY], // 上
    [maxX, (minY + maxY) / 2], // 右
    [(minX + maxX) / 2, maxY], // 下
    [minX, (minY + maxY) / 2]  // 左
  ];

  // 旋转手柄（在上方）
  const rotation: Point = [(minX + maxX) / 2, minY - 1.5];

  return { corners, edges, rotation, center };
}

/**
 * 移动房间
 */
export function moveRoom(room: Room, delta: Point): Room {
  const [dx, dy] = delta;
  return {
    ...room,
    polygon: room.polygon.map(([x, y]) => [x + dx, y + dy] as Point)
  };
}

/**
 * 缩放房间
 */
export function scaleRoom(room: Room, scale: number, origin?: Point): Room {
  const center = origin ?? polygonCentroid(room.polygon);
  return {
    ...room,
    polygon: room.polygon.map(([x, y]) => {
      const dx = (x - center[0]) * scale;
      const dy = (y - center[1]) * scale;
      return [center[0] + dx, center[1] + dy] as Point;
    }),
    areaSqm: room.areaSqm * scale * scale
  };
}

/**
 * 旋转房间
 */
export function rotateRoom(room: Room, angleDegrees: number, origin?: Point): Room {
  const center = origin ?? polygonCentroid(room.polygon);
  const angleRadians = (angleDegrees * Math.PI) / 180;
  const cos = Math.cos(angleRadians);
  const sin = Math.sin(angleRadians);

  return {
    ...room,
    polygon: room.polygon.map(([x, y]) => {
      const dx = x - center[0];
      const dy = y - center[1];
      return [
        center[0] + dx * cos - dy * sin,
        center[1] + dx * sin + dy * cos
      ] as Point;
    })
  };
}

/**
 * 镜像房间
 */
export function mirrorRoom(room: Room, axis: "x" | "y", origin?: Point): Room {
  const center = origin ?? polygonCentroid(room.polygon);
  
  return {
    ...room,
    polygon: room.polygon.map(([x, y]) => {
      if (axis === "x") {
        return [2 * center[0] - x, y] as Point;
      }
      return [x, 2 * center[1] - y] as Point;
    })
  };
}

/**
 * 对齐房间
 */
export function alignRooms(
  rooms: Room[],
  mode: "left" | "right" | "top" | "bottom" | "center-h" | "center-v"
): Room[] {
  if (rooms.length < 2) {
    return rooms;
  }

  // 计算基准位置
  const allPolygons = rooms.flatMap((room) => room.polygon);
  const xs = allPolygons.map(([x]) => x);
  const ys = allPolygons.map(([, y]) => y);
  
  let targetValue: number;
  let deltaFn: (room: Room) => Point;

  switch (mode) {
    case "left": {
      targetValue = Math.min(...xs);
      deltaFn = (room) => {
        const minX = Math.min(...room.polygon.map(([x]) => x));
        return [targetValue - minX, 0];
      };
      break;
    }
    case "right": {
      targetValue = Math.max(...xs);
      deltaFn = (room) => {
        const maxX = Math.max(...room.polygon.map(([x]) => x));
        return [targetValue - maxX, 0];
      };
      break;
    }
    case "top": {
      targetValue = Math.min(...ys);
      deltaFn = (room) => {
        const minY = Math.min(...room.polygon.map(([, y]) => y));
        return [0, targetValue - minY];
      };
      break;
    }
    case "bottom": {
      targetValue = Math.max(...ys);
      deltaFn = (room) => {
        const maxY = Math.max(...room.polygon.map(([, y]) => y));
        return [0, targetValue - maxY];
      };
      break;
    }
    case "center-h": {
      targetValue = (Math.min(...xs) + Math.max(...xs)) / 2;
      deltaFn = (room) => {
        const center = polygonCentroid(room.polygon);
        return [targetValue - center[0], 0];
      };
      break;
    }
    case "center-v": {
      targetValue = (Math.min(...ys) + Math.max(...ys)) / 2;
      deltaFn = (room) => {
        const center = polygonCentroid(room.polygon);
        return [0, targetValue - center[1]];
      };
      break;
    }
    default:
      return rooms;
  }

  return rooms.map((room) => moveRoom(room, deltaFn(room)));
}

/**
 * 检测点是否在多边形内
 */
export function pointInPolygon(point: Point, polygon: Point[]): boolean {
  const [x, y] = point;
  let inside = false;

  for (let index = 0, j = polygon.length - 1; index < polygon.length; j = index++) {
    const [xi, yi] = polygon[index];
    const [xj, yj] = polygon[j];

    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * 检测点击命中的房间
 */
export function hitTestRoom(point: Point, room: Room, tolerance = 0.5): boolean {
  // 先检查是否在包围盒内
  const xs = room.polygon.map(([x]) => x);
  const ys = room.polygon.map(([, y]) => y);
  const minX = Math.min(...xs) - tolerance;
  const maxX = Math.max(...xs) + tolerance;
  const minY = Math.min(...ys) - tolerance;
  const maxY = Math.max(...ys) + tolerance;

  if (point[0] < minX || point[0] > maxX || point[1] < minY || point[1] > maxY) {
    return false;
  }

  // 检查是否在多边形内
  return pointInPolygon(point, room.polygon);
}

/**
 * 生成唯一ID
 */
export function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

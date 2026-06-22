import type { Point, Room } from "@/lib/project-types";

export type DrawingMode =
  | "select"       // 选择模式
  | "outline"      // 轮廓绘制
  | "room"         // 房间多边形绘制
  | "rectangle"    // 矩形房间绘制
  | "wall"         // 墙线绘制
  | "opening"      // 门窗放置
  | "dimension";   // 尺寸标注

export type TransformMode =
  | "move"
  | "scale"
  | "rotate"
  | "mirror";

export interface SnapOptions {
  grid: boolean;
  gridSize: number;
  angle: number;          // 角度吸附（度）
  distance: number;       // 距离吸附（米）
  snapToWalls: boolean;
  snapToRooms: boolean;
}

export interface SelectionState {
  mode: "single" | "multiple" | "box";
  selectedRoomIds: string[];
  selectedWallIds: string[];
  selectedOpeningIds: string[];
  hoveredElementId?: string;
  transformMode?: TransformMode;
}

export interface DrawingState {
  mode: DrawingMode;
  currentPoints: Point[];
  previewRoom?: Room;
  isDrawing: boolean;
  dragStart?: Point;
  dragCurrent?: Point;
}

export interface TransformHandles {
  corners: Point[];       // 四角缩放手柄
  edges: Point[];         // 边中点手柄
  rotation?: Point;       // 旋转手柄
  center: Point;          // 中心点
}

export interface RoomDrawingOptions {
  defaultType: Room["type"];
  defaultZone: Room["zone"];
  defaultCeilingHeight: number;
  autoClose: boolean;      // 自动闭合多边形
  simplifyTolerance: number; // 简化容差
}

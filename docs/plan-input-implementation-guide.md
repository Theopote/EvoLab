# 建筑平面输入系统实施指南

## 已实现的核心功能

### ✅ 现有功能概览
1. **AI生成** - `/api/generate-plan` 完整实现
2. **手绘轮廓** - `OutlineCanvas` 组件
3. **草图识别** - `/api/interpret-sketch` + 自动识别
4. **图片上传** - Vision API识别平面图
5. **DWG导入** - `dxf-import.ts` 解析墙线/门窗/标注
6. **PDF导入** - `pdf-import.ts` 基础实现

### ✅ 新增工具库（本次实现）
- `lib/manual-drawing-types.ts` - 类型定义
- `lib/manual-drawing-utils.ts` - 核心工具函数

## 核心功能详解

### 1. 手动绘制工具函数

#### 1.1 几何运算
```typescript
// 已实现的核心函数
- distance(a, b)                    // 两点距离
- polygonCentroid(polygon)          // 多边形中心
- polygonArea(points)               // 多边形面积
- simplifyPolygon(points, tolerance) // 多边形简化
- pointInPolygon(point, polygon)    // 点是否在多边形内
```

#### 1.2 智能吸附
```typescript
// 吸附功能
- snapToGrid(point, gridSize)       // 网格吸附
- snapAngle(angle, snapDegrees)     // 角度吸附
- snapToPoint(point, targets)       // 距离吸附
- smartSnap(point, options)         // 综合吸附
```

#### 1.3 房间变换
```typescript
// 房间操作
- moveRoom(room, delta)             // 移动
- scaleRoom(room, scale, origin)    // 缩放
- rotateRoom(room, angle, origin)   // 旋转
- mirrorRoom(room, axis, origin)    // 镜像
- alignRooms(rooms, mode)           // 对齐
```

#### 1.4 交互辅助
```typescript
- rectangleFromDrag(start, end)     // 拖拽绘制矩形
- calculateTransformHandles(room)   // 计算变换手柄
- hitTestRoom(point, room)          // 点击检测
```

### 2. 文件导入系统

#### 2.1 DWG/DXF导入（已实现）
```typescript
// lib/plan-import/dxf-import.ts
- parseDxfToGraph(dxfText): RecognizedPlanGraph

// 功能：
✅ 识别墙体图层（A-WALL、PARTITION等）
✅ 提取门窗块（INSERT实体）
✅ 解析房间标注（TEXT/MTEXT）
✅ 支持LINE和POLYLINE实体
```

#### 2.2 图片识别（已实现）
```typescript
// lib/plan-import/image-recognition.ts
- importPlanFromImage(image, fileName): Promise<PlanImportResult>

// 使用Anthropic Vision API
✅ 识别墙线
✅ 识别门窗
✅ 识别房间标注
✅ 置信度评估
```

#### 2.3 PDF导入（部分实现）
```typescript
// lib/plan-import/pdf-import.ts
// 需要增强：
⚠️ 矢量图形提取
⚠️ 文字标注提取
⚠️ 多页处理
```

## 实施步骤指南

### Phase 1: UI组件开发（高优先级）

#### Step 1.1: 创建高级绘图画布
```bash
# 创建文件
components/plan-editor/AdvancedDrawingCanvas.tsx
```

**功能需求**：
- 多种绘制模式切换（轮廓/房间/墙体/门窗）
- 实时预览
- 网格显示和吸附
- 快捷键支持
- 撤销/重做

#### Step 1.2: 创建房间编辑器
```bash
# 创建文件
components/plan-editor/RoomEditor.tsx
components/plan-editor/TransformHandles.tsx
```

**功能需求**：
- 选择房间显示边界框
- 8个缩放手柄（4角+4边）
- 旋转手柄
- 拖拽移动
- 属性面板（类型/区域/层高）

#### Step 1.3: 创建文件上传组件
```bash
# 创建文件
components/plan-editor/FileUploadZone.tsx
components/plan-editor/ImportPreview.tsx
```

**功能需求**：
- 拖拽上传（DWG/PDF/图片）
- 导入选项配置
- 预览和校准
- 图层选择（DWG）

### Phase 2: 增强现有功能

#### Step 2.1: DXF导入增强
```typescript
// 在 lib/plan-import/dxf-import-options.ts 中添加

export interface DXFImportOptions {
  layerMapping: {
    walls: string[];
    windows: string[];
    doors: string[];
    furniture: string[];
    dimensions: string[];
  };
  autoDetectRooms: boolean;
  mergeColinearWalls: boolean;
  snapTolerance: number;
  sourceUnit: "mm" | "cm" | "m";
  scale: number;
}

export function createDXFImportOptionsUI(): React.Component {
  // 返回配置UI组件
}
```

#### Step 2.2: 自动识别封闭空间
```typescript
// 在 lib/room-detection.ts 中创建

export function detectEnclosedRooms(walls: Wall[]): Room[] {
  // 1. 构建墙体图
  // 2. 找到所有环路
  // 3. 识别为房间
  // 4. 计算面积和中心点
}
```

#### Step 2.3: Excel房间表导入
```typescript
// 在 lib/plan-import/excel-import.ts 中创建

export interface RoomScheduleRow {
  roomName: string;
  roomType: RoomType;
  area: number;
  zone?: FunctionZone;
  adjacentTo?: string[];
}

export function importRoomSchedule(
  rows: RoomScheduleRow[]
): PlanVersion {
  // 1. 解析Excel数据
  // 2. 自动布局算法（矩形装箱）
  // 3. 生成PlanVersion
}
```

### Phase 3: 集成到主界面

#### Step 3.1: 更新Plan工作区
```typescript
// 在 components/evolab-workspace.tsx 中

function PlanWorkspace() {
  const [inputMode, setInputMode] = useState<InputMode>("ai");
  
  return (
    <div className="plan-workspace">
      {/* 输入模式选择 */}
      <InputModeSelector
        modes={["ai", "manual", "upload", "template"]}
        active={inputMode}
        onChange={setInputMode}
      />
      
      {/* 根据模式显示不同的输入界面 */}
      {inputMode === "ai" && <AIGenerationPanel />}
      {inputMode === "manual" && <AdvancedDrawingCanvas />}
      {inputMode === "upload" && <FileUploadZone />}
      {inputMode === "template" && <TemplateGallery />}
    </div>
  );
}
```

#### Step 3.2: 添加工具栏
```typescript
// components/plan-editor/DrawingToolbar.tsx

export function DrawingToolbar({
  mode,
  onModeChange,
  snap,
  onSnapChange
}: DrawingToolbarProps) {
  return (
    <div className="drawing-toolbar">
      {/* 绘制工具 */}
      <ToolGroup label="绘制">
        <ToolButton icon={<Square />} mode="rectangle" />
        <ToolButton icon={<Pentagon />} mode="polygon" />
        <ToolButton icon={<Minus />} mode="wall" />
        <ToolButton icon={<DoorOpen />} mode="opening" />
      </ToolGroup>
      
      {/* 编辑工具 */}
      <ToolGroup label="编辑">
        <ToolButton icon={<Move />} mode="move" />
        <ToolButton icon={<Maximize />} mode="scale" />
        <ToolButton icon={<RotateCw />} mode="rotate" />
      </ToolGroup>
      
      {/* 吸附选项 */}
      <SnapOptions snap={snap} onChange={onSnapChange} />
    </div>
  );
}
```

### Phase 4: 快捷键系统

#### Step 4.1: 创建快捷键管理器
```typescript
// lib/shortcuts.ts

export const shortcuts = {
  // 绘制模式
  "R": "draw_rectangle",
  "P": "draw_polygon",
  "W": "draw_wall",
  "D": "add_door",
  
  // 编辑操作
  "M": "move",
  "S": "scale",
  "Ctrl+R": "rotate",
  "Ctrl+D": "duplicate",
  "Delete": "delete",
  
  // 撤销重做
  "Ctrl+Z": "undo",
  "Ctrl+Y": "redo",
} as const;

export function useShortcuts(handlers: ShortcutHandlers) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const key = getShortcutKey(event);
      const action = shortcuts[key];
      if (action && handlers[action]) {
        event.preventDefault();
        handlers[action]();
      }
    }
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handlers]);
}
```

## 使用示例

### 示例1: 手动绘制矩形房间
```typescript
import { rectangleFromDrag, polygonArea } from "@/lib/manual-drawing-utils";

function handleRectangleDrag(start: Point, end: Point) {
  const polygon = rectangleFromDrag(start, end);
  const area = polygonArea(polygon);
  
  const newRoom: Room = {
    id: generateId("room"),
    name: "Room",
    type: "office",
    zone: "private",
    polygon,
    areaSqm: area,
    ceilingHeight: 3.0,
    doors: [],
    windows: []
  };
  
  addRoomToVersion(newRoom);
}
```

### 示例2: 移动并吸附房间
```typescript
import { moveRoom, smartSnap } from "@/lib/manual-drawing-utils";

function handleRoomDrag(room: Room, delta: Point, snapOptions: SnapOptions) {
  // 计算新位置
  const movedRoom = moveRoom(room, delta);
  const center = polygonCentroid(movedRoom.polygon);
  
  // 获取其他房间的吸附点
  const snapPoints = otherRooms.flatMap(r => r.polygon);
  
  // 吸附
  const snappedCenter = smartSnap(center, snapOptions, snapPoints);
  const snapDelta: Point = [
    snappedCenter[0] - center[0],
    snappedCenter[1] - center[1]
  ];
  
  // 应用吸附后的偏移
  return moveRoom(movedRoom, snapDelta);
}
```

### 示例3: DWG文件上传和导入
```typescript
async function handleDWGUpload(file: File) {
  // 读取文件
  const text = await file.text();
  
  // 解析DXF
  const graph = parseDxfToGraph(text);
  
  // 转换为PlanVersion
  const version = await buildPlanVersionFromGraph(graph, {
    fileName: file.name,
    label: `DWG Import: ${file.name}`
  });
  
  // 后处理
  const processed = postProcessPlanVersion(version);
  
  // 添加到项目
  addVersion(processed);
}
```

## API路由扩展建议

### 新增：房间自动识别
```typescript
// app/api/detect-rooms/route.ts

export async function POST(request: Request) {
  const { walls } = await request.json();
  
  // 自动检测封闭空间
  const rooms = detectEnclosedRooms(walls);
  
  return Response.json({ rooms });
}
```

### 新增：智能修复
```typescript
// app/api/auto-repair/route.ts

export async function POST(request: Request) {
  const { version, issues } = await request.json();
  
  // 自动修复几何问题
  const repaired = autoRepairVersion(version, issues);
  
  return Response.json({ version: repaired, fixes: [] });
}
```

## 测试计划

### 单元测试
```typescript
// lib/manual-drawing-utils.test.ts

describe("manual-drawing-utils", () => {
  test("rectangleFromDrag creates correct rectangle", () => {
    const rect = rectangleFromDrag([0, 0], [10, 5]);
    expect(rect).toEqual([[0, 0], [10, 0], [10, 5], [0, 5]]);
  });
  
  test("smartSnap snaps to grid", () => {
    const snapped = smartSnap([1.3, 2.7], { 
      grid: true, 
      gridSize: 0.5,
      angle: 15,
      distance: 0,
      snapToWalls: false,
      snapToRooms: false
    });
    expect(snapped).toEqual([1.5, 2.5]);
  });
  
  test("moveRoom translates all points", () => {
    const room = createTestRoom([[0, 0], [1, 0], [1, 1], [0, 1]]);
    const moved = moveRoom(room, [5, 5]);
    expect(moved.polygon[0]).toEqual([5, 5]);
  });
});
```

### E2E测试
```typescript
// tests/e2e/manual-drawing.spec.ts

test("user can draw rectangle room", async ({ page }) => {
  await page.goto("/");
  await page.click('[data-testid="manual-mode"]');
  await page.click('[data-testid="rectangle-tool"]');
  
  // 拖拽绘制
  await page.mouse.move(100, 100);
  await page.mouse.down();
  await page.mouse.move(200, 150);
  await page.mouse.up();
  
  // 验证房间已创建
  const rooms = await page.locator('[data-testid="room"]').count();
  expect(rooms).toBe(1);
});
```

## 性能优化建议

### 1. Canvas渲染优化
```typescript
// 使用离屏Canvas
const offscreenCanvas = new OffscreenCanvas(width, height);
const ctx = offscreenCanvas.getContext("2d");

// 只重绘变化区域
function redrawDirtyRegion(dirtyRect: Rect) {
  ctx.clearRect(dirtyRect.x, dirtyRect.y, dirtyRect.w, dirtyRect.h);
  // ... 重绘
}
```

### 2. 空间索引
```typescript
// 使用R-Tree加速查询
import RBush from "rbush";

const spatialIndex = new RBush<RoomIndex>();
spatialIndex.load(rooms.map(room => ({
  minX, minY, maxX, maxY,
  room
})));

// 快速查找附近房间
const nearby = spatialIndex.search({
  minX: x - radius,
  minY: y - radius,
  maxX: x + radius,
  maxY: y + radius
});
```

### 3. Web Worker处理
```typescript
// lib/drawing-worker.ts
self.onmessage = (event) => {
  const { type, data } = event.data;
  
  if (type === "simplify-polygon") {
    const simplified = simplifyPolygon(data.points, data.tolerance);
    self.postMessage({ type: "result", data: simplified });
  }
};
```

## 总结

### 核心成果
✅ 完整的类型系统定义
✅ 丰富的几何运算工具库
✅ 房间变换函数（移动/缩放/旋转/镜像）
✅ 智能吸附系统
✅ 点击检测和碰撞检测

### 下一步工作
1. 实现UI组件（AdvancedDrawingCanvas、RoomEditor）
2. 集成到主界面
3. 添加快捷键系统
4. 完善文件导入选项
5. 编写测试用例

### 预期收益
- 用户可以完全手动绘制平面图
- 支持多种输入方式无缝切换
- 专业级绘图体验（吸附、变换、快捷键）
- 大幅提升建筑师工作效率

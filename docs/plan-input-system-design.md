# 建筑平面输入系统完整设计

## 一、系统架构概览

### 1.1 输入方式矩阵

| 输入方式 | 当前状态 | 优先级 | 说明 |
|---------|---------|--------|------|
| **AI生成** | ✅ 已实现 | P0 | 通过brief生成多方案 |
| **手绘轮廓+brief** | ✅ 已实现 | P0 | OutlineCanvas点击绘制 |
| **草图识别** | ✅ 已实现 | P1 | 手绘sketch自动识别房间 |
| **图片上传识别** | ✅ 已实现 | P1 | Vision API识别平面图 |
| **DWG文件导入** | ✅ 已实现 | P1 | DXF解析墙线/门窗 |
| **PDF平面图导入** | 🟡 部分实现 | P1 | 需增强 |
| **手动绘制房间** | ⚠️ 需增强 | P0 | 当前仅支持点击轮廓 |
| **直接编辑房间** | ⚠️ 需增强 | P0 | 移动/缩放/旋转房间 |
| **墙体绘制** | ❌ 未实现 | P1 | CAD式墙线绘制 |
| **门窗添加** | ⚠️ 需增强 | P1 | 交互式添加到墙上 |
| **Excel/CSV导入** | ❌ 未实现 | P2 | 房间表导入 |
| **Revit/IFC导入** | ❌ 未实现 | P2 | BIM模型导入 |

### 1.2 架构分层

```
┌─────────────────────────────────────────────────────────────┐
│                    UI交互层 (Components)                      │
│  - PlanInputPanel (统一入口)                                  │
│  - ManualDrawingCanvas (手动绘制)                             │
│  - FileUploadZone (文件拖拽上传)                              │
│  - RoomEditor (房间编辑器)                                    │
│  - WallDrawingTool (墙体绘制工具)                             │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                  输入处理层 (Input Processors)                │
│  - SketchProcessor (草图处理)                                 │
│  - FileImportProcessor (文件导入)                             │
│  - ManualInputProcessor (手动输入)                            │
│  - AIGenerationProcessor (AI生成)                            │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   数据转换层 (Converters)                     │
│  - DXFConverter (DWG→Graph)                                 │
│  - VisionConverter (Image→Graph)                            │
│  - SketchConverter (Sketch→Graph)                           │
│  - GraphToVersionConverter (Graph→PlanVersion)              │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                 验证与修复层 (Validation)                     │
│  - GeometryValidator (几何验证)                               │
│  - TopologyValidator (拓扑验证)                               │
│  - AutoRepair (自动修复)                                      │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   数据模型层 (Data Model)                     │
│                      PlanVersion                            │
└─────────────────────────────────────────────────────────────┘
```

## 二、详细功能设计

### 2.1 手动绘制系统（增强）

#### 2.1.1 绘制模式
```typescript
type DrawingMode = 
  | "outline"      // 轮廓绘制（已有）
  | "room"         // 房间多边形绘制（新增）
  | "wall"         // 墙线绘制（新增）
  | "opening"      // 门窗放置（新增）
  | "label"        // 标注添加（新增）
  | "dimension";   // 尺寸标注（新增）
```

#### 2.1.2 房间绘制工具
- **矩形工具**: 点击拖拽绘制矩形房间
- **多边形工具**: 点击顶点绘制任意形状
- **自由绘制**: 鼠标轨迹自动识别为多边形
- **智能吸附**: 对齐到网格、已有墙线、其他房间边缘

#### 2.1.3 墙体绘制工具
- **直线墙**: 点击起点终点
- **连续墙**: 连续点击绘制墙体链
- **平行墙**: 基于已有墙体绘制平行墙
- **倒角/圆角**: 墙体转角处理

### 2.2 交互式编辑系统（新增）

#### 2.2.1 选择模式
```typescript
interface SelectionState {
  mode: "single" | "multiple" | "box";
  selectedRoomIds: string[];
  selectedWallIds: string[];
  selectedOpeningIds: string[];
  hoveredElementId?: string;
}
```

#### 2.2.2 变换操作
- **移动** (Move): 拖拽房间/墙体到新位置
- **缩放** (Scale): 手柄调整房间大小
- **旋转** (Rotate): 旋转手柄调整角度
- **镜像** (Mirror): X/Y轴镜像
- **对齐** (Align): 左对齐/右对齐/居中/分布

#### 2.2.3 编辑操作
- **拆分房间** (Split): 通过线条分割房间
- **合并房间** (Merge): 合并相邻房间
- **修剪墙体** (Trim): 修剪墙体交叉部分
- **延伸墙体** (Extend): 延伸墙体到目标
- **添加开口** (Add Opening): 在墙上点击添加门窗

### 2.3 文件导入系统（增强）

#### 2.3.1 DWG/DXF导入增强
```typescript
interface DXFImportOptions {
  // 图层映射
  layerMapping: {
    walls: string[];        // 墙体图层名
    windows: string[];      // 窗图层
    doors: string[];        // 门图层
    furniture: string[];    // 家具图层（可忽略）
    dimensions: string[];   // 尺寸标注
  };
  
  // 识别选项
  autoDetectRooms: boolean;      // 自动识别房间轮廓
  mergeColinearWalls: boolean;   // 合并共线墙
  snapTolerance: number;         // 吸附容差（mm）
  
  // 单位转换
  sourceUnit: "mm" | "cm" | "m"; // 源文件单位
  scale: number;                  // 缩放比例
}
```

#### 2.3.2 图片导入增强
```typescript
interface ImageImportOptions {
  // 识别选项
  recognitionMode: "ai" | "template" | "manual";
  
  // AI识别参数
  aiOptions: {
    detectWalls: boolean;
    detectOpenings: boolean;
    detectRoomLabels: boolean;
    detectDimensions: boolean;
    confidenceThreshold: number;
  };
  
  // 模板匹配（用于标准户型）
  templateMatching?: {
    templateLibrary: string[];
    fuzzyMatch: boolean;
  };
  
  // 手动校准
  calibration?: {
    knownDistance: number;    // 已知尺寸
    pixelDistance: number;    // 像素距离
  };
}
```

#### 2.3.3 PDF导入增强
- 提取矢量图形（优先）
- 提取栅格图片→Vision识别
- 提取文字标注→房间名称

#### 2.3.4 新增：Excel/CSV导入
```typescript
interface RoomScheduleImport {
  columns: {
    roomName: string;
    roomType: string;
    area: number;
    zone?: string;
    adjacentTo?: string[];
    requirements?: string;
  }[];
  
  // 自动布局选项
  autoLayout: {
    method: "packing" | "grid" | "flow";
    respectAdjacency: boolean;
    targetAspectRatio?: number;
  };
}
```

### 2.4 智能辅助功能

#### 2.4.1 自动识别与建议
```typescript
interface SmartAssist {
  // 房间识别
  detectEnclosedSpaces(): RecognizedRoom[];
  
  // 缺失元素提示
  suggestMissingElements(): {
    missingDoors: WallSegment[];
    missingWindows: WallSegment[];
    missingCores: Point[];
  };
  
  // 合规性实时检查
  liveComplianceCheck(): ComplianceIssue[];
  
  // 智能修复
  autoFix(issues: ComplianceIssue[]): PlanVersion;
}
```

#### 2.4.2 模板库系统
```typescript
interface PlanTemplate {
  id: string;
  name: string;
  category: "residential" | "office" | "healthcare" | "retail";
  subtype: string;  // "1br", "2br", "studio" etc
  baseVersion: PlanVersion;
  parametric: {
    adjustableParams: Array<{
      name: string;
      type: "length" | "area" | "count";
      min: number;
      max: number;
      default: number;
    }>;
  };
}
```

## 三、UI组件设计

### 3.1 统一输入面板
```typescript
<PlanInputPanel>
  <InputModeSelector 
    modes={["ai", "manual", "upload", "template"]}
    active={mode}
  />
  
  {mode === "ai" && <AIGenerationForm />}
  {mode === "manual" && <ManualDrawingCanvas />}
  {mode === "upload" && <FileUploadZone />}
  {mode === "template" && <TemplateGallery />}
</PlanInputPanel>
```

### 3.2 高级绘图画布
```typescript
<ManualDrawingCanvas
  mode={drawingMode}
  snap={{ grid: true, angle: 15, distance: 0.5 }}
  tools={{
    rectangle: true,
    polygon: true,
    wall: true,
    opening: true,
    dimension: true
  }}
  onShortcut={(key) => handleShortcut(key)}
/>
```

### 3.3 房间编辑器
```typescript
<RoomEditor
  room={selectedRoom}
  transform={{
    move: true,
    rotate: true,
    scale: true,
    mirror: true
  }}
  constraints={{
    minArea: 10,
    maxArea: 100,
    snapToGrid: true
  }}
  onChange={updateRoom}
/>
```

## 四、快捷键系统

```typescript
const shortcuts: Record<string, Command> = {
  // 绘制模式
  "R": "draw_rectangle",
  "P": "draw_polygon",
  "W": "draw_wall",
  "D": "add_door",
  "Win": "add_window",
  
  // 编辑操作
  "M": "move",
  "S": "scale",
  "Ctrl+R": "rotate",
  "Ctrl+D": "duplicate",
  "Delete": "delete",
  
  // 选择
  "A": "select_all",
  "Ctrl+A": "select_all",
  "Esc": "deselect",
  
  // 对齐
  "Ctrl+L": "align_left",
  "Ctrl+E": "align_center",
  "Ctrl+R": "align_right",
  
  // 视图
  "F": "fit_to_view",
  "Ctrl+0": "reset_zoom",
  "Ctrl++": "zoom_in",
  "Ctrl+-": "zoom_out",
  
  // 撤销重做
  "Ctrl+Z": "undo",
  "Ctrl+Y": "redo",
  "Ctrl+Shift+Z": "redo"
};
```

## 五、实施计划

### Phase 1: 手动绘制增强（1周）
- [ ] 实现矩形房间绘制工具
- [ ] 实现多边形房间绘制工具
- [ ] 添加网格吸附功能
- [ ] 添加快捷键系统

### Phase 2: 交互式编辑（1周）
- [ ] 实现房间选择系统
- [ ] 实现移动/缩放/旋转操作
- [ ] 添加编辑手柄UI
- [ ] 实现撤销/重做栈

### Phase 3: 墙体编辑（1周）
- [ ] 实现墙体绘制工具
- [ ] 实现门窗交互式添加
- [ ] 墙体修剪/延伸功能
- [ ] 墙体智能吸附

### Phase 4: 文件导入增强（1周）
- [ ] DXF导入选项UI
- [ ] PDF矢量提取
- [ ] Excel房间表导入
- [ ] 导入预览与校准

### Phase 5: 智能辅助（1周）
- [ ] 自动识别封闭空间
- [ ] 缺失元素建议
- [ ] 实时合规检查
- [ ] 自动修复功能

### Phase 6: 模板系统（1周）
- [ ] 模板库设计
- [ ] 参数化模板引擎
- [ ] 模板预览与应用
- [ ] 用户自定义模板

## 六、技术要点

### 6.1 性能优化
- 使用Canvas进行大规模绘制
- 空间索引（R-Tree）加速碰撞检测
- 虚拟化渲染（只渲染可见区域）
- Web Worker处理复杂几何运算

### 6.2 用户体验
- 实时预览（每个操作都有预览）
- 操作提示（工具提示、引导线）
- 错误容忍（自动修复小偏差）
- 渐进式披露（基础→高级功能）

### 6.3 数据一致性
- 每个输入方式都转换为统一的RecognizedPlanGraph
- 统一验证管线确保质量
- 版本控制追踪每次修改
- 自动保存避免数据丢失

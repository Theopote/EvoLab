# Import/Trace Module - 技术文档

> **状态**: ✅ 基础架构已完成  
> **优先级**: P0-1 (必须最先做的能力)  
> **完成日期**: 2026-06-28

---

## 概述

Import/Trace模块是EvoLab的核心入口功能之一，允许建筑师从现有资料（图片、PDF、DXF）快速启动项目，而不是从空白画布开始。这符合真实工作流：方案设计通常基于旧图、参考案例或手绘草图。

## 架构设计

### 工作流程

```
上传文件 → 标定比例 → 描摹元素 → 转换为项目
  ↓          ↓           ↓            ↓
Upload   Calibrate    Trace      Convert
```

### 核心概念

1. **ImportSession**: 导入会话，贯穿整个流程
2. **Calibration**: 校正图片比例、旋转、偏移
3. **Trace**: 半自动或AI辅助描摹建筑元素
4. **Conversion**: 转换为EvoLab的PlanVersion格式

---

## 技术实现

### 1. 类型系统 (`lib/import-types.ts`)

完整的TypeScript接口定义：

```typescript
// 核心类型
export type ImportSourceType = "image" | "pdf" | "dxf" | "sketch";

// 导入源
export interface ImportSource {
  id: string;
  type: ImportSourceType;
  fileName: string;
  fileSize: number;
  uploadedAt: string;
  base64?: string;
  metadata?: ImportMetadata;
}

// 标定点
export interface CalibrationPoint {
  pixel: [number, number];  // 像素坐标
  world: [number, number];  // 世界坐标
  label?: string;
}

// 标定结果
export interface ImportCalibration {
  points: CalibrationPoint[];
  scale: number;      // 比例因子
  rotation: number;   // 旋转角度（度）
  offset: [number, number];  // 平移偏移
  unit: "mm" | "m" | "ft" | "in";
}

// 描摹元素
export interface TracedElement {
  id: string;
  type: "wall" | "room" | "opening" | "reference";
  points: [number, number][];
  closed?: boolean;
  label?: string;
  confidence?: number;  // AI检测置信度 0-1
}
```

### 2. API端点

#### `/api/import-upload` (POST)

上传文件并提取元数据。

**请求**:
```typescript
{
  fileBase64: string;
  fileName: string;
  sourceType: "image" | "pdf" | "dxf" | "sketch";
  selectedPage?: number;  // PDF专用
}
```

**功能**:
- Magic bytes验证（PNG: 0x89504E47, JPEG: 0xFFD8FF）
- 图片尺寸检测（PNG从字节16-23读取，JPEG扫描SOF0标记）
- DXF基础验证（检查SECTION和ENTITIES标记）
- 生成会话ID: `import_${timestamp}_${random}`

**响应**:
```typescript
{
  sessionId: string;
  source: ImportSource;
  metadata: ImportMetadata;
}
```

#### `/api/import-calibrate` (POST)

计算标定参数。

**请求**:
```typescript
{
  sessionId: string;
  points: CalibrationPoint[];  // 2-10个标定点
  unit: "mm" | "m" | "ft" | "in";
}
```

**算法**:
- 2点: 直接计算比例和旋转
- 3+点: 最小二乘法平均（简化版）
- 比例 = 世界距离 / 像素距离
- 旋转 = arctan2(世界向量) - arctan2(像素向量)
- 偏移 = 世界坐标 - (旋转后的缩放像素坐标)

**响应**:
```typescript
{
  calibration: ImportCalibration;
  success: boolean;
}
```

#### `/api/import-trace` (POST)

执行描摹（手动/半自动/AI）。

**请求**:
```typescript
{
  sessionId: string;
  mode: "manual" | "semi-auto" | "ai";
  hints?: {
    expectedRoomCount?: number;
    buildingType?: string;
    includeOpenings?: boolean;
  };
}
```

**模式**:
- `manual`: 返回空结果，由用户手绘
- `semi-auto`: 图像处理算法（边缘检测、直线检测）
- `ai`: Anthropic Vision API识别（当前为mock实现）

**响应**:
```typescript
{
  trace: TraceResult;
  suggestedOutline?: [number, number][];
  warnings?: string[];
}
```

#### `/api/import-convert` (POST)

转换为EvoLab项目。

**请求**:
```typescript
{
  sessionId: string;
  projectName: string;
  projectType: string;
  applyTrace: boolean;
}
```

**功能**:
- 使用标定参数将归一化坐标转为世界坐标
- 转换TracedElement为PlanVersion格式
- 生成outline和rooms数组

**响应**:
```typescript
{
  outline: [number, number][];
  rooms?: Array<{ polygon: [number, number][]; label?: string }>;
  success: boolean;
}
```

---

## UI组件

### 状态管理 (`lib/store/import-slice.ts`)

使用Zustand管理导入流程状态：

```typescript
interface ImportState {
  session: ImportSession | null;
  currentStep: "upload" | "calibrate" | "trace" | "convert";
  isProcessing: boolean;
  error: string | null;
  calibrationPoints: CalibrationPoint[];
  calibrationUnit: "mm" | "m" | "ft" | "in";
  traceMode: "manual" | "semi-auto" | "ai";
  manualElements: Array<{...}>;
}
```

### 组件结构

```
ImportWorkspace (主容器)
├── ImportUploadPanel (上传)
├── ImportCalibratePanel (标定)
├── ImportTracePanel (描摹)
└── ImportConvertPanel (转换)
```

#### 1. ImportUploadPanel

**功能**:
- 拖拽上传 + 文件选择
- 自动检测文件类型（.png/.jpg/.pdf/.dxf）
- Base64编码并调用upload API
- 成功后自动进入标定步骤

#### 2. ImportCalibratePanel

**功能**:
- Canvas显示图片
- 点击添加标定点
- 输入对应世界坐标
- 单位选择（mm/m/ft/in）
- 实时绘制标定点（蓝色圆点）
- 计算并显示标定结果

**交互**:
1. 用户点击图片 → 红色待定标记
2. 输入世界坐标 → 添加为蓝色标定点
3. 至少2个点 → 启用"计算标定"按钮
4. 可选"跳过标定"直接进入描摹

#### 3. ImportTracePanel

**功能**:
- 模式切换：手动 / AI辅助
- 手动模式：点击绘制墙体或房间
- AI模式：调用AI API自动识别
- 实时Canvas渲染：
  - 手动元素：蓝色（墙体）、绿色（房间）
  - AI结果：红色虚线
  - 当前绘制：橙色

**交互**:
- 手动：点击添加点 → "完成绘制" → 添加到元素列表
- AI：点击"开始AI识别" → 显示检测结果（带置信度）
- 列表管理：查看/删除已绘制元素

#### 4. ImportConvertPanel

**功能**:
- 输入项目名称和类型
- 选择是否应用描摹结果
- 显示导入信息摘要
- 转换成功后显示成功页面

**流程**:
1. 填写项目信息
2. 调用convert API
3. 成功 → 显示"进入编辑器"按钮
4. 失败 → 显示错误并允许重试

---

## 关键技术点

### 1. Magic Bytes验证

防止文件类型伪装攻击：

```typescript
const IMAGE_MAGIC_BYTES = {
  png: [0x89, 0x50, 0x4e, 0x47],   // %PNG
  jpeg: [0xff, 0xd8, 0xff]         // ÿØÿ
};

function validateImageMagicBytes(buffer: Buffer, type: string): boolean {
  const magicBytes = IMAGE_MAGIC_BYTES[type];
  for (let i = 0; i < magicBytes.length; i++) {
    if (buffer[i] !== magicBytes[i]) return false;
  }
  return true;
}
```

### 2. 图片尺寸检测

从二进制头部提取尺寸，无需解码整个图片：

```typescript
// PNG: bytes 16-19 = width, 20-23 = height (big endian)
const width = buffer.readUInt32BE(16);
const height = buffer.readUInt32BE(20);

// JPEG: 扫描SOF0标记 (0xFF 0xC0)
for (let i = 0; i < buffer.length - 9; i++) {
  if (buffer[i] === 0xff && buffer[i + 1] === 0xc0) {
    const height = buffer.readUInt16BE(i + 5);
    const width = buffer.readUInt16BE(i + 7);
    return { width, height };
  }
}
```

### 3. 标定算法

```typescript
// 2点标定：直接计算
const pixelDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
const worldDist = Math.hypot(w2.x - w1.x, w2.y - w1.y);
const scale = worldDist / pixelDist;

const pixelAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
const worldAngle = Math.atan2(w2.y - w1.y, w2.x - w1.x);
const rotation = (worldAngle - pixelAngle) * (180 / Math.PI);

// 多点标定：最小二乘法（简化为平均）
```

### 4. Canvas实时绘制

```typescript
function redrawCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  // 绘制标定点
  calibrationPoints.forEach(point => {
    ctx.fillStyle = "#3B82F6";
    ctx.beginPath();
    ctx.arc(point.pixel[0], point.pixel[1], 6, 0, 2 * Math.PI);
    ctx.fill();
  });

  // 绘制描摹元素
  manualElements.forEach(element => {
    ctx.strokeStyle = element.type === "wall" ? "#3B82F6" : "#10B981";
    ctx.lineWidth = 2;
    ctx.beginPath();
    element.points.forEach((point, i) => {
      if (i === 0) ctx.moveTo(point[0], point[1]);
      else ctx.lineTo(point[0], point[1]);
    });
    ctx.stroke();
  });
}
```

---

## 可访问性

所有组件遵循WCAG 2.1标准：

```typescript
// Canvas
<canvas
  role="img"
  aria-label={`标定画布，当前有${calibrationPoints.length}个标定点`}
/>

// Form inputs
<label htmlFor="calibration-unit">单位</label>
<select id="calibration-unit" ...>

// Buttons
<button aria-label="删除标定点">✕</button>
```

---

## 后续开发任务

### 已完成 ✅
- [x] 类型系统定义
- [x] 4个API端点实现
- [x] Zustand状态管理
- [x] 5个UI组件
- [x] Canvas绘制逻辑
- [x] 表单验证

### 待实现 🚧

#### 短期（1-2周）
- [ ] 真实AI Vision集成（Anthropic API）
- [ ] PDF多页预览与选择
- [ ] DXF解析库集成（dxf-parser）
- [ ] 半自动描摹（OpenCV.js边缘检测）
- [ ] 会话持久化（IndexedDB/localStorage）
- [ ] 与主编辑器集成

#### 中期（3-4周）
- [ ] 导入历史记录
- [ ] 批量导入
- [ ] 导入模板保存
- [ ] 描摹结果优化（拟合、简化）
- [ ] 导出为DXF/PDF

#### 长期（未来迭代）
- [ ] 智能图层识别
- [ ] 多楼层PDF批量处理
- [ ] 3D扫描点云导入
- [ ] 协作标定（多人同时标定）

---

## 集成示例

### 在主应用中使用

```typescript
import { ImportWorkspace } from "@/components/import/ImportWorkspace";

export default function ImportPage() {
  return <ImportWorkspace />;
}
```

### API调用示例

```typescript
// 上传
const uploadResponse = await fetch("/api/import-upload", {
  method: "POST",
  body: JSON.stringify({
    fileBase64: base64String,
    fileName: "plan.png",
    sourceType: "image"
  })
});

// 标定
const calibrateResponse = await fetch("/api/import-calibrate", {
  method: "POST",
  body: JSON.stringify({
    sessionId: "import_123_abc",
    points: [
      { pixel: [100, 100], world: [0, 0] },
      { pixel: [500, 100], world: [10000, 0] }
    ],
    unit: "mm"
  })
});
```

---

## 性能考虑

1. **大图片处理**: Canvas自动缩放，避免内存溢出
2. **Base64编码**: 前端进行，减少服务器压力
3. **文件大小限制**: 继承自`MAX_IMPORT_BYTES`
4. **API超时**: 默认45秒，可配置

---

## 安全性

1. **Magic bytes验证**: 防止文件类型伪装
2. **Zod schema验证**: 所有API输入验证
3. **文件大小限制**: 防止DoS攻击
4. **Base64长度检查**: 防止内存攻击
5. **Session ID生成**: 包含时间戳和随机数，避免碰撞

---

## 测试策略

### 单元测试
- [ ] 标定算法（2点、多点）
- [ ] 坐标转换（像素↔世界）
- [ ] Magic bytes验证
- [ ] 图片尺寸检测

### 集成测试
- [ ] 完整导入流程
- [ ] API端点错误处理
- [ ] 会话状态管理

### E2E测试
- [ ] 用户上传→标定→描摹→转换
- [ ] 不同文件格式（PNG/JPEG/PDF/DXF）
- [ ] 错误场景（无效文件、超大文件）

---

*文档版本: v1.0*  
*最后更新: 2026-06-28*  
*维护者: EvoLab开发团队*

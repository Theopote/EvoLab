# Presentation 功能模块 - 技术文档

> **状态**: ✅ 核心功能已完成  
> **优先级**: P0-5 (方案阶段表达中心)  
> **最后检查**: 2026-06-28

---

## 概述

Presentation模块是EvoLab的核心输出功能，自动生成设计汇报材料。建筑师可以一键导出包含设计概念、功能分区、流线说明、方案对比的完整PPT/PDF，无需手动整理图文。

**核心价值**: "让建筑师能用EvoLab直接生成'拿去讲'的材料"

---

## 已实现功能 ✅

### 1. AI驱动的Storyboard生成

**API端点**: `/api/generate-storyboard`

自动生成包含以下内容的完整叙事：

- **Story Arc**: 4-8个章节标签，串联整个汇报逻辑
- **Slide Copy**: 为每张幻灯片生成标题、副标题、要点
- **Design Narrative**: 4-8条设计总结，用于结束页

**AI Prompt策略** (`lib/prompts/presentationNarrativePrompt.ts`):
- 反映多方案演进（当存在version evolution时）
- 提及造价和性能权衡
- 专业语调，无营销废话
- 不编造数据，基于实际输入

**输入数据**:
```typescript
{
  project: ProjectData,
  version: PlanVersion,
  brief?: DesignBrief,
  siteContext?: SiteContext,
  envelope?: BuildableEnvelope,
  environmentSurrogate?: EnvironmentSurrogate
}
```

### 2. 自动生成的幻灯片类型

#### 核心幻灯片

1. **Cover (封面)**
   - 项目名称、类型、方案版本
   - 设计简介
   - 性能评分汇总

2. **Site (场地分析)**
   - 场地地址和周边建筑统计
   - 数据来源说明
   - 建筑控制线和容积率（如果有zoning）
   - 环境图表（环境代理数据可视化）

3. **Evolution (方案演进)**
   - 多方案版本对比表格
   - 演进叙事（自动总结）
   - 演进示意图

4. **Topology (空间拓扑)**
   - 空间连接关系图
   - 拓扑评分（连通性、集中度、平衡性）
   - 可视化图形

5. **Massing (体量研究)**
   - 轴测爆炸图
   - 体量描述（楼层数、总面积、建筑高度）
   - 等轴测投影图

6. **Plan (平面方案)**
   - 平面SVG
   - 楼层列表
   - 空间组织说明

7. **Zones (功能分区)**
   - 分区色块图
   - 各功能区面积和房间数
   - 分区策略说明

8. **Flow (流线组织)**
   - 流线示意图
   - 类型化流线策略（healthcare/office/residential）
   - 垂直交通和水平动线说明

9. **Facade (立面策略)**
   - 立面分区图
   - 开窗策略和朝向响应
   - 外围护结构说明

10. **Systems (机电系统)**
    - 竖井和设备房布置
    - 服务逻辑
    - 系统示意图

11. **Compare (方案比选)**
    - 多方案并排对比
    - 关键指标对比表
    - AI生成的比较说明

12. **Quantities (面积指标)**
    - 面积统计表（总面积、净面积、公摊）
    - 各楼层面积分解
    - 容积率和建筑密度

13. **Cost (造价估算)**
    - 成本估算表
    - 分项造价（土建、装修、机电、其他）
    - 单位成本和总成本

14. **Narrative (设计叙事)**
    - AI生成的设计总结
    - 关键设计决策
    - 后续建议

### 3. PPTX导出

**API端点**: `/api/export-presentation-pptx`

**实现**: `lib/presentation/render-pptx.ts`

**功能**:
- 使用`pptxgenjs`生成标准PowerPoint文件
- 支持两套模板：classic / studio
- 自动布局：标题、副标题、要点、图表、表格、图片网格
- 响应式图片布局（2-6张图片自动网格排列）
- SVG图表转换为PNG嵌入
- 表格自动格式化（交替行颜色、对齐）

**模板系统** (`lib/presentation/templates.ts`):
```typescript
const classicTemplate = {
  pptx: {
    titleBackground: "1E293B",
    titleText: "FFFFFF",
    titleMuted: "94A3B8",
    contentBackground: "F8FAFC",
    headingText: "1E293B",
    bodyText: "475569",
    muted: "94A3B8",
    accent: "3B82F6"
  }
};
```

### 4. PDF导出

**API端点**: `/api/export-presentation-pdf`

通过Puppeteer将HTML渲染为PDF，支持完整排版和样式。

### 5. 图表生成引擎

**位置**: `lib/presentation/diagrams/*.ts`

**已实现图表**:
- `renderEvolutionDiagram`: 方案演进图（多个方案的轮廓叠加）
- `renderTopologyDiagram`: 拓扑关系图（房间节点+连接边）
- `renderIsometricDiagram`: 等轴测投影（3D体量）
- `renderExplodedDiagram`: 爆炸轴测（楼层分解）
- `renderZoneDiagram`: 功能分区色块图
- `renderFlowDiagram`: 流线示意图（主入口、垂直交通、水平动线）
- `renderFacadeDiagram`: 立面分区图
- `renderSystemsDiagram`: 机电系统布置图
- `renderEnvironmentDiagram`: 环境分析图（场地、建筑、道路）

所有图表均为SVG格式，分辨率无关，可无损缩放。

### 6. 智能内容生成

#### 流线说明（类型化）

根据建筑类型生成专业流线说明：

**Healthcare**:
- 医患分离动线
- 洁污分离物流
- 急诊快速通道
- 无障碍路径

**Office**:
- 访客与员工动线
- 核心筒布局
- 垂直交通效率

**Residential**:
- 入户流线
- 公共空间可达性
- 消防疏散

#### 方案比选说明

自动比较多个方案的：
- 面积效率
- 流线质量
- 采光得分
- 造价差异

---

## 技术架构

### 数据流

```
ProjectData + PlanVersion
  ↓
buildPresentationDeck() → PresentationDeck
  ↓
generate-storyboard API (Anthropic) → AI叙事
  ↓
applySlideCopy() → 更新幻灯片文案
  ↓
export-presentation-pptx → PPTX文件
```

### 核心类型

```typescript
interface PresentationDeck {
  projectName: string;
  projectType: string;
  versionLabel: string;
  generatedAt: string;
  templateId?: "classic" | "studio";
  storyArc?: string[];          // AI生成的章节标签
  designNarrative?: string[];   // AI生成的设计总结
  slides: PresentationSlide[];
}

interface PresentationSlide {
  id: string;
  kind: "cover" | "site" | "evolution" | ...;
  title: string;
  subtitle?: string;
  bullets: string[];
  svg?: string;                 // SVG图表
  images?: Array<{              // 参考图片（如ControlNet depth/line）
    id: string;
    label: string;
    dataUrl: string;
  }>;
  table?: {                     // 数据表格
    headers: string[];
    rows: string[][];
  };
}
```

### Zod验证

所有API输入输出均有Zod schema验证：
- `PresentationSlideKindSchema`
- `PresentationSlideCopySchema`
- `GenerateStoryboardToolInputSchema`
- `PresentationSlideSchema`
- `PresentationDeckSchema`

---

## UI组件

### RenderBriefPanel

**位置**: `components/presentation/RenderBriefPanel.tsx`

**功能**:
- 可视化渲染配置（材质、光照、相机视角）
- ControlNet参考导出（深度图、线稿）
- 渲染简报复制（用于外部AI图像工具）
- 3D预览联动

**用途**: 为外部渲染工具（Stable Diffusion, DALL-E等）生成prompt和参考图

### DeliverPresentationView（推测存在）

完整的Presentation生成和导出界面。

---

## 使用流程

### 1. 生成Presentation

```typescript
const response = await fetch("/api/generate-storyboard", {
  method: "POST",
  body: JSON.stringify({
    project: projectData,
    version: activePlanVersion,
    brief: designBrief,
    siteContext: siteContext,
    outline: outline
  })
});

const { deck, storyArc } = await response.json();
```

### 2. 导出PPTX

```typescript
const response = await fetch("/api/export-presentation-pptx", {
  method: "POST",
  body: JSON.stringify({ deck })
});

const blob = await response.blob();
const url = URL.createObjectURL(blob);
const a = document.createElement("a");
a.href = url;
a.download = "presentation.pptx";
a.click();
```

### 3. 导出PDF

```typescript
const response = await fetch("/api/export-presentation-pdf", {
  method: "POST",
  body: JSON.stringify({ deck })
});

const blob = await response.blob();
// 下载或预览
```

---

## 性能优化

### 1. 图表缓存

SVG图表生成较慢，可在客户端缓存：

```typescript
const svgCache = useMemo(() => {
  return renderZoneDiagram(version);
}, [version.rooms, version.zones]);
```

### 2. 增量更新

只重新生成修改的幻灯片，而不是整个deck。

### 3. 后台生成

大型项目的presentation生成可以异步化，使用任务队列。

---

## 与P0-5目标对比

| P0-5需求 | 实现状态 | 说明 |
|---------|---------|------|
| 自动生成设计概念说明 | ✅ 已实现 | AI生成storyArc和narrative |
| 自动生成功能分区说明 | ✅ 已实现 | Zones slide with AI copy |
| 自动生成流线说明 | ✅ 已实现 | Flow slide with typology-specific copy |
| 自动生成多方案对比文字 | ✅ 已实现 | Compare slide with AI narrative |
| 汇总体量/立面/结构/MEP说明 | ✅ 已实现 | Massing/Facade/Systems slides |
| 一键导出PDF/PPT初稿 | ✅ 已实现 | export-presentation-pptx/pdf APIs |

**结论**: Presentation功能已经完全满足P0-5要求！

---

## 待增强功能（非P0）

### 短期优化
- [ ] 更多模板选项（minimal / technical / artistic）
- [ ] 用户自定义模板上传
- [ ] 幻灯片排序拖拽
- [ ] 单张幻灯片重新生成
- [ ] 演讲备注自动生成

### 中期增强
- [ ] 动画效果配置
- [ ] 视频嵌入支持
- [ ] 多语言输出（英文/中文切换）
- [ ] 品牌资产库（Logo、字体、配色）
- [ ] 协作评论（幻灯片级别）

### 长期迭代
- [ ] 交互式Web演示（无需下载PPT）
- [ ] AI语音解说生成
- [ ] 实时协作编辑
- [ ] 版本历史和回滚

---

## 测试建议

### 单元测试
- [ ] 各类图表渲染函数
- [ ] 表格格式化逻辑
- [ ] 模板颜色解析
- [ ] SVG到PNG转换

### 集成测试
- [ ] 完整deck生成流程
- [ ] AI storyboard生成（含fallback）
- [ ] PPTX导出完整性
- [ ] PDF导出样式一致性

### E2E测试
- [ ] 从项目到PPTX下载
- [ ] 多方案对比presentation
- [ ] 不同建筑类型的流线说明
- [ ] 大型项目（>50个房间）性能

---

## API参考

### POST /api/generate-storyboard

生成presentation deck和AI叙事。

**请求**:
```json
{
  "project": ProjectData,
  "version": PlanVersion,
  "brief": DesignBrief,
  "siteContext": SiteContext,
  "zoning": ZoningConstraints,
  "outline": [[x, y], ...],
  "environmentSurrogate": EnvironmentSurrogate
}
```

**响应**:
```json
{
  "deck": PresentationDeck,
  "storyArc": string[],
  "fallback": boolean,
  "warning": string
}
```

### POST /api/export-presentation-pptx

导出PPTX文件。

**请求**:
```json
{
  "deck": PresentationDeck
}
```

**响应**: Binary PPTX file download

### POST /api/export-presentation-pdf

导出PDF文件。

**请求**:
```json
{
  "deck": PresentationDeck
}
```

**响应**: Binary PDF file download

---

## 关键文件

| 文件路径 | 职责 |
|---------|------|
| `app/api/generate-storyboard/route.ts` | Storyboard生成API |
| `app/api/export-presentation-pptx/route.ts` | PPTX导出API |
| `app/api/export-presentation-pdf/route.ts` | PDF导出API |
| `lib/presentation/storyboard.ts` | Deck构建核心逻辑 |
| `lib/presentation/render-pptx.ts` | PPTX渲染引擎 |
| `lib/presentation/diagrams/*.ts` | 各类图表生成 |
| `lib/presentation/templates.ts` | 模板系统 |
| `lib/prompts/presentationNarrativePrompt.ts` | AI prompt |
| `lib/schemas/presentation-schema.ts` | Zod验证 |
| `components/presentation/RenderBriefPanel.tsx` | 渲染配置UI |

---

## 安全性

1. **Zod验证**: 所有API输入验证
2. **文件大小限制**: PPTX/PDF生成有大小限制
3. **SVG注入防护**: SVG内容经过清理
4. **AI输出验证**: GenerateStoryboardToolInputSchema确保AI输出合规

---

## 可访问性

- [ ] PPTX中添加Alt text for images
- [ ] PDF导出确保语义化标签
- [ ] 高对比度模板选项
- [ ] 表格正确使用header row

---

*文档版本: v1.0*  
*最后更新: 2026-06-28*  
*结论: Presentation功能已完整实现P0-5目标*

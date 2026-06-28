# Presentation Studio - 独立演示文稿编辑器

> **状态**: ✅ 完整架构已实现  
> **开发日期**: 2026-06-28  
> **类型**: 新功能模块

---

## 概述

Presentation Studio 是 EvoLab 的独立演示文稿编辑器，提供 AI 辅助的大纲生成、逐页内容编辑、手动调整等功能。可以独立使用，也可以从 EvoLab 项目导入数据。

**核心价值**: "让建筑师能用 AI + 手动混合方式，快速制作专业演示文稿"

---

## 功能特性

### ✅ 已实现功能

#### 1. 独立工作模式
- ✅ 不依赖项目数据，可从零开始
- ✅ AI 生成演示文稿大纲
- ✅ 手动创建空白大纲
- ✅ 文档持久化存储（Zustand persist）

#### 2. AI 辅助大纲生成
- ✅ 输入主题自动生成结构
- ✅ 章节分组和幻灯片规划
- ✅ 智能推荐幻灯片类型
- ✅ 可定制页数（5-30页）

#### 3. 逐页内容生成
- ✅ 单张幻灯片独立生成
- ✅ 批量生成全部内容
- ✅ 基于上下文保持连贯性
- ✅ 支持多种幻灯片类型

#### 4. 灵活编辑模式
- ✅ 视图模式：查看格式化内容
- ✅ 编辑模式：直接修改文字
- ✅ AI 修改：自然语言指令优化
- ✅ 手动调整：完全控制

#### 5. 项目集成
- ✅ 从 EvoLab 项目导入
- ✅ 复用现有 Presentation 模块的幻灯片
- ✅ 转换为可编辑格式
- ✅ Append 或创建新文档

#### 6. 状态管理
- ✅ Zustand store 管理文档
- ✅ 本地持久化
- ✅ 多文档支持
- ✅ 撤销/重做准备

---

## 技术架构

### 数据模型

```typescript
// 核心类型
interface PresentationDocument {
  id: string;
  title: string;
  subtitle?: string;
  
  projectId?: string;           // 可选：关联项目
  projectVersionId?: string;
  
  outline: PresentationOutline; // 大纲
  slides: StudioSlide[];        // 幻灯片内容
  
  theme?: "classic" | "modern" | "minimal" | "dark";
  aspectRatio?: "16:9" | "4:3";
  
  status: "draft" | "in-progress" | "completed";
}

// 幻灯片
interface StudioSlide {
  id: string;
  order: number;
  type: SlideContentType;       // 11种类型
  status: SlideStatus;          // 5种状态
  
  // 内容
  title?: string;
  subtitle?: string;
  content?: string;             // Markdown支持
  bullets?: string[];
  notes?: string;               // 演讲备注
  
  // 媒体
  imageUrl?: string;
  imageCaption?: string;
  
  // 元数据
  generatedBy?: "ai" | "manual" | "project";
  lastEditedAt: string;
}
```

### 幻灯片类型

支持11种内容类型：

1. **title** - 标题页
2. **content** - 文字内容页
3. **image** - 图片页
4. **image-text** - 图文混排
5. **two-column** - 双栏对比
6. **quote** - 引用强调
7. **data-viz** - 数据可视化
8. **comparison** - 对比分析
9. **timeline** - 时间线
10. **process** - 流程图
11. **blank** - 空白自定义

### 幻灯片状态

5种状态追踪：

1. **draft** - 草稿（大纲阶段）
2. **generating** - AI生成中
3. **generated** - AI已生成
4. **edited** - 手动编辑过
5. **finalized** - 最终确定

---

## API端点

### 1. POST /api/studio/generate-outline

生成演示文稿大纲。

**请求**:
```typescript
{
  topic: string,                // 主题（必需）
  purpose?: string,             // 目的
  targetAudience?: string,      // 目标受众
  slideCount?: number,          // 页数（5-30）
  keyPoints?: string[],         // 关键要点
  
  projectId?: string,           // 可选：从项目生成
  versionId?: string
}
```

**响应**:
```typescript
{
  outline: PresentationOutline,
  suggestions?: string[]        // AI建议
}
```

**AI Prompt**: `generateOutlinePrompt`

### 2. POST /api/studio/generate-slide

生成单张幻灯片内容。

**请求**:
```typescript
{
  presentationId: string,
  slideId: string,
  outlineItem: OutlineSlideItem,
  previousSlide?: StudioSlide,  // 上一页（保持连贯）
  
  tone?: "professional" | "casual" | "technical",
  length?: "brief" | "moderate" | "detailed",
  includeImage?: boolean
}
```

**响应**:
```typescript
{
  slide: StudioSlide,
  alternatives?: Partial<StudioSlide>[]  // 其他版本
}
```

**AI Prompt**: `generateSlideContentPrompt`

### 3. POST /api/studio/modify-slide

修改现有幻灯片。

**请求**:
```typescript
{
  presentationId: string,
  slideId: string,
  currentSlide: StudioSlide,
  userRequest: string,          // "把标题改短一点"
  mode?: "refine" | "regenerate"
}
```

**响应**:
```typescript
{
  slide: StudioSlide,
  changes?: string[]            // 改动说明
}
```

**AI Prompt**: `modifySlidePrompt`

### 4. POST /api/studio/batch-generate

批量生成多张幻灯片。

**请求**:
```typescript
{
  presentationId: string,
  slideIds: string[],           // 1-20个
  options?: {
    tone?: string,
    includeImages?: boolean
  }
}
```

**响应**:
```typescript
{
  slides: StudioSlide[],
  errors?: Array<{ slideId: string; error: string }>
}
```

### 5. POST /api/studio/import-from-project

从EvoLab项目导入。

**请求**:
```typescript
{
  projectId: string,
  versionId: string,
  includeSlides?: string[],     // 选择要包含的幻灯片类型
  mode: "create" | "append",
  targetPresentationId?: string // append模式必需
}
```

**响应**:
```typescript
{
  presentationId: string,
  importedSlideIds: string[],
  outline: PresentationOutline
}
```

---

## UI组件

### 组件结构

```
PresentationStudioWorkspace (主容器)
├── OutlineEditor (大纲编辑)
│   ├── Section headers (可折叠)
│   ├── Slide items (可排序)
│   └── Add/Delete controls
├── SlideEditor (单页编辑)
│   ├── View mode (预览)
│   ├── Edit mode (直接编辑)
│   └── AI modify panel (AI指令)
└── Preview (预览模式 - TODO)
```

### 1. OutlineEditor

**功能**:
- 显示章节和幻灯片层级结构
- 拖拽排序（使用GripVertical图标）
- 编辑幻灯片标题
- 单独生成或批量生成
- 删除幻灯片
- 添加新幻灯片

**交互**:
```typescript
<OutlineEditor
  outline={outline}
  onUpdateOutline={(outline) => ...}
  onGenerateSlide={(slideId) => ...}
  onGenerateAll={() => ...}
  selectedSlideId={activeSlideId}
  onSelectSlide={(id) => ...}
/>
```

### 2. SlideEditor

**功能**:
- **View模式**: 格式化显示内容
- **Edit模式**: 直接修改标题/内容/备注
- **AI修改**: 输入自然语言指令
- 快速示例：改短标题、更详细、更专业
- 状态徽章显示（draft/generating/generated/edited/finalized）

**交互**:
```typescript
<SlideEditor
  slide={slide}
  onUpdateSlide={(updates) => ...}
  onAIModify={(request) => ...}
  onSave={() => ...}
  isModifying={isGenerating}
/>
```

### 3. PresentationStudioWorkspace

**功能**:
- 顶部工具栏：视图切换、导出PPTX
- 左侧边栏：大纲导航（可折叠）
- 主编辑区：根据viewMode显示不同内容
- 初次使用：大纲生成引导

**视图模式**:
- `outline`: 大纲视图（提示选择幻灯片）
- `slide-editor`: 幻灯片编辑器
- `preview`: 预览模式（开发中）

---

## 状态管理

### Zustand Store

**位置**: `lib/presentation-studio/store.ts`

**核心状态**:
```typescript
interface PresentationStudioState {
  documents: PresentationDocument[];
  activeDocumentId: string | null;
  activeSlideId: string | null;
  
  viewMode: "outline" | "slide-editor" | "preview";
  sidebarOpen: boolean;
  isGenerating: boolean;
  generatingSlideIds: Set<string>;
}
```

**Actions**:
- 文档管理：create, delete, setActive, update
- 大纲管理：setOutline, reorderSlides
- 幻灯片管理：add, update, delete, duplicate
- 批量操作：batchUpdateSlides, setSlideStatus
- UI状态：setViewMode, setSidebarOpen, setGenerating

**持久化**:
```typescript
persist(
  (set, get) => ({ ... }),
  {
    name: "presentation-studio-storage",
    partialize: (state) => ({
      documents: state.documents,
      activeDocumentId: state.activeDocumentId
    })
  }
)
```

只持久化文档数据，UI状态不持久化。

---

## 使用流程

### 流程A：独立创建

```
1. 访问 /presentation-studio
   ↓
2. 输入主题 → AI生成大纲
   ↓
3. 审查大纲，调整章节和幻灯片
   ↓
4. 批量生成全部 或 逐页生成
   ↓
5. 单页编辑（View/Edit模式）
   ↓
6. AI修改优化（"把标题改短"）
   ↓
7. 导出PPTX
```

### 流程B：从项目导入

```
1. 在项目中选择 "导出演示文稿"
   ↓
2. 选择要包含的幻灯片类型
   ↓
3. 导入到Presentation Studio
   ↓
4. 转换为可编辑格式
   ↓
5. 继续编辑和优化
   ↓
6. 导出PPTX
```

### 流程C：混合工作

```
1. 从项目导入基础幻灯片（cover/site/plan等）
   ↓
2. 手动添加额外章节
   ↓
3. AI生成新增幻灯片内容
   ↓
4. 手动编辑项目导入的页面
   ↓
5. 导出完整PPTX
```

---

## AI Prompt策略

### 大纲生成

**目标**: 生成结构化、逻辑清晰的演示大纲

**关键规则**:
- 开始用title slide，结束用summary/narrative
- 每个section 2-5张幻灯片
- 使用多样化的幻灯片类型
- 匹配受众语气（technical vs. general）
- 覆盖所有keyPoints

### 单页内容生成

**目标**: 生成简洁、视觉友好的幻灯片内容

**关键规则**:
- 标题页：强标题 + 副标题
- 内容页：3-5个要点 或 2-3段落
- 图文页：简短文字 + 图片说明
- 保持连贯性（参考previousSlide）
- 根据tone和length调整

### 内容修改

**目标**: 根据用户指令精确修改内容

**模式**:
- `refine`: 增量改进（缩短、澄清、调整语气）
- `regenerate`: 完全重写（保持结构和目的）

**关键规则**:
- 不改动无关部分
- 保留核心信息
- 返回changes数组说明改动

---

## 与现有Presentation模块关系

### 复用的部分

1. **PPTX导出引擎** - `lib/presentation/render-pptx.ts`
   - 复用pptxgenjs生成逻辑
   - 复用模板系统

2. **幻灯片类型映射** - `lib/presentation/types.ts`
   - cover → title
   - site → content
   - compare → comparison
   - 等

3. **项目数据转换** - `lib/presentation/storyboard.ts`
   - buildPresentationDeck()生成幻灯片
   - 转换为StudioSlide格式

### 新增的部分

1. **逐页生成** - Studio特有
2. **单页AI修改** - Studio特有
3. **手动编辑器** - Studio特有
4. **独立大纲管理** - Studio特有
5. **文档持久化** - Studio特有

### 整合方式

```typescript
// 在项目Deliver工作区添加按钮
<button onClick={async () => {
  const response = await fetch("/api/studio/import-from-project", {
    method: "POST",
    body: JSON.stringify({
      projectId,
      versionId,
      mode: "create"
    })
  });
  
  const data = await response.json();
  window.location.href = `/presentation-studio?doc=${data.presentationId}`;
}}>
  在Studio中编辑
</button>
```

---

## 待实现功能

### 短期（1-2周）

- [ ] 预览模式完整实现
- [ ] 幻灯片拖拽排序（react-beautiful-dnd）
- [ ] 图片上传和管理
- [ ] 更多幻灯片模板
- [ ] 撤销/重做功能

### 中期（3-4周）

- [ ] 协作评论
- [ ] 版本历史
- [ ] 多主题支持（classic/modern/minimal/dark）
- [ ] 演讲备注增强
- [ ] 演讲计时器

### 长期

- [ ] 实时协作编辑
- [ ] 云端同步
- [ ] 移动端适配
- [ ] 视频嵌入
- [ ] 交互式图表

---

## 代码示例

### 创建新文档

```typescript
import { usePresentationStudio } from "@/lib/presentation-studio/store";

function MyComponent() {
  const { createDocument, setActiveDocument } = usePresentationStudio();
  
  const handleCreate = () => {
    const doc = createDocument("我的演示文稿");
    setActiveDocument(doc.id);
  };
  
  return <button onClick={handleCreate}>新建</button>;
}
```

### 生成大纲

```typescript
const response = await fetch("/api/studio/generate-outline", {
  method: "POST",
  body: JSON.stringify({
    topic: "医院建筑设计方案汇报",
    slideCount: 15,
    keyPoints: ["场地分析", "功能分区", "流线组织"]
  })
});

const { outline } = await response.json();
updateDocument(docId, { outline });
```

### AI修改幻灯片

```typescript
const response = await fetch("/api/studio/modify-slide", {
  method: "POST",
  body: JSON.stringify({
    presentationId: docId,
    slideId: slideId,
    currentSlide: slide,
    userRequest: "把这页的内容浓缩到3个要点",
    mode: "refine"
  })
});

const { slide: updatedSlide, changes } = await response.json();
console.log("改动:", changes);
```

---

## 性能优化

### 1. 增量生成

只生成用户需要的幻灯片，而非全部：

```typescript
// 用户点击"生成"按钮时才生成
onGenerateSlide(slideId);

// 而非自动生成全部
```

### 2. 本地缓存

Zustand persist自动缓存到localStorage，避免重复请求。

### 3. 批量优化

批量生成时，可以并行请求（注意API rate limit）：

```typescript
await Promise.all(
  slideIds.map(id => generateSlide(id))
);
```

---

## 安全性

1. **Zod验证**: 所有API输入验证
2. **文件大小限制**: 图片上传限制（TODO）
3. **XSS防护**: Markdown内容清理（TODO）
4. **Rate limiting**: API调用频率限制（TODO）

---

## 测试建议

### 单元测试
- [ ] Zustand store actions
- [ ] 幻灯片类型转换
- [ ] 大纲更新逻辑

### 集成测试
- [ ] 完整创建→生成→编辑→导出流程
- [ ] 项目导入
- [ ] AI生成质量

### E2E测试
- [ ] 用户创建演示文稿
- [ ] AI生成和手动编辑混合
- [ ] PPTX导出验证

---

## 路由和导航

| 路由 | 功能 |
|------|------|
| `/presentation-studio` | 主工作区 |
| `/presentation-studio/home` | 文档列表（TODO） |
| `/presentation-studio?doc=xxx` | 打开特定文档（TODO） |

---

## 关键文件清单

| 文件 | 职责 |
|------|------|
| `lib/presentation-studio/types.ts` | 类型定义和Zod schemas |
| `lib/presentation-studio/prompts.ts` | AI提示词 |
| `lib/presentation-studio/store.ts` | Zustand状态管理 |
| `app/api/studio/generate-outline/route.ts` | 大纲生成API |
| `app/api/studio/generate-slide/route.ts` | 单页生成API |
| `app/api/studio/modify-slide/route.ts` | 修改API |
| `app/api/studio/batch-generate/route.ts` | 批量生成API |
| `app/api/studio/import-from-project/route.ts` | 项目导入API |
| `components/presentation-studio/OutlineEditor.tsx` | 大纲编辑器 |
| `components/presentation-studio/SlideEditor.tsx` | 单页编辑器 |
| `components/presentation-studio/PresentationStudioWorkspace.tsx` | 主容器 |
| `app/presentation-studio/page.tsx` | 路由页面 |

---

*文档版本: v1.0*  
*最后更新: 2026-06-28*  
*状态: 基础架构完成，可开始测试*

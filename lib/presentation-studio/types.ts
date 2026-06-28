/**
 * Presentation Studio - 独立演示文稿编辑器类型定义
 * 支持AI辅助生成和手动编辑的混合工作流
 */

import { z } from "zod";

// ==================== 核心数据模型 ====================

/**
 * 幻灯片内容类型
 */
export type SlideContentType =
  | "title"           // 标题页
  | "content"         // 文字内容页
  | "image"           // 图片页
  | "image-text"      // 图文混排
  | "two-column"      // 双栏
  | "quote"           // 引用
  | "data-viz"        // 数据可视化
  | "comparison"      // 对比
  | "timeline"        // 时间线
  | "process"         // 流程图
  | "blank";          // 空白

/**
 * 幻灯片状态
 */
export type SlideStatus =
  | "draft"           // 草稿（大纲阶段）
  | "generating"      // AI生成中
  | "generated"       // AI已生成
  | "edited"          // 手动编辑过
  | "finalized";      // 最终确定

/**
 * 单张幻灯片定义
 */
export interface StudioSlide {
  id: string;
  order: number;                    // 顺序号
  type: SlideContentType;
  status: SlideStatus;

  // 内容
  title?: string;
  subtitle?: string;
  content?: string;                 // 主要文本内容（支持Markdown）
  bullets?: string[];
  notes?: string;                   // 演讲备注

  // 媒体
  imageUrl?: string;
  imageCaption?: string;

  // 数据（用于图表）
  chartData?: {
    type: "bar" | "line" | "pie" | "scatter";
    data: unknown;
  };

  // 布局配置
  layout?: {
    imagePosition?: "left" | "right" | "top" | "bottom";
    alignment?: "left" | "center" | "right";
  };

  // 元数据
  generatedBy?: "ai" | "manual" | "project";
  lastEditedAt: string;
  aiPromptUsed?: string;            // 生成此页时使用的prompt
}

/**
 * 演示文稿大纲
 */
export interface PresentationOutline {
  title: string;
  subtitle?: string;
  sections: OutlineSection[];
  totalSlides: number;
}

/**
 * 大纲章节
 */
export interface OutlineSection {
  id: string;
  title: string;
  description?: string;
  slideCount: number;
  slides: OutlineSlideItem[];
}

/**
 * 大纲中的幻灯片条目
 */
export interface OutlineSlideItem {
  id: string;
  title: string;
  type: SlideContentType;
  notes?: string;                   // 对这页的说明/要求
}

/**
 * 演示文稿文档
 */
export interface PresentationDocument {
  id: string;
  title: string;
  subtitle?: string;

  // 关联信息
  projectId?: string;               // 可选：关联的EvoLab项目ID
  projectVersionId?: string;        // 可选：关联的方案版本ID

  // 内容
  outline: PresentationOutline;
  slides: StudioSlide[];

  // 设置
  theme?: "classic" | "modern" | "minimal" | "dark";
  aspectRatio?: "16:9" | "4:3";

  // 元数据
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  status: "draft" | "in-progress" | "completed";
}

// ==================== API Request/Response 类型 ====================

/**
 * 生成大纲请求
 */
export interface GenerateOutlineRequest {
  topic: string;                    // 主题
  purpose?: string;                 // 目的（如：客户汇报、设计评审）
  targetAudience?: string;          // 目标受众
  slideCount?: number;              // 期望页数（5-30）
  keyPoints?: string[];             // 必须包含的要点

  // 可选：从项目生成
  projectId?: string;
  versionId?: string;
}

export interface GenerateOutlineResponse {
  outline: PresentationOutline;
  suggestions?: string[];           // AI的建议
}

/**
 * 生成单页内容请求
 */
export interface GenerateSlideContentRequest {
  presentationId: string;
  slideId: string;

  // 上下文
  outlineItem: OutlineSlideItem;
  previousSlide?: StudioSlide;      // 上一页（用于连贯性）

  // 可选约束
  tone?: "professional" | "casual" | "technical";
  length?: "brief" | "moderate" | "detailed";
  includeImage?: boolean;

  // 可选：从项目数据生成
  projectData?: unknown;
}

export interface GenerateSlideContentResponse {
  slide: StudioSlide;
  alternatives?: Partial<StudioSlide>[];  // 可选的其他版本
}

/**
 * 修改幻灯片请求
 */
export interface ModifySlideRequest {
  presentationId: string;
  slideId: string;
  currentSlide: StudioSlide;

  userRequest: string;              // "把标题改短一点"、"加一张示意图"
  mode?: "refine" | "regenerate";   // 优化 vs 重新生成
}

export interface ModifySlideResponse {
  slide: StudioSlide;
  changes?: string[];               // 改动说明
}

/**
 * 批量生成内容请求
 */
export interface BatchGenerateSlidesRequest {
  presentationId: string;
  slideIds: string[];
  options?: {
    tone?: "professional" | "casual" | "technical";
    includeImages?: boolean;
  };
}

export interface BatchGenerateSlidesResponse {
  slides: StudioSlide[];
  errors?: Array<{ slideId: string; error: string }>;
}

/**
 * 从项目导入请求
 */
export interface ImportFromProjectRequest {
  projectId: string;
  versionId: string;

  // 选择要包含的内容
  includeSlides?: Array<
    | "cover"
    | "site"
    | "evolution"
    | "massing"
    | "plan"
    | "zones"
    | "flow"
    | "systems"
    | "compare"
    | "quantities"
    | "cost"
  >;

  // 是否创建新文档还是追加到现有文档
  mode: "create" | "append";
  targetPresentationId?: string;    // append模式必需
}

export interface ImportFromProjectResponse {
  presentationId: string;
  importedSlideIds: string[];
  outline: PresentationOutline;
}

// ==================== Zod Schemas ====================

export const SlideContentTypeSchema = z.enum([
  "title", "content", "image", "image-text", "two-column",
  "quote", "data-viz", "comparison", "timeline", "process", "blank"
]);

export const SlideStatusSchema = z.enum([
  "draft", "generating", "generated", "edited", "finalized"
]);

export const StudioSlideSchema = z.object({
  id: z.string(),
  order: z.number().int().min(0),
  type: SlideContentTypeSchema,
  status: SlideStatusSchema,

  title: z.string().optional(),
  subtitle: z.string().optional(),
  content: z.string().optional(),
  bullets: z.array(z.string()).optional(),
  notes: z.string().optional(),

  imageUrl: z.string().url().optional(),
  imageCaption: z.string().optional(),

  chartData: z.object({
    type: z.enum(["bar", "line", "pie", "scatter"]),
    data: z.unknown()
  }).optional(),

  layout: z.object({
    imagePosition: z.enum(["left", "right", "top", "bottom"]).optional(),
    alignment: z.enum(["left", "center", "right"]).optional()
  }).optional(),

  generatedBy: z.enum(["ai", "manual", "project"]).optional(),
  lastEditedAt: z.string(),
  aiPromptUsed: z.string().optional()
});

export const OutlineSlideItemSchema = z.object({
  id: z.string(),
  title: z.string().min(1).max(200),
  type: SlideContentTypeSchema,
  notes: z.string().optional()
});

export const OutlineSectionSchema = z.object({
  id: z.string(),
  title: z.string().min(1).max(100),
  description: z.string().optional(),
  slideCount: z.number().int().min(1),
  slides: z.array(OutlineSlideItemSchema)
});

export const PresentationOutlineSchema = z.object({
  title: z.string().min(1).max(200),
  subtitle: z.string().optional(),
  sections: z.array(OutlineSectionSchema).min(1),
  totalSlides: z.number().int().min(1).max(100)
});

export const PresentationDocumentSchema = z.object({
  id: z.string(),
  title: z.string().min(1).max(200),
  subtitle: z.string().optional(),

  projectId: z.string().optional(),
  projectVersionId: z.string().optional(),

  outline: PresentationOutlineSchema,
  slides: z.array(StudioSlideSchema),

  theme: z.enum(["classic", "modern", "minimal", "dark"]).optional(),
  aspectRatio: z.enum(["16:9", "4:3"]).optional(),

  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string().optional(),
  status: z.enum(["draft", "in-progress", "completed"])
});

export const GenerateOutlineRequestSchema = z.object({
  topic: z.string().min(5).max(500),
  purpose: z.string().optional(),
  targetAudience: z.string().optional(),
  slideCount: z.number().int().min(5).max(30).optional(),
  keyPoints: z.array(z.string()).max(10).optional(),

  projectId: z.string().optional(),
  versionId: z.string().optional()
});

export const GenerateSlideContentRequestSchema = z.object({
  presentationId: z.string(),
  slideId: z.string(),
  outlineItem: OutlineSlideItemSchema,
  previousSlide: StudioSlideSchema.optional(),

  tone: z.enum(["professional", "casual", "technical"]).optional(),
  length: z.enum(["brief", "moderate", "detailed"]).optional(),
  includeImage: z.boolean().optional(),

  projectData: z.unknown().optional()
});

export const ModifySlideRequestSchema = z.object({
  presentationId: z.string(),
  slideId: z.string(),
  currentSlide: StudioSlideSchema,
  userRequest: z.string().min(1).max(500),
  mode: z.enum(["refine", "regenerate"]).optional()
});

export const BatchGenerateSlidesRequestSchema = z.object({
  presentationId: z.string(),
  slideIds: z.array(z.string()).min(1).max(20),
  options: z.object({
    tone: z.enum(["professional", "casual", "technical"]).optional(),
    includeImages: z.boolean().optional()
  }).optional()
});

export const ImportFromProjectRequestSchema = z.object({
  projectId: z.string(),
  versionId: z.string(),
  includeSlides: z.array(z.enum([
    "cover", "site", "evolution", "massing", "plan",
    "zones", "flow", "systems", "compare", "quantities", "cost"
  ])).optional(),
  mode: z.enum(["create", "append"]),
  targetPresentationId: z.string().optional()
});

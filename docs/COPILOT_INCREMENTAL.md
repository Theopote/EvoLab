# Copilot 增量化改造 - 技术文档

> **状态**: ✅ 已完全实现  
> **优先级**: P0-4 (局部推敲工作流)  
> **最后检查**: 2026-06-28

---

## 概述

Copilot模块已从"完整重生成器"升级为"增量修改助手"。建筑师可以选择性接受/拒绝AI建议的每个操作，锁定不希望改动的元素，并获得清晰的"为什么建议这样改"的说明。

**核心价值**: "用户敢在真实方案里使用AI修改"

---

## 架构设计

### 修改前 vs 修改后

| 方面 | 修改前（假设） | 修改后（实际） |
|-----|------------|------------|
| AI返回 | 完整PlanVersion | PlanChangeProposal（操作列表） |
| 用户控制 | 全接受或全拒绝 | 逐项接受/拒绝 |
| 锁定元素 | 不支持 | ✅ lockedElementIds支持 |
| 差异预览 | 难以对比 | ✅ 高亮变更区域 |
| 操作说明 | 无 | ✅ label + rationale + summary |

### 数据流

```
用户请求 + currentVersion + lockedElementIds
  ↓
/api/modify-plan (requestAnthropicTool)
  ↓
AI返回 PlanChangeProposal {
  intent,
  constraints,
  operations: [
    { type: "move_core", ... },
    { type: "widen_corridor", ... },
    ...
  ]
}
  ↓
PlanChangeProposalPanel UI
  ↓
用户选择接受的operations
  ↓
buildPreviewVersion() 应用选中的操作
  ↓
用户点击Apply → 更新activeVersion
```

---

## 核心类型

### PlanChangeProposal

```typescript
interface PlanChangeProposal {
  intent: string;                      // 一句话总结用户意图
  constraints: PlanChangeConstraint[]; // 必须遵守的设计规则
  targetElementIds: string[];          // 最受影响的房间ID
  operations: PlanOperation[];         // 1-12个具体操作
}

interface PlanChangeConstraint {
  id: string;
  label: string;
  severity: "hard" | "soft";  // hard=必须遵守，soft=尽量遵守
}
```

### PlanOperation（14种操作类型）

#### 1. move_core - 移动核心筒

```typescript
{
  type: "move_core",
  direction: "north" | "south" | "east" | "west",
  distanceMeters: number  // 0.5-30m，典型值0.5-8m
}
```

**用途**: 整体移动楼梯/电梯/竖井组合

#### 2. shift_rooms - 平移房间

```typescript
{
  type: "shift_rooms",
  roomIds: string[],
  dx: number,  // -30 to 30 meters
  dy: number
}
```

**用途**: 微调房间位置，腾出空间

#### 3. widen_corridor - 加宽走廊

```typescript
{
  type: "widen_corridor",
  corridorIds?: string[],
  extraWidthMeters: number,  // 0-5m
  side: "left" | "right" | "both"
}
```

**用途**: 满足疏散宽度要求

#### 4. align_wet_rooms - 对齐湿区

```typescript
{
  type: "align_wet_rooms",
  roomIds?: string[],
  nearShaftId?: string,
  maxDistanceMeters: number  // 默认12m
}
```

**用途**: 优化管道布局，减少横支管长度

#### 5. update_room - 更新房间属性

```typescript
{
  type: "update_room",
  roomId: string,
  patch: {
    name?: string,
    type?: string,
    zone?: string
  }
}
```

**用途**: 修改房间名称、类型、功能分区（不改几何）

#### 6. optimize_egress - 优化疏散

```typescript
{
  type: "optimize_egress",
  note?: string
}
```

**用途**: 标记意图，实际几何调整通过其他操作实现

#### 7. split_room - 分割房间

```typescript
{
  type: "split_room",
  roomId: string,
  splitAxis: "horizontal" | "vertical",
  splitRatio: number,  // 0.15-0.85
  secondRoomName: string,
  secondRoomId?: string
}
```

**用途**: 细分大房间

#### 8. merge_room - 合并房间

```typescript
{
  type: "merge_room",
  primaryRoomId: string,
  secondaryRoomId: string,
  mergedRoomName?: string,
  mergedRoomId?: string
}
```

**前提**: 两个房间必须共享完整内墙

#### 9. add_opening - 添加开口

```typescript
{
  type: "add_opening",
  roomId: string,
  openingKind: "door" | "window",
  wall: "north" | "south" | "east" | "west",
  position: number,  // 0-1，沿墙位置
  width: number      // 宽度（米）
}
```

#### 10. resize_opening - 调整开口尺寸

```typescript
{
  type: "resize_opening",
  roomId: string,
  openingKind: "door" | "window",
  openingIndex: number,  // 第几个开口
  width: number
}
```

#### 11. update_room_polygon - 更新房间轮廓

```typescript
{
  type: "update_room_polygon",
  roomId: string,
  polygon: [number, number][]  // 3-32个顶点
}
```

**用途**: 局部几何修改（inpaint场景）

#### 12. add_room - 添加新房间

```typescript
{
  type: "add_room",
  room: {
    id: string,
    name: string,
    type: string,
    zone: string,
    polygon: [number, number][],
    areaSqm: number,
    doors: OpeningPatch[],
    windows: OpeningPatch[]
  }
}
```

#### 13. add_protrusion - 添加凸出

```typescript
{
  type: "add_protrusion",
  roomId: string,
  protrusion: {
    id: string,
    type: "bay_window" | "niche" | "balcony",
    footprint: [number, number][],
    depthM: number,
    widthM?: number,
    sillHeightM?: number,
    headroomM?: number,
    gfaExempt?: boolean
  }
}
```

#### 14. replace_rooms - 完全替换房间列表

```typescript
{
  type: "replace_rooms",
  rooms: Room[]
}
```

**用途**: 复杂重构场景的后备方案

---

## API实现

### POST /api/modify-plan

**请求**:
```typescript
{
  currentVersion: PlanVersion,
  userRequest: string,              // max 2000 chars
  lockedElementIds?: string[],      // 锁定的房间ID
  referenceImages?: Array<{         // max 5 images
    base64: string,
    mediaType?: string,
    fileName?: string
  }>,
  stream?: boolean
}
```

**Zod验证**: `ModifyPlanRequestSchema`（已在前期优化中添加）

**响应（非流式）**:
```typescript
{
  mode: "proposal",
  proposal: PlanChangeProposal,
  version: PlanVersion,             // 预览版本
  findings: CopilotFinding[],       // 分析发现
  fallback?: boolean,               // 是否是mock数据
  warning?: string
}
```

**响应（流式）**:
```
event: status
data: {"message": "正在分析当前方案与约束…"}

event: delta
data: {"text": "分析完成"}

event: result
data: {整个ModifyPlanResponse}
```

### AI Prompt策略

**位置**: `lib/prompts/proposePlanChangesPrompt.ts`

**关键规则**:
1. **NEVER返回完整PlanVersion或room polygons**
2. 只使用currentVersion中存在的room ids
3. 优先小型、可组合的操作，而非一个巨大的隐式重排
4. 每个操作需要稳定的唯一ID和简短标签
5. 保持楼梯/电梯/竖井ID稳定，用move_core而非重建
6. 不操作lockedElementIds中的元素
7. Findings描述后果，可包含CopilotAction按钮

**参考图片支持**: 当附加图片时，AI将其视为设计意图标注（草图、红线标注、参考平面）

---

## UI组件

### PlanChangeProposalPanel

**位置**: `components/copilot/PlanChangeProposalPanel.tsx`

**功能**:
1. **可折叠面板**: 显示proposal.intent
2. **差异预览**: PlanChangeProposalDiffPreview高亮变更区域
3. **约束列表**: 显示hard/soft constraints
4. **操作清单**: 
   - 每个operation显示为checkbox
   - 显示label、summary、rationale
   - 锁定的操作显示Lock图标并禁用
   - 鼠标悬停高亮affected rooms
5. **跳过操作警告**: 显示因锁定而跳过的操作
6. **评论输入**: 可选的onAddComment回调
7. **Apply/Dismiss按钮**: 
   - Apply时传递acceptedOperationIds
   - 显示接受数量（如"Apply 3/5 changes"）

**交互流程**:
```
用户收到proposal
  ↓
查看差异预览（高亮变更房间）
  ↓
逐项review每个operation
  ↓
取消勾选不想要的操作
  ↓
预览实时更新
  ↓
点击Apply → onApply(version, acceptedIds)
```

### PlanChangeProposalDiffPreview

**位置**: `components/copilot/PlanChangeProposalDiffPreview.tsx`

**功能**:
- 并排显示base version和preview version
- 高亮变更房间（highlightRoomIds）
- 聚焦悬停的房间（focusedRoomIds）
- 颜色编码：新增/删除/修改

---

## 引擎实现

### buildPreviewVersion()

**位置**: `lib/plan-change-engine.ts`

**功能**: 将operations应用到base version生成预览

```typescript
function buildPreviewVersion(
  baseVersion: PlanVersion,
  proposal: PlanChangeProposal,
  options: {
    acceptedOperationIds?: string[],
    lockedElementIds?: string[],
    allowedRoomIds?: string[],
    versionLabel?: string
  }
): PlanVersion
```

**执行顺序**:
1. 过滤acceptedOperationIds
2. 跳过被lockedElementIds阻塞的操作
3. 按类型顺序应用操作
4. Post-process（拓扑计算、评分等）

### applyPlanOperationsWithReport()

返回详细的执行报告：

```typescript
interface PlanOperationsReport {
  version: PlanVersion,
  appliedOperationIds: string[],
  skippedOperations: SkippedPlanOperation[]
}

interface SkippedPlanOperation {
  operationId: string,
  label: string,
  lockedElementIds: string[],
  reason?: string
}
```

### 操作应用逻辑

每种操作类型都有对应的apply函数：

- `applyMoveCore()`: 移动所有CORE_TYPES房间
- `applyShiftRooms()`: 平移polygon顶点
- `applyWidenCorridor()`: 扩展corridor边界
- `applyAlignWetRooms()`: 计算最近竖井并移动湿区
- `applySplitRoom()`: 调用`splitRectRoom()`
- `applyMergeRoom()`: 调用`mergeAdjacentRooms()`
- `applyUpdateRoomPolygon()`: 直接替换polygon
- `applyAddOpening()`: 添加到doors/windows数组
- ... 等

**锁定检查**:
```typescript
function isOperationBlockedByLocks(
  operation: PlanOperation,
  lockedElementIds: string[],
  version: PlanVersion
): boolean
```

检查操作是否触碰locked elements，如果是则自动跳过。

---

## 使用示例

### 客户端调用

```typescript
// 发起修改请求
const response = await fetch("/api/modify-plan", {
  method: "POST",
  body: JSON.stringify({
    currentVersion: activePlanVersion,
    userRequest: "把核心筒向北移动3米",
    lockedElementIds: ["room-101", "room-102"]  // 锁定这两个房间
  })
});

const result: ModifyPlanResponse = await response.json();

// 用户在UI中review proposal
<PlanChangeProposalPanel
  baseVersion={currentVersion}
  proposal={result.proposal}
  lockedElementIds={lockedElementIds}
  onApply={(version, acceptedIds) => {
    // 更新activeVersion
    setActiveVersion(version);
    console.log("Applied operations:", acceptedIds);
  }}
  onDismiss={() => {
    // 取消修改
  }}
/>
```

### 流式调用

```typescript
const response = await fetch("/api/modify-plan", {
  method: "POST",
  body: JSON.stringify({
    currentVersion,
    userRequest: "优化疏散距离",
    stream: true
  })
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const text = decoder.decode(value);
  const lines = text.split("\n\n");

  for (const line of lines) {
    if (line.startsWith("event: delta")) {
      const data = JSON.parse(line.split("data: ")[1]);
      console.log("AI思考:", data.text);
    } else if (line.startsWith("event: result")) {
      const data = JSON.parse(line.split("data: ")[1]);
      // 显示proposal UI
    }
  }
}
```

---

## 与P0-4目标对比

| P0-4需求 | 实现状态 | 说明 |
|---------|---------|------|
| 选区级AI修改 | ✅ 已实现 | targetRoomIds + allowedRoomIds |
| 锁定对象不改 | ✅ 已实现 | lockedElementIds完整支持 |
| Proposal差异预览 | ✅ 已实现 | PlanChangeProposalDiffPreview组件 |
| Accept/Reject单项操作 | ✅ 已实现 | Checkbox per operation |
| 自动说明"为什么建议这样改" | ✅ 已实现 | operation.rationale字段 |
| 增量操作而非完整版本 | ✅ 已实现 | 14种PlanOperation类型 |
| Proposal结构增强 | ✅ 已实现 | intent + constraints + operations |

**结论**: Copilot增量化改造已完全实现P0-4目标！

---

## 技术亮点

### 1. 操作组合性

小型操作可以组合达成复杂意图：

```typescript
// "扩大走廊并移动卫生间靠近竖井"
operations: [
  { type: "widen_corridor", extraWidthMeters: 0.6 },
  { type: "align_wet_rooms", nearShaftId: "shaft-1" }
]
```

### 2. 锁定优先级

操作自动跳过锁定元素，不会破坏用户已确定的设计：

```typescript
const blocked = isOperationBlockedByLocks(operation, lockedElementIds, version);
if (blocked) {
  report.skippedOperations.push({
    operationId: operation.id,
    label: operation.label,
    lockedElementIds: getBlockedLocksForOperation(operation, lockedElementIds, version)
  });
}
```

### 3. 实时预览

每次勾选/取消勾选操作，预览立即更新：

```typescript
const preview = useMemo(
  () => buildPreviewVersion(baseVersion, proposal, {
    acceptedOperationIds: [...acceptedIds],
    lockedElementIds
  }),
  [acceptedIds, baseVersion, lockedElementIds, proposal]
);
```

### 4. 高亮差异

通过`getHighlightedRoomIds()`计算受影响房间，并在canvas上高亮显示。

### 5. Fallback机制

如果AI调用失败，返回deterministic mock proposal保证用户体验不中断：

```typescript
function buildFallbackResponse(body: ModifyPlanRequest): ModifyPlanResponse {
  const fallback = createMockModifiedVersion(body.currentVersion!, body.userRequest ?? "");
  return {
    ...fallback,
    fallback: true,
    warning: formatCopilotFallbackWarning()
  };
}
```

---

## 性能优化

### 1. 操作限制

- 最多12个operations per proposal
- 最多32个polygon vertices per room
- 合理的distanceMeters范围限制

### 2. 增量计算

只重新计算变更的房间，而非整个平面。

### 3. 跳过post-process选项

预览时可跳过耗时的后处理，Apply时再完整计算。

---

## 待增强功能（非P0）

### 短期优化
- [ ] 操作依赖关系可视化（操作A必须在操作B之前）
- [ ] 批量accept/reject（全选/全不选/只选建议）
- [ ] 操作排序拖拽
- [ ] 撤销单个已应用的操作

### 中期增强
- [ ] 操作冲突检测（两个操作修改同一房间）
- [ ] 更丰富的约束类型（面积范围、比例要求）
- [ ] 操作模板保存（"常用修改模式"）
- [ ] 协作review（多人评审proposal）

### 长期迭代
- [ ] 操作历史回放
- [ ] A/B test不同operation组合
- [ ] 机器学习优化operation建议质量
- [ ] 自然语言解释每个operation的设计影响

---

## 测试策略

### 单元测试
- [ ] 每种operation的apply逻辑
- [ ] 锁定检查函数
- [ ] 差异高亮计算
- [ ] Fallback生成

### 集成测试
- [ ] 完整modify-plan流程
- [ ] 流式响应正确性
- [ ] 多operation组合效果
- [ ] 锁定元素正确跳过

### E2E测试
- [ ] 用户accept/reject操作
- [ ] 锁定房间后修改
- [ ] 复杂请求的operation decomposition
- [ ] 参考图片upload和使用

---

## 关键文件

| 文件路径 | 职责 |
|---------|------|
| `app/api/modify-plan/route.ts` | API端点，调用AI生成proposal |
| `lib/prompts/proposePlanChangesPrompt.ts` | AI prompt定义 |
| `lib/schemas/plan-change-proposal-schema.ts` | 14种operation的Zod schema |
| `lib/plan-change-engine.ts` | 操作应用引擎 |
| `components/copilot/PlanChangeProposalPanel.tsx` | Proposal review UI |
| `components/copilot/PlanChangeProposalDiffPreview.tsx` | 差异预览组件 |
| `lib/plan-change-diff.ts` | 差异计算逻辑 |
| `lib/room-topology-ops.ts` | split/merge操作实现 |

---

## 安全性

1. **Zod验证**: 所有operation参数验证
2. **范围限制**: distanceMeters、width等有合理上下限
3. **ID验证**: 只能操作currentVersion中存在的房间
4. **锁定保护**: 被锁定元素无法被意外修改
5. **操作数量限制**: 最多12个operations防止过载

---

## 可访问性

- [ ] Operation checkboxes添加aria-label
- [ ] 键盘导航支持（Tab切换operation）
- [ ] 屏幕阅读器友好的operation summary
- [ ] 高对比度模式下的差异高亮

---

*文档版本: v1.0*  
*最后更新: 2026-06-28*  
*结论: Copilot增量化改造已完整实现P0-4目标*

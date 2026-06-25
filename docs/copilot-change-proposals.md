# Copilot 建筑变更建议系统

## 背景与问题

当前 `POST /api/modify-plan` 让 LLM 直接返回完整 `PlanVersion`。早期实现简单，但长期有四个结构性问题：

| 问题 | 表现 |
|------|------|
| 难追踪改了什么 | 只能对两个完整版本做 `diffPlanVersions`，无法理解「意图」 |
| 无法局部接受/拒绝 | 用户要么全盘接受新方案，要么放弃 |
| 容易覆盖手工微调 | LLM 重写全量几何，inspector 里的局部编辑被冲掉 |
| 协作困难 | 多人无法围绕「一条变更建议」讨论、审批、留痕 |

项目里已有 `ChangeSet` / `ChangeSetApprovalPanel`，但它是 **事后** 从 base/target 版本 diff 出来的，Copilot 并未在生成阶段产出可审阅的操作列表。

## 目标架构

把 Copilot 从「整版重写系统」升级为「建筑变更建议系统」：

```
用户自然语言
    ↓
LLM：intent + constraints + targetElements + operations（结构化）
    ↓
几何引擎：确定性执行 operations（split / move core / widen corridor / align wet rooms …）
    ↓
UI：按 operation 展示 diff，支持逐条 accept / reject
    ↓
仅将已接受的操作合并进 activeVersion，并写入 draft ChangeSet
```

### 职责分离

| 层 | 职责 | 不应做 |
|----|------|--------|
| LLM | 理解意图、选目标房间/核心、声明约束、输出 **有限操作集** | 手搓完整多边形、重写全楼 |
| 几何引擎 | 在约束内执行操作、保持 ID 稳定、后处理与校验 | 理解自然语言 |
| UI | 展示建议、逐条审批、预览、提交 | 直接信任 LLM 几何 |

## 数据模型

### PlanChangeProposal

```ts
interface PlanChangeProposal {
  intent: string;                    // 对用户请求的结构化复述
  constraints: PlanChangeConstraint[]; // 必须遵守的硬约束
  targetElementIds: string[];        // 主要影响元素
  operations: PlanOperation[];       // 建议操作（可逐条审批）
}
```

### PlanOperation（v1 支持集）

| type | 说明 | 引擎行为 |
|------|------|----------|
| `move_core` | 平移核心筒 | 移动 stair / elevator / shaft 房间多边形 |
| `shift_rooms` | 平移指定房间 | `dx`/`dy` 偏移 polygon |
| `widen_corridor` | 加宽走廊 | 沿主轴扩展 corridor polygon |
| `align_wet_rooms` | 湿区靠井道 | 将 bathroom/kitchen 向最近 shaft 平移 |
| `update_room` | 元数据更新 | 改 name / type / zone，不动几何 |
| `optimize_egress` | 疏散优化（占位） | 记录 metadata 提示，v1 不改动几何以避免幻觉 |
| `split_room` | 拆分房间 | 沿水平/垂直轴切分矩形房间，生成第二个房间 |
| `add_opening` | 新增门窗 | 向 room.doors / room.windows 追加 Opening |
| `resize_opening` | 调整门窗宽度 | 按 index 修改已有 opening 宽度 |

后续可扩展：`merge_rooms`、`relayout_zone` 等。

### API 响应（新）

```ts
interface ModifyPlanResponse {
  mode: "proposal";
  proposal: PlanChangeProposal;
  version: PlanVersion;
  findings: CopilotFinding[];
  fallback?: boolean;
  warning?: string;
}
```

UI 展示 `PlanChangeProposalPanel`，默认勾选未锁定的 operation，用户确认后调用 `applyCopilotProposal` 写入版本与 audit log。

### StoredCopilotProposal（持久化）

保存在 `ProjectDomain.copilotProposals`，含 `comments` 与 `auditLog`。`ChangeSet` 通过 `proposalId` / `acceptedOperationIds` 反向关联。

客户端用 `applyPlanOperations(base, operations, acceptedIds)` 在本地重算预览版本，避免二次请求。

## 与现有 ChangeSet 的关系

1. Copilot 生成 `proposal` 并 `registerCopilotProposal`（status: draft）。
2. 用户确认后，`applyCopilotProposal` 生成 `finalVersion` + draft `ChangeSet`（含 `proposalId`）。
3. Quantity 面板的 `ChangeSetApprovalPanel` 继续负责整包 approve/reject；operation 级审批在 Copilot 侧完成。

## 文件地图

| 文件 | 作用 |
|------|------|
| `lib/schemas/plan-change-proposal-schema.ts` | Zod schema + 类型 |
| `lib/prompts/proposePlanChangesPrompt.ts` | LLM 系统提示 |
| `lib/plan-change-engine.ts` | 操作执行与预览构建 |
| `app/api/modify-plan/route.ts` | proposal-only API |
| `lib/copilot-proposals.ts` | 持久化、评论、audit log |
| `components/copilot/CopilotProposalHistoryPanel.tsx` | Proposal 历史与 audit 浏览 |
| `components/copilot/PlanChangeProposalPanel.tsx` | 逐条审批 UI |
| `components/copilot/PlanChangeProposalDiffPreview.tsx` | 内嵌几何 diff 预览 |
| `lib/plan-change-diff.ts` | 房间级变更摘要 |
| `lib/plan-change-engine.test.ts` | 引擎单元测试 |
| `components/copilot-panel.tsx` / `CopilotConsole.tsx` | 接入审批流 |

## 迁移计划

### Phase 1（已完成）

- [x] Schema + 几何引擎（6 类 operation）
- [x] API proposal 优先
- [x] Copilot UI 逐条 accept + Apply selected

### Phase 2（已完成）

- [x] 更多 operation：`split_room`、`add_opening`、`resize_opening`
- [x] Copilot 内嵌 mini diff（`PlanChangeProposalDiffPreview`）
- [x] 锁定元素：跳过 `lockedElementIds` 上的 operation
- [x] 单元测试：`lib/plan-change-engine.test.ts`（`npm test`）

### Phase 3（当前）

- [x] Proposal 持久化到 `ProjectDomain.copilotProposals`
- [x] 评论：`addCopilotProposalComment` + Copilot 面板输入框
- [x] Operation 级 audit log：`CopilotProposalHistoryPanel`
- [x] `ChangeSet.proposalId` / `acceptedOperationIds` 关联
- [x] 淘汰 `/api/modify-plan` legacy 整版重写路径

### Phase 4（inpaint / hybrid）

- [x] `/api/inpaint-plan` 返回 `proposal + version`（`proposeInpaintChangesPrompt`）
- [x] Inpaint / Vertical alignment 使用 `useCopilotProposalRevision` + `PlanChangeProposalPanel`
- [x] `/api/hybridize-schemes` 将合并结果包装为 `replace_rooms` proposal
- [x] `SchemeHybridPanel` 通过 `applyCopilotProposal` 提交，不再直接 `updateActiveVersion`

## 设计原则

1. **LLM 提建议，引擎改几何** — 与 `generate-plan-pipeline`（topology → geometry → refinement）同一哲学。
2. **稳定 ID** — operation 默认 in-place 修改，仅在用户确认后才 fork version id。
3. **可逆** — 拒绝 proposal 时不写入 versions；拒绝 ChangeSet 时回滚 `baseVersionSnapshot`。
4. **渐进增强** — API 失败时仍回退到 deterministic mock proposal，而不是整版 LLM 重写。

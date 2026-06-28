# EvoLab AI模型接入指南

> **目标**: 将真实的AI模型API接入EvoLab应用  
> **更新日期**: 2026-06-28

---

## 当前状态

EvoLab已经内置了完整的AI集成架构，但**默认运行在Mock模式**。这意味着：

- ✅ 所有UI功能都能正常使用
- ✅ 数据流和状态管理完全正常
- ⚠️ AI生成的结果是预设的deterministic mock数据
- ⚠️ 没有真正调用外部AI API

**代码位置**: 
- `lib/ai/offline-mode.ts` - Mock模式检测
- `lib/ai/model-routing.ts` - 模型选择逻辑
- `lib/anthropic-tool.ts` - Anthropic API封装

---

## 方案一：Anthropic Claude API（推荐）

### 为什么选择Anthropic

EvoLab是专门为Anthropic Claude优化的：
- ✅ **Tool Use功能** - 结构化输出，适合建筑设计的复杂约束
- ✅ **长上下文** - Claude 3.5 Sonnet支持200K tokens
- ✅ **Vision能力** - 支持图片输入（Import模块需要）
- ✅ **代码已完全集成** - 无需修改代码，只需配置API Key

### 1. 获取API Key

#### 免费试用
Anthropic提供**$5免费额度**供测试：

1. 访问 https://console.anthropic.com/
2. 注册账号（需要邮箱和手机号验证）
3. 进入Console → Settings → API Keys
4. 点击"Create Key"创建新密钥
5. **立即复制并保存** - 密钥只显示一次

**免费额度说明**:
- $5 = 约200万tokens（Claude 3.5 Sonnet）
- 足够测试完整功能数百次
- 用完后需要添加支付方式

#### 付费方案
- **即用即付** - 无月费，按token计费
- Claude 3.5 Sonnet: 
  - Input: $3.00 / 1M tokens
  - Output: $15.00 / 1M tokens
- 预估成本：一次完整平面生成约$0.05-0.15

### 2. 配置EvoLab

创建或编辑`.env.local`文件：

```env
# 关闭Mock模式
NEXT_PUBLIC_MOCK_MODE=false

# 设置Anthropic API Key（替换为你的真实密钥）
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxxxx

# 可选：指定特定模型（默认使用claude-sonnet-4-20250514）
# EVOLAB_LLM_MODEL_STANDARD=claude-sonnet-4-20250514
# EVOLAB_LLM_MODEL_LIGHT=claude-sonnet-4-20250514
# EVOLAB_LLM_MODEL_HEAVY=claude-opus-4-20250514
```

### 3. 重启开发服务器

```bash
npm run dev
```

现在EvoLab会真正调用Anthropic API！

### 4. 验证接入成功

测试关键功能：

1. **平面生成** - `/workspace` → 画outline → 输入brief → 生成方案
2. **Copilot修改** - 在平面编辑器中，输入修改请求（如"把核心筒向北移动3米"）
3. **MEP生成** - 在Systems工作区，点击"生成MEP系统"
4. **Presentation** - 在Deliver工作区，生成汇报材料

**成功标志**:
- 生成结果不是固定的mock数据
- 每次请求结果略有差异（AI的不确定性）
- Console中有API调用日志

---

## 方案二：OpenAI GPT-4/GPT-4o（实验性）

EvoLab代码中已预留OpenAI支持，但**未经充分测试**。

### 获取API Key

1. 访问 https://platform.openai.com/
2. 注册账号
3. API Keys → Create new secret key
4. **新用户有$5免费额度**（有时间限制）

### 配置

```env
NEXT_PUBLIC_MOCK_MODE=false

# 设置Provider为OpenAI
EVOLAB_LLM_PROVIDER=openai

# OpenAI API Key
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxx

# 指定模型
EVOLAB_LLM_MODEL_STANDARD=gpt-4o-2024-08-06
EVOLAB_LLM_MODEL_HEAVY=gpt-4o-2024-08-06
```

### ⚠️ 注意事项

OpenAI支持是实验性的，可能需要代码调整：

1. **Tool Use格式不同** - OpenAI的Function Calling与Anthropic的Tool Use有差异
2. **Prompt兼容性** - 现有prompts为Claude优化
3. **Vision功能** - 需要验证图片输入是否正常工作

**建议**: 仅当你已有OpenAI账号且熟悉其API时尝试。否则优先使用Anthropic。

---

## 方案三：本地模型（Ollama）

使用本地运行的开源模型，完全免费但需要较强硬件。

### 硬件要求

- **最低**: 16GB RAM + RTX 3060 (12GB VRAM)
- **推荐**: 32GB RAM + RTX 4090 (24GB VRAM)
- **最佳**: 64GB RAM + A100/H100

### 安装Ollama

1. 下载Ollama: https://ollama.com/download
2. 安装后打开终端，拉取模型：

```bash
# Llama 3.1 70B（推荐，但需要48GB+ VRAM）
ollama pull llama3.1:70b

# 或者较小的模型（质量会下降）
ollama pull llama3.1:8b
ollama pull qwen2.5:14b
```

### 配置EvoLab

```env
NEXT_PUBLIC_MOCK_MODE=false

EVOLAB_LLM_PROVIDER=ollama

# Ollama默认运行在本地11434端口
OLLAMA_BASE_URL=http://localhost:11434

# 指定模型
EVOLAB_LLM_MODEL_STANDARD=llama3.1:70b
```

### ⚠️ 重要警告

1. **代码适配必需** - 当前EvoLab代码未实现Ollama adapter
2. **质量差距** - 开源模型在结构化输出和复杂约束上远不如Claude/GPT-4
3. **速度慢** - 本地推理速度取决于硬件，可能需要30秒-数分钟
4. **需要开发工作** - 预计需要1-2周开发时间实现完整集成

**建议**: 仅作为长期规划，短期不推荐。

---

## 方案四：Azure OpenAI Service（企业级）

适合需要SLA保障和企业安全的场景。

### 特点

- ✅ 企业级SLA
- ✅ 私有部署选项
- ✅ GDPR/HIPAA合规
- ❌ 需要Azure订阅
- ❌ 审批周期较长
- ❌ 价格较高

### 配置（需要代码修改）

```env
EVOLAB_LLM_PROVIDER=azure-openai

AZURE_OPENAI_API_KEY=your_key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4
```

**注意**: 需要修改`lib/anthropic-tool.ts`以支持Azure OpenAI的SDK。

---

## 推荐接入路径

### 阶段1: 快速验证（1天）

**使用Anthropic免费额度**

```bash
# 1. 注册Anthropic账号，获取$5免费额度
# 2. 创建.env.local
echo "NEXT_PUBLIC_MOCK_MODE=false" > .env.local
echo "ANTHROPIC_API_KEY=sk-ant-api03-your-key-here" >> .env.local

# 3. 启动
npm run dev

# 4. 测试关键功能
```

**预算**: $0（使用免费额度）

### 阶段2: 深度测试（1-2周）

继续使用Anthropic，用完免费额度后添加支付方式：

- 充值$20-50
- 测试完整工作流
- 收集性能数据和成本分析
- 优化Prompt降低token消耗

**预算**: $20-50

### 阶段3: 生产部署（长期）

根据测试结果选择：

**选项A - Anthropic API（推荐）**
- 成本可控：单用户每月$5-20
- 质量最高
- 维护成本低

**选项B - 混合方案**
- 轻量任务用本地模型（Ollama）
- 重要任务用Claude
- 成本优化但开发复杂

**选项C - 企业方案**
- Azure OpenAI
- 私有部署Claude（需联系Anthropic）
- 适合大规模商业化

---

## 成本估算

### 典型用户使用场景

**假设**: 一个建筑师每天使用EvoLab完成3个项目

| 操作 | 频率/项目 | Tokens | 成本/项目 |
|-----|---------|--------|---------|
| 平面生成 | 3次 | ~50K | $0.15 |
| Copilot修改 | 5次 | ~20K | $0.10 |
| MEP生成 | 1次 | ~30K | $0.10 |
| Presentation | 1次 | ~40K | $0.15 |
| **合计** | | **~140K** | **$0.50** |

**每月成本**: $0.50/天 × 20工作日 = **$10/月/用户**

### 成本优化建议

1. **启用Caching** - 代码中已实现LLM cache (`lib/ai/llm-cache.ts`)
2. **调整max_tokens** - 减少不必要的长输出
3. **使用轻量模型** - 简单任务用Haiku代替Sonnet
4. **批量处理** - 一次生成多个方案

---

## 常见问题

### Q1: 免费额度用完后会怎样？

**Anthropic**: API调用返回402错误，需要添加支付方式后继续使用。EvoLab会fallback到mock模式，不会崩溃。

### Q2: 如何监控API使用量和成本？

1. **Anthropic Console**: https://console.anthropic.com/settings/usage
2. **代码内监控**: 查看`lib/ai/token-usage.ts`，已实现usage logging
3. **添加预算警报**: Anthropic Console → Settings → Billing → Set usage limits

### Q3: API Key泄露怎么办？

立即：
1. 在Anthropic Console删除泄露的Key
2. 创建新Key并更新`.env.local`
3. 检查`.gitignore`确保`.env.local`未被提交

预防：
- **永远不要**提交`.env.local`到Git
- 使用环境变量管理工具（如Vercel Secrets）
- 定期轮换API Keys

### Q4: 为什么生成结果不理想？

可能原因：
1. **Prompt需要优化** - 查看`lib/prompts/`目录
2. **模型选择不当** - 复杂任务需要Claude Opus
3. **输入数据不完整** - 确保brief和constraints清晰
4. **温度参数过高** - 检查API调用的temperature设置

### Q5: 能同时支持多个AI提供商吗？

可以，但需要开发工作：

```typescript
// lib/ai/model-routing.ts
export function resolveLlmProvider(): LlmProviderName {
  const task = getCurrentTask();
  
  // 策略路由
  if (task === "simple-generation") {
    return "ollama"; // 本地模型
  } else if (task === "complex-planning") {
    return "anthropic"; // Claude Opus
  }
  
  return "anthropic";
}
```

---

## 技术细节

### AI调用流程

```
用户操作（如"生成平面"）
  ↓
API Route (app/api/generate-plan/route.ts)
  ↓
requestAnthropicTool() (lib/anthropic-tool.ts)
  ↓
isLlmAvailable() 检查
  ├─ Mock模式 → 返回mock数据
  └─ 真实模式 → Anthropic SDK调用
       ↓
     Claude API
       ↓
     Zod验证
       ↓
     返回结构化数据
```

### 关键配置文件

```
.env.local                           # API Keys和配置
├── NEXT_PUBLIC_MOCK_MODE            # Mock模式开关
├── ANTHROPIC_API_KEY                # Anthropic密钥
├── EVOLAB_LLM_PROVIDER              # 模型提供商
├── EVOLAB_LLM_MODEL_STANDARD        # 标准任务模型
├── EVOLAB_LLM_MODEL_LIGHT           # 轻量任务模型
└── EVOLAB_LLM_MODEL_HEAVY           # 重型任务模型
```

### 任务分层

代码中定义了3个AI任务等级（`lib/ai/llm-tasks.ts`）：

- **Light** - 简单分类、标签生成
- **Standard** - 平面生成、Copilot修改
- **Heavy** - 复杂推理、多约束优化

可以为不同等级配置不同模型以优化成本。

---

## 下一步行动

### 立即开始（今天）

1. **注册Anthropic账号** - https://console.anthropic.com/
2. **获取免费$5额度**
3. **配置`.env.local`**
4. **测试一次平面生成**

### 本周完成

1. 测试所有主要AI功能
2. 记录token使用量
3. 评估成本和质量
4. 决定长期方案

### 下周规划

根据测试结果：
- 如果效果好 → 添加支付方式，继续使用Anthropic
- 如果成本高 → 研究混合方案或本地模型
- 如果需要企业级 → 联系Anthropic商务

---

## 联系支持

### Anthropic支持
- 文档: https://docs.anthropic.com/
- Discord: https://discord.gg/anthropic
- Email: support@anthropic.com

### EvoLab技术问题
- 检查`lib/ai/`目录下的实现代码
- 查看API route中的错误处理
- 参考`README.md`中的troubleshooting部分

---

*文档版本: v1.0*  
*最后更新: 2026-06-28*  
*建议优先方案: Anthropic Claude API with $5 free credit*

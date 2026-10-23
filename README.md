# 再来一周 · One More Week

一场七天、168 小时的生活选择实验。你会以一个大学生的身份进入这一周，在上午、中午、下午、晚上做出选择；时间、精力、心情、成长、关系和现金都会留下痕迹，最后走向不同的结局。

**在线试玩：** https://one-more-week-blush.vercel.app/

## 玩法

- 7 天 × 4 个时段，共 28 个事件、80 多个选择。
- 每天有 12 小时固定生活时间和 12 小时自由时间；没用完的时间会自动变成休息。
- 五项状态：精力、心情、成长、人际、现金。
- 五种结局：burned-out、balanced、connector、explorer、week-keeper。
- 选项有真实代价，倾向会累积；部分选择会在一两天后留下余波。
- 支持自动存档、手动快照、JSON 导入导出、结局分享卡。
- AI 桌宠「小鲸」会观察你的选择并说一句话；角色语音和场景朗读使用 MiniMax TTS。

## 技术栈

- Vue 3 + TypeScript + Vite + Pinia
- Tailwind CSS 4
- Vitest 单元测试 + Playwright E2E
- Vercel Functions（AI 评论与 TTS 代理）
- MiniMax 文本/语音为主，StepFun 文本为降级；两个 provider 都不可用时使用本地兜底文案

## 本地运行

```bash
npm install
cp .env.example .env.local
# 在 .env.local 填入 MINIMAX_API_KEY / STEPFUN_API_KEY
npm run dev
```

本地开发时 Vite 会挂载 `/api/pet` 和 `/api/tts` 的中间件；生产环境使用 `api/` 下的 Vercel Functions。密钥只在服务端读取，不会进入前端 bundle。

### 环境变量

| 变量 | 用途 |
|---|---|
| `MINIMAX_API_KEY` | MiniMax 文本与 TTS |
| `MINIMAX_BASE_URL` | 默认 `https://api.minimax.cn/v1` |
| `MINIMAX_MODEL` | 默认 `MiniMax-M3.1-Flash` |
| `MINIMAX_TTS_MODEL` | 默认 `speech-2.8-hd` |
| `STEPFUN_API_KEY` | StepFun 文本降级 |
| `STEPFUN_BASE_URL` | 默认 `https://api.stepfun.com/step_plan/v1` |
| `STEPFUN_MODEL` | 默认 `step-5-preview` |

## 脚本

```bash
npm run dev        # 本地开发
npm run build      # 类型检查 + 生产构建
npm test           # 单元测试
npm run test:e2e   # Playwright E2E（首次需安装浏览器）
npm run preview    # 预览 dist
```

## 目录

```
src/game/          规则引擎、内容、存档会话、桌宠协议
src/screens/       封面、介绍、身份、游戏、结局、分享、设置、存档
src/components/    HUD、选项卡、桌宠、加载与确认组件
src/services/      存档仓库、分享卡、语音引擎、设置持久化
src/lib/           图片尺寸策略、预取、文件工具
api/               Vercel Functions（/api/pet、/api/tts）
shared/            客户端与服务端共用的桌宠兜底/ provider 链
public/            漫画场景、身份立绘、选项图、语音样音
e2e/               Playwright 全流程测试
```

## 资源说明

- 漫画场景、身份立绘和选项插图由 MiniMax 生成，再按展示尺寸导出 WebP 与响应式变体。
- 语音使用 MiniMax TTS；桌宠文本优先 MiniMax，失败时降级到 StepFun，再失败时使用本地文案。
- 所有图片与语音都放在 `public/`，部署时不依赖第三方图片服务。

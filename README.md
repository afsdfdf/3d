# AI 3D Web Tool

一个基于 **Next.js 16 + React 19** 的图片转 3D Web 工具网站模板。用户上传一张图片后，服务端会创建生成任务、轮询第三方 AI 模型任务状态，并在网页端展示进度、结果预览与下载入口。

## 功能概览

- 图片上传与基础校验（PNG / JPG / WEBP，默认最大 8MB）
- 简单参数设置：质量、拓扑、是否生成纹理、纹理提示词
- 任务创建与状态管理（排队 / 处理中 / 成功 / 失败 / 超时）
- 结果展示页：支持 3D 模型查看与预览图展示
- 下载按钮：支持下载生成模型，若无模型则回退下载预览图
- 第三方 AI API 对接（默认内置 Meshy 适配层）
- Mock 演示模式：未配置 API Key 时也可本地跑通 UI 和流程
- 超时、失败、服务异常等基础错误处理

## 技术栈

- Next.js App Router
- TypeScript
- Tailwind CSS v4
- Motion
- `@google/model-viewer`

## 启动方式

```bash
cd D:\web\ai-3d-web-tool
copy .env.example .env.local
npm install
npm run dev
```

默认地址：`http://localhost:3000`

## 环境变量

| 变量 | 说明 |
| --- | --- |
| `AI_PROVIDER` | `mock` 或 `meshy` |
| `MESHY_API_KEY` | Meshy API Key |
| `MESHY_API_BASE_URL` | 默认为 `https://api.meshy.ai/openapi/v1` |
| `PROVIDER_REQUEST_TIMEOUT_MS` | 单次调用第三方接口超时 |
| `TASK_TIMEOUT_MS` | 整个生成任务超时 |
| `TASK_SYNC_INTERVAL_MS` | 前端轮询时服务端最短同步间隔 |
| `MAX_UPLOAD_BYTES` | 上传文件大小限制 |

## 第三方 API 对接说明

当前项目实现了 `Meshy` 适配层：

- 创建任务：`POST /openapi/v1/image-to-3d`
- 查询任务：`GET /openapi/v1/image-to-3d/{id}`

未配置 `MESHY_API_KEY` 时，系统会自动回退到本地 Mock Provider，方便先看完整交互流程。

## 主要目录

```text
src/
  app/
    api/tasks/...         # 创建任务、查询任务、下载结果、读取源图
    tasks/[taskId]/...    # 结果展示页
    page.tsx              # 首页
  components/
    create-task-form.tsx  # 上传与参数设置
    model-viewer.tsx      # 3D 预览组件
  lib/
    env.ts                # 环境变量
    provider.ts           # 第三方 AI Provider 适配层
    storage.ts            # 本地任务与文件存储
    tasks.ts              # 任务编排
    types.ts              # 类型定义
```

## 设计说明

- 首页强调一个主工作区：上传图片、调参数、开始生成。
- 任务页单独负责展示状态、进度、结果和下载操作。
- 服务端使用文件系统存储任务与上传文件，方便原型阶段快速落地。
- 如需接数据库或队列，可将 `src/lib/storage.ts` 与 `src/lib/tasks.ts` 替换为 Redis / Postgres / S3 版本。

## 可继续扩展

- 登录与额度系统
- Webhook / SSE 实时进度
- 多结果版本管理
- 支持更多 3D 输出格式
- 接入对象存储（S3 / R2）

## Vercel deployment note

For Vercel, the project uses **Vercel Blob** as persistent storage when `BLOB_READ_WRITE_TOKEN` is configured.

- uploaded source images are stored in Blob
- task JSON records are stored in Blob
- local development without Blob still falls back to `.runtime`
- this app still requires the Node.js runtime and should not be deployed as static export only

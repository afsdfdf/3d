import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  Download,
  LoaderCircle,
  Sparkles,
} from "lucide-react";

import { CreateTaskForm } from "@/components/create-task-form";
import { RecentTasksPanel } from "@/components/recent-tasks-panel";
import { TaskHistorySection } from "@/components/task-history-section";
import { env } from "@/lib/env";

const features = [
  {
    title: "上传并生成",
    description: "上传参考图后，直接创建 Meshy 图片转 3D 任务。",
    icon: Sparkles,
    tone: "from-sky-100 to-sky-50",
  },
  {
    title: "进度持续保留",
    description: "离开任务页后回到首页，任务仍会保存在任务中心里。",
    icon: LoaderCircle,
    tone: "from-violet-100 to-white",
  },
  {
    title: "查看与下载",
    description: "任务完成后可继续预览模型，并一键下载结果文件。",
    icon: Download,
    tone: "from-amber-100 to-white",
  },
];

const workflow = [
  ["01", "上传图片", "支持 PNG / JPG / WEBP，服务端会做基础校验。"],
  ["02", "提交任务", "调用 Meshy API 创建任务，并保存本地任务记录。"],
  ["03", "后台追踪", "首页任务中心和详情页都会自动同步任务进度。"],
];

export default function Home() {
  const providerLabel =
    env.provider === "meshy" ? "Meshy API 已连接" : "Mock 演示模式";

  return (
    <main className="flex flex-col pb-14">
      <section className="section-shell pt-6 sm:pt-8">
        <div className="hero-wash overflow-hidden rounded-[40px] border border-white/70 px-6 py-7 shadow-[0_24px_80px_rgba(148,163,184,0.14)] sm:px-8 sm:py-8 lg:px-10 lg:py-10">
          <div className="grid gap-8 lg:grid-cols-[1.08fr_0.92fr]">
            <div className="flex flex-col justify-between gap-8">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/76 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.24em] text-slate-600">
                  <Boxes className="size-4 text-sky-600" />
                  {providerLabel}
                </div>

                <div className="space-y-4">
                  <p className="text-sm font-medium uppercase tracking-[0.28em] text-sky-700">
                    Image to 3D Studio
                  </p>
                  <h1 className="max-w-3xl text-5xl font-semibold leading-[0.95] tracking-[-0.06em] text-slate-900 sm:text-6xl lg:text-7xl">
                    <span className="gradient-text">一张图片，</span>
                    <br />
                    生成可持续追踪的 3D 任务。
                  </h1>
                  <p className="max-w-xl text-base leading-7 text-slate-600 sm:text-lg">
                    现在不只是上传和生成，还把任务挂起能力补齐了。你创建任务后返回首页，
                    依然能在任务中心里随时查看进度、打开详情或下载结果。
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {features.map(({ title, description, icon: Icon, tone }) => (
                  <article
                    key={title}
                    className={`rounded-[28px] border border-white/70 bg-gradient-to-br ${tone} p-4 shadow-[0_14px_36px_rgba(148,163,184,0.08)]`}
                  >
                    <div className="mb-4 inline-flex rounded-full bg-white/90 p-2.5 text-sky-700 shadow-sm">
                      <Icon className="size-4.5" />
                    </div>
                    <h2 className="text-base font-semibold text-slate-900">{title}</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      {description}
                    </p>
                  </article>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href="#workspace"
                  className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,#8fd4ff,#5aa6ff)] px-5 py-3 text-sm font-medium text-white shadow-[0_10px_24px_rgba(90,166,255,0.28)] transition hover:opacity-92"
                >
                  开始创建任务
                  <ArrowRight className="size-4" />
                </Link>
                <Link
                  href="#workflow"
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/72 px-5 py-3 text-sm font-medium text-slate-700 transition hover:border-sky-200 hover:text-sky-700"
                >
                  查看流程
                </Link>
              </div>
            </div>

            <div id="workspace" className="grid gap-5">
              <CreateTaskForm />
              <RecentTasksPanel />
            </div>
          </div>
        </div>
      </section>

      <section id="workflow" className="section-shell pt-8">
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="panel-light rounded-[34px] p-6 sm:p-7">
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-sky-600">
              Workflow
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-slate-900">
              更轻、更紧凑，但关键流程一眼可懂
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-500 sm:text-base">
              页面风格已改成暖白与浅米色基底，信息更集中，交互更克制。上传区、
              任务中心、详情页都使用了统一的大圆角、轻阴影和细边框语言。
            </p>
          </div>

          <div className="grid gap-3">
            {workflow.map(([index, title, description]) => (
              <div
                key={index}
                className="panel-light rounded-[28px] px-5 py-4"
              >
                <div className="flex items-start gap-4">
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[linear-gradient(135deg,#dff2ff,#eef6ff)] text-sm font-semibold text-sky-700">
                    {index}
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">
                      {title}
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-slate-500">
                      {description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-shell pt-8">
        <TaskHistorySection />
      </section>
    </main>
  );
}

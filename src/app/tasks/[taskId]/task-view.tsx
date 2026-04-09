"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowDownToLine,
  Boxes,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  RefreshCw,
} from "lucide-react";
import { motion } from "motion/react";

import { ModelViewerCanvas } from "@/components/model-viewer";
import type { LocalTaskStatus, PublicTask } from "@/lib/types";

const statusMeta: Record<
  LocalTaskStatus,
  { label: string; tone: string; chip: string; icon: typeof LoaderCircle }
> = {
  queued: {
    label: "排队中",
    tone: "text-sky-700",
    chip: "bg-sky-100 text-sky-700",
    icon: Clock3,
  },
  uploading: {
    label: "上传中",
    tone: "text-sky-700",
    chip: "bg-sky-100 text-sky-700",
    icon: LoaderCircle,
  },
  processing: {
    label: "生成中",
    tone: "text-indigo-700",
    chip: "bg-indigo-100 text-indigo-700",
    icon: LoaderCircle,
  },
  succeeded: {
    label: "已完成",
    tone: "text-emerald-700",
    chip: "bg-emerald-100 text-emerald-700",
    icon: CheckCircle2,
  },
  failed: {
    label: "失败",
    tone: "text-rose-700",
    chip: "bg-rose-100 text-rose-700",
    icon: AlertTriangle,
  },
  timeout: {
    label: "超时",
    tone: "text-amber-700",
    chip: "bg-amber-100 text-amber-700",
    icon: AlertTriangle,
  },
};

function isTerminal(status: LocalTaskStatus) {
  return status === "succeeded" || status === "failed" || status === "timeout";
}

function buildDownloadLink(taskId: string) {
  return `/api/tasks/${taskId}/download`;
}

function getPreviewImage(task: PublicTask) {
  if (task.result.thumbnailUrl || task.sourceImageUrl) {
    return `/api/tasks/${task.id}/asset?kind=thumbnail`;
  }

  return null;
}

function getModelAsset(task: PublicTask) {
  if (!task.result.primaryModelUrl) {
    return null;
  }

  return `/api/tasks/${task.id}/asset?kind=model`;
}

export function TaskView({ initialTask }: { initialTask: PublicTask }) {
  const [task, setTask] = useState(initialTask);
  const [refreshing, setRefreshing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setSyncError(null);

    try {
      const response = await fetch(`/api/tasks/${task.id}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as
        | { task: PublicTask }
        | { error: string };

      if (!response.ok || !("task" in payload)) {
        throw new Error("error" in payload ? payload.error : "刷新任务状态失败。");
      }

      setTask(payload.task);
    } catch (error) {
      setSyncError(
        error instanceof Error ? error.message : "刷新任务状态失败，请稍后重试。",
      );
    } finally {
      setRefreshing(false);
    }
  }, [task.id]);

  useEffect(() => {
    if (isTerminal(task.status)) {
      return;
    }

    const timer = window.setInterval(() => {
      void refresh();
    }, 4000);

    return () => window.clearInterval(timer);
  }, [refresh, task.status]);

  const meta = useMemo(() => statusMeta[task.status], [task.status]);
  const StatusIcon = meta.icon;
  const modelAsset = getModelAsset(task);
  const canShow3d = Boolean(modelAsset);
  const canDownload =
    canShow3d || Boolean(task.result.thumbnailUrl) || Boolean(task.sourceImageUrl);
  const previewImage = getPreviewImage(task);

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="panel-light overflow-hidden rounded-[34px] p-4 sm:p-5"
      >
        <div className="panel-strong rounded-[28px] p-3 sm:p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div
              className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium ${meta.chip}`}
            >
              <StatusIcon
                className={`size-4 ${task.status === "processing" ? "animate-spin" : ""}`}
              />
              <span>{meta.label}</span>
              <span className="opacity-45">·</span>
              <span>{task.progress}%</span>
            </div>
            <button
              type="button"
              onClick={() => void refresh()}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/82 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-sky-200 hover:text-sky-700 disabled:opacity-60"
              disabled={refreshing}
            >
              <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
              刷新
            </button>
          </div>

          <div className="relative overflow-hidden rounded-[24px] border border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(244,247,252,0.95))]">
            {canShow3d ? (
              <ModelViewerCanvas
                src={modelAsset!}
                poster={previewImage ?? undefined}
                alt="3D model preview"
              />
            ) : (
              <div className="relative aspect-[16/11] min-h-[360px] w-full">
                {previewImage ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewImage}
                      alt="Task preview"
                      className="h-full w-full object-cover"
                    />
                  </>
                ) : (
                  <div className="flex h-full items-center justify-center bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(244,247,252,0.95))] text-sm text-slate-500">
                    暂无预览图，等待任务继续处理
                  </div>
                )}
                {!isTerminal(task.status) && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/52 backdrop-blur-sm">
                    <div className="flex flex-col items-center gap-3 text-center">
                      <LoaderCircle className="size-10 animate-spin text-sky-600" />
                      <div>
                        <p className="text-lg font-semibold text-slate-900">{task.stage}</p>
                        <p className="mt-1 text-sm text-slate-500">
                          系统正在同步 Meshy 返回的最新状态
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </motion.section>

      <motion.aside
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.08, ease: "easeOut" }}
        className="space-y-6"
      >
        <section className="panel-light rounded-[34px] p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-sky-50 p-2.5 text-sky-700">
              <Boxes className="size-5" />
            </div>
            <div>
              <p className="text-sm text-slate-500">当前阶段</p>
              <h2 className="text-xl font-semibold tracking-[-0.02em] text-slate-900">
                {task.stage}
              </h2>
            </div>
          </div>

          <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,#9fd8ff,#4aa4ff)] transition-[width] duration-500"
              style={{ width: `${task.progress}%` }}
            />
          </div>

          <dl className="mt-6 grid gap-4 text-sm text-slate-500">
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <dt>任务 ID</dt>
              <dd className="font-mono text-xs text-slate-800">{task.id}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <dt>输入方式</dt>
              <dd className="text-slate-800">
                {task.inputMode === "text" ? "文字生成" : "图片生成"}
              </dd>
            </div>
            {task.inputMode === "text" && task.prompt && (
              <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
                <dt>文字描述</dt>
                <dd className="max-w-[220px] text-right text-slate-800">
                  {task.prompt}
                </dd>
              </div>
            )}
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <dt>第三方 Provider</dt>
              <dd className="uppercase text-slate-800">{task.provider}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <dt>质量档位</dt>
              <dd className="text-slate-800">
                {task.settings.quality === "production" ? "高质量" : "快速草稿"}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <dt>拓扑</dt>
              <dd className="text-slate-800">
                {task.settings.topology === "quad" ? "Quad" : "Triangle"}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt>纹理生成</dt>
              <dd className="text-slate-800">
                {task.settings.shouldTexture ? "开启" : "关闭"}
              </dd>
            </div>
          </dl>
        </section>

        <section className="panel-light rounded-[34px] p-6">
          <h3 className="text-lg font-semibold text-slate-900">结果操作</h3>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            任务完成后可直接下载结果文件。若当前还未生成模型，也能稍后从首页任务中心继续进入查看。
          </p>

          <div className="mt-5 flex flex-col gap-3">
            <a
              href={canDownload ? buildDownloadLink(task.id) : undefined}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#8fd4ff,#5aa6ff)] px-5 py-3 text-sm font-medium text-white transition hover:opacity-92 disabled:pointer-events-none disabled:opacity-40"
              aria-disabled={!canDownload}
            >
              <ArrowDownToLine className="size-4" />
              下载结果
            </a>
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white/82 px-5 py-3 text-sm font-medium text-slate-700 transition hover:border-sky-200 hover:text-sky-700"
            >
              返回任务中心
            </Link>
          </div>

          {task.errorMessage && (
            <div className="mt-5 rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              <p className="font-medium">任务提示</p>
              <p className="mt-1 leading-6">{task.errorMessage}</p>
            </div>
          )}

          {syncError && (
            <div className="mt-5 rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              <p className="font-medium">状态同步失败</p>
              <p className="mt-1 leading-6">{syncError}</p>
            </div>
          )}
        </section>
      </motion.aside>
    </div>
  );
}

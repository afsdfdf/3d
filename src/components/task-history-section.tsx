"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Download,
  History,
  LoaderCircle,
  TriangleAlert,
} from "lucide-react";

import type { LocalTaskStatus, PublicTask } from "@/lib/types";

const CACHE_KEY = "ai-3d-web-tool:task-history";

const statusMap: Record<
  LocalTaskStatus,
  { label: string; icon: typeof LoaderCircle; className: string }
> = {
  queued: {
    label: "排队中",
    icon: Clock3,
    className: "bg-sky-100 text-sky-700",
  },
  uploading: {
    label: "上传中",
    icon: LoaderCircle,
    className: "bg-sky-100 text-sky-700",
  },
  processing: {
    label: "生成中",
    icon: LoaderCircle,
    className: "bg-indigo-100 text-indigo-700",
  },
  succeeded: {
    label: "已完成",
    icon: CheckCircle2,
    className: "bg-emerald-100 text-emerald-700",
  },
  failed: {
    label: "失败",
    icon: TriangleAlert,
    className: "bg-rose-100 text-rose-700",
  },
  timeout: {
    label: "超时",
    icon: TriangleAlert,
    className: "bg-amber-100 text-amber-700",
  },
};

function isTerminal(status: LocalTaskStatus) {
  return status === "succeeded" || status === "failed" || status === "timeout";
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getPreviewImage(task: PublicTask) {
  return task.result.thumbnailUrl || task.sourceImageUrl || null;
}

function readCache() {
  if (typeof window === "undefined") {
    return [] as PublicTask[];
  }

  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as PublicTask[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeCache(tasks: PublicTask[]) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(tasks));
  } catch {
    // ignore cache failures
  }
}

export function TaskHistorySection({
  currentTaskId,
  title = "做过的任务",
  description = "已生成过的任务会缓存在这里，刷新页面后也能快速看到。",
}: {
  currentTaskId?: string;
  title?: string;
  description?: string;
}) {
  const [tasks, setTasks] = useState<PublicTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const visibleTasks = useMemo(() => {
    return tasks.filter((task) => task.id !== currentTaskId).slice(0, 12);
  }, [currentTaskId, tasks]);

  const hasRunningTasks = useMemo(
    () => tasks.some((task) => !isTerminal(task.status)),
    [tasks],
  );

  const fetchTasks = useCallback(async () => {
    setError(null);

    try {
      const response = await fetch("/api/tasks?limit=12&refresh=true", {
        cache: "no-store",
      });
      const payload = (await response.json()) as
        | { tasks: PublicTask[] }
        | { error: string };

      if (!response.ok || !("tasks" in payload)) {
        throw new Error("error" in payload ? payload.error : "读取历史任务失败。");
      }

      setTasks(payload.tasks);
      writeCache(payload.tasks);
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "读取历史任务失败，请稍后重试。",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const cached = readCache();
    if (cached.length > 0) {
      setTasks(cached);
      setLoading(false);
    }

    void fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    const timer = window.setInterval(
      () => void fetchTasks(),
      hasRunningTasks ? 5000 : 15000,
    );

    return () => window.clearInterval(timer);
  }, [fetchTasks, hasRunningTasks]);

  return (
    <section className="panel-light rounded-[34px] p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.2em] text-slate-600">
            <History className="size-3.5" />
            History
          </div>
          <h3 className="mt-4 text-2xl font-semibold tracking-[-0.03em] text-slate-900">
            {title}
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
        </div>
      </div>

      <div className="mt-5">
        {loading && visibleTasks.length === 0 ? (
          <div className="rounded-[24px] border border-slate-200/80 bg-white/75 px-4 py-5 text-sm text-slate-500">
            正在读取历史任务...
          </div>
        ) : visibleTasks.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-slate-200 bg-white/70 px-4 py-5 text-sm text-slate-500">
            这里会缓存你已经做过的任务，方便回看、继续追踪和重新下载。
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visibleTasks.map((task) => {
              const meta = statusMap[task.status];
              const StatusIcon = meta.icon;
              const preview = getPreviewImage(task);
              const canDownload =
                Boolean(task.result.primaryModelUrl) || Boolean(task.result.thumbnailUrl);

              return (
                <article
                  key={task.id}
                  className="overflow-hidden rounded-[26px] border border-slate-200/85 bg-white/82 shadow-[0_16px_36px_rgba(148,163,184,0.08)]"
                >
                  <div className="relative aspect-[16/10] bg-[linear-gradient(180deg,#f7fbff,#eef5ff)]">
                    {preview ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={preview}
                          alt={task.sourceFileName}
                          className="h-full w-full object-cover"
                        />
                      </>
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-slate-400">
                        暂无预览图
                      </div>
                    )}

                    <div className="absolute left-3 top-3">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${meta.className}`}
                      >
                        <StatusIcon
                          className={`size-3.5 ${task.status === "processing" ? "animate-spin" : ""}`}
                        />
                        {meta.label}
                      </span>
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h4 className="truncate text-sm font-semibold text-slate-900">
                          {task.sourceFileName}
                        </h4>
                        <p className="mt-1 text-xs text-slate-400">
                          {formatTime(task.updatedAt)} · ID {task.id.slice(0, 8)}
                        </p>
                      </div>
                      <Link
                        href={`/tasks/${task.id}`}
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-sky-200 hover:text-sky-700"
                        aria-label="打开任务"
                      >
                        <ArrowUpRight className="size-4" />
                      </Link>
                    </div>

                    <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-500">
                      {task.stage}
                    </p>

                    <div className="mt-4 h-2 rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-[linear-gradient(90deg,#9fd8ff,#4aa4ff)] transition-[width] duration-500"
                        style={{ width: `${task.progress}%` }}
                      />
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link
                        href={`/tasks/${task.id}`}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-sky-200 hover:text-sky-700"
                      >
                        查看详情
                      </Link>
                      {canDownload && (
                        <a
                          href={`/api/tasks/${task.id}/download`}
                          className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,#8fd4ff,#5aa6ff)] px-4 py-2 text-sm font-medium text-white transition hover:opacity-92"
                        >
                          <Download className="size-4" />
                          下载
                        </a>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            {error}
          </div>
        )}
      </div>
    </section>
  );
}

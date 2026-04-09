"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Download,
  LoaderCircle,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";

import type { LocalTaskStatus, PublicTask } from "@/lib/types";

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

export function RecentTasksPanel() {
  const [tasks, setTasks] = useState<PublicTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasRunningTasks = useMemo(
    () => tasks.some((task) => !isTerminal(task.status)),
    [tasks],
  );

  const fetchTasks = useCallback(async (silent = false) => {
    if (!silent) {
      setRefreshing(true);
    }
    setError(null);

    try {
      const response = await fetch("/api/tasks?limit=6&refresh=true", {
        cache: "no-store",
      });
      const payload = (await response.json()) as
        | { tasks: PublicTask[] }
        | { error: string };

      if (!response.ok || !("tasks" in payload)) {
        throw new Error("error" in payload ? payload.error : "读取任务列表失败。");
      }

      setTasks(payload.tasks);
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "读取任务列表失败，请稍后再试。",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void fetchTasks(true);
    }, hasRunningTasks ? 4500 : 12000);

    return () => window.clearInterval(timer);
  }, [fetchTasks, hasRunningTasks]);

  return (
    <section className="panel-light rounded-[30px] p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-sky-600">
            Task Center
          </p>
          <h3 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-slate-900">
            最近任务
          </h3>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            回到首页后，任务会继续保留在这里，随时可查看最新进度。
          </p>
        </div>
        <button
          type="button"
          onClick={() => void fetchTasks()}
          disabled={refreshing}
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200/90 bg-white/80 text-slate-500 transition hover:border-sky-200 hover:text-sky-700 disabled:opacity-60"
          aria-label="刷新任务"
        >
          <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="mt-5 space-y-3">
        {loading ? (
          <div className="rounded-[24px] border border-slate-200/80 bg-white/72 px-4 py-5 text-sm text-slate-500">
            正在读取任务列表...
          </div>
        ) : tasks.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-slate-200 bg-white/62 px-4 py-5 text-sm text-slate-500">
            还没有任务。创建一次生成后，这里会自动记录并持续展示状态。
          </div>
        ) : (
          tasks.map((task) => {
            const meta = statusMap[task.status];
            const StatusIcon = meta.icon;
            const canDownload =
              Boolean(task.result.primaryModelUrl) || Boolean(task.result.thumbnailUrl);

            return (
              <article
                key={task.id}
                className="rounded-[24px] border border-slate-200/80 bg-white/80 p-4 shadow-[0_10px_30px_rgba(15,23,42,0.04)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${meta.className}`}
                      >
                        <StatusIcon
                          className={`size-3.5 ${task.status === "processing" ? "animate-spin" : ""}`}
                        />
                        {meta.label}
                      </span>
                      <span className="text-xs text-slate-400">
                        {formatTime(task.updatedAt)}
                      </span>
                    </div>
                    <h4 className="mt-3 truncate text-sm font-semibold text-slate-900">
                      {task.sourceFileName}
                    </h4>
                    <p className="mt-1 text-sm text-slate-500">{task.stage}</p>
                  </div>

                  <Link
                    href={`/tasks/${task.id}`}
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200/80 bg-white/86 text-slate-500 transition hover:border-sky-200 hover:text-sky-700"
                    aria-label="查看任务详情"
                  >
                    <ArrowUpRight className="size-4" />
                  </Link>
                </div>

                <div className="mt-4">
                  <div className="h-2 rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-[linear-gradient(90deg,#9fd8ff,#4aa4ff)] transition-[width] duration-500"
                      style={{ width: `${task.progress}%` }}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
                    <span>ID · {task.id.slice(0, 8)}</span>
                    <span>{task.progress}%</span>
                  </div>
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
              </article>
            );
          })
        )}

        {error && (
          <div className="rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            {error}
          </div>
        )}
      </div>
    </section>
  );
}

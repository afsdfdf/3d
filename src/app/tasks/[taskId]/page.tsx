import Link from "next/link";
import { notFound } from "next/navigation";

import { TaskHistorySection } from "@/components/task-history-section";
import { TaskView } from "./task-view";
import { readTask, toPublicTask } from "@/lib/storage";
import { refreshTask } from "@/lib/tasks";

export const dynamic = "force-dynamic";

export default async function TaskPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  const task = await readTask(taskId);

  if (!task) {
    notFound();
  }

  const refreshed = await refreshTask(taskId, { force: true });
  const initialTask = refreshed ?? toPublicTask(task);

  return (
    <main className="section-shell flex min-h-screen flex-col gap-6 py-6 sm:py-8">
      <div className="panel-light flex flex-wrap items-center justify-between gap-4 rounded-[34px] px-5 py-5 sm:px-6">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-sky-600">
            Result Center
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-900 sm:text-3xl">
            生成任务 #{initialTask.id.slice(0, 8)}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            返回首页后，该任务仍会出现在任务中心里，方便持续查看。
          </p>
        </div>
        <Link
          href="/"
          className="inline-flex items-center rounded-full border border-slate-200 bg-white/80 px-5 py-3 text-sm font-medium text-slate-700 transition hover:border-sky-200 hover:text-sky-700"
        >
          返回首页
        </Link>
      </div>

      <TaskView initialTask={initialTask} />

      <TaskHistorySection
        currentTaskId={initialTask.id}
        title="做过的任务"
        description="这个专栏会缓存你已经做过的任务。看完当前结果后，底部可以继续翻看历史任务、进度和下载结果。"
      />
    </main>
  );
}

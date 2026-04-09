import { NextResponse } from "next/server";

import { getTask, refreshTask } from "@/lib/tasks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ taskId: string }> },
) {
  const { taskId } = await context.params;
  const existing = await getTask(taskId);

  if (!existing) {
    return NextResponse.json({ error: "任务不存在。" }, { status: 404 });
  }

  const task = await refreshTask(taskId, { force: true });

  return NextResponse.json({ task: task ?? existing }, { status: 200 });
}

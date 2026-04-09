import { NextResponse } from "next/server";

import { getTask, refreshTask } from "@/lib/tasks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ taskId: string }> },
) {
  try {
    const { taskId } = await context.params;
    const existing = await getTask(taskId);

    if (!existing) {
      return NextResponse.json({ error: "Task not found." }, { status: 404 });
    }

    const task = await refreshTask(taskId, { force: true });

    return NextResponse.json({ task: task ?? existing }, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to read task details.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

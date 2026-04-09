import { readFile } from "node:fs/promises";

import { NextResponse } from "next/server";

import { readTask } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ taskId: string }> },
) {
  const { taskId } = await context.params;
  const task = await readTask(taskId);

  if (!task) {
    return NextResponse.json({ error: "任务不存在。" }, { status: 404 });
  }

  const fileBuffer = await readFile(task.sourceImagePath);

  return new NextResponse(fileBuffer, {
    headers: {
      "Content-Type": task.sourceMimeType,
      "Cache-Control": "no-store",
    },
  });
}

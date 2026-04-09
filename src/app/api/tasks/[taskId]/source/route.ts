import { NextResponse } from "next/server";

import { readStoredBinary, readTask } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ taskId: string }> },
) {
  const { taskId } = await context.params;
  const task = await readTask(taskId);

  if (!task) {
    return NextResponse.json({ error: "Task not found." }, { status: 404 });
  }

  if (!task.sourceImageBlobPath || !task.sourceMimeType) {
    return NextResponse.json({ error: "Source image not found." }, { status: 404 });
  }

  const source = await readStoredBinary(task.sourceImageBlobPath);

  if (!source) {
    return NextResponse.json({ error: "Source image not found." }, { status: 404 });
  }

  return new NextResponse(source.buffer, {
    headers: {
      "Content-Type": source.contentType ?? task.sourceMimeType,
      "Cache-Control": "no-store",
    },
  });
}

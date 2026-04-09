import { NextResponse } from "next/server";

import { createTask, listTasks } from "@/lib/tasks";
import {
  parseInputMode,
  parseSettingsFromFormData,
} from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limitRaw = Number(searchParams.get("limit") ?? "8");
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 20) : 8;
  const refresh = searchParams.get("refresh") === "true";

  const tasks = await listTasks({ limit, refresh });
  return NextResponse.json({ tasks }, { status: 200 });
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const inputMode = parseInputMode(formData);
    const settings = parseSettingsFromFormData(formData);

    const task =
      inputMode === "text"
        ? await createTask({
            inputMode: "text",
            prompt:
              typeof formData.get("prompt") === "string"
                ? String(formData.get("prompt"))
                : "",
            settings,
          })
        : await createTask({
            inputMode: "image",
            image: (() => {
              const image = formData.get("image");
              if (!(image instanceof File)) {
                throw new Error("请先选择一张图片。");
              }
              return image;
            })(),
            settings,
          });

    return NextResponse.json({ task }, { status: 202 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "创建生成任务时发生未知错误。";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

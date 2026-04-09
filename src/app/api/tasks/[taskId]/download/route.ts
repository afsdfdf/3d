import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextRequest, NextResponse } from "next/server";

import { readTask } from "@/lib/storage";
import type { OutputFormat, TaskRecord } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONTENT_TYPES: Record<string, string> = {
  glb: "model/gltf-binary",
  gltf: "model/gltf+json",
  fbx: "application/octet-stream",
  obj: "text/plain; charset=utf-8",
  stl: "model/stl",
  usdz: "model/vnd.usdz+zip",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  svg: "image/svg+xml",
};

function getLocalPublicPath(assetUrl: string) {
  const publicRoot = path.join(process.cwd(), "public");
  const normalized = path.normalize(assetUrl).replace(/^\\+|^\/+/, "");
  const resolved = path.join(publicRoot, normalized);

  if (!resolved.startsWith(publicRoot)) {
    throw new Error("本地资源路径非法。");
  }

  return resolved;
}

function pickAssetUrl(task: TaskRecord, format?: OutputFormat) {
  if (format && task.result.modelUrls[format]) {
    return task.result.modelUrls[format];
  }

  return (
    task.result.primaryModelUrl ||
    task.result.thumbnailUrl ||
    task.sourceImageUrl ||
    null
  );
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ taskId: string }> },
) {
  const { taskId } = await context.params;
  const task = await readTask(taskId);

  if (!task) {
    return NextResponse.json({ error: "任务不存在。" }, { status: 404 });
  }

  const requestedFormat = request.nextUrl.searchParams.get("format") as
    | OutputFormat
    | null;
  const assetUrl = pickAssetUrl(task, requestedFormat ?? undefined);

  if (!assetUrl) {
    return NextResponse.json({ error: "当前任务没有可下载结果。" }, { status: 404 });
  }

  if (assetUrl.startsWith("/")) {
    const filePath =
      assetUrl === task.sourceImageUrl && task.sourceImagePath
        ? task.sourceImagePath
        : getLocalPublicPath(assetUrl);
    const fileBuffer = await readFile(filePath);
    const extension = path.extname(filePath).replace(".", "") || "bin";

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": CONTENT_TYPES[extension] ?? "application/octet-stream",
        "Content-Disposition": `attachment; filename="${task.id}.${extension}"`,
      },
    });
  }

  const upstream = await fetch(assetUrl, { cache: "no-store" });

  if (!upstream.ok) {
    return NextResponse.json({ error: "下载远程模型文件失败。" }, { status: 502 });
  }

  const inferredExtension =
    path.extname(new URL(assetUrl).pathname).replace(".", "") || "glb";
  const extension = requestedFormat ?? inferredExtension;
  const arrayBuffer = await upstream.arrayBuffer();

  return new NextResponse(arrayBuffer, {
    headers: {
      "Content-Type": CONTENT_TYPES[extension] ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename="${task.id}.${extension}"`,
    },
  });
}

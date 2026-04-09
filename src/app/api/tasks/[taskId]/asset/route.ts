import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextRequest, NextResponse } from "next/server";

import { readStoredBinary, readTask } from "@/lib/storage";
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
    throw new Error("Invalid local asset path.");
  }

  return resolved;
}

function pickAssetUrl(
  task: TaskRecord,
  kind: "model" | "thumbnail",
  format?: OutputFormat,
) {
  if (kind === "thumbnail") {
    return task.result.thumbnailUrl || task.sourceImageUrl || null;
  }

  if (format && task.result.modelUrls[format]) {
    return task.result.modelUrls[format];
  }

  return task.result.primaryModelUrl || null;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ taskId: string }> },
) {
  const { taskId } = await context.params;
  const task = await readTask(taskId);

  if (!task) {
    return NextResponse.json({ error: "Task not found." }, { status: 404 });
  }

  const kindParam = request.nextUrl.searchParams.get("kind");
  const kind = kindParam === "thumbnail" ? "thumbnail" : "model";
  const requestedFormat = request.nextUrl.searchParams.get("format") as
    | OutputFormat
    | null;
  const assetUrl = pickAssetUrl(task, kind, requestedFormat ?? undefined);

  if (!assetUrl) {
    return NextResponse.json({ error: "Preview asset not found." }, { status: 404 });
  }

  if (assetUrl.startsWith("/")) {
    if (assetUrl === task.sourceImageUrl && task.sourceImageBlobPath) {
      const source = await readStoredBinary(task.sourceImageBlobPath);

      if (!source) {
        return NextResponse.json({ error: "Preview asset not found." }, { status: 404 });
      }

      const extension =
        path.extname(task.sourceImageBlobPath).replace(".", "") || "bin";

      return new NextResponse(source.buffer, {
        headers: {
          "Content-Type":
            source.contentType ??
            CONTENT_TYPES[extension] ??
            "application/octet-stream",
          "Cache-Control": "no-store",
        },
      });
    }

    const filePath = getLocalPublicPath(assetUrl);
    const fileBuffer = await readFile(filePath);
    const extension = path.extname(filePath).replace(".", "") || "bin";

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": CONTENT_TYPES[extension] ?? "application/octet-stream",
        "Cache-Control": "no-store",
      },
    });
  }

  const upstream = await fetch(assetUrl, { cache: "no-store" });

  if (!upstream.ok) {
    return NextResponse.json(
      { error: "Failed to fetch remote preview asset." },
      { status: 502 },
    );
  }

  const remoteExtension =
    path.extname(new URL(assetUrl).pathname).replace(".", "") ||
    (kind === "thumbnail" ? "png" : "glb");
  const inferredExtension = requestedFormat ?? remoteExtension;
  const arrayBuffer = await upstream.arrayBuffer();

  return new NextResponse(arrayBuffer, {
    headers: {
      "Content-Type":
        CONTENT_TYPES[inferredExtension] ?? "application/octet-stream",
      "Cache-Control": "no-store",
    },
  });
}

import {
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { get, list, put } from "@vercel/blob";

import type { PublicTask, TaskRecord } from "@/lib/types";
import { extensionFromFile } from "@/lib/utils";

const hasBlobStore = Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());

const runtimeRoot = process.env.VERCEL
  ? path.join(tmpdir(), "ai-3d-web-tool-runtime")
  : path.join(process.cwd(), ".runtime");
const tasksRoot = path.join(runtimeRoot, "tasks");
const uploadsRoot = path.join(runtimeRoot, "uploads");

const TASK_BLOB_PREFIX = "tasks/";
const UPLOAD_BLOB_PREFIX = "uploads/";

async function ensureRuntimeDirs() {
  await Promise.all([
    mkdir(tasksRoot, { recursive: true }),
    mkdir(uploadsRoot, { recursive: true }),
  ]);
}

function getTaskFilePath(taskId: string) {
  return path.join(tasksRoot, `${taskId}.json`);
}

function getTaskBlobPath(taskId: string) {
  return `${TASK_BLOB_PREFIX}${taskId}.json`;
}

async function atomicWrite(filePath: string, content: string) {
  const tempFile = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tempFile, content, "utf-8");

  try {
    await rename(tempFile, filePath);
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      ["EPERM", "EEXIST", "EBUSY"].includes(
        String((error as { code?: string }).code),
      )
    ) {
      await writeFile(filePath, content, "utf-8");
      await rm(tempFile, { force: true });
      return;
    }

    await rm(tempFile, { force: true });
    throw error;
  }
}

async function streamToString(stream: ReadableStream<Uint8Array>) {
  return await new Response(stream).text();
}

async function streamToBuffer(stream: ReadableStream<Uint8Array>) {
  const arrayBuffer = await new Response(stream).arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function saveUploadFileToBlob({
  taskId,
  fileName,
  mimeType,
  buffer,
}: {
  taskId: string;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}) {
  const extension = extensionFromFile(fileName, mimeType);
  const pathname = `${UPLOAD_BLOB_PREFIX}${taskId}${extension}`;

  await put(pathname, buffer, {
    access: "private",
    allowOverwrite: true,
    addRandomSuffix: false,
    contentType: mimeType,
  });

  return {
    sourceImageBlobPath: pathname,
    sourceImageUrl: `/api/tasks/${taskId}/source`,
  };
}

async function saveUploadFileToFs({
  taskId,
  fileName,
  mimeType,
  buffer,
}: {
  taskId: string;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}) {
  await ensureRuntimeDirs();
  const extension = extensionFromFile(fileName, mimeType);
  const sourceImagePath = path.join(uploadsRoot, `${taskId}${extension}`);
  await writeFile(sourceImagePath, buffer);

  return {
    sourceImageBlobPath: sourceImagePath,
    sourceImageUrl: `/api/tasks/${taskId}/source`,
  };
}

export async function saveUploadFile(args: {
  taskId: string;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}) {
  if (hasBlobStore) {
    return saveUploadFileToBlob(args);
  }

  return saveUploadFileToFs(args);
}

async function writeTaskToBlob(task: TaskRecord) {
  await put(getTaskBlobPath(task.id), JSON.stringify(task, null, 2), {
    access: "private",
    allowOverwrite: true,
    addRandomSuffix: false,
    contentType: "application/json; charset=utf-8",
  });
  return task;
}

async function writeTaskToFs(task: TaskRecord) {
  await ensureRuntimeDirs();
  await atomicWrite(getTaskFilePath(task.id), JSON.stringify(task, null, 2));
  return task;
}

export async function writeTask(task: TaskRecord) {
  if (hasBlobStore) {
    return writeTaskToBlob(task);
  }

  return writeTaskToFs(task);
}

async function readTaskFromBlob(taskId: string) {
  const result = await get(getTaskBlobPath(taskId), {
    access: "private",
    useCache: false,
  });

  if (!result || result.statusCode !== 200 || !result.stream) {
    return null;
  }

  const raw = await streamToString(result.stream);
  return JSON.parse(raw) as TaskRecord;
}

async function readTaskFromFs(taskId: string) {
  try {
    await ensureRuntimeDirs();
    const raw = await readFile(getTaskFilePath(taskId), "utf-8");
    return JSON.parse(raw) as TaskRecord;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "ENOENT"
    ) {
      return null;
    }

    throw error;
  }
}

export async function readTask(taskId: string) {
  if (hasBlobStore) {
    return readTaskFromBlob(taskId);
  }

  return readTaskFromFs(taskId);
}

async function listTaskRecordsFromBlob(limit = 8) {
  const tasks: TaskRecord[] = [];
  let cursor: string | undefined;

  do {
    const result = await list({
      prefix: TASK_BLOB_PREFIX,
      limit: 1000,
      cursor,
    });

    const batch = await Promise.all(
      result.blobs.map(async (blob) => {
        const fetched = await get(blob.pathname, {
          access: "private",
          useCache: false,
        });

        if (!fetched || fetched.statusCode !== 200 || !fetched.stream) {
          return null;
        }

        const raw = await streamToString(fetched.stream);
        return JSON.parse(raw) as TaskRecord;
      }),
    );

    tasks.push(...batch.filter((task): task is TaskRecord => task !== null));
    cursor = result.hasMore ? result.cursor : undefined;
  } while (cursor);

  return tasks
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )
    .slice(0, limit);
}

async function listTaskRecordsFromFs(limit = 8) {
  await ensureRuntimeDirs();
  const entries = await readdir(tasksRoot, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => path.join(tasksRoot, entry.name));

  const tasks = await Promise.all(
    files.map(async (filePath) => {
      const raw = await readFile(filePath, "utf-8");
      return JSON.parse(raw) as TaskRecord;
    }),
  );

  return tasks
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )
    .slice(0, limit);
}

export async function listTaskRecords(limit = 8) {
  if (hasBlobStore) {
    return listTaskRecordsFromBlob(limit);
  }

  return listTaskRecordsFromFs(limit);
}

export async function readStoredBinary(pathname: string) {
  if (hasBlobStore) {
    const result = await get(pathname, {
      access: "private",
      useCache: false,
    });

    if (!result || result.statusCode !== 200 || !result.stream) {
      return null;
    }

    return {
      buffer: await streamToBuffer(result.stream),
      contentType: result.blob.contentType,
    };
  }

  try {
    return {
      buffer: await readFile(pathname),
      contentType: undefined,
    };
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "ENOENT"
    ) {
      return null;
    }

    throw error;
  }
}

export function toPublicTask(task: TaskRecord): PublicTask {
  return Object.fromEntries(
    Object.entries(task).filter(([key]) => key !== "sourceImageBlobPath"),
  ) as PublicTask;
}

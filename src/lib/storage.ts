import {
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

import type { PublicTask, TaskRecord } from "@/lib/types";
import { extensionFromFile } from "@/lib/utils";

const runtimeRoot = path.join(process.cwd(), ".runtime");
const tasksRoot = path.join(runtimeRoot, "tasks");
const uploadsRoot = path.join(runtimeRoot, "uploads");

async function ensureRuntimeDirs() {
  await Promise.all([
    mkdir(tasksRoot, { recursive: true }),
    mkdir(uploadsRoot, { recursive: true }),
  ]);
}

function getTaskFilePath(taskId: string) {
  return path.join(tasksRoot, `${taskId}.json`);
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

export async function saveUploadFile({
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
    sourceImagePath,
    sourceImageUrl: `/api/tasks/${taskId}/source`,
  };
}

export async function writeTask(task: TaskRecord) {
  await ensureRuntimeDirs();
  await atomicWrite(getTaskFilePath(task.id), JSON.stringify(task, null, 2));
  return task;
}

export async function readTask(taskId: string) {
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

export async function listTaskRecords(limit = 8) {
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

export function toPublicTask(task: TaskRecord): PublicTask {
  return Object.fromEntries(
    Object.entries(task).filter(([key]) => key !== "sourceImagePath"),
  ) as PublicTask;
}

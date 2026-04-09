import { nanoid } from "nanoid";

import { env } from "@/lib/env";
import { createProviderTask, syncProviderTask } from "@/lib/provider";
import {
  listTaskRecords,
  readTask,
  saveUploadFile,
  toPublicTask,
  writeTask,
} from "@/lib/storage";
import type {
  GenerateSettings,
  LocalTaskStatus,
  PublicTask,
  TaskRecord,
} from "@/lib/types";
import { bufferToDataUri, clamp, formatPromptLabel } from "@/lib/utils";

function isTerminal(status: LocalTaskStatus) {
  return status === "succeeded" || status === "failed" || status === "timeout";
}

function mergeTask(task: TaskRecord, patch: Partial<TaskRecord>) {
  return {
    ...task,
    ...patch,
    result: {
      ...task.result,
      ...(patch.result ?? {}),
      modelUrls: {
        ...task.result.modelUrls,
        ...(patch.result?.modelUrls ?? {}),
      },
    },
  } satisfies TaskRecord;
}

export async function createTask(
  input:
    | { inputMode: "image"; image: File; settings: GenerateSettings }
    | { inputMode: "text"; prompt: string; settings: GenerateSettings },
): Promise<PublicTask> {
  const taskId = nanoid(12);
  const createdAt = new Date().toISOString();
  let task: TaskRecord;

  if (input.inputMode === "image") {
    const image = input.image;

    if (!image.type.startsWith("image/")) {
      throw new Error("仅支持图片文件上传。");
    }

    if (image.size > env.maxUploadBytes) {
      throw new Error(
        `上传图片不能超过 ${Math.round(env.maxUploadBytes / 1024 / 1024)}MB。`,
      );
    }

    const fileBuffer = Buffer.from(await image.arrayBuffer());
    const upload = await saveUploadFile({
      taskId,
      fileName: image.name,
      mimeType: image.type,
      buffer: fileBuffer,
    });

    task = {
      id: taskId,
      provider: env.provider,
      inputMode: "image",
      status: "uploading",
      progress: 4,
      stage: "图片上传完成，准备提交生成任务",
      createdAt,
      updatedAt: createdAt,
      sourceFileName: image.name,
      sourceMimeType: image.type,
      sourceImagePath: upload.sourceImagePath,
      sourceImageUrl: upload.sourceImageUrl,
      settings: input.settings,
      result: {
        modelUrls: {},
      },
    };

    await writeTask(task);

    try {
      const providerResult = await createProviderTask({
        localTaskId: taskId,
        inputMode: "image",
        sourceFileName: image.name,
        sourceMimeType: image.type,
        sourceImageUrl: upload.sourceImageUrl,
        sourceDataUri: bufferToDataUri(fileBuffer, image.type),
        settings: input.settings,
        createdAt,
      });

      task = mergeTask(task, {
        provider: providerResult.provider,
        providerTaskId: providerResult.providerTaskId,
        providerTaskFlow: providerResult.providerTaskFlow,
        previewTaskId: providerResult.previewTaskId,
        status: providerResult.status,
        progress: clamp(providerResult.progress, 0, 100),
        stage: providerResult.stage,
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastProviderSyncAt: new Date().toISOString(),
        errorMessage: providerResult.errorMessage,
        result: providerResult.result,
        finishedAt:
          providerResult.status === "succeeded" ||
          providerResult.status === "failed"
            ? new Date().toISOString()
            : undefined,
      });

      await writeTask(task);
      return toPublicTask(task);
    } catch (error) {
      task = mergeTask(task, {
        status: "failed",
        progress: 100,
        stage: "提交第三方任务失败",
        updatedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        errorMessage:
          error instanceof Error ? error.message : "提交第三方任务失败，请稍后重试。",
      });
      await writeTask(task);
      return toPublicTask(task);
    }
  }

  const prompt = input.prompt.trim();
  if (!prompt) {
    throw new Error("请输入文字描述。");
  }

  task = {
    id: taskId,
    provider: env.provider,
    inputMode: "text",
    prompt,
    status: "queued",
    progress: 4,
    stage: "文字提示词已提交，准备创建生成任务",
    createdAt,
    updatedAt: createdAt,
    sourceFileName: formatPromptLabel(prompt),
    settings: input.settings,
    result: {
      modelUrls: {},
    },
  };

  await writeTask(task);

  try {
    const providerResult = await createProviderTask({
      localTaskId: taskId,
      inputMode: "text",
      prompt,
      settings: input.settings,
      createdAt,
    });

    task = mergeTask(task, {
      provider: providerResult.provider,
      providerTaskId: providerResult.providerTaskId,
      providerTaskFlow: providerResult.providerTaskFlow,
      previewTaskId: providerResult.previewTaskId,
      status: providerResult.status,
      progress: clamp(providerResult.progress, 0, 100),
      stage: providerResult.stage,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastProviderSyncAt: new Date().toISOString(),
      errorMessage: providerResult.errorMessage,
      result: providerResult.result,
      finishedAt:
        providerResult.status === "succeeded" ||
        providerResult.status === "failed"
          ? new Date().toISOString()
          : undefined,
    });

    await writeTask(task);
    return toPublicTask(task);
  } catch (error) {
    task = mergeTask(task, {
      status: "failed",
      progress: 100,
      stage: "提交第三方任务失败",
      updatedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      errorMessage:
        error instanceof Error ? error.message : "提交第三方任务失败，请稍后重试。",
    });
    await writeTask(task);
    return toPublicTask(task);
  }
}

export async function getTask(taskId: string): Promise<PublicTask | null> {
  const task = await readTask(taskId);
  return task ? toPublicTask(task) : null;
}

export async function refreshTask(
  taskId: string,
  options: { force?: boolean } = {},
): Promise<PublicTask | null> {
  const existing = await readTask(taskId);

  if (!existing) {
    return null;
  }

  if (isTerminal(existing.status)) {
    return toPublicTask(existing);
  }

  const now = Date.now();
  const createdAt = new Date(existing.createdAt).getTime();
  if (now - createdAt > env.taskTimeoutMs) {
    const timedOut = mergeTask(existing, {
      status: "timeout",
      progress: Math.max(existing.progress, 99),
      stage: "任务超时，请重新提交",
      updatedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      errorMessage: "第三方模型生成超时，请稍后重试。",
    });

    await writeTask(timedOut);
    return toPublicTask(timedOut);
  }

  const lastSyncAt = existing.lastProviderSyncAt
    ? new Date(existing.lastProviderSyncAt).getTime()
    : 0;

  if (!options.force && now - lastSyncAt < env.taskSyncIntervalMs) {
    return toPublicTask(existing);
  }

  const providerResult = await syncProviderTask(existing);
  const updated = mergeTask(existing, {
    provider: providerResult.provider,
    providerTaskId: providerResult.providerTaskId,
    providerTaskFlow: providerResult.providerTaskFlow,
    previewTaskId: providerResult.previewTaskId ?? existing.previewTaskId,
    status: providerResult.status,
    progress: clamp(providerResult.progress, 0, 100),
    stage: providerResult.stage,
    updatedAt: new Date().toISOString(),
    lastProviderSyncAt: new Date().toISOString(),
    errorMessage: providerResult.errorMessage,
    result: providerResult.result,
    finishedAt: isTerminal(providerResult.status)
      ? new Date().toISOString()
      : existing.finishedAt,
  });

  await writeTask(updated);
  return toPublicTask(updated);
}

export async function listTasks(options?: { limit?: number; refresh?: boolean }) {
  const limit = options?.limit ?? 8;
  const refresh = options?.refresh ?? false;
  const tasks = await listTaskRecords(limit);

  if (!refresh) {
    return tasks.map(toPublicTask);
  }

  const refreshed = await Promise.all(
    tasks.map(async (task) => {
      if (isTerminal(task.status)) {
        return toPublicTask(task);
      }

      const updated = await refreshTask(task.id);
      return updated ?? toPublicTask(task);
    }),
  );

  return refreshed.sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

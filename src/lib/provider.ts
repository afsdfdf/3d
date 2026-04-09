import { env } from "@/lib/env";
import type {
  LocalTaskStatus,
  OutputFormat,
  ProviderCreateInput,
  ProviderSyncResult,
  TaskRecord,
  TaskResultAssets,
} from "@/lib/types";
import { clamp } from "@/lib/utils";

const SUPPORTED_FORMATS: OutputFormat[] = ["glb", "fbx", "obj", "stl", "usdz"];

function statusFromRemoteStatus(status: string): LocalTaskStatus {
  switch (status.toUpperCase()) {
    case "PENDING":
    case "QUEUED":
      return "queued";
    case "FAILED":
    case "CANCELED":
    case "CANCELLED":
    case "EXPIRED":
      return "failed";
    case "SUCCEEDED":
      return "succeeded";
    default:
      return "processing";
  }
}

function normalizeProgress(value: unknown, status: LocalTaskStatus) {
  if (typeof value === "number" && Number.isFinite(value)) {
    const normalized = value <= 1 ? value * 100 : value;
    return Math.round(clamp(normalized, 0, 100));
  }

  if (status === "queued") return 8;
  if (status === "processing") return 62;
  return 100;
}

function buildStage(status: LocalTaskStatus, progress: number) {
  if (status === "queued") {
    return "任务已创建，等待第三方服务处理";
  }

  if (status === "processing") {
    if (progress < 35) return "正在分析输入图片";
    if (progress < 72) return "正在生成几何网格";
    return "正在整理纹理与导出模型";
  }

  if (status === "succeeded") return "模型已生成，可以预览与下载";
  if (status === "timeout") return "任务超时，请稍后重试";
  return "生成失败，请调整参数后重试";
}

function extractModelUrls(data: Record<string, unknown>): TaskResultAssets {
  const modelUrlsRaw =
    data.model_urls && typeof data.model_urls === "object"
      ? (data.model_urls as Record<string, unknown>)
      : {};

  const modelUrls: Partial<Record<OutputFormat, string>> = {};

  for (const format of SUPPORTED_FORMATS) {
    const value = modelUrlsRaw[format];
    if (typeof value === "string" && value.length > 0) {
      modelUrls[format] = value;
    }
  }

  const primaryModelUrl =
    modelUrls.glb ?? Object.values(modelUrls).find((value) => Boolean(value));
  const thumbnailUrl =
    typeof data.thumbnail_url === "string" && data.thumbnail_url.length > 0
      ? data.thumbnail_url
      : typeof data.preview_image_url === "string" &&
          data.preview_image_url.length > 0
        ? data.preview_image_url
        : undefined;

  return {
    thumbnailUrl,
    primaryModelUrl,
    modelUrls,
  };
}

async function fetchMeshy(pathname: string, init: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.providerRequestTimeoutMs);

  try {
    const response = await fetch(`${env.meshyApiBaseUrl}${pathname}`, {
      ...init,
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${env.meshyApiKey}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
    });

    const data = (await response.json()) as Record<string, unknown>;

    if (!response.ok) {
      const message =
        typeof data.message === "string"
          ? data.message
          : "第三方 AI 服务返回异常。";
      throw new Error(message);
    }

    return data;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("调用第三方 AI 服务超时，请稍后重试。");
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function createMeshyTask(
  input: ProviderCreateInput,
): Promise<ProviderSyncResult> {
  const body: Record<string, unknown> = {
    image_url: input.sourceDataUri,
    model_type: "standard",
    ai_model: "latest",
    topology: input.settings.topology,
    target_polycount: input.settings.targetPolycount,
    should_remesh: true,
    should_texture: input.settings.shouldTexture,
    target_formats: input.settings.targetFormats,
    image_enhancement: true,
    remove_lighting: true,
  };

  if (input.settings.shouldTexture) {
    body.enable_pbr = true;
  }

  if (input.settings.texturePrompt.trim()) {
    body.texture_prompt = input.settings.texturePrompt.trim();
  }

  const data = await fetchMeshy("/image-to-3d", {
    method: "POST",
    body: JSON.stringify(body),
  });

  const providerTaskId =
    typeof data.result === "string"
      ? data.result
      : typeof data.id === "string"
        ? data.id
        : null;

  if (!providerTaskId) {
    throw new Error("第三方 AI 服务未返回任务 ID。");
  }

  return {
    provider: "meshy",
    providerTaskId,
    status: "queued",
    progress: 8,
    stage: "任务已提交到 Meshy，等待处理",
  };
}

async function syncMeshyTask(task: TaskRecord): Promise<ProviderSyncResult> {
  const data = await fetchMeshy(`/image-to-3d/${task.providerTaskId}`, {
    method: "GET",
  });

  const remoteStatus = typeof data.status === "string" ? data.status : "PENDING";
  const status = statusFromRemoteStatus(remoteStatus);
  const progress = normalizeProgress(data.progress, status);
  const result = extractModelUrls(data);
  const taskError =
    data.task_error && typeof data.task_error === "object"
      ? (data.task_error as Record<string, unknown>)
      : null;

  const errorMessage =
    status === "failed"
      ? typeof taskError?.message === "string"
        ? taskError.message
        : typeof data.message === "string"
          ? data.message
          : "第三方模型生成失败。"
      : undefined;

  return {
    provider: "meshy",
    providerTaskId: task.providerTaskId ?? "",
    status,
    progress,
    stage: buildStage(status, progress),
    errorMessage,
    result,
    raw: data,
  };
}

function createMockTask(input: ProviderCreateInput): ProviderSyncResult {
  return {
    provider: "mock",
    providerTaskId: `mock-${input.localTaskId}`,
    status: "queued",
    progress: 6,
    stage: "Mock 模式已启动，准备生成演示模型",
  };
}

function syncMockTask(task: TaskRecord): ProviderSyncResult {
  const elapsed = Date.now() - new Date(task.createdAt).getTime();

  if (elapsed < 2_000) {
    return {
      provider: "mock",
      providerTaskId: task.providerTaskId ?? `mock-${task.id}`,
      status: "queued",
      progress: 12,
      stage: "Mock 队列中",
    };
  }

  if (elapsed < 7_000) {
    const progress = clamp(Math.round(18 + ((elapsed - 2_000) / 5_000) * 70), 18, 88);
    return {
      provider: "mock",
      providerTaskId: task.providerTaskId ?? `mock-${task.id}`,
      status: "processing",
      progress,
      stage: buildStage("processing", progress),
    };
  }

  return {
    provider: "mock",
    providerTaskId: task.providerTaskId ?? `mock-${task.id}`,
    status: "succeeded",
    progress: 100,
    stage: "Mock 模型已准备完成",
    result: {
      thumbnailUrl: "/demo/mock-preview.svg",
      primaryModelUrl: "/demo/mock-model.gltf",
      modelUrls: {
        glb: "/demo/mock-model.gltf",
      },
    },
  };
}

export async function createProviderTask(
  input: ProviderCreateInput,
): Promise<ProviderSyncResult> {
  if (env.provider === "meshy") {
    return createMeshyTask(input);
  }

  return createMockTask(input);
}

export async function syncProviderTask(
  task: TaskRecord,
): Promise<ProviderSyncResult> {
  if (task.provider === "meshy") {
    return syncMeshyTask(task);
  }

  return syncMockTask(task);
}

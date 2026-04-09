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

function buildStage(
  status: LocalTaskStatus,
  progress: number,
  inputMode: "image" | "text",
  flow?: TaskRecord["providerTaskFlow"],
) {
  if (status === "queued") {
    return inputMode === "text"
      ? "任务已创建，等待生成 3D 草模"
      : "任务已创建，等待第三方服务处理";
  }

  if (status === "processing") {
    if (inputMode === "text" && flow === "text-preview") {
      if (progress < 45) return "正在根据文字生成 3D 草模";
      return "正在整理预览模型";
    }

    if (inputMode === "text" && flow === "text-refine") {
      if (progress < 55) return "正在细化网格与结构";
      return "正在烘焙材质与导出模型";
    }

    if (progress < 35) return "正在分析输入内容";
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

function extractTaskId(data: Record<string, unknown>) {
  return typeof data.result === "string"
    ? data.result
    : typeof data.id === "string"
      ? data.id
      : null;
}

async function createMeshyImageTask(
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

  const providerTaskId = extractTaskId(data);

  if (!providerTaskId) {
    throw new Error("第三方 AI 服务未返回任务 ID。");
  }

  return {
    provider: "meshy",
    providerTaskId,
    providerTaskFlow: "image-to-3d",
    status: "queued",
    progress: 8,
    stage: "任务已提交到 Meshy，等待处理",
  };
}

async function createMeshyTextTask(
  input: ProviderCreateInput,
): Promise<ProviderSyncResult> {
  const prompt = input.prompt?.trim();
  if (!prompt) {
    throw new Error("请输入文字描述。");
  }

  const body: Record<string, unknown> = {
    prompt,
    ai_model: "latest",
    should_remesh: true,
    topology: input.settings.topology,
  };

  const data = await fetchMeshy("/text-to-3d", {
    method: "POST",
    body: JSON.stringify(body),
  });

  const providerTaskId = extractTaskId(data);

  if (!providerTaskId) {
    throw new Error("第三方 AI 服务未返回文本任务 ID。");
  }

  return {
    provider: "meshy",
    providerTaskId,
    providerTaskFlow: "text-preview",
    status: "queued",
    progress: 8,
    stage: "文字任务已提交，正在生成 3D 草模",
  };
}

async function syncMeshyImageTask(task: TaskRecord): Promise<ProviderSyncResult> {
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
    providerTaskFlow: "image-to-3d",
    status,
    progress,
    stage: buildStage(status, progress, "image", "image-to-3d"),
    errorMessage,
    result,
    raw: data,
  };
}

async function syncMeshyTextTask(task: TaskRecord): Promise<ProviderSyncResult> {
  const flow = task.providerTaskFlow ?? "text-preview";
  const data = await fetchMeshy(`/text-to-3d/${task.providerTaskId}`, {
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

  if (
    flow === "text-preview" &&
    status === "succeeded" &&
    task.settings.shouldTexture
  ) {
    const previewTaskId = task.providerTaskId ?? "";
    const refineBody: Record<string, unknown> = {
      preview_task_id: previewTaskId,
      should_texture: true,
      should_remesh: true,
      target_formats: task.settings.targetFormats,
    };

    if (task.settings.texturePrompt.trim()) {
      refineBody.texture_prompt = task.settings.texturePrompt.trim();
    }

    const refineData = await fetchMeshy("/text-to-3d", {
      method: "POST",
      body: JSON.stringify(refineBody),
    });
    const refineTaskId = extractTaskId(refineData);

    if (!refineTaskId) {
      throw new Error("Meshy 细化任务创建失败。");
    }

    return {
      provider: "meshy",
      providerTaskId: refineTaskId,
      previewTaskId,
      providerTaskFlow: "text-refine",
      status: "processing",
      progress: 55,
      stage: "草模已完成，正在细化并生成可下载模型",
      result,
      raw: refineData,
    };
  }

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
    providerTaskFlow: flow,
    previewTaskId: task.previewTaskId,
    status,
    progress,
    stage: buildStage(status, progress, "text", flow),
    errorMessage,
    result,
    raw: data,
  };
}

function createMockTask(input: ProviderCreateInput): ProviderSyncResult {
  return {
    provider: "mock",
    providerTaskId: `mock-${input.localTaskId}`,
    providerTaskFlow:
      input.inputMode === "text" ? "text-refine" : "image-to-3d",
    status: "queued",
    progress: 6,
    stage:
      input.inputMode === "text"
        ? "Mock 文本模式已启动，准备生成演示模型"
        : "Mock 图片模式已启动，准备生成演示模型",
  };
}

function syncMockTask(task: TaskRecord): ProviderSyncResult {
  const elapsed = Date.now() - new Date(task.createdAt).getTime();

  if (elapsed < 2_000) {
    return {
      provider: "mock",
      providerTaskId: task.providerTaskId ?? `mock-${task.id}`,
      providerTaskFlow: task.providerTaskFlow,
      status: "queued",
      progress: 12,
      stage: "Mock 队列中",
    };
  }

  if (elapsed < 7_000) {
    const progress = clamp(
      Math.round(18 + ((elapsed - 2_000) / 5_000) * 70),
      18,
      88,
    );
    return {
      provider: "mock",
      providerTaskId: task.providerTaskId ?? `mock-${task.id}`,
      providerTaskFlow: task.providerTaskFlow,
      status: "processing",
      progress,
      stage: buildStage(task.status, progress, task.inputMode, task.providerTaskFlow),
    };
  }

  return {
    provider: "mock",
    providerTaskId: task.providerTaskId ?? `mock-${task.id}`,
    providerTaskFlow: task.providerTaskFlow,
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
    return input.inputMode === "text"
      ? createMeshyTextTask(input)
      : createMeshyImageTask(input);
  }

  return createMockTask(input);
}

export async function syncProviderTask(
  task: TaskRecord,
): Promise<ProviderSyncResult> {
  if (task.provider === "meshy") {
    return task.inputMode === "text"
      ? syncMeshyTextTask(task)
      : syncMeshyImageTask(task);
  }

  return syncMockTask(task);
}

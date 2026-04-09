import { env } from "@/lib/env";
import { parseJsonResponse } from "@/lib/http";
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

const meshyApiOrigin = env.meshyApiBaseUrl
  .replace(/\/openapi\/v\d+\/?$/, "")
  .replace(/\/$/, "");

function buildMeshyUrl(pathname: string) {
  if (/^https?:\/\//.test(pathname)) {
    return pathname;
  }

  return `${meshyApiOrigin}${pathname}`;
}

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
      ? "Task created. Waiting to generate 3D preview."
      : "Task created. Waiting for Meshy processing.";
  }

  if (status === "processing") {
    if (inputMode === "text" && flow === "text-preview") {
      if (progress < 45) return "Generating 3D preview from text prompt.";
      return "Please enter a text prompt.";
    }

    if (inputMode === "text" && flow === "text-refine") {
      if (progress < 55) return "Refining mesh and structure.";
      return "Baking materials and exporting model.";
    }

    if (progress < 35) return "Please enter a text prompt.";
    if (progress < 72) return "Please enter a text prompt.";
    return "Baking materials and exporting model.";
  }

  if (status === "succeeded") return "Model is ready for preview and download.";
  if (status === "timeout") return "Third-party model generation failed.";
  return "Model is ready for preview and download.";
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
    const response = await fetch(buildMeshyUrl(pathname), {
      ...init,
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${env.meshyApiKey}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
    });

    const data = (await parseJsonResponse<Record<string, unknown>>(
      response,
    )) as Record<string, unknown> | { error: string };

    if (!response.ok) {
      const responseMessage =
        "message" in data && typeof data.message === "string"
          ? data.message
          : null;
      const responseError =
        "error" in data && typeof data.error === "string" ? data.error : null;
      throw new Error(responseMessage ?? responseError ?? "Third-party AI service returned an unexpected response.");
    }

    if ("error" in data) {
      throw new Error(typeof data.error === "string" ? data.error : "Request failed.");
    }

    return data;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Third-party AI request timed out. Please try again later.");
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

  const data = await fetchMeshy("/openapi/v1/image-to-3d", {
    method: "POST",
    body: JSON.stringify(body),
  });

  const providerTaskId = extractTaskId(data);

  if (!providerTaskId) {
    throw new Error("Third-party AI service did not return a task ID.");
  }

  return {
    provider: "meshy",
    providerTaskId,
    providerTaskFlow: "image-to-3d",
    status: "queued",
    progress: 8,
    stage: "Task submitted to Meshy. Waiting for processing.",
  };
}

async function createMeshyTextTask(
  input: ProviderCreateInput,
): Promise<ProviderSyncResult> {
  const prompt = input.prompt?.trim();
  if (!prompt) {
    throw new Error("Please enter a text prompt.");
  }

  const body: Record<string, unknown> = {
    mode: "preview",
    prompt,
    ai_model: "latest",
    should_remesh: true,
    topology: input.settings.topology,
    target_polycount: input.settings.targetPolycount,
  };

  const data = await fetchMeshy("/openapi/v2/text-to-3d", {
    method: "POST",
    body: JSON.stringify(body),
  });

  const providerTaskId = extractTaskId(data);

  if (!providerTaskId) {
    throw new Error("Third-party AI service did not return a text task ID.");
  }

  return {
    provider: "meshy",
    providerTaskId,
    providerTaskFlow: "text-preview",
    status: "queued",
    progress: 8,
    stage: "Text task submitted. Generating 3D preview.",
  };
}

async function syncMeshyImageTask(task: TaskRecord): Promise<ProviderSyncResult> {
  const data = await fetchMeshy(`/openapi/v1/image-to-3d/${task.providerTaskId}`, {
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
          : "Third-party model generation failed."
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
  const data = await fetchMeshy(`/openapi/v2/text-to-3d/${task.providerTaskId}`, {
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
      mode: "refine",
      preview_task_id: previewTaskId,
      should_texture: true,
      should_remesh: true,
      enable_pbr: true,
      target_formats: task.settings.targetFormats,
      ai_model: "latest",
      topology: task.settings.topology,
    };

    if (task.settings.texturePrompt.trim()) {
      refineBody.texture_prompt = task.settings.texturePrompt.trim();
    }

    const refineData = await fetchMeshy("/openapi/v2/text-to-3d", {
      method: "POST",
      body: JSON.stringify(refineBody),
    });
    const refineTaskId = extractTaskId(refineData);

    if (!refineTaskId) {
      throw new Error("Failed to create Meshy refine task.");
    }

    return {
      provider: "meshy",
      providerTaskId: refineTaskId,
      previewTaskId,
      providerTaskFlow: "text-refine",
      status: "processing",
      progress: 55,
      stage: "Preview completed. Refining and preparing downloadable model.",
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
          : "Third-party model generation failed."
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
        ? "Mock text mode started. Preparing demo model."
        : "Mock text mode started. Preparing demo model.",
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
      stage: "Mock task queued.",
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
    stage: "Mock model is ready.",
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

import type { ProviderName } from "@/lib/types";

function readNumber(name: string, fallback: number) {
  const raw = process.env[name];

  if (!raw) {
    return fallback;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const hasMeshyApiKey = Boolean(process.env.MESHY_API_KEY?.trim());
const requestedProvider = process.env.AI_PROVIDER?.trim().toLowerCase();

const provider: ProviderName =
  requestedProvider === "mock"
    ? "mock"
    : requestedProvider === "meshy"
      ? hasMeshyApiKey
        ? "meshy"
        : "mock"
      : hasMeshyApiKey
        ? "meshy"
        : "mock";

export const env = {
  provider,
  hasMeshyApiKey,
  meshyApiKey: process.env.MESHY_API_KEY?.trim() ?? "",
  meshyApiBaseUrl:
    process.env.MESHY_API_BASE_URL?.trim() ?? "https://api.meshy.ai/openapi/v1",
  providerRequestTimeoutMs: readNumber("PROVIDER_REQUEST_TIMEOUT_MS", 30_000),
  taskTimeoutMs: readNumber("TASK_TIMEOUT_MS", 15 * 60 * 1000),
  taskSyncIntervalMs: readNumber("TASK_SYNC_INTERVAL_MS", 5_000),
  maxUploadBytes: readNumber("MAX_UPLOAD_BYTES", 8 * 1024 * 1024),
} as const;

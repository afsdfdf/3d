import path from "node:path";

import type {
  GenerateSettings,
  OutputFormat,
  QualityPreset,
  TaskInputMode,
  TopologyMode,
} from "@/lib/types";

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function bufferToDataUri(buffer: Buffer, mimeType: string) {
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

export function extensionFromFile(fileName: string, mimeType: string) {
  const fromName = path.extname(fileName).toLowerCase();
  if (fromName) {
    return fromName;
  }

  switch (mimeType) {
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    case "image/jpeg":
    case "image/jpg":
      return ".jpg";
    default:
      return ".bin";
  }
}

export function formatPromptLabel(prompt: string) {
  const normalized = prompt.replace(/\s+/g, " ").trim();
  return normalized.length > 48 ? `${normalized.slice(0, 48)}...` : normalized;
}

export function parseSettingsFromFormData(formData: FormData): GenerateSettings {
  const qualityRaw = formData.get("quality");
  const topologyRaw = formData.get("topology");
  const shouldTextureRaw = formData.get("shouldTexture");
  const texturePromptRaw = formData.get("texturePrompt");

  const quality: QualityPreset =
    qualityRaw === "draft" ? "draft" : "production";
  const topology: TopologyMode =
    topologyRaw === "triangle" ? "triangle" : "quad";
  const shouldTexture = shouldTextureRaw === "true";
  const texturePrompt =
    typeof texturePromptRaw === "string" ? texturePromptRaw : "";
  const targetPolycount = quality === "production" ? 120_000 : 50_000;
  const targetFormats: OutputFormat[] = ["glb"];

  return {
    quality,
    topology,
    shouldTexture,
    texturePrompt,
    targetPolycount,
    targetFormats,
  };
}

export function parseInputMode(formData: FormData): TaskInputMode {
  return formData.get("inputMode") === "text" ? "text" : "image";
}

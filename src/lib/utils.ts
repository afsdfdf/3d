import path from "node:path";

import type {
  GenerateSettings,
  OutputFormat,
  QualityPreset,
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

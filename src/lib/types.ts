export type ProviderName = "meshy" | "mock";
export type LocalTaskStatus =
  | "queued"
  | "uploading"
  | "processing"
  | "succeeded"
  | "failed"
  | "timeout";
export type TopologyMode = "triangle" | "quad";
export type OutputFormat = "glb" | "fbx" | "obj" | "stl" | "usdz";
export type QualityPreset = "draft" | "production";

export interface GenerateSettings {
  quality: QualityPreset;
  topology: TopologyMode;
  targetPolycount: number;
  shouldTexture: boolean;
  texturePrompt: string;
  targetFormats: OutputFormat[];
}

export interface TaskResultAssets {
  thumbnailUrl?: string;
  primaryModelUrl?: string;
  modelUrls: Partial<Record<OutputFormat, string>>;
}

export interface TaskRecord {
  id: string;
  provider: ProviderName;
  providerTaskId?: string;
  status: LocalTaskStatus;
  progress: number;
  stage: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  finishedAt?: string;
  lastProviderSyncAt?: string;
  sourceFileName: string;
  sourceMimeType: string;
  sourceImagePath: string;
  sourceImageUrl: string;
  settings: GenerateSettings;
  errorMessage?: string;
  result: TaskResultAssets;
}

export type PublicTask = Omit<TaskRecord, "sourceImagePath">;

export interface ProviderCreateInput {
  localTaskId: string;
  sourceFileName: string;
  sourceMimeType: string;
  sourceImageUrl: string;
  sourceDataUri: string;
  settings: GenerateSettings;
  createdAt: string;
}

export interface ProviderSyncResult {
  provider: ProviderName;
  providerTaskId: string;
  status: LocalTaskStatus;
  progress: number;
  stage: string;
  errorMessage?: string;
  result?: TaskResultAssets;
  raw?: unknown;
}

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
export type TaskInputMode = "image" | "text";
export type ProviderTaskFlow = "image-to-3d" | "text-preview" | "text-refine";

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
  providerTaskFlow?: ProviderTaskFlow;
  previewTaskId?: string;
  inputMode: TaskInputMode;
  prompt?: string;
  status: LocalTaskStatus;
  progress: number;
  stage: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  finishedAt?: string;
  lastProviderSyncAt?: string;
  sourceFileName: string;
  sourceMimeType?: string;
  sourceImageBlobPath?: string;
  sourceImageUrl?: string;
  settings: GenerateSettings;
  errorMessage?: string;
  result: TaskResultAssets;
}

export type PublicTask = Omit<TaskRecord, "sourceImageBlobPath">;

export interface ProviderCreateInput {
  localTaskId: string;
  inputMode: TaskInputMode;
  prompt?: string;
  sourceFileName?: string;
  sourceMimeType?: string;
  sourceImageUrl?: string;
  sourceDataUri?: string;
  settings: GenerateSettings;
  createdAt: string;
}

export interface ProviderSyncResult {
  provider: ProviderName;
  providerTaskId: string;
  providerTaskFlow?: ProviderTaskFlow;
  previewTaskId?: string;
  status: LocalTaskStatus;
  progress: number;
  stage: string;
  errorMessage?: string;
  result?: TaskResultAssets;
  raw?: unknown;
}

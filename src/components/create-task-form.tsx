"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, LoaderCircle, Sparkles } from "lucide-react";
import { motion } from "motion/react";

export function CreateTaskForm() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [quality, setQuality] = useState<"draft" | "production">("production");
  const [topology, setTopology] = useState<"triangle" | "quad">("quad");
  const [shouldTexture, setShouldTexture] = useState(true);
  const [texturePrompt, setTexturePrompt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previewUrl = useMemo(() => {
    if (!file) {
      return null;
    }

    return URL.createObjectURL(file);
  }, [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!file) {
      setError("请先上传一张图片。");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("image", file);
      formData.append("quality", quality);
      formData.append("topology", topology);
      formData.append("shouldTexture", String(shouldTexture));
      formData.append("texturePrompt", texturePrompt.trim());

      const response = await fetch("/api/tasks", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as
        | { task: { id: string } }
        | { error: string };

      if (!response.ok || !("task" in payload)) {
        throw new Error("error" in payload ? payload.error : "提交任务失败。");
      }

      router.push(`/tasks/${payload.task.id}`);
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "提交任务失败，请稍后再试。",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <motion.form
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      onSubmit={handleSubmit}
      className="panel-light relative overflow-hidden rounded-[34px] p-5 sm:p-6"
    >
      <div className="absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top,rgba(143,212,255,0.3),transparent_62%)]" />

      <div className="relative">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.24em] text-sky-700">
              <Sparkles className="size-3.5" />
              Create Task
            </div>
            <h2 className="mt-4 text-2xl font-semibold tracking-[-0.04em] text-slate-900">
              上传图片并开始生成
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              保留最必要的参数。提交后会生成任务详情页，同时首页任务中心也会保留进度。
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-5">
          <label className="group block cursor-pointer overflow-hidden rounded-[28px] border border-dashed border-slate-200 bg-white/78 transition hover:border-sky-300 hover:bg-white">
            <input
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              className="sr-only"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
            <div className="relative aspect-[16/10] min-h-[250px] overflow-hidden">
              {previewUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl}
                    alt="Upload preview"
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-white via-white/85 to-transparent p-5">
                    <p className="text-sm font-semibold text-slate-800">{file?.name}</p>
                    <p className="mt-1 text-sm text-slate-500">点击重新选择图片</p>
                  </div>
                </>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
                  <div className="rounded-full bg-[linear-gradient(135deg,#e7f5ff,#f2f6ff)] p-4 text-sky-700">
                    <ImagePlus className="size-8" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-slate-900">
                      拖入或点击上传一张图片
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      推荐主体清晰、背景干净的参考图，支持 PNG / JPG / WEBP。
                    </p>
                  </div>
                </div>
              )}
            </div>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-600">生成质量</span>
              <select
                value={quality}
                onChange={(event) =>
                  setQuality(event.target.value as "draft" | "production")
                }
                className="soft-input h-12 w-full rounded-[18px] px-4"
              >
                <option value="production">高质量（更细致）</option>
                <option value="draft">快速草稿（更快）</option>
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-600">拓扑类型</span>
              <select
                value={topology}
                onChange={(event) =>
                  setTopology(event.target.value as "triangle" | "quad")
                }
                className="soft-input h-12 w-full rounded-[18px] px-4"
              >
                <option value="quad">Quad</option>
                <option value="triangle">Triangle</option>
              </select>
            </label>
          </div>

          <label className="flex items-start gap-3 rounded-[22px] border border-slate-200/85 bg-white/76 px-4 py-4">
            <input
              type="checkbox"
              checked={shouldTexture}
              onChange={(event) => setShouldTexture(event.target.checked)}
              className="mt-1 size-4 rounded border-slate-200 accent-sky-500"
            />
            <span>
              <span className="block text-sm font-semibold text-slate-900">
                生成纹理
              </span>
              <span className="mt-1 block text-sm leading-6 text-slate-500">
                开启后会同时尝试生成更适合预览和下载的纹理表现。
              </span>
            </span>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-600">
              纹理提示词（可选）
            </span>
            <textarea
              value={texturePrompt}
              onChange={(event) => setTexturePrompt(event.target.value)}
              placeholder="例如：clean ceramic toy, soft blue glaze, product studio lighting"
              rows={4}
              className="soft-input w-full rounded-[22px] px-4 py-3"
            />
          </label>

          {error && (
            <div className="rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex h-13 w-full items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#8fd4ff,#5aa6ff)] px-6 text-sm font-medium text-white shadow-[0_14px_30px_rgba(90,166,255,0.28)] transition hover:opacity-92 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? (
              <>
                <LoaderCircle className="size-4 animate-spin" />
                正在提交任务...
              </>
            ) : (
              <>
                <Sparkles className="size-4" />
                开始生成 3D 模型
              </>
            )}
          </button>
        </div>
      </div>
    </motion.form>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ImagePlus,
  LoaderCircle,
  Sparkles,
  Type,
} from "lucide-react";
import { motion } from "motion/react";

import { parseJsonResponse } from "@/lib/http";

type InputMode = "image" | "text";

export function CreateTaskForm() {
  const router = useRouter();
  const [inputMode, setInputMode] = useState<InputMode>("image");
  const [file, setFile] = useState<File | null>(null);
  const [prompt, setPrompt] = useState("");
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

    if (inputMode === "image" && !file) {
      setError("请先上传一张图片。");
      return;
    }

    if (inputMode === "text" && !prompt.trim()) {
      setError("请输入文字描述。");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("inputMode", inputMode);
      formData.append("quality", quality);
      formData.append("topology", topology);
      formData.append("shouldTexture", String(shouldTexture));
      formData.append("texturePrompt", texturePrompt.trim());

      if (inputMode === "image" && file) {
        formData.append("image", file);
      }

      if (inputMode === "text") {
        formData.append("prompt", prompt.trim());
      }

      const response = await fetch("/api/tasks", {
        method: "POST",
        body: formData,
      });
      const payload = (await parseJsonResponse<{
        task: { id: string };
      }>(response)) as
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
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.24em] text-sky-700">
            <Sparkles className="size-3.5" />
            Create Task
          </div>
          <h2 className="mt-4 text-2xl font-semibold tracking-[-0.04em] text-slate-900">
            支持文字和图片生成
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            可以上传参考图生成 3D，也可以直接输入文字描述生成 3D。
          </p>
        </div>

        <div className="mt-6 inline-flex rounded-full border border-slate-200 bg-white/88 p-1">
          <button
            type="button"
            onClick={() => setInputMode("image")}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
              inputMode === "image"
                ? "bg-[linear-gradient(135deg,#8fd4ff,#5aa6ff)] text-white shadow-sm"
                : "text-slate-600"
            }`}
          >
            <ImagePlus className="size-4" />
            图片生成
          </button>
          <button
            type="button"
            onClick={() => setInputMode("text")}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
              inputMode === "text"
                ? "bg-[linear-gradient(135deg,#8fd4ff,#5aa6ff)] text-white shadow-sm"
                : "text-slate-600"
            }`}
          >
            <Type className="size-4" />
            文字生成
          </button>
        </div>

        <div className="mt-6 space-y-5">
          {inputMode === "image" ? (
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
          ) : (
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-600">文字描述</span>
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="例如：a cute ceramic astronaut toy, glossy white helmet, soft blue accents, studio product render"
                rows={6}
                className="soft-input w-full rounded-[24px] px-4 py-4"
              />
            </label>
          )}

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
                文字模式下会先生成草模，再自动细化成带纹理的 3D 模型。
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
              placeholder="例如：clean ceramic, premium toy finish, product studio lighting"
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

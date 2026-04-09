"use client";

import { createElement, useEffect, useMemo, useRef, useState } from "react";
import Script from "next/script";
import {
  Expand,
  Lightbulb,
  RotateCw,
  ScanLine,
  Sparkles,
} from "lucide-react";

type BackgroundMode = "white" | "grid" | "glass";
type DisplayMode = "default" | "studio" | "technical";

const BACKGROUND_OPTIONS: Array<{
  key: BackgroundMode;
  label: string;
  className: string;
}> = [
  { key: "white", label: "白底", className: "bg-white" },
  {
    key: "grid",
    label: "网格",
    className:
      "bg-[linear-gradient(rgba(148,163,184,0.14)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.14)_1px,transparent_1px),linear-gradient(180deg,#ffffff,#f6f8fc)] bg-[size:26px_26px,26px_26px,100%_100%]",
  },
  {
    key: "glass",
    label: "透明感",
    className:
      "bg-[radial-gradient(circle_at_top,rgba(143,212,255,0.30),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(217,204,255,0.26),transparent_26%),linear-gradient(180deg,rgba(255,255,255,0.82),rgba(246,248,252,0.95))]",
  },
];

const DISPLAY_OPTIONS: Array<{
  key: DisplayMode;
  label: string;
  icon: typeof Sparkles;
  exposure: string;
  environmentImage?: string;
  shadowIntensity: string;
  filter?: string;
}> = [
  {
    key: "default",
    label: "标准",
    icon: Sparkles,
    exposure: "1.05",
    shadowIntensity: "1",
  },
  {
    key: "studio",
    label: "强光",
    icon: Lightbulb,
    exposure: "1.35",
    environmentImage: "legacy",
    shadowIntensity: "1.25",
  },
  {
    key: "technical",
    label: "线框感",
    icon: ScanLine,
    exposure: "1.22",
    shadowIntensity: "0.55",
    filter: "grayscale(1) contrast(1.18) brightness(1.04)",
  },
];

function hasModelViewer() {
  return (
    typeof window !== "undefined" &&
    Boolean(window.customElements?.get("model-viewer"))
  );
}

export function ModelViewerCanvas({
  src,
  poster,
  alt,
}: {
  src: string;
  poster?: string;
  alt?: string;
}) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [autoRotate, setAutoRotate] = useState(true);
  const [backgroundMode, setBackgroundMode] = useState<BackgroundMode>("glass");
  const [displayMode, setDisplayMode] = useState<DisplayMode>("default");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewerReady, setViewerReady] = useState(hasModelViewer);
  const safePoster = poster || undefined;

  const background = useMemo(
    () =>
      BACKGROUND_OPTIONS.find((option) => option.key === backgroundMode) ??
      BACKGROUND_OPTIONS[0],
    [backgroundMode],
  );

  const display = useMemo(
    () =>
      DISPLAY_OPTIONS.find((option) => option.key === displayMode) ??
      DISPLAY_OPTIONS[0],
    [displayMode],
  );
  const DisplayIcon = display.icon;

  useEffect(() => {
    const handleChange = () => {
      setIsFullscreen(document.fullscreenElement === wrapperRef.current);
    };

    document.addEventListener("fullscreenchange", handleChange);
    return () => document.removeEventListener("fullscreenchange", handleChange);
  }, []);

  async function toggleFullscreen() {
    if (!wrapperRef.current) {
      return;
    }

    if (document.fullscreenElement === wrapperRef.current) {
      await document.exitFullscreen();
      return;
    }

    await wrapperRef.current.requestFullscreen();
  }

  function cycleBackground() {
    const currentIndex = BACKGROUND_OPTIONS.findIndex(
      (option) => option.key === backgroundMode,
    );
    const next = BACKGROUND_OPTIONS[(currentIndex + 1) % BACKGROUND_OPTIONS.length];
    setBackgroundMode(next.key);
  }

  function cycleDisplayMode() {
    const currentIndex = DISPLAY_OPTIONS.findIndex(
      (option) => option.key === displayMode,
    );
    const next = DISPLAY_OPTIONS[(currentIndex + 1) % DISPLAY_OPTIONS.length];
    setDisplayMode(next.key);
  }

  return (
    <div
      ref={wrapperRef}
      className={`relative aspect-[16/11] min-h-[360px] w-full overflow-hidden ${background.className} ${
        isFullscreen ? "rounded-none" : ""
      }`}
    >
      <Script
        src="/vendor/model-viewer.min.js"
        strategy="afterInteractive"
        onLoad={() => setViewerReady(true)}
      />

      <div className="absolute left-3 top-3 z-10 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setAutoRotate((value) => !value)}
          className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/88 px-3 py-2 text-xs font-medium text-slate-700 shadow-sm transition hover:border-sky-200 hover:text-sky-700"
        >
          <RotateCw className={`size-3.5 ${autoRotate ? "text-sky-600" : ""}`} />
          {autoRotate ? "自动旋转开" : "自动旋转关"}
        </button>

        <button
          type="button"
          onClick={cycleBackground}
          className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/88 px-3 py-2 text-xs font-medium text-slate-700 shadow-sm transition hover:border-sky-200 hover:text-sky-700"
        >
          <Sparkles className="size-3.5" />
          背景：{background.label}
        </button>

        <button
          type="button"
          onClick={cycleDisplayMode}
          className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/88 px-3 py-2 text-xs font-medium text-slate-700 shadow-sm transition hover:border-sky-200 hover:text-sky-700"
        >
          <DisplayIcon className="size-3.5" />
          模式：{display.label}
        </button>
      </div>

      <div className="absolute bottom-3 right-3 z-10">
        <button
          type="button"
          onClick={() => void toggleFullscreen()}
          className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/88 px-3 py-2 text-xs font-medium text-slate-700 shadow-sm transition hover:border-sky-200 hover:text-sky-700"
        >
          <Expand className="size-3.5" />
          {isFullscreen ? "退出全屏" : "全屏查看"}
        </button>
      </div>

      {viewerReady ? (
        createElement("model-viewer", {
          src,
          poster: safePoster,
          alt: alt ?? "3D model",
          "camera-controls": true,
          "auto-rotate": autoRotate || undefined,
          "shadow-intensity": display.shadowIntensity,
          "interaction-prompt": "none",
          exposure: display.exposure,
          "environment-image": display.environmentImage,
          style: {
            width: "100%",
            height: "100%",
            filter: display.filter,
          },
        })
      ) : (
        <div className="flex h-full w-full items-center justify-center text-sm text-slate-500">
          正在加载 3D 预览器...
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-white/72 via-white/22 to-transparent px-4 py-3 text-xs text-slate-500">
        拖拽可旋转，滚轮可缩放，按钮可切换背景、模式和全屏。
      </div>
    </div>
  );
}

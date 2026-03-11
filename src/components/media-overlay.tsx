import { useEffect, useCallback } from "react";
import type { CompanyScreenshot, CompanyVideo } from "@llm-tracker/shared";

interface ScreenshotOverlay {
  type: "screenshot";
  items: CompanyScreenshot[];
  index: number;
}

interface VideoOverlay {
  type: "video";
  items: CompanyVideo[];
  index: number;
  getEmbedUrl: (provider: string, videoId: string) => string;
}

export type MediaOverlayProps = (ScreenshotOverlay | VideoOverlay) & {
  onClose: () => void;
  onNavigate: (index: number) => void;
};

export function MediaOverlay(props: MediaOverlayProps) {
  const { type, items, index, onClose, onNavigate } = props;
  const total = items.length;

  const goPrev = useCallback(() => {
    if (index > 0) onNavigate(index - 1);
  }, [index, onNavigate]);

  const goNext = useCallback(() => {
    if (index < total - 1) onNavigate(index + 1);
  }, [index, total, onNavigate]);

  // Lock body scroll & listen for keyboard
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    }

    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose, goPrev, goNext]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      onClick={onClose}
    >
      <div
        className="relative mx-4 flex max-h-[95vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-gray-950 shadow-2xl"
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-gray-400">
            {index + 1} / {total}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="h-5 w-5"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Media area */}
        <div className="relative flex min-h-0 flex-1 items-center justify-center px-12">
          {/* Prev button */}
          {index > 0 && (
            <button
              type="button"
              onClick={goPrev}
              className="absolute left-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
              aria-label="Previous"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="h-5 w-5"
              >
                <path d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}

          {/* Next button */}
          {index < total - 1 && (
            <button
              type="button"
              onClick={goNext}
              className="absolute right-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
              aria-label="Next"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="h-5 w-5"
              >
                <path d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}

          {/* Content */}
          {type === "screenshot" ? (
            <ScreenshotContent screenshot={items[index]} />
          ) : (
            <VideoContent video={items[index]} getEmbedUrl={props.getEmbedUrl} />
          )}
        </div>

        {/* Metadata strip */}
        <div className="border-t border-white/10 px-5 py-4">
          {type === "screenshot" ? (
            <ScreenshotMeta screenshot={items[index]} />
          ) : (
            <VideoMeta video={items[index]} />
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- Screenshot ----------

function ScreenshotContent({ screenshot }: { screenshot: CompanyScreenshot }) {
  return (
    <div className="flex max-h-[65vh] w-full items-center justify-center">
      <img
        src={screenshot.assetPath}
        alt={screenshot.alt}
        className="max-h-[65vh] max-w-full rounded object-contain"
      />
    </div>
  );
}

function ScreenshotMeta({ screenshot }: { screenshot: CompanyScreenshot }) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {screenshot.kind && (
          <span className="rounded-full bg-blue-500/20 px-2.5 py-0.5 text-xs font-medium text-blue-300">
            {screenshot.kind}
          </span>
        )}
        <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-medium text-gray-300">
          {screenshot.sourceType}
        </span>
        {screenshot.tags.slice(0, 3).map((tag) => (
          <span
            key={`${screenshot.id}-${tag}`}
            className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-medium text-gray-300"
          >
            {tag}
          </span>
        ))}
      </div>

      <h3 className="text-base font-semibold text-white">
        {screenshot.contextHeading ?? screenshot.alt}
      </h3>
      {screenshot.caption && (
        <p className="text-sm leading-6 text-gray-400">{screenshot.caption}</p>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
        <span>Collected {new Date(screenshot.collectedAt).toLocaleDateString()}</span>
        {screenshot.width && screenshot.height && (
          <span>
            {screenshot.width} x {screenshot.height}
          </span>
        )}
        {screenshot.pageTitle && <span>{screenshot.pageTitle}</span>}
      </div>

      <div className="flex flex-wrap gap-3 text-sm">
        <a
          href={screenshot.sourcePageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-blue-400 hover:underline"
        >
          View source page
        </a>
        <a
          href={screenshot.sourceImageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-blue-400 hover:underline"
        >
          Open original image
        </a>
      </div>
    </div>
  );
}

// ---------- Video ----------

function VideoContent({
  video,
  getEmbedUrl,
}: {
  video: CompanyVideo;
  getEmbedUrl: (provider: string, videoId: string) => string;
}) {
  return (
    <div className="aspect-video w-full">
      <iframe
        key={video.id}
        src={getEmbedUrl(video.provider, video.videoId)}
        title={video.title}
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        className="h-full w-full rounded border-0"
      />
    </div>
  );
}

function VideoMeta({ video }: { video: CompanyVideo }) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {video.kind && (
          <span className="rounded-full bg-red-500/20 px-2.5 py-0.5 text-xs font-medium text-red-300">
            {video.kind}
          </span>
        )}
        <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-medium text-gray-300">
          {video.sourceType}
        </span>
        <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-medium text-gray-300">
          {video.provider}
        </span>
      </div>

      <h3 className="text-base font-semibold text-white">{video.title}</h3>
      <p className="text-sm text-gray-400">
        {video.creatorUrl ? (
          <a
            href={video.creatorUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
          >
            {video.creator}
          </a>
        ) : (
          video.creator
        )}
        {" · "}
        Added {new Date(video.collectedAt).toLocaleDateString()}
      </p>
      {video.description && (
        <p className="max-w-3xl text-sm leading-6 text-gray-400">{video.description}</p>
      )}
      <div className="flex flex-wrap gap-3 text-sm">
        <a
          href={video.watchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-blue-400 hover:underline"
        >
          Watch on{" "}
          {video.provider === "youtube" ? "YouTube" : video.provider === "loom" ? "Loom" : "Wistia"}
        </a>
      </div>
    </div>
  );
}

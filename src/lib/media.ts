import { supabase } from "@/integrations/supabase/client";

export type MediaKind = "image" | "video" | "audio" | "file";

export const MAX_FILE_BYTES = 100 * 1024 * 1024; // 100 MB hard ceiling
export const MAX_BYTES_BY_KIND: Record<MediaKind, number> = {
  image: 25 * 1024 * 1024,
  video: 100 * 1024 * 1024,
  audio: 50 * 1024 * 1024,
  file: 50 * 1024 * 1024,
};

const BLOCKED_EXTENSIONS = [
  "exe",
  "msi",
  "bat",
  "cmd",
  "com",
  "scr",
  "cpl",
  "jar",
  "js",
  "vbs",
  "ps1",
  "sh",
  "apk",
  "dll",
  "app",
];

export const ACCEPT_ATTRIBUTE = [
  "image/*",
  "video/*",
  "audio/*",
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".txt",
  ".md",
  ".csv",
  ".rtf",
  ".zip",
  ".json",
].join(",");

export function kindOf(type?: string | null): MediaKind {
  const t = (type ?? "").toLowerCase();
  if (t.startsWith("image/")) return "image";
  if (t.startsWith("video/")) return "video";
  if (t.startsWith("audio/")) return "audio";
  return "file";
}

export function extensionOf(name: string) {
  const parts = name.split(".");
  return parts.length > 1 ? (parts.pop() ?? "").toLowerCase() : "";
}

/** Client-side gate only — storage RLS and the size limit are enforced server-side too. */
export function validateFile(file: File): string | null {
  if (file.size === 0) return "That file looks empty.";
  const kind = kindOf(file.type);
  const limit = MAX_BYTES_BY_KIND[kind];
  if (file.size > limit) return `${kindLabel(kind)} must be under ${formatBytes(limit)}.`;
  if (file.size > MAX_FILE_BYTES) return `Files must be under ${formatBytes(MAX_FILE_BYTES)}.`;
  if (BLOCKED_EXTENSIONS.includes(extensionOf(file.name)))
    return "That file type can't be shared here.";
  return null;
}

export function kindLabel(kind: MediaKind) {
  return kind === "image"
    ? "Photos"
    : kind === "video"
      ? "Videos"
      : kind === "audio"
        ? "Audio"
        : "Files";
}

export function formatBytes(bytes?: number | null) {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value >= 10 ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
}

export function formatDuration(seconds?: number | null) {
  if (!seconds || !Number.isFinite(seconds)) return "";
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function prettyType(type?: string | null, name?: string | null) {
  const ext = extensionOf(name ?? "");
  if (ext) return ext.toUpperCase();
  const t = type ?? "";
  return (t.split("/")[1] ?? "FILE").toUpperCase();
}

export type ProbeResult = {
  width?: number;
  height?: number;
  duration?: number;
  thumbnail?: Blob;
  previewUrl?: string;
};

const THUMB_MAX = 640;

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.72));
}

function scaled(width: number, height: number) {
  const ratio = Math.min(1, THUMB_MAX / Math.max(width, height));
  return { w: Math.max(1, Math.round(width * ratio)), h: Math.max(1, Math.round(height * ratio)) };
}

async function probeImage(file: File): Promise<ProbeResult> {
  const bitmap = await createImageBitmap(file);
  const { w, h } = scaled(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, w, h);
  const thumbnail = (await canvasToBlob(canvas)) ?? undefined;
  const result: ProbeResult = { width: bitmap.width, height: bitmap.height };
  if (thumbnail) result.thumbnail = thumbnail;
  bitmap.close();
  return result;
}

function probeVideo(file: File): Promise<ProbeResult> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    const done = (result: ProbeResult) => {
      URL.revokeObjectURL(url);
      resolve(result);
    };
    const fail = () => done({});
    video.onerror = fail;
    video.onloadedmetadata = () => {
      const base: ProbeResult = {
        width: video.videoWidth,
        height: video.videoHeight,
        duration: video.duration,
      };
      video.onseeked = () => {
        try {
          const { w, h } = scaled(video.videoWidth || THUMB_MAX, video.videoHeight || THUMB_MAX);
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          canvas.getContext("2d")?.drawImage(video, 0, 0, w, h);
          void canvasToBlob(canvas).then((blob) =>
            done(blob ? { ...base, thumbnail: blob } : base),
          );
        } catch {
          done(base);
        }
      };
      try {
        video.currentTime = Math.min(0.2, (video.duration || 1) / 4);
      } catch {
        done(base);
      }
    };
    video.src = url;
    setTimeout(fail, 8000);
  });
}

function probeAudio(file: File): Promise<ProbeResult> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = document.createElement("audio");
    audio.preload = "metadata";
    const done = (result: ProbeResult) => {
      URL.revokeObjectURL(url);
      resolve(result);
    };
    audio.onerror = () => done({});
    audio.onloadedmetadata = () => done({ duration: audio.duration });
    audio.src = url;
    setTimeout(() => done({}), 6000);
  });
}

export async function probeFile(file: File): Promise<ProbeResult> {
  try {
    const kind = kindOf(file.type);
    if (kind === "image") return await probeImage(file);
    if (kind === "video") return await probeVideo(file);
    if (kind === "audio") return await probeAudio(file);
  } catch {
    /* metadata is best-effort */
  }
  return {};
}

export function thumbPathFor(path: string) {
  return `${path}.thumb.jpg`;
}

/* ---------------- signed URL cache ---------------- */

const TTL_SECONDS = 60 * 60;
const cache = new Map<string, { url: string; expires: number }>();
const inflight = new Map<string, Promise<string | null>>();

export async function signedUrl(path: string): Promise<string | null> {
  const hit = cache.get(path);
  if (hit && hit.expires > Date.now()) return hit.url;
  const pending = inflight.get(path);
  if (pending) return pending;
  const request = supabase.storage
    .from("attachments")
    .createSignedUrl(path, TTL_SECONDS)
    .then(({ data }) => {
      const url = data?.signedUrl ?? null;
      if (url) cache.set(path, { url, expires: Date.now() + (TTL_SECONDS - 120) * 1000 });
      return url;
    })
    .catch(() => null)
    .finally(() => inflight.delete(path));
  inflight.set(path, request);
  return request;
}

/** Prefers the small generated thumbnail; falls back to the original object. */
export async function previewUrl(path: string): Promise<string | null> {
  const thumb = await signedUrl(thumbPathFor(path));
  if (thumb) {
    const ok = await headOk(thumb);
    if (ok) return thumb;
    cache.delete(thumbPathFor(path));
  }
  return signedUrl(path);
}

const headCache = new Map<string, boolean>();
async function headOk(url: string) {
  const cached = headCache.get(url);
  if (cached !== undefined) return cached;
  try {
    const res = await fetch(url, { method: "HEAD" });
    headCache.set(url, res.ok);
    return res.ok;
  } catch {
    return false;
  }
}

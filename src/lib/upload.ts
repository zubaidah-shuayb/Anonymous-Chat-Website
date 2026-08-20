import { supabase } from "@/integrations/supabase/client";

const BUCKET = "attachments";

function storageBase() {
  const url = import.meta.env["VITE_SUPABASE_URL"] as string | undefined;
  if (!url) throw new Error("Storage is not configured");
  return `${url}/storage/v1/object/${BUCKET}`;
}

export type UploadOptions = {
  path: string;
  body: Blob;
  contentType: string;
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
};

/**
 * Uploads through the Storage REST endpoint with XHR so we get real progress
 * events and cancellation. Access is still enforced by storage RLS.
 */
export async function uploadObject({
  path,
  body,
  contentType,
  onProgress,
  signal,
}: UploadOptions): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Your session expired — sign in again.");
  const apikey = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string;

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${storageBase()}/${encodeURI(path)}`, true);
    xhr.setRequestHeader("authorization", `Bearer ${token}`);
    xhr.setRequestHeader("apikey", apikey);
    xhr.setRequestHeader("x-upsert", "true");
    xhr.setRequestHeader("cache-control", "3600");
    if (contentType) xhr.setRequestHeader("content-type", contentType);

    const onAbort = () => xhr.abort();
    signal?.addEventListener("abort", onAbort);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded / event.total);
    };
    xhr.onload = () => {
      signal?.removeEventListener("abort", onAbort);
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(1);
        resolve();
      } else {
        reject(new Error(xhr.status === 413 ? "That file is too large." : "Upload failed."));
      }
    };
    xhr.onerror = () => {
      signal?.removeEventListener("abort", onAbort);
      reject(new Error("Network error while uploading."));
    };
    xhr.onabort = () => {
      signal?.removeEventListener("abort", onAbort);
      reject(new DOMException("Upload cancelled", "AbortError"));
    };
    xhr.send(body);
  });
}

export async function removeObjects(paths: string[]) {
  if (paths.length === 0) return;
  await supabase.storage.from(BUCKET).remove(paths);
}

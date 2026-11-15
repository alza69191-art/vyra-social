export type VyraPost = {
  id: string;
  author_id: string;
  body: string | null;
  visibility: "public" | "followers" | "private";
  created_at: string;
  author_name?: string;
  author_username?: string;
  avatar_url?: string | null;
  likes_count?: number;
  comments_count?: number;
  media?: Array<{ url: string; media_type: "image" | "video" }>;
};

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "https://vyra-api-9pxl.onrender.com").replace(/\/$/, "");

async function request<T>(path: string, init: RequestInit = {}, accessToken?: string): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set("Content-Type", "application/json");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers, cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof payload.detail === "string" ? payload.detail : "تعذر تنفيذ الطلب.");
  return payload as T;
}

export function getPublicPosts(limit = 20, offset = 0): Promise<VyraPost[]> {
  return request<VyraPost[]>(`/api/posts?limit=${limit}&offset=${offset}`);
}

export function getPublicReels(limit = 20, offset = 0): Promise<VyraPost[]> {
  return request<VyraPost[]>(`/api/reels?limit=${limit}&offset=${offset}`);
}

type DirectUploadSignature = {
  cloud_name: string;
  api_key: string;
  timestamp: number;
  signature: string;
  public_id: string;
  resource_type: "image" | "video";
};

async function uploadCloudinaryChunk(
  endpoint: string,
  form: FormData,
  headers: Record<string, string>,
  onProgress: (loaded: number) => void,
): Promise<any> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", endpoint);
        Object.entries(headers).forEach(([key, value]) => xhr.setRequestHeader(key, value));
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) onProgress(event.loaded);
        };
        xhr.onload = () => {
          let data: any = {};
          try { data = JSON.parse(xhr.responseText || "{}"); } catch {}
          if (xhr.status >= 200 && xhr.status < 300) resolve(data);
          else {
            const error: any = new Error(data?.error?.message || data?.message || "تعذر رفع جزء من الفيديو إلى التخزين.");
            error.status = xhr.status;
            reject(error);
          }
        };
        xhr.onerror = () => {
          const error: any = new Error("انقطع الاتصال أثناء رفع الفيديو.");
          error.status = 0;
          reject(error);
        };
        xhr.onabort = () => reject(new Error("تم إلغاء رفع الفيديو."));
        xhr.send(form);
      });
    } catch (error: any) {
      lastError = error;
      const retryable = error?.status === 0 || error?.status === 429 || error?.status >= 500;
      if (!retryable || attempt === 2) break;
      await new Promise((resolve) => window.setTimeout(resolve, 500 * (2 ** attempt)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("تعذر إكمال رفع الفيديو.");
}

/** Upload video bytes straight to Cloudinary in resumable-size chunks, then attach
 * the signed Cloudinary response to the user's own post through the API. */
export async function uploadVideoDirect(
  accessToken: string,
  file: File,
  postId: string,
  onProgress: (percent: number) => void = () => undefined,
): Promise<{ url: string; media_type: "video"; purpose: "post"; post_id: string }> {
  if (!file.type.startsWith("video/")) throw new Error("اختر ملف فيديو صالحاً.");
  const signature = await request<DirectUploadSignature>(
    "/api/uploads/signature",
    { method: "POST", body: JSON.stringify({ post_id: postId, resource_type: "video", content_type: file.type, file_size: file.size }) },
    accessToken,
  );
  const endpoint = `https://api.cloudinary.com/v1_1/${encodeURIComponent(signature.cloud_name)}/video/upload`;
  const chunkSize = 6 * 1024 * 1024;
  const uploadId = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let response: any = null;

  for (let start = 0; start < file.size; start += chunkSize) {
    const endExclusive = Math.min(start + chunkSize, file.size);
    const chunk = file.slice(start, endExclusive);
    const form = new FormData();
    form.append("file", chunk, file.name);
    form.append("api_key", signature.api_key);
    form.append("timestamp", String(signature.timestamp));
    form.append("signature", signature.signature);
    form.append("public_id", signature.public_id);
    const isChunked = file.size > chunkSize;
    const headers: Record<string, string> = {};
    if (isChunked) {
      headers["X-Unique-Upload-Id"] = uploadId;
      headers["Content-Range"] = `bytes ${start}-${endExclusive - 1}/${file.size}`;
    }
    response = await uploadCloudinaryChunk(endpoint, form, headers, (loaded) => {
      const completed = start + Math.min(loaded, chunk.size);
      onProgress(Math.min(99, Math.round((completed / file.size) * 100)));
    });
  }

  if (!response?.secure_url || !response?.public_id || !response?.version || !response?.signature) {
    throw new Error("اكتمل الرفع دون استلام بيانات تحقق صالحة من التخزين.");
  }
  const attached = await request<{ url: string; media_type: "video"; post_id: string }>(
    "/api/uploads/complete",
    {
      method: "POST",
      body: JSON.stringify({
        post_id: postId,
        public_id: response.public_id,
        secure_url: response.secure_url,
        version: response.version,
        signature: response.signature,
        resource_type: "video",
      }),
    },
    accessToken,
  );
  onProgress(100);
  return { ...attached, purpose: "post" };
}
export function saveProfile(accessToken: string, profile: { username: string; display_name: string; bio?: string | null; is_private?: boolean }): Promise<VyraProfile> {
  return request<VyraProfile>("/api/me", { method: "PUT", body: JSON.stringify(profile) }, accessToken);
}
export function createPost(accessToken: string, body: string, visibility: "public" | "followers" | "private" = "public") {
  return request<VyraPost>("/api/posts", { method: "POST", body: JSON.stringify({ body, visibility }) }, accessToken);
}
export function createComment(accessToken: string, postId: string, body: string): Promise<VyraComment> {
  return request<VyraComment>(`/api/posts/${encodeURIComponent(postId)}/comments`, { method: "POST", body: JSON.stringify({ body }) }, accessToken);
}
export type VyraReaction = "like" | "love" | "care" | "haha" | "wow" | "sad" | "angry" | "dislike";
export function toggleReaction(accessToken: string, postId: string, reaction: VyraReaction = "like") {
  return request<{ reacted: boolean; reaction_type: VyraReaction | null }>(`/api/posts/${encodeURIComponent(postId)}/reaction`, { method: "PUT", body: JSON.stringify({ reaction_type: reaction }) }, accessToken);
}

export type VyraComment = {
  id: string;
  post_id: string;
  author_id: string;
  body: string;
  created_at: string;
};

export type VyraProfile = {
  id: string;
  username: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  cover_url?: string | null;
  is_private: boolean;
};

export function getMyProfile(accessToken: string): Promise<VyraProfile> {
  return request<VyraProfile>("/api/me", {}, accessToken);
}
export function getComments(postId: string): Promise<VyraComment[]> {
  return request<VyraComment[]>(`/api/posts/${encodeURIComponent(postId)}/comments`);
}

export async function uploadMedia(accessToken: string, file: File, purpose: "avatar" | "cover" | "post" | "space" | "message" | "market" | "story" | "ad" = "post", postId?: string) {
  const form = new FormData();
  form.append("file", file);
  form.append("purpose", purpose);
  if (postId) form.append("post_id", postId);
  const response = await fetch(`${API_BASE}/api/uploads`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof payload.detail === "string" ? payload.detail : "تعذر رفع الملف.");
  return payload as { url: string; media_type: "image" | "video" | "audio"; purpose: string; post_id: string | null };
}

export function getPostMedia(postId: string): Promise<Array<{ url: string; media_type: "image" | "video" }>> {
  return request<Array<{ url: string; media_type: "image" | "video" }>>(`/api/posts/${encodeURIComponent(postId)}/media`);
}

export function toggleBookmark(accessToken: string, postId: string): Promise<{ saved: boolean }> {
  return request<{ saved: boolean }>(`/api/posts/${encodeURIComponent(postId)}/bookmark`, { method: "PUT" }, accessToken);
}
export function getSavedPosts(accessToken: string): Promise<VyraPost[]> {
  return request<VyraPost[]>("/api/bookmarks", {}, accessToken);
}

export function updatePost(accessToken: string, postId: string, body: string, visibility: "public" | "followers" | "private") {
  return request<{ id: string; body: string | null; visibility: string; updated: boolean }>(`/api/posts/${encodeURIComponent(postId)}`, { method: "PATCH", body: JSON.stringify({ body, visibility }) }, accessToken);
}

export function deletePost(accessToken: string, postId: string): Promise<{ deleted: boolean }> {
  return request<{ deleted: boolean }>(`/api/posts/${encodeURIComponent(postId)}`, { method: "DELETE" }, accessToken);
}

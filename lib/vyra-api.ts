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
export function saveProfile(accessToken: string, profile: { username: string; display_name: string; bio?: string | null; is_private?: boolean }): Promise<VyraProfile> {
  return request<VyraProfile>("/api/me", { method: "PUT", body: JSON.stringify(profile) }, accessToken);
}
export function createPost(accessToken: string, body: string, visibility: "public" | "followers" | "private" = "public") {
  return request<VyraPost>("/api/posts", { method: "POST", body: JSON.stringify({ body, visibility }) }, accessToken);
}
export function createComment(accessToken: string, postId: string, body: string): Promise<VyraComment> {
  return request<VyraComment>(`/api/posts/${encodeURIComponent(postId)}/comments`, { method: "POST", body: JSON.stringify({ body }) }, accessToken);
}
export function toggleReaction(accessToken: string, postId: string) {
  return request<{ reacted: boolean }>(`/api/posts/${encodeURIComponent(postId)}/reaction`, { method: "PUT" }, accessToken);
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

export async function uploadMedia(accessToken: string, file: File, purpose: "avatar" | "cover" | "post" = "post", postId?: string) {
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
  return payload as { url: string; media_type: "image" | "video"; purpose: string; post_id: string | null };
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

export function deletePost(accessToken: string, postId: string): Promise<{ deleted: boolean }> {
  return request<{ deleted: boolean }>(`/api/posts/${encodeURIComponent(postId)}`, { method: "DELETE" }, accessToken);
}

import { storage } from "@/src/utils/storage";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;
export const API = `${BASE}/api`;

export const TOKEN_KEY = "saklio_token";

async function getToken(): Promise<string | null> {
  return await storage.secureGet<string>(TOKEN_KEY, "");
}

async function request<T = any>(
  path: string,
  options: { method?: string; body?: any; auth?: boolean } = {}
): Promise<T> {
  const { method = "GET", body, auth = true } = options;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) {
    const token = await getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const detail = (data && data.detail) || "Bir hata oluştu";
    throw new Error(typeof detail === "string" ? detail : "Bir hata oluştu");
  }
  return data as T;
}

export const api = {
  register: (name: string, email: string, password: string) =>
    request("/auth/register", { method: "POST", body: { name, email, password }, auth: false }),
  login: (email: string, password: string) =>
    request("/auth/login", { method: "POST", body: { email, password }, auth: false }),
  me: () => request("/auth/me"),
  updateProfile: (body: any) => request("/auth/profile", { method: "PUT", body }),

  dashboard: () => request("/dashboard"),
  listProducts: (category?: string) =>
    request(`/products${category && category !== "tumu" ? `?category=${category}` : ""}`),
  getProduct: (id: string) => request(`/products/${id}`),
  createProduct: (body: any) => request("/products", { method: "POST", body }),
  updateProduct: (id: string, body: any) => request(`/products/${id}`, { method: "PUT", body }),
  deleteProduct: (id: string) => request(`/products/${id}`, { method: "DELETE" }),

  scan: (image_base64: string) => request("/scan", { method: "POST", body: { image_base64 } }),
  assistantChat: (message: string, session_id?: string) =>
    request("/assistant/chat", { method: "POST", body: { message, session_id } }),
  assistantHistory: () => request("/assistant/history"),

  returnVerdict: (id: string) => request(`/return/verdict/${id}`),
  warrantyClaim: (product_id: string, problem: string) =>
    request("/warranty/claim", { method: "POST", body: { product_id, problem } }),

  gmailPreview: () => request("/gmail/preview"),
  gmailImport: () => request("/gmail/import", { method: "POST" }),
  notifications: () => request("/notifications"),
  seedDemo: () => request("/seed-demo", { method: "POST" }),
};

// Upload a local image uri as multipart. Returns { path }.
export async function uploadImage(uri: string): Promise<string> {
  const token = await getToken();
  const form = new FormData();
  const name = `receipt_${Date.now()}.jpg`;
  // native shape
  form.append("file", { uri, name, type: "image/jpeg" } as any);
  const res = await fetch(`${API}/upload`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!res.ok) throw new Error("Yükleme başarısız");
  const data = await res.json();
  return data.path;
}

// Build an authenticated image URL for display via <expo-image>.
export async function fileUrl(path: string): Promise<string> {
  const token = await getToken();
  return `${API}/files/${path}?token=${token}`;
}

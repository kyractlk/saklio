import { Platform } from "react-native";

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const s = String(reader.result || "");
      const i = s.indexOf(",");
      resolve(i >= 0 ? s.slice(i + 1) : s);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function uriToBase64(uri: string): Promise<string> {
  const res = await fetch(uri);
  const blob = await res.blob();
  return blobToBase64(blob);
}

export async function compressImageBase64(raw: string, maxEdge = 1400, quality = 0.72): Promise<string> {
  let b64 = String(raw || "").replace(/\s/g, "");
  const comma = b64.indexOf(",");
  if (b64.startsWith("data:") && comma !== -1) b64 = b64.slice(comma + 1);
  if (Platform.OS !== "web" || typeof document === "undefined") return b64;
  try {
    const img = new Image();
    const src = b64.startsWith("iVBOR")
      ? `data:image/png;base64,${b64}`
      : b64.startsWith("UklGR")
        ? `data:image/webp;base64,${b64}`
        : `data:image/jpeg;base64,${b64}`;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("img"));
      img.src = src;
    });
    const scale = Math.min(1, maxEdge / Math.max(img.width || 1, img.height || 1));
    const w = Math.max(1, Math.round((img.width || maxEdge) * scale));
    const h = Math.max(1, Math.round((img.height || maxEdge) * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return b64;
    ctx.drawImage(img, 0, 0, w, h);
    const out = canvas.toDataURL("image/jpeg", quality);
    const i = out.indexOf(",");
    return i >= 0 ? out.slice(i + 1) : b64;
  } catch {
    return b64;
  }
}

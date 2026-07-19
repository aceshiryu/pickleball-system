// Prepare an uploaded receipt for storage. Images are downscaled and re-encoded
// to keep the inline data URL small (it's persisted in the DB, no object storage
// yet); PDFs pass through and rely on the server's size cap.

export interface PreparedReceipt {
  fileName: string;
  dataUrl: string;
}

const MAX_DIM = 1600;

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("bad image"));
    img.src = src;
  });
}

export async function prepareReceipt(file: File): Promise<PreparedReceipt> {
  const raw = await readAsDataUrl(file);

  if (file.type === "application/pdf") {
    return { fileName: file.name, dataUrl: raw };
  }
  if (!file.type.startsWith("image/")) {
    throw new Error("Please upload an image (PNG/JPEG) or a PDF.");
  }

  const img = await loadImage(raw);
  const scale = Math.min(1, MAX_DIM / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not read that image.");
  ctx.drawImage(img, 0, 0, w, h);
  return { fileName: file.name, dataUrl: canvas.toDataURL("image/jpeg", 0.85) };
}

// Prepares a payment QR for inline storage: downscale to a modest square-ish
// bound and emit PNG (lossless, so the code stays scannable). Kept small since
// several of these ride inline on the settings row. Throws on a non-image.
const QR_MAX_DIM = 512;
export async function prepareQr(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please upload an image (PNG, JPEG or WEBP).");
  }
  const raw = await readAsDataUrl(file);
  const img = await loadImage(raw);
  const scale = Math.min(1, QR_MAX_DIM / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not read that image.");
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/png");
}

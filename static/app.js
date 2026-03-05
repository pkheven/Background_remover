const fileInput = document.getElementById("fileInput");
const processBtn = document.getElementById("processBtn");
const downloadBtn = document.getElementById("downloadBtn");
const eraseBtn = document.getElementById("eraseBtn");
const restoreBtn = document.getElementById("restoreBtn");
const brushSize = document.getElementById("brushSize");
const statusEl = document.getElementById("status");
const canvas = document.getElementById("previewCanvas");
const ctx = canvas.getContext("2d");

let selectedFile = null;
let originalImageData = null;
let maskImageData = null;
let drawing = false;
let mode = "erase";

function setStatus(text) {
  statusEl.textContent = text;
}

function decodeBase64Image(base64) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = `data:image/png;base64,${base64}`;
  });
}

async function loadAndRender(payload) {
  const [originalImg, maskImg] = await Promise.all([
    decodeBase64Image(payload.original_png),
    decodeBase64Image(payload.mask_png),
  ]);

  canvas.width = payload.width;
  canvas.height = payload.height;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(originalImg, 0, 0);
  originalImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  const off = document.createElement("canvas");
  off.width = payload.width;
  off.height = payload.height;
  const offCtx = off.getContext("2d");
  offCtx.drawImage(maskImg, 0, 0);
  maskImageData = offCtx.getImageData(0, 0, off.width, off.height);

  applyMaskAndRender();
  downloadBtn.disabled = false;
}

function applyMaskAndRender() {
  if (!originalImageData || !maskImageData) return;

  const composed = new ImageData(
    new Uint8ClampedArray(originalImageData.data),
    canvas.width,
    canvas.height,
  );

  for (let i = 0; i < composed.data.length; i += 4) {
    composed.data[i + 3] = maskImageData.data[i];
  }

  ctx.putImageData(composed, 0, 0);
}

function paintMask(canvasX, canvasY) {
  if (!maskImageData) return;

  const radius = Number(brushSize.value);
  const { width, height, data } = maskImageData;

  const minX = Math.max(0, Math.floor(canvasX - radius));
  const maxX = Math.min(width - 1, Math.ceil(canvasX + radius));
  const minY = Math.max(0, Math.floor(canvasY - radius));
  const maxY = Math.min(height - 1, Math.ceil(canvasY + radius));

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const dx = x - canvasX;
      const dy = y - canvasY;
      if (dx * dx + dy * dy > radius * radius) continue;

      const idx = (y * width + x) * 4;
      const value = mode === "erase" ? 0 : 255;
      data[idx] = value;
      data[idx + 1] = value;
      data[idx + 2] = value;
      data[idx + 3] = 255;
    }
  }

  applyMaskAndRender();
}

function getCanvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  };
}

fileInput.addEventListener("change", () => {
  selectedFile = fileInput.files[0] || null;
  processBtn.disabled = !selectedFile;
  downloadBtn.disabled = true;
  setStatus(selectedFile ? `Selected: ${selectedFile.name}` : "Choose an image to begin.");
});

processBtn.addEventListener("click", async () => {
  if (!selectedFile) return;
  setStatus("Removing background... (first run may download model weights)");
  processBtn.disabled = true;

  const form = new FormData();
  form.append("file", selectedFile);

  try {
    const res = await fetch("/api/remove", { method: "POST", body: form });
    if (!res.ok) {
      throw new Error((await res.json()).detail || "Background removal failed");
    }
    const payload = await res.json();
    await loadAndRender(payload);
    setStatus("Done. Use brush tools to refine edges, then download PNG.");
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  } finally {
    processBtn.disabled = false;
  }
});

function setMode(nextMode) {
  mode = nextMode;
  eraseBtn.classList.toggle("active", nextMode === "erase");
  restoreBtn.classList.toggle("active", nextMode === "restore");
}

eraseBtn.addEventListener("click", () => setMode("erase"));
restoreBtn.addEventListener("click", () => setMode("restore"));

canvas.addEventListener("mousedown", (event) => {
  if (!maskImageData) return;
  drawing = true;
  const p = getCanvasPoint(event);
  paintMask(p.x, p.y);
});

canvas.addEventListener("mousemove", (event) => {
  if (!drawing) return;
  const p = getCanvasPoint(event);
  paintMask(p.x, p.y);
});

window.addEventListener("mouseup", () => {
  drawing = false;
});

downloadBtn.addEventListener("click", () => {
  if (!maskImageData || !originalImageData) return;

  applyMaskAndRender();
  canvas.toBlob(
    (blob) => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "background-removed.png";
      a.click();
      URL.revokeObjectURL(a.href);
    },
    "image/png",
    1.0,
  );
});

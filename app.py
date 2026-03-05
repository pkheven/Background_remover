from io import BytesIO
import base64

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from PIL import Image
from rembg import remove

app = FastAPI(title="Self-hosted Background Remover")
app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/")
def index() -> FileResponse:
    return FileResponse("static/index.html")


@app.post("/api/remove")
async def remove_background(file: UploadFile = File(...)):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Please upload an image file.")

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    try:
        original = Image.open(BytesIO(raw)).convert("RGBA")
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail="Could not parse image.") from exc

    removed_bytes = remove(raw)
    removed = Image.open(BytesIO(removed_bytes)).convert("RGBA")

    if removed.size != original.size:
        removed = removed.resize(original.size, Image.Resampling.LANCZOS)

    alpha = removed.split()[3]

    original_buffer = BytesIO()
    original.save(original_buffer, format="PNG")

    mask_buffer = BytesIO()
    alpha.save(mask_buffer, format="PNG")

    return {
        "width": original.width,
        "height": original.height,
        "original_png": base64.b64encode(original_buffer.getvalue()).decode("utf-8"),
        "mask_png": base64.b64encode(mask_buffer.getvalue()).decode("utf-8"),
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)

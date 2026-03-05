# Self-hosted Background Remover

This project is a local web app for high-quality background removal with manual touch-up controls.

## Features

- Upload any image and remove the background locally with `rembg`.
- Manual cleanup with brush tools:
  - **Erase**: remove remaining background pixels.
  - **Restore**: bring back foreground areas if over-removed.
- Download as **full-resolution PNG** (lossless, transparent, max quality).

## Run locally

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

Then open <http://localhost:8000>.

## Notes

- On first run, model weights may be downloaded once.
- Editing is done on a full-resolution alpha mask, so export quality matches the original dimensions.

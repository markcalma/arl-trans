import json
import os
from fastapi import FastAPI, File, Form, UploadFile, HTTPException, Request
from fastapi.responses import Response
from redact import redact_pdf, render_page, apply_manual_redactions, stamp_logo

app = FastAPI()


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/redact")
async def redact(
    pdf: UploadFile = File(...),
    instructions: str = Form(...),
):
    pdf_bytes = await pdf.read()
    if not pdf_bytes:
        raise HTTPException(status_code=400, detail="Empty PDF")

    try:
        inst = json.loads(instructions)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid instructions JSON")

    result_bytes, is_image_pdf = redact_pdf(pdf_bytes, inst)

    headers = {"X-Image-PDF": "true"} if is_image_pdf else {}
    return Response(content=result_bytes, media_type="application/pdf", headers=headers)


@app.post("/render-page")
async def render_page_endpoint(pdf: UploadFile = File(...)):
    pdf_bytes = await pdf.read()
    if not pdf_bytes:
        raise HTTPException(status_code=400, detail="Empty PDF")
    png_bytes = render_page(pdf_bytes)
    return Response(content=png_bytes, media_type="image/png")


@app.post("/manual-redact")
async def manual_redact_endpoint(
    pdf: UploadFile = File(...),
    boxes: str = Form(...),
):
    pdf_bytes = await pdf.read()
    if not pdf_bytes:
        raise HTTPException(status_code=400, detail="Empty PDF")
    try:
        boxes_list = json.loads(boxes)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid boxes JSON")
    result_bytes = apply_manual_redactions(pdf_bytes, boxes_list)
    return Response(content=result_bytes, media_type="application/pdf")


@app.post("/stamp-logo")
async def stamp_logo_endpoint(request: Request):
    data = await request.json()
    pdf_path = data.get("pdfPath")
    box = data.get("box")

    if not pdf_path or not box:
        raise HTTPException(status_code=400, detail="pdfPath and box required")
    if not os.path.exists(pdf_path):
        raise HTTPException(status_code=404, detail="PDF not found")

    logo_path = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "dashboard", "public", "arltrans-no-bg.png")
    )
    if not os.path.exists(logo_path):
        raise HTTPException(status_code=404, detail="Logo file not found")

    with open(pdf_path, "rb") as f:
        pdf_bytes = f.read()

    result_bytes = stamp_logo(pdf_bytes, box, logo_path)

    with open(pdf_path, "wb") as f:
        f.write(result_bytes)

    return {"ok": True}

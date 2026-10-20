import json
from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.responses import Response
from redact import redact_pdf, render_page, apply_manual_redactions

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

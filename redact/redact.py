import fitz  # PyMuPDF

# Proportional bounds derived from diagnostic output on standard NVO DO forms (612x792 pts)
# Top-left box: shipper/terminal company info
TOP_LEFT_Y_MIN_RATIO = 0.05
TOP_LEFT_Y_MAX_RATIO = 0.22
TOP_LEFT_X_MAX_RATIO = 0.44

# Bottom-left box: NVO issuing agent info
BOTTOM_LEFT_Y_MIN_RATIO = 0.60
BOTTOM_LEFT_X_MAX_RATIO = 1.0   # full width — agent address can span wide

# NVO billing reference in cargo description (image PDFs — fixed coordinates)
CARGO_REF_Y_MIN_RATIO = 0.62
CARGO_REF_Y_MAX_RATIO = 0.78
CARGO_REF_X_MIN_RATIO = 0.07
CARGO_REF_X_MAX_RATIO = 0.80


def _to_irect(rect, pw, ph, pg_w, pg_h):
    return fitz.IRect(
        max(0, int(rect.x0 / pg_w * pw)),
        max(0, int(rect.y0 / pg_h * ph)),
        min(pw, int(rect.x1 / pg_w * pw)),
        min(ph, int(rect.y1 / pg_h * ph)),
    )


def redact_pdf(pdf_bytes: bytes, instructions: dict) -> tuple[bytes, bool]:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    page = doc[0]
    w = page.rect.width
    h = page.rect.height

    blocks = page.get_text("blocks")
    is_image_pdf = len(blocks) == 0

    bottom_rect = fitz.Rect(0, h * BOTTOM_LEFT_Y_MIN_RATIO, w * BOTTOM_LEFT_X_MAX_RATIO, h * 0.98)
    top_rect = None
    if instructions.get("top_left_box", {}).get("redact"):
        top_rect = fitz.Rect(0, h * TOP_LEFT_Y_MIN_RATIO, w * TOP_LEFT_X_MAX_RATIO, h * TOP_LEFT_Y_MAX_RATIO)

    if is_image_pdf:
        # Render to pixmap and modify pixels directly — avoids z-order issues with shapes
        pix = page.get_pixmap(colorspace=fitz.csRGB)
        pw, ph = pix.width, pix.height

        pix.set_rect(_to_irect(bottom_rect, pw, ph, w, h), (255, 255, 255))
        if top_rect:
            pix.set_rect(_to_irect(top_rect, pw, ph, w, h), (255, 255, 255))
        if instructions.get("description_notes", {}).get("nvo_reference_found"):
            cargo_rect = fitz.Rect(
                w * CARGO_REF_X_MIN_RATIO,
                h * CARGO_REF_Y_MIN_RATIO,
                w * CARGO_REF_X_MAX_RATIO,
                h * CARGO_REF_Y_MAX_RATIO,
            )
            pix.set_rect(_to_irect(cargo_rect, pw, ph, w, h), (255, 255, 255))

        new_doc = fitz.open()
        new_page = new_doc.new_page(width=w, height=h)
        new_page.insert_image(new_page.rect, pixmap=pix)
        return new_doc.tobytes(), is_image_pdf

    else:
        # Text PDF: use proper redaction annotations
        page.add_redact_annot(bottom_rect, fill=(1, 1, 1))
        if top_rect:
            page.add_redact_annot(top_rect, fill=(1, 1, 1))
        if instructions.get("description_notes", {}).get("nvo_reference_found"):
            note_text = instructions["description_notes"].get("text_to_remove", "")
            first_line = note_text.strip().split("\n")[0].strip()
            if first_line:
                matches = page.search_for(first_line)
                for match in matches:
                    expanded = fitz.Rect(match.x0 - 2, match.y0 - 2, w * 0.65, match.y1 + 70)
                    page.add_redact_annot(expanded, fill=(1, 1, 1))
        page.apply_redactions()
        return doc.tobytes(), is_image_pdf


def render_page(pdf_bytes: bytes) -> bytes:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    pix = doc[0].get_pixmap(matrix=fitz.Matrix(2, 2), colorspace=fitz.csRGB)
    return pix.tobytes("png")


def stamp_logo(pdf_bytes: bytes, box: dict, logo_path: str) -> bytes:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    page = doc[0]
    w, h = page.rect.width, page.rect.height
    scale = 2.0  # canvas coords are in 2× PNG pixel space
    rect = fitz.Rect(
        max(0, box["x"] / scale),
        max(0, box["y"] / scale),
        min(w, (box["x"] + box["w"]) / scale),
        min(h, (box["y"] + box["h"]) / scale),
    )
    page.insert_image(rect, filename=logo_path)
    return doc.tobytes()


def apply_manual_redactions(pdf_bytes: bytes, boxes: list[dict]) -> bytes:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    page = doc[0]
    w, h = page.rect.width, page.rect.height
    scale = 2.0  # canvas boxes are in 2× PNG pixel space; divide to get PDF points
    for box in boxes:
        bw = int(box.get("w", 0))
        bh = int(box.get("h", 0))
        if bw <= 0 or bh <= 0:
            continue
        x0 = box.get("x", 0) / scale
        y0 = box.get("y", 0) / scale
        x1 = x0 + bw / scale
        y1 = y0 + bh / scale
        rect = fitz.Rect(max(0, x0), max(0, y0), min(w, x1), min(h, y1))
        page.add_redact_annot(rect, fill=(1, 1, 1))
    page.apply_redactions()
    return doc.tobytes()

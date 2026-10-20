import json
import fitz
import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


@pytest.fixture
def minimal_pdf_bytes() -> bytes:
    doc = fitz.open()
    doc.new_page(width=612, height=792)
    return doc.tobytes()


def test_render_page_returns_200_with_png(minimal_pdf_bytes):
    res = client.post(
        "/render-page",
        files={"pdf": ("test.pdf", minimal_pdf_bytes, "application/pdf")},
    )
    assert res.status_code == 200
    assert res.headers["content-type"] == "image/png"
    assert res.content[:8] == b'\x89PNG\r\n\x1a\n'


def test_render_page_rejects_empty_pdf():
    res = client.post(
        "/render-page",
        files={"pdf": ("test.pdf", b"", "application/pdf")},
    )
    assert res.status_code == 400


def test_manual_redact_returns_200_with_pdf(minimal_pdf_bytes):
    boxes = json.dumps([{"x": 0, "y": 0, "w": 100, "h": 100}])
    res = client.post(
        "/manual-redact",
        files={"pdf": ("test.pdf", minimal_pdf_bytes, "application/pdf")},
        data={"boxes": boxes},
    )
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/pdf"
    assert res.content[:5] == b'%PDF-'


def test_manual_redact_rejects_empty_pdf():
    res = client.post(
        "/manual-redact",
        files={"pdf": ("test.pdf", b"", "application/pdf")},
        data={"boxes": "[]"},
    )
    assert res.status_code == 400


def test_manual_redact_rejects_invalid_boxes_json(minimal_pdf_bytes):
    res = client.post(
        "/manual-redact",
        files={"pdf": ("test.pdf", minimal_pdf_bytes, "application/pdf")},
        data={"boxes": "not-valid-json"},
    )
    assert res.status_code == 400


def test_manual_redact_accepts_empty_boxes_list(minimal_pdf_bytes):
    res = client.post(
        "/manual-redact",
        files={"pdf": ("test.pdf", minimal_pdf_bytes, "application/pdf")},
        data={"boxes": "[]"},
    )
    assert res.status_code == 200


def test_health_endpoint_still_works():
    res = client.get("/health")
    assert res.status_code == 200

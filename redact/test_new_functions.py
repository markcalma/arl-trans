import struct
import fitz
from redact import render_page, apply_manual_redactions


def test_render_page_returns_png_magic_bytes(minimal_pdf):
    result = render_page(minimal_pdf)
    assert result[:8] == b'\x89PNG\r\n\x1a\n'


def test_render_page_dimensions_are_2x(minimal_pdf):
    result = render_page(minimal_pdf)
    # PNG IHDR: bytes 16–19 = width, 20–23 = height, big-endian uint32
    width = struct.unpack('>I', result[16:20])[0]
    height = struct.unpack('>I', result[20:24])[0]
    assert width == 1224   # 612pt × 2
    assert height == 1584  # 792pt × 2


def test_apply_manual_redactions_returns_valid_pdf(minimal_pdf):
    result = apply_manual_redactions(minimal_pdf, [{"x": 0, "y": 0, "w": 100, "h": 100}])
    assert result[:5] == b'%PDF-'


def test_apply_manual_redactions_whites_out_pixels(minimal_pdf):
    # Verify red pixel exists before redaction
    pre_doc = fitz.open(stream=minimal_pdf, filetype="pdf")
    pre_pix = pre_doc[0].get_pixmap(matrix=fitz.Matrix(2, 2))
    pre_sample = pre_pix.pixel(250, 200)
    assert pre_sample[0] > 200  # red channel dominant

    # Apply box covering the red rect (pixel space 100,100 w=300 h=200)
    result = apply_manual_redactions(minimal_pdf, [{"x": 100, "y": 100, "w": 300, "h": 200}])

    doc = fitz.open(stream=result, filetype="pdf")
    pix = doc[0].get_pixmap(matrix=fitz.Matrix(2, 2))
    sample = pix.pixel(250, 200)
    assert sample[0] == 255 and sample[1] == 255 and sample[2] == 255


def test_apply_manual_redactions_ignores_zero_area_boxes(minimal_pdf):
    boxes = [
        {"x": 100, "y": 100, "w": 0, "h": 100},
        {"x": 100, "y": 100, "w": 100, "h": 0},
    ]
    result = apply_manual_redactions(minimal_pdf, boxes)
    assert result[:5] == b'%PDF-'


def test_apply_manual_redactions_clamps_out_of_bounds(minimal_pdf):
    # Box starting near edge, extending well beyond 1224×1584
    boxes = [{"x": 1100, "y": 1400, "w": 500, "h": 500}]
    result = apply_manual_redactions(minimal_pdf, boxes)
    assert result[:5] == b'%PDF-'


def test_apply_empty_boxes_returns_unchanged_pdf(minimal_pdf):
    result = apply_manual_redactions(minimal_pdf, [])
    assert result[:5] == b'%PDF-'

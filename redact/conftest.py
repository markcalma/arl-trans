import pytest
import fitz


@pytest.fixture
def minimal_pdf() -> bytes:
    doc = fitz.open()
    page = doc.new_page(width=612, height=792)
    # Red rectangle at PDF points (50,50)→(200,150).
    # At 2× scale: pixels (100,100)→(400,300).
    page.draw_rect(fitz.Rect(50, 50, 200, 150), color=(1, 0, 0), fill=(1, 0, 0))
    return doc.tobytes()

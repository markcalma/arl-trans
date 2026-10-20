from redact import redact_pdf
import sys

SAMPLES = "C:\\Users\\28mar\\OneDrive\\Dev\\greg-clarke\\projects\\greg materials\\eml files 10-5-2026"

# Test 1: Bottom-left only (Page & Jones DO — railroad in top-left, keep it)
with open(f"{SAMPLES}\\DeliveryOrder___639256015306685011.pdf", "rb") as f:
    pdf_bytes = f.read()

instructions = {
    "top_left_box": {"redact": False},
    "description_notes": {"nvo_reference_found": False},
    "bottom_left_box": {"redact": True}
}
result, low_conf = redact_pdf(pdf_bytes, instructions)
assert not low_conf, "Test 1 FAIL: unexpected low_confidence"
with open("test_output_1.pdf", "wb") as f:
    f.write(result)
print("Test 1 PASS — open test_output_1.pdf: bottom-left should be blank, top-left intact")

# Test 2: Both boxes (Spadaro DO — Ocala Group commercial company)
with open(f"{SAMPLES}\\DeliveryOrder_33501000001_639248330756167542.pdf", "rb") as f:
    pdf_bytes = f.read()

instructions = {
    "top_left_box": {"redact": True},
    "description_notes": {"nvo_reference_found": False},
    "bottom_left_box": {"redact": True}
}
result, low_conf = redact_pdf(pdf_bytes, instructions)
assert not low_conf, "Test 2 FAIL: unexpected low_confidence"
with open("test_output_2.pdf", "wb") as f:
    f.write(result)
print("Test 2 PASS — open test_output_2.pdf: both top-left AND bottom-left should be blank")

# Test 3: Notes redaction (Taggart DO with billing note)
with open(f"{SAMPLES}\\DeliveryOrder_DeliveryOrderNoST203166200001_639258352019373660.pdf", "rb") as f:
    pdf_bytes = f.read()

instructions = {
    "top_left_box": {"redact": False},
    "description_notes": {
        "nvo_reference_found": True,
        "text_to_remove": "Please bill delivery charges to:\nTaggart Int'l\nPO Box 3692\nSt Augustine, FL 32085"
    },
    "bottom_left_box": {"redact": True}
}
result, low_conf = redact_pdf(pdf_bytes, instructions)
assert not low_conf, "Test 3 FAIL: unexpected low_confidence"
with open("test_output_3.pdf", "wb") as f:
    f.write(result)
print("Test 3 PASS — open test_output_3.pdf: billing note in description should be gone, bottom-left blank")

print("\nAll 3 tests passed. Open the output PDFs to visually confirm.")

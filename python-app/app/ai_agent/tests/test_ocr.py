import os
import pytest
from ocr_utils import process_document, clean_extracted_text

TEST_IMAGE_PATH = os.path.join(os.path.dirname(__file__), '../test_samples/sample_image.png')

@pytest.mark.ocr
def test_ocr_on_sample_image():
    if not os.path.exists(TEST_IMAGE_PATH):
        pytest.skip(f"Test image not found: {TEST_IMAGE_PATH}")
    text = process_document(TEST_IMAGE_PATH)
    cleaned = clean_extracted_text(text)
    assert isinstance(cleaned, str)
    assert len(cleaned) > 0, "OCR did not extract any text from the sample image."

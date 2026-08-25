import pymupdf

def _normalize_page_text(raw_text):
    """Convert PyMuPDF page text to a plain string for safe chunking."""
    if isinstance(raw_text, str):
        return raw_text
    if isinstance(raw_text, list):
        return "\n".join(str(part) for part in raw_text)
    return str(raw_text)


def parse_and_chunk_pdf(file_bytes: bytes, chunk_size: int = 700, overlap: int = 100):
    """
    Parses PDF bytes in RAM and extracts clean text chunks with page numbers.
    """
    doc = pymupdf.open(stream=file_bytes, filetype="pdf")
    total_pages = len(doc)
    extracted_chunks = []

    try:
        for page_idx in range(total_pages):
            page = doc[page_idx]
            raw_text = page.get_text("text")
            text = _normalize_page_text(raw_text).strip()
            if not text:
                continue

            start = 0
            while start < len(text):
                end = start + chunk_size
                chunk_text = text[start:end].strip()

                if chunk_text:
                    extracted_chunks.append({
                        "page_number": page_idx + 1,
                        "text": chunk_text,
                    })
                start += chunk_size - overlap
    finally:
        doc.close()  # Clean up memory immediately

    return total_pages, extracted_chunks
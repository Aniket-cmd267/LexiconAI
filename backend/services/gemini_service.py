import time
import re
from google.genai.errors import ClientError
from google import genai
from google.genai import types
from config import GEMINI_API_KEY
# Initialize the new unified client
client = genai.Client(api_key=GEMINI_API_KEY)

EMBEDDING_MODEL = "gemini-embedding-001"
CHAT_MODEL = "gemini-2.5-flash"

embedding_cache: dict[str, list[float]] = {}

EMBEDDING_REQUEST_INTERVAL_SECONDS = 0.6
last_embedding_request_at = 0.0

MAX_EMBEDDING_RETRIES = 3
query_embedding_cache: dict[str, list[float]] = {}


def _retry_delay(error: ClientError, attempt: int) -> float:
    message = str(error)

    match = re.search(r"retry in ([\d.]+)s", message, re.IGNORECASE)
    if match:
        return float(match.group(1)) + 1

    return min(2 ** attempt, 60)


def _embed_with_retry(contents, config):
    global last_embedding_request_at

    for attempt in range(MAX_EMBEDDING_RETRIES + 1):
        elapsed = time.monotonic() - last_embedding_request_at
        if elapsed < EMBEDDING_REQUEST_INTERVAL_SECONDS:
            time.sleep(EMBEDDING_REQUEST_INTERVAL_SECONDS - elapsed)

        try:
            response = client.models.embed_content(
                model=EMBEDDING_MODEL,
                contents=contents,
                config=config,
            )
            last_embedding_request_at = time.monotonic()
            return response

        except ClientError as error:
            if error.code != 429 or attempt == MAX_EMBEDDING_RETRIES:
                raise

            delay = _retry_delay(error, attempt)
            print(f"Embedding quota reached. Retrying in {delay:.1f} seconds...")
            time.sleep(delay)

    raise RuntimeError("Embedding request failed after retries.")

def get_batch_embeddings(texts: list[str]) -> list[list[float]]:
    """Generates embeddings while reusing vectors for repeated chunk text."""

    # Clean out empty strings
    clean_texts = [t.strip() for t in texts if t.strip()]
    if not clean_texts:
        return []

    uncached_texts = list(dict.fromkeys(
        text for text in clean_texts if text not in embedding_cache
    ))

    global last_embedding_request_at

    for start in range(0, len(uncached_texts), 100):
        batch = uncached_texts[start:start + 100]

        # Keep embedding requests sequential and below the free-tier rate limit.
        elapsed = time.monotonic() - last_embedding_request_at
        if elapsed < EMBEDDING_REQUEST_INTERVAL_SECONDS:
            time.sleep(EMBEDDING_REQUEST_INTERVAL_SECONDS - elapsed)

        response = _embed_with_retry(
            contents=batch,
            config=types.EmbedContentConfig(
                task_type="RETRIEVAL_DOCUMENT",
                output_dimensionality=768,
            ),
        )
        last_embedding_request_at = time.monotonic()
        response_embeddings = response.embeddings or []
        if len(response_embeddings) != len(batch):
            raise ValueError("Gemini returned an incomplete embedding response.")

        for text, embedding in zip(batch, response_embeddings):
            if embedding.values is None:
                raise ValueError("Gemini returned an embedding without values.")
            embedding_cache[text] = embedding.values

    return [embedding_cache[text] for text in clean_texts]


def get_query_embedding(query: str) -> list[float]:
    """Generates a query-specific 768-dim embedding."""
    clean_query = query.strip()
    if not clean_query:
        raise ValueError("Search query cannot be empty.")

    response = _embed_with_retry(
        contents=clean_query,
        config=types.EmbedContentConfig(
            task_type="RETRIEVAL_QUERY",
            output_dimensionality=768,
        ),
    )

    if not response.embeddings or response.embeddings[0].values is None:
        raise ValueError("Failed to generate embedding for query.")

    return response.embeddings[0].values


def _build_grounded_prompt(query: str, context_chunks: list[dict]) -> tuple[str, str]:
    """Builds the grounded prompt used for generation."""
    formatted_context = ""
    for idx, chunk in enumerate(context_chunks):
        formatted_context += (
            f"\n[Source {idx+1}] Document: {chunk.get('filename', 'Unknown')} | Page: {chunk.get('page_number', 1)}\n"
            f"Content: {chunk.get('text', '')}\n"
        )

    system_instruction = (
        "You are an expert research assistant like Google NotebookLM. "
        "Answer the user's question ONLY using the provided source context below.\n\n"
        "Formatting Guidelines:\n"
        "- Write in clean, publication-ready prose with proper typography and sentence casing.\n"
        "- Avoid shouting in ALL-CAPS unless it is an acronym.\n"
        "- Use clean bullet points and clear paragraphs.\n"
        "- If the answer cannot be found in the context, state: 'I cannot find the answer in the provided documents.'\n"
        "- Every factual claim MUST be followed by an inline citation formatted as: [Page: <page_number>]."
    )

    prompt = f"Context:\n{formatted_context}\n\nUser Question: {query}"
    return prompt, system_instruction


def generate_grounded_answer(query: str, context_chunks: list[dict]) -> str:
    """Generates strictly grounded answers with citations using Gemini 1.5 Flash."""
    prompt, system_instruction = _build_grounded_prompt(query, context_chunks)

    response = client.models.generate_content(
        model=CHAT_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=system_instruction,
            temperature=0.2,
        ),
    )

    if not response.text:
        return "I could not generate an answer based on the provided documents."

    return response.text


def generate_grounded_answer_stream(query: str, context_chunks: list[dict]):
    """Streams a grounded answer in chunks so the UI can render it incrementally."""
    prompt, system_instruction = _build_grounded_prompt(query, context_chunks)

    for chunk in client.models.generate_content_stream(
        model=CHAT_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=system_instruction,
            temperature=0.2,
        ),
    ):
        if chunk.text:
            yield chunk.text
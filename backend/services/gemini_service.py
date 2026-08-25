from google import genai
from google.genai import types
from config import GEMINI_API_KEY

# Initialize the new unified client
client = genai.Client(api_key=GEMINI_API_KEY)

EMBEDDING_MODEL = "gemini-embedding-001"
CHAT_MODEL = "gemini-2.5-flash"


def get_batch_embeddings(texts: list[str]) -> list[list[float]]:
    """Generates 768-dim embeddings for multiple chunks in ONE batch call."""
    if not texts:
        return []

    # Clean out empty strings
    clean_texts = [t.strip() for t in texts if t.strip()]
    if not clean_texts:
        return []

    response = client.models.embed_content(
        model=EMBEDDING_MODEL,
        contents=clean_texts,
        config=types.EmbedContentConfig(
            task_type="RETRIEVAL_DOCUMENT",
            output_dimensionality=768,
        ),
    )

    if not response.embeddings:
        raise ValueError("No embeddings returned by Google GenAI API.")

    return [e.values for e in response.embeddings if e.values is not None]


def get_query_embedding(query: str) -> list[float]:
    """Generates a query-specific 768-dim embedding."""
    clean_query = query.strip()
    if not clean_query:
        raise ValueError("Search query cannot be empty.")

    response = client.models.embed_content(
        model=EMBEDDING_MODEL,
        contents=clean_query,
        config=types.EmbedContentConfig(
            task_type="RETRIEVAL_QUERY",
            output_dimensionality=768,
        ),
    )

    if not response.embeddings or response.embeddings[0].values is None:
        raise ValueError("Failed to generate embedding for query.")

    return response.embeddings[0].values


def generate_grounded_answer(query: str, context_chunks: list[dict]) -> str:
    """Generates strictly grounded answers with citations using Gemini 1.5 Flash."""
    formatted_context = ""
    for idx, chunk in enumerate(context_chunks):
        formatted_context += (
            f"\n[Source {idx+1}] Document: {chunk.get('filename', 'Unknown')} | Page: {chunk.get('page_number', 1)}\n"
            f"Content: {chunk.get('text', '')}\n"
        )

    system_instruction = (
        "You are an expert research assistant like Google NotebookLM. "
        "Answer the user's question ONLY using the provided source context below.\n"
        "Strict Guidelines:\n"
        "1. If the answer cannot be found in the context, state: 'I cannot find the answer in the provided documents.'\n"
        "2. Do not use outside knowledge.\n"
        "3. Every factual claim must be backed with an inline citation in format: [Doc: <filename>, Page: <page_number>]."
    )

    prompt = f"Context:\n{formatted_context}\n\nUser Question: {query}"

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
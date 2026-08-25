import uuid
import re
from typing import Any

from qdrant_client import QdrantClient
from qdrant_client.http import models
from config import QDRANT_URL, QDRANT_API_KEY

qdrant_client = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY)

def format_collection_name(notebook_id: str) -> str:
    """
    Sanitizes notebook_id to be a valid Qdrant collection name
    (only alphanumeric characters, underscores, and hyphens).
    """
    clean_id = re.sub(r'[^a-zA-Z0-9_-]', '_', notebook_id.strip())
    return f"notebook_{clean_id}"


def init_qdrant(notebook_id: str):
    """
    Ensures a dedicated Qdrant collection exists for this specific notebook.
    """
    collection_name = format_collection_name(notebook_id)
    collections = [c.name for c in qdrant_client.get_collections().collections]

    if collection_name not in collections:
        qdrant_client.create_collection(
            collection_name=collection_name,
            vectors_config=models.VectorParams(
                size=768,  # Matches Google text-embedding-004 dimensions
                distance=models.Distance.COSINE,
            ),
        )
        print(f" Created new dedicated Qdrant collection: {collection_name}")

    qdrant_client.create_payload_index(
        collection_name=collection_name,
        field_name="document_id",
        field_schema=models.PayloadSchemaType.KEYWORD,
    )

    return collection_name


def insert_chunks(notebook_id: str, chunks_data: list[dict]):
    """Insert text chunks and embeddings into the notebook's dedicated collection."""
    if not chunks_data:
        return

    # Ensure this notebook's collection exists before inserting
    collection_name = init_qdrant(notebook_id)

    points = models.Batch(
        ids=[str(uuid.uuid4()) for _ in chunks_data],
        vectors=[item["vector"] for item in chunks_data],
        payloads=[
            {
                "document_id": item["document_id"],
                "filename": item["filename"],
                "page_number": item["page_number"],
                "text": item["text"],
            }
            for item in chunks_data
        ],
    )

    qdrant_client.upsert(collection_name=collection_name, points=points)


def search_relevant_chunks(
    query_vector: list[float],
    notebook_id: str,
    doc_ids: list[str] | None = None,
    limit: int = 6,
) -> list[dict]:
    """Search vectors strictly inside the notebook's dedicated collection."""
    collection_name = init_qdrant(notebook_id)

    must_filters: list[models.Condition] = []

    if doc_ids and len(doc_ids) > 0:
        must_filters.append(
            models.FieldCondition(key="document_id", match=models.MatchAny(any=doc_ids))
        )

    query_filter = models.Filter(must=must_filters) if must_filters else None

    search_fn = getattr(qdrant_client, "query_points", None) or getattr(qdrant_client, "search")

    if search_fn.__name__ == "query_points":
        search_result = search_fn(
            collection_name=collection_name,
            query=query_vector,
            filter=query_filter,
            limit=limit,
            with_payload=True,
            with_vectors=False,
        )
    else:
        search_result = search_fn(
            collection_name=collection_name,
            query_vector=query_vector,
            query_filter=query_filter,
            limit=limit,
        )

    return [hit.payload for hit in search_result if hit.payload is not None]

def delete_notebook_collection(notebook_id: str):
    """Deletes the entire collection if a notebook is deleted."""
    collection_name = format_collection_name(notebook_id)
    qdrant_client.delete_collection(collection_name=collection_name)
    print(f"🗑️ Deleted Qdrant collection: {collection_name}")
import uuid
from typing import Any, Callable, cast

from qdrant_client import QdrantClient
from qdrant_client.http import models
from config import QDRANT_URL, QDRANT_API_KEY

qdrant_client = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY)
COLLECTION_NAME = "notebook_chunks"


def init_qdrant():
    """Ensure the Qdrant collection exists and has filter indexes for metadata."""
    collections = qdrant_client.get_collections().collections
    exists = any(c.name == COLLECTION_NAME for c in collections)

    if not exists:
        qdrant_client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=models.VectorParams(
                size=768,
                distance=models.Distance.COSINE,
            ),
        )

    for field_name in ["notebook_id", "document_id"]:
        try:
            qdrant_client.create_payload_index(
                collection_name=COLLECTION_NAME,
                field_name=field_name,
                field_schema=models.PayloadSchemaType.KEYWORD,
            )
        except Exception as exc:
            message = str(exc).lower()
            if "already exists" not in message and "index already" not in message:
                raise


def insert_chunks(chunks_data: list[dict]):
    """Insert text chunks and embeddings with metadata payloads."""
    if not chunks_data:
        return

    print("Inserting Chunks....")
    points = models.Batch(
        ids=[str(uuid.uuid4()) for _ in chunks_data],
        vectors=[item["vector"] for item in chunks_data],
        payloads=[
            {
                "notebook_id": item["notebook_id"],
                "document_id": item["document_id"],
                "filename": item["filename"],
                "page_number": item["page_number"],
                "text": item["text"],
            }
            for item in chunks_data
        ],
    )

    qdrant_client.upsert(collection_name=COLLECTION_NAME, points=points)


def search_relevant_chunks(
    query_vector: list[float],
    notebook_id: str,
    doc_ids: list[str] | None = None,
    limit: int = 6,
) -> list[dict]:
    """Filtered semantic search scoped by notebook_id and optional doc_ids."""
    must_filters: list[models.FieldCondition] = [
        models.FieldCondition(key="notebook_id", match=models.MatchValue(value=notebook_id))
    ]

    if doc_ids and len(doc_ids) > 0:
        must_filters.append(
            models.FieldCondition(key="document_id", match=models.MatchAny(any=doc_ids))
        )

    search_method: Callable[..., Any] = getattr(qdrant_client, "search")
    search_result = search_method(
        collection_name=COLLECTION_NAME,
        query_vector=query_vector,
        query_filter=models.Filter(must=cast(list[models.Condition], must_filters)),
        limit=limit,
    )

    return [hit.payload for hit in search_result if hit.payload is not None]
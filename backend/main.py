import uuid
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from pydantic import BaseModel
from sqlalchemy.orm import Session

# Database & Models
from database import engine, Base, get_db
import models

# Services
from services.pdf_Service import parse_and_chunk_pdf
from services.gemini_service import get_batch_embeddings, get_query_embedding, generate_grounded_answer
from services.qdrant_service import init_qdrant, insert_chunks, search_relevant_chunks

app = FastAPI(title="NotebookLM Backend API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema

    schema = get_openapi(
        title=app.title,
        version="1.0.0",
        routes=app.routes,
    )
    upload_schema = schema["components"]["schemas"].get(
        "Body_upload_document_api_documents_upload_post"
    )
    if upload_schema:
        file_schema = upload_schema["properties"]["file"]
        file_schema.pop("contentMediaType", None)
        file_schema["format"] = "binary"

    app.openapi_schema = schema
    return schema


app.openapi = custom_openapi


@app.on_event("startup")
def startup_event():
    # Initialize Qdrant collection and create PostgreSQL/Supabase tables
    init_qdrant()
    Base.metadata.create_all(bind=engine)
    print("✅ Qdrant and Database tables initialized successfully.")


class ChatRequest(BaseModel):
    notebook_id: str
    query: str
    selected_doc_ids: list[str] = []


class CreateNotebookRequest(BaseModel):
    name: str


# ==========================================
# 1. NOTEBOOK / WORKSPACE ROUTES
# ==========================================

@app.post("/api/notebooks")
def create_notebook(payload: CreateNotebookRequest, db: Session = Depends(get_db)):
    """Create a new notebook workspace."""
    notebook = models.Notebook(name=payload.name)
    db.add(notebook)
    db.commit()
    db.refresh(notebook)
    return notebook


@app.get("/api/notebooks")
def list_notebooks(db: Session = Depends(get_db)):
    """Get all notebooks."""
    return db.query(models.Notebook).order_by(models.Notebook.created_at.desc()).all()


# ==========================================
# 2. DOCUMENT MANAGEMENT ROUTES
# ==========================================

@app.post("/api/documents/upload")
async def upload_document(
    notebook_id: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    print("Running")
    print(notebook_id, file)
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    file_bytes = await file.read()
    document_id = str(uuid.uuid4())

    # 1. Parse and chunk in RAM
    total_pages, chunks = parse_and_chunk_pdf(file_bytes)
    if not chunks:
        raise HTTPException(
            status_code=400,
            detail="Could not extract text from this PDF (it might be scanned images or empty)."
        )
    print("running..")

    # 2. Extract plain text array for high-speed batch embedding
    texts_to_embed = [c["text"] for c in chunks]
    print(texts_to_embed)

    # 3. Call Google GenAI SDK (Single batch call)
    vectors = get_batch_embeddings(texts_to_embed)

    # 4. Prepare payload
    qdrant_payloads = [
        {
            "vector": vector,
            "notebook_id": notebook_id,
            "document_id": document_id,
            "filename": file.filename,
            "page_number": chunk["page_number"],
            "text": chunk["text"]
        }
        for chunk, vector in zip(chunks, vectors)
    ]

    # 5. Insert into Qdrant Cloud
    insert_chunks(qdrant_payloads)

    # 6. Save record in Database (Auto-create notebook if not existing)
    notebook = db.query(models.Notebook).filter(models.Notebook.id == notebook_id).first()
    if not notebook:
        notebook = models.Notebook(id=notebook_id, name="Default Notebook")
        db.add(notebook)
        db.commit()

    db_document = models.Document(
        id=document_id,
        notebook_id=notebook_id,
        filename=file.filename,
        total_pages=total_pages
    )
    db.add(db_document)
    db.commit()

    return {
        "status": "success",
        "document_id": document_id,
        "filename": file.filename,
        "total_pages": total_pages,
        "total_chunks": len(chunks)
    }


@app.get("/api/documents")
def list_documents(notebook_id: str, db: Session = Depends(get_db)):
    """List all uploaded PDF documents for a notebook."""
    clean_id = notebook_id.strip()
    return db.query(models.Document).filter(models.Document.notebook_id == clean_id).all()  


# ==========================================
# 3. CHAT & HISTORY ROUTES
# ==========================================

@app.post("/api/chat")
async def chat_with_documents(
    payload: ChatRequest,
    db: Session = Depends(get_db)
):
    # 1. Save user query to Chat History
    user_msg = models.ChatMessage(
        notebook_id=payload.notebook_id,
        sender="user",
        message=payload.query
    )
    db.add(user_msg)
    db.commit()

    # 2. Embed query
    query_vector = get_query_embedding(payload.query)

    # 3. Search Qdrant with filters
    matched_chunks = search_relevant_chunks(
        query_vector=query_vector,
        notebook_id=payload.notebook_id,
        doc_ids=payload.selected_doc_ids,
        limit=6
    )

    if not matched_chunks:
        answer = "No relevant context found in the selected documents to answer your question."
        citations = []
    else:
        # 4. Generate grounded answer
        answer = generate_grounded_answer(payload.query, matched_chunks)

        # 5. Extract citations
        citations = [
            {"filename": c["filename"], "page_number": c["page_number"]}
            for c in matched_chunks
        ]

    # 6. Save assistant response and citations to Chat History
    assistant_msg = models.ChatMessage(
        notebook_id=payload.notebook_id,
        sender="assistant",
        message=answer,
        citations=citations
    )
    db.add(assistant_msg)
    db.commit()

    return {
        "answer": answer,
        "citations": citations
    }


@app.get("/api/chat/history")
def get_chat_history(notebook_id: str, db: Session = Depends(get_db)):
    """Fetch previous chat messages for this notebook when the page reloads."""
    return (
        db.query(models.ChatMessage)
        .filter(models.ChatMessage.notebook_id == notebook_id)
        .order_by(models.ChatMessage.created_at.asc())
        .all()
    )
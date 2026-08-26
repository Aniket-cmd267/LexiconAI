import uuid
import json
from typing import cast
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from sqlalchemy import inspect, text

# Database & Models
from database import engine, Base, get_db
import models

# Services
from services.auth_service import hash_password, verify_password, create_access_token, get_current_user
from services.pdf_Service import parse_and_chunk_pdf
from services.gemini_service import (
    get_batch_embeddings,
    get_query_embedding,
    generate_grounded_answer,
    generate_grounded_answer_stream,
)
from services.qdrant_service import insert_chunks, search_relevant_chunks, init_qdrant

app = FastAPI(title="Lexicon Backend API")

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
    Base.metadata.create_all(bind=engine)
    inspector = inspect(engine)
    if "user_id" not in {column["name"] for column in inspector.get_columns("notebooks")}:
        with engine.begin() as connection:
            connection.execute(
                text(
                    "ALTER TABLE notebooks "
                    "ADD COLUMN user_id VARCHAR(36) "
                    "REFERENCES users(id) ON DELETE CASCADE"
                )
            )
    print("✅ Database tables initialized successfully.")

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class ChatRequest(BaseModel):
    notebook_id: str
    query: str
    selected_doc_ids: list[str] = []
class CreateNotebookRequest(BaseModel):
    name: str


# ==========================================
# 1. NOTEBOOK / WORKSPACE ROUTES
# ==========================================
@app.post("/api/auth/register")
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    existing_user = db.query(models.User).filter(models.User.email == payload.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = models.User(
        email=payload.email,
        hashed_password=hash_password(payload.password)
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(cast(str, user.id), cast(str, user.email))
    return {"token": token, "user": {"id": user.id, "email": user.email}}

@app.post("/api/auth/login")
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == payload.email).first()
    if not user or not verify_password(payload.password, cast(str, user.hashed_password)):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token(cast(str, user.id), cast(str, user.email))
    return {"token": token, "user": {"id": user.id, "email": user.email}}



@app.post("/api/notebooks")
def create_notebook(payload: CreateNotebookRequest,current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Create a new notebook workspace and its Qdrant collection."""
    notebook = models.Notebook(
        name=payload.name,
        user_id=cast(str, current_user.id),
    )
    db.add(notebook)
    db.commit()
    db.refresh(notebook)

    # Pre-create the dedicated Qdrant collection
    init_qdrant(str(notebook.id))

    return notebook


@app.get("/api/notebooks")
def list_notebooks(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return( 
            db.query(models.Notebook)
            .filter(models.Notebook.user_id == current_user.id)
            .order_by(models.Notebook.created_at.desc()).all()
    )

# ==========================================
# 2. DOCUMENT MANAGEMENT ROUTES
# ==========================================

@app.post("/api/documents/upload")
async def upload_document(
    notebook_id: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
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

    # 2. Batch embedding
    texts_to_embed = [c["text"] for c in chunks]
    vectors = get_batch_embeddings(texts_to_embed)

    # 3. Prepare payload
    qdrant_payloads = [
        {
            "vector": vector,
            "document_id": document_id,
            "filename": file.filename,
            "page_number": chunk["page_number"],
            "text": chunk["text"]
        }
        for chunk, vector in zip(chunks, vectors)
    ]

    # 4. Insert into the notebook's DEDICATED Qdrant collection
    insert_chunks(notebook_id=notebook_id, chunks_data=qdrant_payloads)

    # 5. Save record in Database
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
    # 1. Save user query
    user_msg = models.ChatMessage(
        notebook_id=payload.notebook_id,
        sender="user",
        message=payload.query
    )
    db.add(user_msg)
    db.commit()

    # 2. Embed query
    query_vector = get_query_embedding(payload.query)

    # 3. Search ONLY inside this notebook's dedicated collection
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
        citations = [
            {"filename": c["filename"], "page_number": c["page_number"]}
            for c in matched_chunks
        ]

    # 5. Save assistant response
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


@app.post("/api/chat/stream")
async def chat_with_documents_stream(
    payload: ChatRequest,
    db: Session = Depends(get_db)
):
    user_msg = models.ChatMessage(
        notebook_id=payload.notebook_id,
        sender="user",
        message=payload.query,
    )
    db.add(user_msg)
    db.commit()

    query_vector = get_query_embedding(payload.query)
    matched_chunks = search_relevant_chunks(
        query_vector=query_vector,
        notebook_id=payload.notebook_id,
        doc_ids=payload.selected_doc_ids,
        limit=6,
    )

    citations = []

    async def stream_response():
        if not matched_chunks:
            message = "No relevant context found in the selected documents to answer your question."
            yield "data: " + json.dumps({"type": "text", "text": message}) + "\n\n"
            yield "event: done\ndata: " + json.dumps({"citations": []}) + "\n\n"
            return

        citations.extend([
            {"filename": c["filename"], "page_number": c["page_number"]}
            for c in matched_chunks
        ])

        full_text = []
        for chunk in generate_grounded_answer_stream(payload.query, matched_chunks):
            if not chunk:
                continue
            full_text.append(chunk)
            yield "data: " + json.dumps({"type": "text", "text": chunk}) + "\n\n"

        assistant_msg = models.ChatMessage(
            notebook_id=payload.notebook_id,
            sender="assistant",
            message="".join(full_text),
            citations=citations,
        )
        db.add(assistant_msg)
        db.commit()

        yield "event: done\ndata: " + json.dumps({"citations": citations}) + "\n\n"

    return StreamingResponse(stream_response(), media_type="text/event-stream")


@app.get("/api/chat/history")
def get_chat_history(notebook_id: str, db: Session = Depends(get_db)):
    return (
        db.query(models.ChatMessage)
        .filter(models.ChatMessage.notebook_id == notebook_id)
        .order_by(models.ChatMessage.created_at.asc())
        .all()
    )
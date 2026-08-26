# Lexicon AI

Lexicon AI is a document question-answering workspace. Users can create notebooks, upload PDF sources, search the indexed content, and ask grounded questions with page-level citations.

The repository contains two applications:

- `backend/`: FastAPI API, PostgreSQL persistence, PDF parsing, Gemini embeddings and generation, and Qdrant vector search.
- `frontend/`: Next.js application for authentication, notebook management, PDF uploads, source selection, chat, profile actions, and light/dark mode.

## Current Status

Implemented:

- Email/password registration and login with JWT authentication
- User-owned notebooks
- PDF text extraction and overlapping chunking
- Gemini `gemini-embedding-001` document and query embeddings
- Embedding batches of up to 100 texts
- In-memory reuse of repeated chunk embeddings
- Sequential embedding requests with rate pacing
- Qdrant similarity search scoped to a notebook and optional document selection
- Grounded chat responses using `gemini-2.5-flash`
- Streaming chat responses with citations
- Persistent chat history in PostgreSQL
- Responsive notebook UI with source selection, drag-and-drop upload, suggested questions, profile menu, logout, and theme toggle

## Architecture

```mermaid
flowchart TB
	subgraph Client[Client Layer]
		Web[Web App<br/>React / Next.js<br/>PDF Viewer and Chat UI]
	end

	subgraph Backend[Backend API]
		API[FastAPI Router]
		Ingest[Ingestion and<br/>Chunking Engine]
		RAG[RAG Orchestrator]
	end

	subgraph Gemini[Gemini APIs]
		Embed[Gemini Embedding API<br/>gemini-embedding-001]
		LLM[Gemini 2.5 Flash<br/>Grounded Generation]
	end

	subgraph Storage[Storage and Databases]
		Vector[(Qdrant Vector DB<br/>Embeddings and Metadata)]
		SQL[(PostgreSQL<br/>Users, Metadata, Chat Logs)]
		Files[(Cloud Storage<br/>Raw PDF Files)]
	end

	Web -->|Upload PDF| API
	API -->|Store file and metadata| SQL
	API -->|Store raw PDF| Files
	API --> Ingest
	Ingest -->|Embed chunks| Embed
	Embed -->|Return vectors| Ingest
	Ingest -->|Save vectors and metadata| Vector

	Web -->|User question| RAG
	RAG -->|Embed query| Embed
	Embed -->|Return query vector| RAG
	RAG -->|Filtered similarity search| Vector
	Vector -->|Relevant chunks| RAG
	RAG -->|Prompt with context| LLM
	LLM -->|Answer and citations| RAG
	RAG -->|Stream answer| Web
	RAG -->|Save chat| SQL
```

### Request Flow

1. The web app sends an uploaded PDF to the FastAPI router.
2. The ingestion engine extracts text and creates overlapping chunks.
3. Gemini generates embeddings for the chunks, which are stored in Qdrant with metadata.
4. A user question is embedded and used to search the relevant notebook vectors.
5. The RAG orchestrator sends the retrieved context to Gemini 2.5 Flash.
6. The answer is streamed back to the web app with document and page citations.

## Prerequisites

- Python 3.11 or newer
- Node.js 20 or newer
- A PostgreSQL database
- A Qdrant Cloud collection or server
- A Google Gemini API key with access to the configured models

## Configuration

Create `backend/.env` locally. Do not commit this file or place real credentials in the README:

```env
DATABASE_URL=postgresql://user:password@host:5432/database
QDRANT_URL=https://your-qdrant-endpoint
QDRANT_API_KEY=your-qdrant-api-key
GEMINI_API_KEY=your-gemini-api-key
JWT_SECRET=replace-with-a-long-random-secret
```

The frontend uses `http://127.0.0.1:8000` by default. To override it, create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```

## Local Development

### Backend

From the repository root, create and activate a virtual environment, then install dependencies:

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

The API documentation is available at [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs).

### Frontend

In a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Run the production checks with:

```powershell
npm run lint
npx tsc --noEmit
npm run build
```

## API Overview

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Create a user and return a JWT |
| `POST` | `/api/auth/login` | Authenticate a user and return a JWT |
| `GET` | `/api/notebooks` | List the authenticated user's notebooks |
| `POST` | `/api/notebooks` | Create a notebook |
| `GET` | `/api/documents?notebook_id={id}` | List notebook documents |
| `POST` | `/api/documents/upload` | Parse, embed, and index a PDF |
| `POST` | `/api/chat` | Return a complete grounded answer |
| `POST` | `/api/chat/stream` | Stream a grounded answer over SSE |
| `GET` | `/api/chat/history?notebook_id={id}` | Return notebook chat history |

Notebook endpoints currently expect:

```http
Authorization: Bearer <jwt-token>
```

## Embedding and Quota Notes

Document text is split into chunks in `backend/services/pdf_Service.py`. The embedding service sends at most 100 texts per request, caches repeated text for the lifetime of the backend process, and processes batches sequentially. These measures reduce request volume but do not remove Gemini project quotas.

The free tier can still return `429 RESOURCE_EXHAUSTED` for per-minute, token, or daily limits. Wait for the retry interval supplied by Gemini, avoid repeatedly uploading the same document, and monitor usage in Google AI Studio. For high-volume or durable caching, use a persistent embedding cache or a local embedding model and re-index Qdrant with the matching vector dimension.

## Data and Migration Notes

Database tables are created at backend startup. The startup routine also adds `notebooks.user_id` when upgrading an older database that does not contain that column. Existing notebook rows must be assigned valid owners before they can appear in a user's notebook list.

The current upload flow stores extracted text and vectors in Qdrant and document metadata in PostgreSQL. Original PDF bytes are not currently persisted by the backend, so uploaded files are not available for later browser download unless file storage is added. Document and chat routes should also be protected with the authenticated notebook owner before production deployment.

## Security Notes

- Keep `backend/.env` and API keys out of source control.
- Use a strong, unique `JWT_SECRET` outside local development.
- Restrict CORS origins before production deployment; the current development configuration allows all origins.
- Add authorization checks to document, chat, and upload routes before exposing the service publicly.
- Use HTTPS and a production database connection pool in deployed environments.

## Project Layout

```text
backend/
	main.py                 FastAPI routes and startup migration
	models.py               SQLAlchemy models
	database.py             Database engine and sessions
	config.py               Environment configuration
	services/
		auth_service.py       Password hashing and JWT validation
		gemini_service.py     Embeddings and grounded generation
		pdf_Service.py        PDF extraction and chunking
		qdrant_service.py     Vector collection and search operations

frontend/
	app/                    Next.js routes and page layouts
	src/component/          Navbar, sidebar, chat, and message UI
	src/lib/api.ts          Backend API client
	src/types/              Shared frontend types
```

## License

No license has been declared for this repository yet.

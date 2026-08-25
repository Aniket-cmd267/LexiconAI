import { DocumentItem, ChatMessage, Notebook } from '../types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// 1. Fetch all notebooks
export async function getNotebooks(): Promise<Notebook[]> {
  const res = await fetch(`${API_BASE}/api/notebooks`);
  if (!res.ok) throw new Error('Failed to fetch notebooks');
  return res.json();
}

// 2. Fetch documents for a notebook
export async function getDocuments(notebookId: string): Promise<DocumentItem[]> {
  const res = await fetch(`${API_BASE}/api/documents?notebook_id=${encodeURIComponent(notebookId)}`);
  if (!res.ok) throw new Error('Failed to fetch documents');
  return res.json();
}

// 3. Upload PDF file
export async function uploadDocument(notebookId: string, file: File) {
  const formData = new FormData();
  formData.append('notebook_id', notebookId);
  formData.append('file', file);

  const res = await fetch(`${API_BASE}/api/documents/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Upload failed');
  }
  return res.json();
}

// 4. Send chat message
export async function sendChatMessage(
  notebookId: string,
  query: string,
  selectedDocIds: string[],
  onChunk?: (text: string) => void
): Promise<{ answer: string; citations: { filename: string; page_number: number }[] }> {
  const res = await fetch(`${API_BASE}/api/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      notebook_id: notebookId,
      query,
      selected_doc_ids: selectedDocIds,
    }),
  });

  if (!res.ok) throw new Error('Failed to send message');

  const reader = res.body?.getReader();
  if (!reader) throw new Error('ReadableStream not supported');

  const decoder = new TextDecoder();
  let fullText = '';
  let citations: { filename: string; page_number: number }[] = [];

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    const text = decoder.decode(value, { stream: true });
    const lines = text.split('\n');

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      if (trimmedLine.startsWith('data:')) {
        const payload = trimmedLine.slice(5).trim();
        if (!payload) continue;

        try {
          const parsed = JSON.parse(payload);
          if (parsed.type === 'text') {
            const chunkText = parsed.text || '';
            fullText += chunkText;
            onChunk?.(chunkText);
          }

          if (parsed.citations) {
            citations = parsed.citations;
          }
        } catch {
          fullText += payload;
        }
      }

      if (trimmedLine === 'event: done') {
        continue;
      }
    }
  }

  return { answer: fullText, citations };
}

// 5. Fetch chat history
export async function getChatHistory(notebookId: string): Promise<ChatMessage[]> {
  const res = await fetch(`${API_BASE}/api/chat/history?notebook_id=${encodeURIComponent(notebookId)}`);
  if (!res.ok) throw new Error('Failed to fetch chat history');
  return res.json();
}
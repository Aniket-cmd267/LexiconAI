export interface Notebook {
  id: string;
  name: string;
  created_at: string;
}

export interface DocumentItem {
  id: string;
  notebook_id: string;
  filename: string;
  total_pages: number;
  created_at: string;
}

export interface Citation {
  filename: string;
  page_number: number;
}

export interface ChatMessage {
  id?: string;
  sender: 'user' | 'assistant';
  message: string;
  citations?: Citation[];
  created_at?: string;
}
'use client';

import React, { useState, useEffect } from 'react';
import { DocumentItem, ChatMessage } from '@/types';
import { getDocuments, uploadDocument, sendChatMessage, getChatHistory } from '@/lib/api';
import { Navbar } from '@/component/Navbar';
import { Sidebar } from '@/component/Sidebar';
import { ChatPanel } from '@/component/ChatPanel';

const DEFAULT_NOTEBOOK_ID = 'nb-100';

export default function Home() {
  const [notebookId] = useState(DEFAULT_NOTEBOOK_ID);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);

  // Load documents and chat history on initial mount
  useEffect(() => {
    async function loadInitialData() {
      try {
        const [docs, history] = await Promise.all([
          getDocuments(notebookId),
          getChatHistory(notebookId),
        ]);
        setDocuments(docs);
        setMessages(history);
      } catch (err) {
        console.error('Error loading notebook data:', err);
      }
    }
    loadInitialData();
  }, [notebookId]);

  // Handle PDF Upload
  const handleUpload = async (file: File) => {
    await uploadDocument(notebookId, file);
    const updatedDocs = await getDocuments(notebookId);
    setDocuments(updatedDocs);
  };

  // Toggle selection of specific PDFs
  const handleToggleDoc = (docId: string) => {
    setSelectedDocIds((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]
    );
  };

  // Handle User Chat Query
  const handleSendMessage = async (query: string) => {
    const userMsg: ChatMessage = { sender: 'user', message: query };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    const assistantPlaceholder: ChatMessage = {
      sender: 'assistant',
      message: '',
      citations: [],
    };

    setMessages((prev) => [...prev, assistantPlaceholder]);

    try {
      const data = await sendChatMessage(notebookId, query, selectedDocIds, (chunk) => {
        setMessages((prev) => {
          const next = [...prev];
          const lastIndex = next.length - 1;
          if (lastIndex >= 0 && next[lastIndex].sender === 'assistant') {
            next[lastIndex] = {
              ...next[lastIndex],
              message: (next[lastIndex].message || '') + chunk,
            };
          }
          return next;
        });
      });

      setMessages((prev) => {
        const next = [...prev];
        const lastIndex = next.length - 1;
        if (lastIndex >= 0 && next[lastIndex].sender === 'assistant') {
          next[lastIndex] = {
            ...next[lastIndex],
            message: data.answer || next[lastIndex].message || '',
            citations: data.citations || [],
          };
        }
        return next;
      });
    } catch (err) {
      console.error('Chat error:', err);
      setMessages((prev) => [
        ...prev,
        {
          sender: 'assistant',
          message: 'An error occurred while answering your question. Please try again.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-white">
      <Navbar notebookName="Research Workspace" />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          documents={documents}
          selectedDocIds={selectedDocIds}
          onToggleDoc={handleToggleDoc}
          onUpload={handleUpload}
        />
        <ChatPanel
          messages={messages}
          loading={loading}
          onSendMessage={handleSendMessage}
        />
      </div>
    </div>
  );
}
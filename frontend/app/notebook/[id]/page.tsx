'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DocumentItem, ChatMessage } from '@/types';
import { getDocuments, uploadDocument, sendChatMessage, getChatHistory } from '@/lib/api';
import { Navbar } from '@/component/Navbar';
import { Sidebar } from '@/component/Sidebar';
import { ChatPanel } from '@/component/ChatPanel';

export default function WorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const notebookId = params.id as string;

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(() =>
    typeof window !== 'undefined' && localStorage.getItem('theme') === 'dark'
  );

  const handleThemeToggle = () => {
    setDarkMode((current) => {
      const next = !current;
      localStorage.setItem('theme', next ? 'dark' : 'light');
      return next;
    });
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/auth');
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/auth');
      return;
    }

    async function loadData() {
      try {
        const [docs, history] = await Promise.all([
          getDocuments(notebookId),
          getChatHistory(notebookId),
        ]);
        setDocuments(docs);
        setMessages(history);
      } catch (err) {
        console.error(err);
      }
    }
    loadData();
  }, [notebookId, router]);

  const handleUpload = async (file: File) => {
    await uploadDocument(notebookId, file);
    const updatedDocs = await getDocuments(notebookId);
    setDocuments(updatedDocs);
  };

  const handleToggleDoc = (docId: string) => {
    setSelectedDocIds((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]
    );
  };

  const handleSelectAllDocs = () => {
    setSelectedDocIds(documents.map((document) => document.id));
  };

  const handleClearDocSelection = () => {
    setSelectedDocIds([]);
  };

  const handleSendMessage = async (query: string) => {
    const userMsg: ChatMessage = { sender: 'user', message: query };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const data = await sendChatMessage(notebookId, query, selectedDocIds);
      const assistantMsg: ChatMessage = {
        sender: 'assistant',
        message: data.answer,
        citations: data.citations,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={darkMode ? 'dark h-screen w-screen flex flex-col overflow-hidden' : 'h-screen w-screen flex flex-col overflow-hidden'}>
      <Navbar
        notebookName={`Workspace: ${notebookId.slice(0, 8)}...`}
        darkMode={darkMode}
        onThemeToggle={handleThemeToggle}
        onLogout={handleLogout}
      />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          documents={documents}
          selectedDocIds={selectedDocIds}
          onToggleDoc={handleToggleDoc}
          onSelectAll={handleSelectAllDocs}
          onClearSelection={handleClearDocSelection}
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
import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '@/types';
import { MessageItem } from './MessageItem';
import { Send, Loader2, Sparkles } from 'lucide-react';

interface ChatPanelProps {
  messages: ChatMessage[];
  loading: boolean;
  onSendMessage: (query: string) => Promise<void>;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ messages, loading, onSendMessage }) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    const query = input.trim();
    setInput('');
    await onSendMessage(query);
  };

  return (
    <main className="flex-1 flex flex-col h-[calc(100vh-3.5rem)] bg-gray-50/30">
      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto text-gray-500">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3">
              <Sparkles size={24} />
            </div>
            <h2 className="text-lg font-semibold text-gray-800">Ask your documents anything</h2>
            <p className="text-sm text-gray-500 mt-1">
              Upload PDF sources on the left, then ask questions. Answers are strictly grounded with page-level citations.
            </p>
          </div>
        ) : (
          messages.map((msg, index) => <MessageItem key={index} message={msg} />)
        )}

        {loading && (
          <div className="flex items-center gap-3 text-gray-500 text-sm bg-white border border-gray-200 w-fit px-4 py-3 rounded-2xl shadow-sm">
            <Loader2 size={16} className="animate-spin text-indigo-600" />
            <span>Searching relevant pages & synthesizing answer...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <div className="p-4 bg-white border-t border-gray-200">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question about your selected sources..."
            className="flex-1 text-black bg-gray-50 border border-gray-300 focus:border-indigo-500 focus:bg-white rounded-xl px-4 py-3 text-sm outline-none transition"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="bg-indigo-600 hover:bg-indigo-700 text-white p-3 rounded-xl transition disabled:opacity-40"
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </main>
  );
};
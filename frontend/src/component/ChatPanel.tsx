import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '@/types';
import { MessageItem } from './MessageItem';
import { Send, Loader2, Sparkles, ArrowUpRight } from 'lucide-react';

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

  const suggestedQuestions = [
    'Summarize the main ideas',
    'What should I remember?',
    'Compare the key arguments',
  ];

  return (
    <main className="flex-1 flex flex-col min-w-0 h-full bg-slate-50/60 transition-colors dark:bg-slate-900">
      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto text-slate-500">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3 dark:bg-indigo-950/50 dark:text-indigo-300">
              <Sparkles size={24} />
            </div>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Ask your documents anything</h2>
            <p className="text-sm text-slate-500 mt-1 dark:text-slate-400">
              Upload PDF sources on the left, then ask questions. Answers are strictly grounded with page-level citations.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {suggestedQuestions.map((question) => (
                <button
                  key={question}
                  type="button"
                  onClick={() => { setInput(question); }}
                  className="group inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:text-indigo-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-indigo-700 dark:hover:text-indigo-300"
                >
                  {question}
                  <ArrowUpRight size={13} className="text-slate-400 transition group-hover:text-indigo-500" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, index) => <MessageItem key={index} message={msg} />)
        )}

        {loading && (
          <div className="flex items-center gap-3 text-slate-500 text-sm bg-white border border-slate-200 w-fit px-4 py-3 rounded-2xl shadow-sm dark:bg-slate-950 dark:border-slate-800 dark:text-slate-400">
            <Loader2 size={16} className="animate-spin text-indigo-600" />
            <span>Searching relevant pages & synthesizing answer...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <div className="p-4 bg-white border-t border-slate-200 dark:bg-slate-950 dark:border-slate-800">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question about your selected sources..."
            className="flex-1 text-slate-900 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl px-4 py-3 text-sm outline-none transition dark:bg-slate-900 dark:text-white dark:border-slate-700 dark:focus:bg-slate-800"
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
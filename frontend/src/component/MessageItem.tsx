import React from 'react';
import { ChatMessage } from '../types';
import { Bot, User, Bookmark } from 'lucide-react';

interface MessageItemProps {
  message: ChatMessage;
}

export const MessageItem: React.FC<MessageItemProps> = ({ message }) => {
  const isUser = message.sender === 'user';

  return (
    <div className={`flex gap-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 mt-1">
          <Bot size={16} />
        </div>
      )}

      <div
        className={`max-w-2xl rounded-2xl px-5 py-4 ${
          isUser
            ? 'bg-indigo-600 text-white rounded-br-none'
            : 'bg-white border border-gray-200 text-gray-800 rounded-bl-none shadow-sm'
        }`}
      >
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.message}</p>

        {/* Citations Badges */}
        {!isUser && message.citations && message.citations.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">
              Sources Cited:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {message.citations.map((cite, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs px-2.5 py-1 rounded-md border border-gray-200 transition cursor-default"
                >
                  <Bookmark size={11} className="text-indigo-500" />
                  <span className="truncate max-w-[150px]">{cite.filename}</span>
                  <span className="text-gray-400 font-semibold">p.{cite.page_number}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {isUser && (
        <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center shrink-0 mt-1">
          <User size={16} />
        </div>
      )}
    </div>
  );
};
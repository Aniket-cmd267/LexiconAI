import React from 'react';
import { ChatMessage } from '@/types';
import { Bot, User, Bookmark } from 'lucide-react';

interface MessageItemProps {
  message: ChatMessage;
}

// 1. Lightweight Inline Formatter (Handles **bold** and [Doc: ..., Page: ...])
const formatInlineText = (text: string): React.ReactNode[] => {
  // Regex splitting by: Bold (**text**) OR Citation ([Doc: filename, Page: X])
  const tokenRegex = /(\*\*[^*]+\*\*|\[Doc:\s*[^,]+,\s*Page:\s*\d+\])/g;
  const citationRegex = /^\[Doc:\s*([^,]+),\s*Page:\s*(\d+)\]$/;

  const parts = text.split(tokenRegex);

  return parts.map((part, index) => {
    if (!part) return null;

    // A. Handle Bold (**text**)
    if (part.startsWith('**') && part.endsWith('**')) {
      const boldContent = part.slice(2, -2);
      return (
        <strong key={index} className="font-semibold text-gray-900">
          {boldContent}
        </strong>
      );
    }

    // B. Handle Citation Badge ([Doc: filename, Page: X])
    const citeMatch = part.match(citationRegex);
    if (citeMatch) {
      const filename = citeMatch[1];
      const page = citeMatch[2];
      return (
        <span
          key={index}
          className="inline-flex items-center gap-1 mx-1 px-2 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-700 text-[11px] font-medium rounded-full cursor-pointer hover:bg-indigo-100 transition align-baseline shadow-2xs"
        >
          <Bookmark size={10} className="text-indigo-500" />
          <span className="max-w-[130px] truncate">{filename}</span>
          <span className="text-indigo-400 font-bold">p.{page}</span>
        </span>
      );
    }

    // C. Normal Plain Text
    return <span key={index}>{part}</span>;
  });
};

// 2. Lightweight Block Formatter (Handles Headings, Lists, Paragraphs)
const BookLikeContent: React.FC<{ content: string }> = ({ content }) => {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let currentListItems: React.ReactNode[] = [];

  const flushList = () => {
    if (currentListItems.length > 0) {
      elements.push(
        <ul key={`ul-${elements.length}`} className="space-y-1.5 my-2 pl-4 list-disc text-gray-700">
          {currentListItems}
        </ul>
      );
      currentListItems = [];
    }
  };

  lines.forEach((line, lineIdx) => {
    const trimmed = line.trim();

    if (!trimmed) {
      flushList();
      return;
    }

    // Bullet Points (* or -)
    if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
      const itemText = trimmed.slice(2);
      currentListItems.push(
        <li key={`li-${lineIdx}`} className="text-[14px] leading-relaxed pl-1 text-gray-700">
          {formatInlineText(itemText)}
        </li>
      );
      return;
    }

    // If we hit non-list line, close any open list
    flushList();

    // Headings (###, ##, #)
    if (trimmed.startsWith('### ')) {
      elements.push(
        <h3 key={`h3-${lineIdx}`} className="text-sm font-bold text-gray-900 mt-3 mb-1">
          {formatInlineText(trimmed.slice(4))}
        </h3>
      );
    } else if (trimmed.startsWith('## ')) {
      elements.push(
        <h2 key={`h2-${lineIdx}`} className="text-base font-bold text-gray-900 mt-4 mb-1.5">
          {formatInlineText(trimmed.slice(3))}
        </h2>
      );
    } else if (trimmed.startsWith('# ')) {
      elements.push(
        <h1 key={`h1-${lineIdx}`} className="text-lg font-bold text-gray-900 mt-4 mb-2">
          {formatInlineText(trimmed.slice(2))}
        </h1>
      );
    } else {
      // Regular Paragraph
      elements.push(
        <p key={`p-${lineIdx}`} className="text-[14px] leading-relaxed text-gray-700 mb-2.5">
          {formatInlineText(trimmed)}
        </p>
      );
    }
  });

  flushList();

  return <div className="space-y-1">{elements}</div>;
};

// 3. Main Message Component
export const MessageItem: React.FC<MessageItemProps> = ({ message }) => {
  const isUser = message.sender === 'user';

  return (
    <div className={`flex gap-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 mt-1 shadow-sm">
          <Bot size={16} />
        </div>
      )}

      <div
        className={`max-w-3xl rounded-2xl px-6 py-5 ${
          isUser
            ? 'bg-indigo-600 text-white rounded-br-none shadow-sm'
            : 'bg-white border border-gray-200/80 text-gray-800 rounded-bl-none shadow-xs'
        }`}
      >
        {isUser ? (
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.message}</p>
        ) : (
          <BookLikeContent content={message.message} />
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
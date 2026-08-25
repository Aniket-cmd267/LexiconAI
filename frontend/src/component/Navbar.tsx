import React from 'react';
import { BookOpen, Sparkles } from 'lucide-react';

interface NavbarProps {
  notebookName: string;
}

export const Navbar: React.FC<NavbarProps> = ({ notebookName }) => {
  return (
    <header className="h-14 border-b border-gray-200 bg-white px-6 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="bg-indigo-600 p-2 rounded-lg text-white">
          <BookOpen size={18} />
        </div>
        <div>
          <h1 className="font-semibold text-gray-800 text-sm md:text-base">Lexicon AI {notebookName}</h1>
          <p className="text-xs text-gray-500">Grounded Research Assistant</p>
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs font-medium text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-full border border-indigo-100">
        <Sparkles size={14} />
      </div>
    </header>
  );
};
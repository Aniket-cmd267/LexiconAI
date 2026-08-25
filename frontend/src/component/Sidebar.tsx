import React, { useRef, useState } from 'react';
import { FileText, UploadCloud, CheckSquare, Square, Loader2 } from 'lucide-react';

interface DocumentItem {
  id: string;
  filename: string;
  total_pages: number;
}

interface SidebarProps {
  documents: DocumentItem[];
  selectedDocIds: string[];
  onToggleDoc: (id: string) => void;
  onUpload: (file: File) => Promise<void>;
}

export const Sidebar: React.FC<SidebarProps> = ({
  documents,
  selectedDocIds,
  onToggleDoc,
  onUpload,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      await onUpload(file);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <aside className="w-80 border-r border-gray-200 bg-gray-50/50 flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Upload Button */}
      <div className="p-4 border-b border-gray-200">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".pdf"
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-full flex items-center justify-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-2.5 px-4 rounded-xl shadow-sm transition disabled:opacity-50 text-sm"
        >
          {uploading ? (
            <>
              <Loader2 size={16} className="animate-spin text-indigo-600" />
              <span>Indexing PDF...</span>
            </>
          ) : (
            <>
              <UploadCloud size={16} className="text-indigo-600" />
              <span>Add PDF Source</span>
            </>
          )}
        </button>
      </div>

      {/* Sources List */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Sources ({documents.length})
          </span>
          <span className="text-[11px] text-gray-400">
            {selectedDocIds.length === 0 ? 'Searching All' : `${selectedDocIds.length} Selected`}
          </span>
        </div>

        {documents.length === 0 ? (
          <div className="text-center py-10 px-4 text-gray-400">
            <FileText size={32} className="mx-auto mb-2 opacity-40" />
            <p className="text-sm">No documents added yet.</p>
            <p className="text-xs mt-1 text-gray-400">Upload a PDF to start asking questions.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {documents.map((doc) => {
              const isSelected = selectedDocIds.includes(doc.id);
              return (
                <div
                  key={doc.id}
                  onClick={() => onToggleDoc(doc.id)}
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                    isSelected
                      ? 'bg-indigo-50/60 border-indigo-200'
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <button className="mt-0.5 text-indigo-600">
                    {isSelected ? <CheckSquare size={16} /> : <Square size={16} className="text-gray-400" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{doc.filename}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{doc.total_pages} pages</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
};
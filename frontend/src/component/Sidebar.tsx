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
  onSelectAll: () => void;
  onClearSelection: () => void;
  onUpload: (file: File) => Promise<void>;
}

export const Sidebar: React.FC<SidebarProps> = ({
  documents,
  selectedDocIds,
  onToggleDoc,
  onSelectAll,
  onClearSelection,
  onUpload,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const uploadFile = async (file: File) => {
    if (file.type !== 'application/pdf') return;
    try {
      setUploading(true);
      await onUpload(file);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    await uploadFile(file);
  };

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    const file = event.dataTransfer.files[0];
    if (file) await uploadFile(file);
  };

  return (
    <aside className="w-80 shrink-0 border-r border-slate-200 bg-slate-50/80 flex flex-col h-full transition-colors dark:border-slate-800 dark:bg-slate-950/80">
      {/* Upload Button */}
      <div
        onDragOver={(event) => { event.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        className={`p-4 border-b border-slate-200 dark:border-slate-800 transition-colors ${dragActive ? 'bg-indigo-50 dark:bg-indigo-950/50' : ''}`}
      >
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
          className="w-full flex items-center justify-center gap-2 bg-white border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/60 text-slate-700 font-medium py-2.5 px-4 rounded-xl shadow-sm transition disabled:opacity-50 text-sm dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200 dark:hover:border-indigo-700 dark:hover:bg-indigo-950/40"
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
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider dark:text-slate-400">Sources ({documents.length})</span>
          <div className="flex items-center gap-2 text-[11px]">
            <button type="button" onClick={onSelectAll} disabled={!documents.length} className="text-indigo-600 hover:text-indigo-800 disabled:opacity-40 dark:text-indigo-300">All</button>
            <span className="text-slate-300 dark:text-slate-700">/</span>
            <button type="button" onClick={onClearSelection} disabled={!selectedDocIds.length} className="text-slate-500 hover:text-slate-800 disabled:opacity-40 dark:text-slate-400 dark:hover:text-white">Clear</button>
          </div>
        </div>
        <p className="mb-3 text-[11px] text-slate-400 dark:text-slate-500">
          {selectedDocIds.length === 0 ? 'Searching across all sources' : `${selectedDocIds.length} source${selectedDocIds.length === 1 ? '' : 's'} selected`}
        </p>

        {documents.length === 0 ? (
          <div className="text-center py-10 px-4 text-slate-400">
            <FileText size={32} className="mx-auto mb-2 opacity-40" />
            <p className="text-sm">No documents added yet.</p>
            <p className="text-xs mt-1 text-slate-400">Upload a PDF to start asking questions.</p>
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
                      ? 'bg-indigo-50/60 border-indigo-200 dark:bg-indigo-950/40 dark:border-indigo-800'
                      : 'bg-white border-slate-200 hover:border-indigo-200 dark:bg-slate-900 dark:border-slate-800 dark:hover:border-slate-600'
                  }`}
                >
                  <button className="mt-0.5 text-indigo-600">
                    {isSelected ? <CheckSquare size={16} /> : <Square size={16} className="text-gray-400" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate dark:text-slate-100">{doc.filename}</p>
                    <p className="text-xs text-slate-500 mt-0.5 dark:text-slate-400">{doc.total_pages} pages</p>
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
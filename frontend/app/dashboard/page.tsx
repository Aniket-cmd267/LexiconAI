'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getNotebooks, createNotebook } from '@/lib/api';
import { Notebook } from '@/types';
import { BookOpen, Plus, ArrowRight, Sparkles, LogOut } from 'lucide-react';

export default function DashboardPage() {
  const router = useRouter();
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newNotebookName, setNewNotebookName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    console.log(token);
    if (!token) {
      router.push('/auth');
      return;
    }

    async function loadNotebooks() {
      try {
        const data = await getNotebooks();
        console.log(data)
        setNotebooks(data);
      } catch (err) {
        console.error(err);
        // localStorage.removeItem('token');
        // router.push('/auth');
      } finally {
        setLoading(false);
      }
    }
    loadNotebooks();
  }, [router]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNotebookName.trim()) return;

    try {
      const created = await createNotebook(newNotebookName.trim());
      setNotebooks([created, ...notebooks]);
      setNewNotebookName('');
      setIsCreating(false);
      router.push(`/notebook/${created.id}`);
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/auth');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top Bar */}
      <header className="h-16 border-b border-gray-200 bg-white px-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-xl text-white">
            <BookOpen size={20} />
          </div>
          <span className="font-bold text-gray-800 text-lg">LexiconAI</span>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition"
        >
          <LogOut size={16} />
          <span>Sign Out</span>
        </button>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Your Notebooks</h1>
            <p className="text-sm text-gray-500 mt-1">Select a workspace or create a new collection</p>
          </div>
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-medium text-sm transition shadow-sm"
          >
            <Plus size={18} />
            <span>New Notebook</span>
          </button>
        </div>

        {/* Modal for New Notebook */}
        {isCreating && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-100">
              <h3 className="text-lg font-bold text-gray-800 mb-2">Create New Notebook</h3>
              <p className="text-xs text-gray-500 mb-4">A dedicated vector collection will be provisioned in Qdrant.</p>
              <form onSubmit={handleCreate}>
                <input
                  type="text"
                  autoFocus
                  required
                  placeholder="e.g., Biology 101, Q3 Financials..."
                  value={newNotebookName}
                  onChange={(e) => setNewNotebookName(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm outline-none focus:border-indigo-600 mb-4"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCreating(false)}
                    className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition"
                  >
                    Create Workspace
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Notebooks Grid */}
        {loading ? (
          <p className="text-gray-400 text-sm">Loading your workspaces...</p>
        ) : notebooks.length === 0 ? (
          <div className="text-center py-16 bg-white border border-dashed border-gray-300 rounded-2xl">
            <BookOpen size={40} className="mx-auto text-gray-300 mb-3" />
            <h3 className="font-semibold text-gray-700">No notebooks yet</h3>
            <p className="text-xs text-gray-400 mt-1 mb-4">Create your first notebook to start uploading documents.</p>
            <button
              onClick={() => setIsCreating(true)}
              className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-medium"
            >
              + Create Notebook
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {notebooks.map((nb) => (
              <div
                key={nb.id}
                onClick={() => router.push(`/notebook/${nb.id}`)}
                className="bg-white border border-gray-200 hover:border-indigo-300 hover:shadow-md p-6 rounded-2xl cursor-pointer transition flex flex-col justify-between h-44 group"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                      <Sparkles size={18} />
                    </div>
                    <span className="text-[11px] text-gray-400">
                      {new Date(nb.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <h3 className="font-bold text-gray-800 text-base group-hover:text-indigo-600 transition truncate">
                    {nb.name}
                  </h3>
                </div>
                <div className="flex items-center justify-between text-xs text-indigo-600 font-medium pt-3 border-t border-gray-100">
                  <span>Open Workspace</span>
                  <ArrowRight size={14} className="group-hover:translate-x-1 transition" />
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
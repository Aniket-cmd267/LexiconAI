import React, { useEffect, useRef, useState } from 'react';
import { BookOpen, ChevronDown, LogOut, Moon, Sparkles, Sun } from 'lucide-react';

interface NavbarProps {
  notebookName: string;
  darkMode: boolean;
  onThemeToggle: () => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ notebookName, darkMode, onThemeToggle, onLogout }) => {
  const [profileOpen, setProfileOpen] = useState(false);
  const [userEmail] = useState(() => {
    if (typeof window === 'undefined') return '';

    const storedUser = localStorage.getItem('user');
    if (!storedUser) return '';

    try {
      return JSON.parse(storedUser).email || 'Researcher';
    } catch {
      return 'Researcher';
    }
  });
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const closeProfile = (event: MouseEvent) => {
      if (!profileRef.current?.contains(event.target as Node)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', closeProfile);
    return () => document.removeEventListener('mousedown', closeProfile);
  }, []);

  const initials = userEmail ? userEmail.slice(0, 1).toUpperCase() : 'R';

  return (
    <header className="h-16 shrink-0 border-b border-slate-200 bg-white px-4 sm:px-6 flex items-center justify-between transition-colors dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-center gap-3">
        <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-sm shadow-indigo-600/20">
          <BookOpen size={18} />
        </div>
        <div>
          <h1 className="font-semibold text-slate-900 text-sm md:text-base dark:text-white">Lexicon AI <span className="font-normal text-slate-500 dark:text-slate-400">{notebookName}</span></h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">Grounded research assistant</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-indigo-600 bg-indigo-50 px-3 py-2 rounded-full border border-indigo-100 dark:border-indigo-900/70 dark:bg-indigo-950/50 dark:text-indigo-300">
          <Sparkles size={14} />
          <span>Focused mode</span>
        </div>
        <button
          type="button"
          onClick={onThemeToggle}
          title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          className="rounded-xl p-2.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
        >
          {darkMode ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <div className="relative" ref={profileRef}>
          <button
            type="button"
            onClick={() => setProfileOpen((open) => !open)}
            aria-expanded={profileOpen}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5 hover:border-indigo-200 hover:bg-indigo-50 transition dark:border-slate-700 dark:bg-slate-900 dark:hover:border-indigo-700 dark:hover:bg-slate-800"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-xs font-semibold text-white">{initials}</span>
            <span className="hidden max-w-32 truncate text-left text-xs font-medium text-slate-700 sm:block dark:text-slate-200">{userEmail || 'Profile'}</span>
            <ChevronDown size={14} className={`text-slate-400 transition ${profileOpen ? 'rotate-180' : ''}`} />
          </button>
          {profileOpen && (
            <div className="absolute right-0 top-12 z-20 w-60 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900">
              <div className="flex items-center gap-3 border-b border-slate-100 px-3 py-3 dark:border-slate-800">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-sm font-semibold text-white">{initials}</span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">Your profile</p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">{userEmail || 'Signed in user'}</p>
                </div>
              </div>
              <button type="button" onClick={onLogout} className="mt-2 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-rose-600 hover:bg-rose-50 transition dark:text-rose-300 dark:hover:bg-rose-950/40">
                <LogOut size={16} />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

import React, { useState, useEffect } from 'react';
import TranscriberUI from './components/TranscriberUI';
import AuthUI from './components/AuthUI';
import { supabase, signOut } from './services/supabaseService';
import { Session } from '@supabase/supabase-js';

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await signOut();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Navigation / Header */}
      <header className="bg-white border-b border-slate-200 py-4 sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto px-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Amharic Voice</h1>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-none">Powered by Gemini AI</p>
            </div>
          </div>
          <nav className="flex items-center gap-6">
            {session && (
              <div className="flex items-center gap-4">
                <span className="hidden md:inline text-xs font-semibold text-slate-400">{session.user.email}</span>
                <button 
                  onClick={handleLogout}
                  className="px-4 py-2 bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-600 rounded-lg text-sm font-bold transition-all"
                >
                  Logout
                </button>
              </div>
            )}
            {!session && <a href="https://ai.google.dev" target="_blank" className="hidden md:block text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors">Documentation</a>}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-12">
        {session ? (
          <>
            <div className="text-center mb-12 animate-in fade-in slide-in-from-top-4 duration-700">
              <h2 className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-4 tracking-tight">
                Record, Transcribe, <span className="text-blue-600">Empower.</span>
              </h2>
              <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                Welcome back! Use the professional tools below to transcribe your Amharic audio.
              </p>
            </div>
            <TranscriberUI />
          </>
        ) : (
          <div className="animate-in zoom-in-95 duration-500">
             <div className="text-center mb-4">
                <h2 className="text-4xl font-extrabold text-slate-900 mb-2 tracking-tight">Secure Access</h2>
                <p className="text-slate-500">Sign in to start your transcription project</p>
             </div>
             <AuthUI />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="py-8 bg-white border-t border-slate-200 mt-auto">
        <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-slate-500 text-sm">
            &copy; {new Date().getFullYear()} Amharic Audio Transcriber. All rights reserved.
          </p>
          <div className="flex gap-4">
            <span className="text-slate-300">|</span>
            <span className="text-xs font-mono text-slate-400">v1.1.0-Auth</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;

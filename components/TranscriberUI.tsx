
import React, { useState, useRef } from 'react';
import { TranscriptionStatus, TranscriptionResult } from '../types';
import { geminiService } from '../services/geminiService';
import { saveTranscription } from '../services/supabaseService';
import Visualizer from './Visualizer';

const TranscriberUI: React.FC = () => {
  const [status, setStatus] = useState<TranscriptionStatus>(TranscriptionStatus.IDLE);
  const [result, setResult] = useState<TranscriptionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const startRecording = async () => {
    setError(null);
    setResult(null);
    setPendingBlob(null);
    setSaveSuccess(false);
    audioChunksRef.current = [];
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setStream(mediaStream);
      
      const recorder = new MediaRecorder(mediaStream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setPendingBlob(audioBlob);
        setStatus(TranscriptionStatus.RECORDED);
      };

      recorder.start();
      setStatus(TranscriptionStatus.RECORDING);
    } catch (err) {
      console.error(err);
      setError("Microphone access denied or not available.");
      setStatus(TranscriptionStatus.IDLE);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && status === TranscriptionStatus.RECORDING) {
      mediaRecorderRef.current.stop();
      stream?.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const handleTranscribeNow = async () => {
    if (!pendingBlob) return;
    
    setStatus(TranscriptionStatus.TRANSCRIBING);
    try {
      const base64 = await blobToBase64(pendingBlob);
      const text = await geminiService.transcribeAmharic(base64, pendingBlob.type);
      setResult({
        text,
        timestamp: new Date(),
        audioBlob: pendingBlob
      });
      setStatus(TranscriptionStatus.COMPLETED);
    } catch (err: any) {
      setError(err.message || "An error occurred during transcription.");
      setStatus(TranscriptionStatus.ERROR);
    }
  };

  const handleTranslateNow = async () => {
    if (!result) return;
    
    setStatus(TranscriptionStatus.TRANSLATING);
    try {
      const translatedText = await geminiService.translateToEnglish(result.text);
      setResult(prev => prev ? { ...prev, translatedText } : null);
      setStatus(TranscriptionStatus.COMPLETED);
    } catch (err: any) {
      setError(err.message || "An error occurred during translation.");
      setStatus(TranscriptionStatus.COMPLETED); 
    }
  };

  const handleSaveToCloud = async () => {
    if (!result) return;
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await saveTranscription(result.text, result.translatedText);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setError("Failed to save to Supabase: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTextChange = (field: 'text' | 'translatedText', value: string) => {
    setResult(prev => prev ? { ...prev, [field]: value } : null);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('audio/')) {
      setError("Please select a valid audio file.");
      return;
    }

    setError(null);
    setPendingBlob(file);
    setStatus(TranscriptionStatus.RECORDED);
  };

  const downloadTranscription = () => {
    if (!result) return;
    let content = `Original Amharic:\n${result.text}`;
    if (result.translatedText) {
      content += `\n\nEnglish Translation:\n${result.translatedText}`;
    }
    
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `amharic-transcription-${new Date().getTime()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadAudio = () => {
    const blob = result?.audioBlob || pendingBlob;
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `amharic-audio-${new Date().getTime()}.${blob.type.split('/')[1] || 'webm'}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    setStatus(TranscriptionStatus.IDLE);
    setResult(null);
    setPendingBlob(null);
    setError(null);
    setSaveSuccess(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="max-w-3xl mx-auto p-6 bg-white rounded-2xl shadow-xl border border-slate-200">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Amharic Transcriber</h2>
          <p className="text-slate-500 text-sm">የአማርኛ ድምጽ ወደ ጽሑፍ መቀየሪያ</p>
        </div>
        {(status !== TranscriptionStatus.IDLE) && (
          <button 
            onClick={reset}
            className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
          >
            Clear All
          </button>
        )}
      </div>

      <div className="mb-8">
        {status === TranscriptionStatus.RECORDING ? (
          <Visualizer stream={stream} isRecording={true} />
        ) : (pendingBlob || result?.audioBlob) ? (
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 3v9.113A4.487 4.487 0 004 12c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7.887l8-1.6V9.25a4.5 4.5 0 101 8.75V3z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-bold text-slate-700">Audio Ready</p>
                <p className="text-xs text-slate-500">
                  {((pendingBlob?.size || result?.audioBlob?.size || 0) / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
            <audio controls src={URL.createObjectURL(pendingBlob || result?.audioBlob!)} className="h-8 max-w-[200px]" />
          </div>
        ) : (
          <div className="h-[100px] bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center text-slate-400 mb-4">
            Record or upload audio to visualize
          </div>
        )}
        
        <div className="flex flex-col items-center gap-6">
          <div className="flex justify-center items-center gap-4 flex-wrap">
            {status === TranscriptionStatus.IDLE && (
              <>
                <button
                  onClick={startRecording}
                  className="flex items-center gap-2 px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-bold transition-all shadow-lg hover:shadow-blue-200 transform hover:-translate-y-0.5"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                  Record Now
                </button>
                <div className="relative">
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={handleFileChange}
                    className="hidden"
                    id="audio-upload"
                    ref={fileInputRef}
                  />
                  <label
                    htmlFor="audio-upload"
                    className="flex items-center gap-2 px-8 py-4 bg-white border-2 border-slate-200 hover:border-blue-400 text-slate-700 rounded-full font-bold transition-all cursor-pointer transform hover:-translate-y-0.5 shadow-sm"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    Upload File
                  </label>
                </div>
              </>
            )}

            {status === TranscriptionStatus.RECORDING && (
              <button
                onClick={stopRecording}
                className="flex items-center gap-2 px-8 py-4 bg-red-600 hover:bg-red-700 text-white rounded-full font-bold transition-all shadow-lg animate-pulse"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H10a1 1 0 01-1-1v-4z" />
                </svg>
                Stop Recording
              </button>
            )}

            {status === TranscriptionStatus.RECORDED && (
              <button
                onClick={handleTranscribeNow}
                className="flex items-center gap-3 px-12 py-5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-full font-extrabold text-lg transition-all shadow-xl hover:shadow-blue-200 transform hover:scale-105"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Transcribe Now
              </button>
            )}

            {(status === TranscriptionStatus.TRANSCRIBING || status === TranscriptionStatus.TRANSLATING) && (
              <div className="flex flex-col items-center gap-4 py-4">
                <div className="relative">
                  <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-100 border-t-blue-600"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5a18.022 18.022 0 01-3.827-2.179M1 18a12.062 12.062 0 011.028-5.418m5.864 5.863a11.963 11.963 0 002.263-6.941V11m0 0l5 5m-5-5L14 3" />
                    </svg>
                  </div>
                </div>
                <span className="font-bold text-blue-700 text-lg">
                  {status === TranscriptionStatus.TRANSCRIBING ? "Gemini is transcribing..." : "Gemini is translating..."}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span className="font-semibold">{error}</span>
        </div>
      )}

      {result && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Amharic Text - EDITABLE */}
            <div className="relative group h-full">
              <div className="p-6 bg-slate-50 border border-slate-200 rounded-3xl min-h-[200px] shadow-inner relative h-full flex flex-col">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                  Amharic Transcription (Editable)
                </h3>
                <textarea
                  value={result.text}
                  onChange={(e) => handleTextChange('text', e.target.value)}
                  className="flex-1 w-full bg-transparent text-slate-800 leading-relaxed text-xl font-medium whitespace-pre-wrap font-serif focus:outline-none resize-none"
                  rows={6}
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(result.text);
                    alert("Amharic copied!");
                  }}
                  className="absolute top-4 right-4 p-2 bg-white/80 border border-slate-200 rounded-lg text-slate-500 hover:text-blue-600 transition-all shadow-sm"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Translation Text - EDITABLE */}
            <div className="relative group h-full">
              <div className={`p-6 border rounded-3xl min-h-[200px] shadow-inner relative h-full flex flex-col ${result.translatedText ? 'bg-indigo-50 border-indigo-100' : 'bg-slate-50 border-dashed border-slate-200'}`}>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${result.translatedText ? 'bg-indigo-500' : 'bg-slate-300'}`}></span>
                  English Translation {result.translatedText && "(Editable)"}
                </h3>
                
                {result.translatedText ? (
                  <>
                    <textarea
                      value={result.translatedText}
                      onChange={(e) => handleTextChange('translatedText', e.target.value)}
                      className="flex-1 w-full bg-transparent text-indigo-900 leading-relaxed text-lg font-medium whitespace-pre-wrap focus:outline-none resize-none"
                      rows={6}
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(result.translatedText!);
                        alert("English copied!");
                      }}
                      className="absolute top-4 right-4 p-2 bg-white/80 border border-indigo-200 rounded-lg text-indigo-500 hover:text-indigo-700 transition-all shadow-sm"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                      </svg>
                    </button>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                    <button
                      onClick={handleTranslateNow}
                      disabled={status === TranscriptionStatus.TRANSLATING}
                      className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all shadow-md transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:transform-none"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5a18.022 18.022 0 01-3.827-2.179M1 18a12.062 12.062 0 011.028-5.418m5.864 5.863a11.963 11.963 0 002.263-6.941V11m0 0l5 5m-5-5L14 3" />
                      </svg>
                      Translate to English
                    </button>
                    <p className="text-xs text-slate-500 mt-4 italic">Convert Amharic text to English instantly</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* CLOUD SAVE BUTTON */}
          <div className="flex flex-col items-center gap-4">
             <button
              onClick={handleSaveToCloud}
              disabled={isSaving || status === TranscriptionStatus.TRANSLATING}
              className={`w-full max-w-sm flex items-center justify-center gap-3 px-8 py-5 rounded-2xl font-bold transition-all shadow-xl transform active:scale-95 ${saveSuccess ? 'bg-emerald-600 text-white' : 'bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-800 hover:to-indigo-800 text-white'}`}
            >
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/20 border-t-white"></div>
                  Saving to Supabase...
                </>
              ) : saveSuccess ? (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Saved Successfully!
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                  </svg>
                  Save to Supabase Database
                </>
              )}
            </button>
            <p className="text-xs text-slate-400">Your changes will be synced with your Supabase table</p>
          </div>
          
          <div className="bg-gradient-to-br from-slate-50 to-slate-100 p-8 rounded-3xl border border-slate-200">
            <h4 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
              Local Download Options
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={downloadTranscription}
                className="flex items-center justify-center gap-3 px-8 py-5 bg-slate-900 hover:bg-black text-white rounded-2xl font-bold transition-all shadow-lg group"
              >
                <div className="bg-slate-700 p-2 rounded-lg group-hover:bg-slate-600">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                Download Text (.txt)
              </button>
              
              <button
                onClick={downloadAudio}
                className="flex items-center justify-center gap-3 px-8 py-5 bg-white hover:bg-slate-50 text-slate-800 border-2 border-slate-200 rounded-2xl font-bold transition-all shadow-sm group"
              >
                <div className="bg-blue-50 p-2 rounded-lg group-hover:bg-blue-100 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  </svg>
                </div>
                Download Original Audio
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TranscriberUI;

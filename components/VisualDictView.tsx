import React, { useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { generateVisualVocab, generateSpeech, checkPronunciation } from '../services/geminiService';
import { VocabCard } from '../types';
import { decode, decodeAudioData, playAudioBuffer, blobToBase64 } from '../services/audioUtils';

export const VisualDictView: React.FC = () => {
  const [word, setWord] = useState('');
  const [card, setCard] = useState<VocabCard | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isTTSLoading, setIsTTSLoading] = useState(false);

  // Pronunciation State
  const [isRecording, setIsRecording] = useState(false);
  const [pronunciationResult, setPronunciationResult] = useState<{score: number, feedback: string} | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!word.trim()) return;
    
    setIsLoading(true);
    setCard(null);
    setPronunciationResult(null);
    
    try {
      const result = await generateVisualVocab(word);
      setCard(result);
    } catch (error) {
      console.error(error);
      alert("Failed to generate visual card.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSpeak = async () => {
    if (!card) return;
    setIsTTSLoading(true);
    try {
      const base64 = await generateSpeech(card.word);
      if (base64) {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});
        const audioBuffer = await decodeAudioData(decode(base64), audioCtx, 24000, 1);
        playAudioBuffer(audioBuffer);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsTTSLoading(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        setIsAnalyzing(true);
        try {
          const blob = new Blob(chunksRef.current, { type: 'audio/mp3' });
          const base64 = await blobToBase64(blob);
          if (card) {
             const result = await checkPronunciation(card.word, base64);
             setPronunciationResult(result);
          }
        } catch (e) {
          console.error("Analysis error", e);
          alert("Erreur lors de l'analyse.");
        } finally {
          setIsAnalyzing(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setPronunciationResult(null);
    } catch (e) {
      console.error("Mic error", e);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
      setIsRecording(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto h-full flex flex-col overflow-y-auto">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">Dictionnaire Visuel & Prononciation</h2>
        <p className="text-gray-600">Générez une carte, écoutez la prononciation et testez-vous !</p>
      </div>

      <form onSubmit={handleSubmit} className="relative mb-8 z-10">
        <input
          type="text"
          value={word}
          onChange={(e) => setWord(e.target.value)}
          placeholder="Ex: Hedgehog, Skyscraper, Serendipity..."
          className="w-full border-2 border-gray-200 rounded-full px-6 py-4 pr-32 text-lg focus:outline-none focus:border-indigo-500 shadow-sm transition-all"
        />
        <button
          type="submit"
          disabled={isLoading || !word}
          className="absolute right-2 top-2 bottom-2 bg-indigo-600 text-white px-6 rounded-full font-medium hover:bg-indigo-700 transition-all disabled:opacity-70 disabled:scale-95"
        >
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : 'Générer'}
        </button>
      </form>

      {card && !isLoading && (
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100 mb-10 animate-fade-in">
          {/* Image Section */}
          <div className="relative h-64 bg-gray-50 flex justify-center items-center border-b border-gray-100">
             {card.imageUrl ? (
                <img 
                  src={card.imageUrl} 
                  alt={card.word} 
                  className="h-full object-contain p-4 hover:scale-105 transition-transform duration-500"
                />
             ) : (
               <span className="text-gray-400">No image available</span>
             )}
          </div>
          
          <div className="p-6 md:p-8 space-y-8">
            {/* Header & Audio Controls */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-6">
              <div>
                <h3 className="text-4xl font-bold text-gray-900 capitalize mb-1">{card.word}</h3>
                <span className="text-indigo-500 text-sm font-semibold uppercase tracking-wider">English Vocabulary</span>
              </div>
              
              <div className="flex items-center gap-3">
                {/* TTS Button */}
                <button 
                  onClick={handleSpeak}
                  disabled={isTTSLoading}
                  className="flex items-center justify-center w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full hover:bg-indigo-200 transition-colors"
                  title="Écouter la prononciation"
                >
                  {isTTSLoading ? (
                    <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <span className="text-xl">🔊</span>
                  )}
                </button>

                {/* Record Button */}
                <button 
                  onClick={isRecording ? stopRecording : startRecording}
                  className={`flex items-center justify-center w-12 h-12 rounded-full transition-all shadow-md
                    ${isRecording ? 'bg-red-500 text-white scale-110 ring-4 ring-red-200' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                  title="Tester ma prononciation"
                >
                  {isRecording ? (
                    <div className="w-4 h-4 bg-white rounded-sm animate-pulse"></div>
                  ) : (
                    <span className="text-xl">🎤</span>
                  )}
                </button>
              </div>
            </div>

            {/* Definitions & Content - Structured Layout */}
            <div className="grid md:grid-cols-2 gap-8">
              {/* Left: Definition */}
              <div>
                <h4 className="text-xs font-bold tracking-wider text-gray-400 uppercase mb-3">Définition & Traduction</h4>
                <div className="prose prose-indigo text-gray-700 bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <p className="whitespace-pre-line leading-relaxed">{card.definition}</p>
                </div>
              </div>

              {/* Right: Example */}
              <div>
                 <h4 className="text-xs font-bold tracking-wider text-gray-400 uppercase mb-3">Contexte</h4>
                 <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 h-full">
                    <span className="text-indigo-400 text-xs font-bold block mb-2">EXEMPLE</span>
                    <p className="text-indigo-900 italic text-lg leading-relaxed">"{card.example}"</p>
                 </div>
              </div>
            </div>

            {/* Pronunciation Feedback Section */}
            {(isAnalyzing || pronunciationResult) && (
              <div className="mt-6 animate-fade-in">
                 <h4 className="text-xs font-bold tracking-wider text-gray-400 uppercase mb-3">Analyse Vocale</h4>
                 
                 {isAnalyzing ? (
                   <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-75"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-150"></div>
                      </div>
                      <span className="text-gray-500 text-sm">L'IA analyse votre accent...</span>
                   </div>
                 ) : pronunciationResult ? (
                   <div className={`p-5 rounded-xl border flex flex-col md:flex-row gap-4 items-start
                     ${pronunciationResult.score >= 8 ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'}`}>
                      
                      <div className={`flex-shrink-0 w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold border-4
                        ${pronunciationResult.score >= 8 ? 'border-green-200 text-green-600 bg-white' : 'border-orange-200 text-orange-600 bg-white'}`}>
                        {pronunciationResult.score}/10
                      </div>

                      <div className="flex-1">
                        <h5 className={`font-bold mb-1 ${pronunciationResult.score >= 8 ? 'text-green-800' : 'text-orange-800'}`}>
                          {pronunciationResult.score >= 8 ? 'Excellent !' : 'Continuez vos efforts !'}
                        </h5>
                        <div className="text-gray-700 text-sm">
                           <ReactMarkdown>{pronunciationResult.feedback}</ReactMarkdown>
                        </div>
                      </div>
                   </div>
                 ) : null}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
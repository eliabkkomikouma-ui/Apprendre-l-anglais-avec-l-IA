import React, { useState, useEffect, useRef } from 'react';
import { Chat, Content } from "@google/genai";
import { Message, Attachment } from '../types';
import { createChatSession, generateSpeech } from '../services/geminiService';
import { decode, decodeAudioData, playAudioBuffer, blobToBase64 } from '../services/audioUtils';

export const ChatView: React.FC = () => {
  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Attachment State
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  // --- Initialization & Persistence ---

  useEffect(() => {
    // Load history from LocalStorage
    const savedHistory = localStorage.getItem('chat_history');
    let initialMessages: Message[] = [];
    let chatHistory: Content[] = [];

    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory);
        // Reconstruct valid URLs from Base64 data because Blob URLs expire on refresh
        initialMessages = parsed.map((m: Message) => {
             if (m.attachment && m.attachment.data && m.attachment.mimeType) {
                 return {
                     ...m,
                     attachment: {
                         ...m.attachment,
                         // Re-create data URI for display
                         url: `data:${m.attachment.mimeType};base64,${m.attachment.data}`
                     }
                 };
             }
             return m;
        });

        // Construct Gemini API History
        chatHistory = initialMessages.filter(m => m.id !== 'init').map(m => {
             const parts: any[] = [];
             if (m.text) parts.push({ text: m.text });
             
             // Re-attach images to history if data exists
             if (m.attachment && m.attachment.data && m.attachment.type === 'image') {
                 parts.push({
                     inlineData: {
                         data: m.attachment.data,
                         mimeType: m.attachment.mimeType || 'image/jpeg'
                     }
                 });
             }
             
             // Note: We skip audio attachments in history for now to save tokens, 
             // unless it's critical. Text context usually suffices for conversation.
             
             return {
                 role: m.role,
                 parts: parts
             };
        });

      } catch (e) {
        console.error("Failed to parse chat history", e);
      }
    }

    if (initialMessages.length === 0) {
       initialMessages = [
        { id: 'init', role: 'model', text: "Hello! I'm LinguaBot. You can send me text, photos, or voice messages to practice! How are you?" }
      ];
    }

    setMessages(initialMessages);

    // Initialize chat session with restored history
    const newChat = createChatSession(chatHistory);
    setChat(newChat);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, attachment, isRecording]); 

  // Save messages to localStorage
  useEffect(() => {
      if (messages.length > 0) {
          // Filter out ephemeral state like isLoadingAudio before saving
          const toSave = messages.map(({ isLoadingAudio, ...rest }) => rest);
          localStorage.setItem('chat_history', JSON.stringify(toSave));
      }
  }, [messages]);

  // --- File Handling ---

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const base64 = await blobToBase64(file);
      const url = URL.createObjectURL(file);
      
      setAttachment({
        type: 'image',
        url: url,
        data: base64,
        mimeType: file.type
      });
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const clearAttachment = () => {
    setAttachment(null);
  };

  // --- Audio Recording Handling ---

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/mp3' }); 
        const base64 = await blobToBase64(blob);
        const url = URL.createObjectURL(blob);
        
        handleSend(undefined, {
            type: 'audio',
            url: url,
            data: base64,
            mimeType: 'audio/mp3' 
        });
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      timerRef.current = window.setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error("Error accessing microphone", err);
      alert("Could not access microphone.");
    }
  };

  const stopRecording = (shouldSend: boolean = true) => {
    if (mediaRecorderRef.current && isRecording) {
      if (shouldSend) {
        mediaRecorderRef.current.stop();
      } else {
        mediaRecorderRef.current.stop();
      }
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
    setIsRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // --- Sending Message ---

  const handleSend = async (overrideText?: string, overrideAttachment?: Attachment) => {
    const textToSend = overrideText !== undefined ? overrideText : input;
    const attachmentToSend = overrideAttachment || attachment;

    if ((!textToSend.trim() && !attachmentToSend) || !chat) return;

    // Clear UI immediately
    setInput('');
    setAttachment(null);
    
    const userMsg: Message = { 
      id: Date.now().toString(), 
      role: 'user', 
      text: textToSend,
      attachment: attachmentToSend || undefined
    };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      // Construct parts for Gemini
      const parts: any[] = [];
      
      if (textToSend.trim()) {
        parts.push({ text: textToSend });
      }

      if (attachmentToSend && attachmentToSend.data) {
        parts.push({
            inlineData: {
                data: attachmentToSend.data,
                mimeType: attachmentToSend.mimeType || 'image/jpeg'
            }
        });
      }

      const result = await chat.sendMessage({ message: parts as any });
      
      const responseText = result.text || "I understood, but I don't have a text response.";
      
      const aiMsg: Message = { 
        id: (Date.now() + 1).toString(), 
        role: 'model', 
        text: responseText 
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (error) {
      console.error("Chat error", error);
      setMessages(prev => [...prev, { 
        id: Date.now().toString(), 
        role: 'model', 
        text: "Sorry, I encountered an error processing your message." 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlayAudio = async (msg: Message) => {
      if (msg.role === 'user' && msg.attachment?.type === 'audio' && msg.attachment.url) {
          const audio = new Audio(msg.attachment.url);
          audio.play();
          return;
      }

      if (!msg.text || msg.role === 'user') return;
      if (msg.isLoadingAudio) return;

      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, isLoadingAudio: true } : m));

      try {
          const base64 = await generateSpeech(msg.text);
          if (base64) {
               const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});
               const audioBuffer = await decodeAudioData(decode(base64), audioCtx, 24000, 1);
               playAudioBuffer(audioBuffer);
          }
      } catch (e) {
          console.error(e);
      } finally {
          setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, isLoadingAudio: false } : m));
      }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] md:h-screen bg-[#e5ddd5]">
      {/* Header */}
      <div className="px-4 py-3 bg-white border-b shadow-sm flex justify-between items-center z-10">
        <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold">LB</div>
            <div>
                <h2 className="text-lg font-semibold text-gray-800 leading-tight">LinguaBot</h2>
                <span className="text-xs text-gray-500">Online - AI Tutor</span>
            </div>
        </div>
        <button onClick={() => {
            if(confirm("Effacer l'historique de chat ?")) {
                localStorage.removeItem('chat_history');
                window.location.reload();
            }
        }} className="text-xs text-gray-400 hover:text-red-500">
            Effacer
        </button>
      </div>

      {/* Chat Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2 bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] bg-repeat bg-fixed">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] md:max-w-[65%] rounded-lg shadow-sm relative p-2
              ${msg.role === 'user' 
                ? 'bg-[#d9fdd3] rounded-tr-none' 
                : 'bg-white rounded-tl-none'}`}
            >
              {/* Attachment Display */}
              {msg.attachment && (
                  <div className="mb-2 rounded-lg overflow-hidden">
                      {msg.attachment.type === 'image' && (
                          <img src={msg.attachment.url} alt="Shared" className="max-w-full h-auto object-cover max-h-64" />
                      )}
                      {msg.attachment.type === 'audio' && (
                          <div className="flex items-center gap-2 bg-gray-100 p-2 rounded-md min-w-[200px]">
                              <button onClick={() => handlePlayAudio(msg)} className="text-gray-600">
                                  ▶️
                              </button>
                              <div className="h-1 bg-gray-300 flex-1 rounded-full"></div>
                              <span className="text-xs text-gray-500">Audio</span>
                          </div>
                      )}
                  </div>
              )}

              {/* Text Content */}
              {msg.text && <p className="text-sm md:text-base text-gray-800 whitespace-pre-wrap px-1">{msg.text}</p>}
              
              {/* Metadata / Actions */}
              <div className="flex justify-end items-center gap-2 mt-1">
                  {msg.role === 'model' && (
                    <button 
                        onClick={() => handlePlayAudio(msg)}
                        disabled={msg.isLoadingAudio}
                        className="text-gray-400 hover:text-gray-600"
                        title="Read aloud"
                    >
                        {msg.isLoadingAudio ? '...' : '🔊'}
                    </button>
                  )}
                  <span className="text-[10px] text-gray-500">
                      {new Date(parseInt(msg.id) || Date.now()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </span>
              </div>
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
             <div className="bg-white p-3 rounded-lg rounded-tl-none shadow-sm">
                <div className="flex gap-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-75"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-150"></div>
                </div>
             </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="bg-[#f0f2f5] p-2 md:p-3 flex items-end gap-2">
        
        {isRecording ? (
           <div className="flex-1 bg-white rounded-full h-12 flex items-center justify-between px-4 shadow-sm animate-pulse border border-red-200">
               <div className="flex items-center gap-3">
                   <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                   <span className="text-red-500 font-medium">{formatDuration(recordingDuration)}</span>
               </div>
               <span className="text-gray-500 text-sm">Enregistrement...</span>
               <button onClick={() => stopRecording(false)} className="text-gray-400 hover:text-red-500 font-medium px-2">Cancel</button>
           </div>
        ) : (
            <>
                 {/* Attach Button */}
                <div className="flex items-center pb-3">
                    <input 
                        type="file" 
                        accept="image/*" 
                        multiple={false} 
                        className="hidden" 
                        ref={fileInputRef}
                        onChange={handleFileSelect}
                    />
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2 text-gray-500 hover:bg-gray-200 rounded-full transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                    </button>
                </div>

                {/* Main Input Container */}
                <div className="flex-1 bg-white rounded-2xl min-h-[3rem] flex flex-col shadow-sm border border-white focus-within:border-indigo-300 transition-colors">
                    {/* Attachment Preview */}
                    {attachment && (
                        <div className="p-2 border-b border-gray-100 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                {attachment.type === 'image' ? (
                                    <img src={attachment.url} alt="Preview" className="h-10 w-10 object-cover rounded-md" />
                                ) : (
                                    <span className="text-sm text-gray-500">Audio file</span>
                                )}
                                <span className="text-xs text-gray-500">Pièce jointe prête</span>
                            </div>
                            <button onClick={clearAttachment} className="text-gray-400 hover:text-red-500">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                            </button>
                        </div>
                    )}
                    
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                        placeholder="Message"
                        className="w-full px-4 py-3 bg-transparent border-none focus:ring-0 resize-none max-h-32 rounded-2xl"
                        rows={1}
                        style={{ minHeight: '3rem' }}
                    />
                </div>
            </>
        )}

        {/* Action Button (Mic or Send) */}
        <div className="pb-1">
            {input.trim() || attachment ? (
                <button
                    onClick={() => handleSend()}
                    disabled={isLoading}
                    className="p-3 bg-[#00a884] text-white rounded-full hover:bg-[#008f6f] transition-colors shadow-sm"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 transform rotate-90">
                        <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                    </svg>
                </button>
            ) : (
                <button
                    onClick={isRecording ? () => stopRecording(true) : startRecording}
                    className={`p-3 rounded-full transition-colors shadow-sm flex items-center justify-center
                        ${isRecording 
                            ? 'bg-red-500 text-white hover:bg-red-600' 
                            : 'bg-[#00a884] text-white hover:bg-[#008f6f]'
                        }`}
                >
                    {isRecording ? (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                           <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                        </svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                            <path d="M8.25 4.5a3.75 3.75 0 117.5 0v8.25a3.75 3.75 0 11-7.5 0V4.5z" />
                            <path d="M6 10.5a.75.75 0 01.75.75v1.5a5.25 5.25 0 1010.5 0v-1.5a.75.75 0 011.5 0v1.5a6.751 6.751 0 01-6 6.709v2.291h3a.75.75 0 010 1.5h-7.5a.75.75 0 010-1.5h3v-2.291a6.751 6.751 0 01-6-6.709v-1.5A.75.75 0 016 10.5z" />
                        </svg>
                    )}
                </button>
            )}
        </div>
      </div>
    </div>
  );
};
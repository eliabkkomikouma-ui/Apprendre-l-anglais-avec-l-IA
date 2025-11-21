import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { GeneratedLesson, LessonResult } from '../types';
import { generateLessonPlan } from '../services/geminiService';

const TOPICS = ['Travel Basics', 'Job Interview', 'Ordering Food', 'Grammar: Past Tense', 'Making Friends'];
const LEVELS = ['Beginner', 'Intermediate', 'Advanced'];

export const LessonView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'create' | 'history'>('create');
  
  // Lesson Generation State
  const [selectedTopic, setSelectedTopic] = useState(TOPICS[0]);
  const [selectedLevel, setSelectedLevel] = useState(LEVELS[0]);
  const [lesson, setLesson] = useState<GeneratedLesson | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Quiz State
  const [quizAnswers, setQuizAnswers] = useState<Record<number, string>>({});
  const [showResults, setShowResults] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  // History State
  const [history, setHistory] = useState<LessonResult[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('lesson_history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
  }, []);

  const handleGenerate = async () => {
    setIsLoading(true);
    setLesson(null);
    setQuizAnswers({});
    setShowResults(false);
    setIsSaved(false);
    try {
      const data = await generateLessonPlan(selectedTopic, selectedLevel);
      setLesson(data);
    } catch (e) {
      alert("Error generating lesson. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnswer = (qIndex: number, option: string) => {
    setQuizAnswers(prev => ({ ...prev, [qIndex]: option }));
  };

  const checkAnswers = () => {
    setShowResults(true);
    
    // Calculate score
    if (lesson && !isSaved) {
      let score = 0;
      lesson.quiz.forEach((q, idx) => {
        if (quizAnswers[idx] === q.correctAnswer) {
          score++;
        }
      });

      const newResult: LessonResult = {
        id: Date.now().toString(),
        timestamp: Date.now(),
        topic: selectedTopic,
        level: selectedLevel,
        score,
        totalQuestions: lesson.quiz.length,
        lessonData: lesson,
        userAnswers: quizAnswers
      };

      const updatedHistory = [newResult, ...history];
      setHistory(updatedHistory);
      localStorage.setItem('lesson_history', JSON.stringify(updatedHistory));
      setIsSaved(true);
    }
  };

  const loadHistoryItem = (item: LessonResult) => {
    setLesson(item.lessonData);
    setQuizAnswers(item.userAnswers);
    setSelectedTopic(item.topic);
    setSelectedLevel(item.level);
    setShowResults(true);
    setIsSaved(true); // Already saved since it's from history
    setActiveTab('create'); // Switch to view mode
  };

  const deleteHistoryItem = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updated = history.filter(h => h.id !== id);
    setHistory(updated);
    localStorage.setItem('lesson_history', JSON.stringify(updated));
  };

  const formatDate = (ts: number) => {
    return new Date(ts).toLocaleDateString('fr-FR', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div className="p-6 max-w-4xl mx-auto mb-20 md:mb-0 h-full overflow-y-auto">
      <header className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
           <h2 className="text-3xl font-bold text-gray-800">Leçons & Exercices</h2>
           <p className="text-gray-600">Générez des cours ou révisez vos acquis.</p>
        </div>
        
        <div className="bg-white p-1 rounded-lg border border-gray-200 inline-flex shadow-sm">
           <button 
             onClick={() => setActiveTab('create')}
             className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'create' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}
           >
             Nouvelle Leçon
           </button>
           <button 
             onClick={() => setActiveTab('history')}
             className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'history' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}
           >
             Historique
           </button>
        </div>
      </header>

      {activeTab === 'create' && (
        <>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sujet</label>
                <select 
                  value={selectedTopic} 
                  onChange={(e) => setSelectedTopic(e.target.value)}
                  className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  {TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Niveau</label>
                <select 
                  value={selectedLevel} 
                  onChange={(e) => setSelectedLevel(e.target.value)}
                  className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div className="flex items-end">
                <button 
                  onClick={handleGenerate}
                  disabled={isLoading}
                  className="w-full bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Génération...</span>
                    </>
                  ) : (
                    'Générer le cours'
                  )}
                </button>
              </div>
            </div>
          </div>

          {lesson && (
            <div className="animate-fade-in space-y-8">
              <section className="bg-white p-8 rounded-xl shadow-lg border-l-4 border-indigo-500">
                <div className="flex justify-between items-start mb-4 border-b border-gray-100 pb-4">
                  <h3 className="text-2xl font-bold text-gray-800">{selectedTopic} - {selectedLevel}</h3>
                  {isSaved && <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold">Terminé</span>}
                </div>
                
                {/* Customized Markdown Rendering for clean structure */}
                <div className="text-gray-700 leading-relaxed">
                  <ReactMarkdown
                    components={{
                        h3: ({node, ...props}) => <h3 className="text-xl font-bold text-indigo-700 mt-8 mb-4 border-b border-indigo-50 pb-2" {...props} />,
                        p: ({node, ...props}) => <p className="mb-4 text-base leading-7" {...props} />,
                        ul: ({node, ...props}) => <ul className="list-disc pl-6 mb-6 space-y-2 bg-gray-50 p-4 rounded-lg border border-gray-100" {...props} />,
                        li: ({node, ...props}) => <li className="pl-1" {...props} />,
                        strong: ({node, ...props}) => <strong className="font-bold text-indigo-900 bg-indigo-50 px-1 rounded" {...props} />
                    }}
                  >
                    {lesson.content}
                  </ReactMarkdown>
                </div>
              </section>

              <section className="bg-white p-8 rounded-xl shadow-lg border-t-4 border-gray-800">
                <h3 className="text-xl font-bold mb-6 text-gray-800 flex items-center gap-2">
                   <span>📝</span> Quiz de compréhension
                </h3>
                <div className="space-y-6">
                  {lesson.quiz.map((q, idx) => {
                    const isCorrect = quizAnswers[idx] === q.correctAnswer;
                    const hasAnswered = !!quizAnswers[idx];

                    return (
                      <div key={idx} className="border-b border-gray-100 pb-6 last:border-0">
                        <p className="font-medium text-lg mb-3 text-gray-800">{idx + 1}. {q.question}</p>
                        <div className="space-y-2">
                          {q.options.map((opt) => (
                            <button
                              key={opt}
                              onClick={() => !showResults && handleAnswer(idx, opt)}
                              disabled={showResults}
                              className={`w-full text-left p-4 rounded-lg border transition-all relative
                                ${!showResults && quizAnswers[idx] === opt ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500' : 'border-gray-200 hover:bg-gray-50'}
                                ${showResults && opt === q.correctAnswer ? 'bg-green-50 border-green-500 text-green-900 font-medium' : ''}
                                ${showResults && quizAnswers[idx] === opt && opt !== q.correctAnswer ? 'bg-red-50 border-red-500 text-red-900' : ''}
                              `}
                            >
                                {opt}
                                {showResults && opt === q.correctAnswer && <span className="absolute right-4 top-4 text-green-600">✓</span>}
                                {showResults && quizAnswers[idx] === opt && opt !== q.correctAnswer && <span className="absolute right-4 top-4 text-red-600">✗</span>}
                            </button>
                          ))}
                        </div>
                        {showResults && (
                          <div className={`mt-3 text-sm p-4 rounded-lg border ${isCorrect ? 'bg-green-50 border-green-100 text-green-800' : 'bg-red-50 border-red-100 text-red-800'}`}>
                            <strong className="block mb-1">{isCorrect ? 'Correct!' : 'Incorrect.'}</strong> {q.explanation}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                
                {!showResults && Object.keys(quizAnswers).length === lesson.quiz.length && (
                  <button 
                    onClick={checkAnswers}
                    className="mt-6 w-full bg-gray-900 text-white py-4 rounded-xl hover:bg-black font-bold text-lg transition-all shadow-lg transform hover:-translate-y-0.5"
                  >
                    Vérifier les réponses
                  </button>
                )}

                 {showResults && !isSaved && (
                    <button 
                    onClick={checkAnswers}
                    className="mt-6 w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 font-medium"
                  >
                    Enregistrer dans l'historique
                  </button>
                 )}
              </section>
            </div>
          )}
          
          {!lesson && !isLoading && (
            <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300 text-gray-400">
               <div className="text-6xl mb-4 opacity-20">📚</div>
               <p className="text-lg">Configurez et générez votre première leçon ci-dessus.</p>
            </div>
          )}
        </>
      )}

      {activeTab === 'history' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
           {history.length === 0 ? (
             <div className="p-12 text-center text-gray-500">
               <span className="text-4xl block mb-4">🕰️</span>
               <p className="text-lg">Aucune leçon terminée pour le moment.</p>
               <button onClick={() => setActiveTab('create')} className="mt-4 text-indigo-600 font-medium hover:underline">Commencer une leçon</button>
             </div>
           ) : (
             <div className="divide-y divide-gray-100">
               {history.map((item) => (
                 <div 
                   key={item.id} 
                   onClick={() => loadHistoryItem(item)}
                   className="p-4 hover:bg-gray-50 transition-colors cursor-pointer group flex items-center justify-between"
                 >
                   <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{formatDate(item.timestamp)}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          item.score === item.totalQuestions ? 'bg-green-100 text-green-700' :
                          item.score >= item.totalQuestions / 2 ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          Score: {item.score}/{item.totalQuestions}
                        </span>
                      </div>
                      <h4 className="font-bold text-gray-800 text-lg">{item.topic}</h4>
                      <p className="text-sm text-gray-500">{item.level}</p>
                   </div>
                   
                   <div className="flex items-center gap-4">
                      <button className="text-indigo-600 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                        Revoir
                      </button>
                      <button 
                        onClick={(e) => deleteHistoryItem(e, item.id)}
                        className="text-gray-300 hover:text-red-500 p-2 rounded-full hover:bg-red-50 transition-colors z-10"
                        title="Supprimer"
                      >
                         <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                      </button>
                   </div>
                 </div>
               ))}
             </div>
           )}
        </div>
      )}
    </div>
  );
};
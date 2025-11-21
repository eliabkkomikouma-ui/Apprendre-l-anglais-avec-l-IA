import React from 'react';
import { View } from '../types';

interface DashboardProps {
  setView: (view: View) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ setView }) => {
  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto">
      <header className="mb-10">
        <h2 className="text-3xl font-bold text-gray-900">Welcome back! 👋</h2>
        <p className="text-gray-500 mt-2">Prêt à améliorer votre anglais aujourd'hui ?</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Quick Action Cards */}
        <div 
          onClick={() => setView(View.CHAT)}
          className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg cursor-pointer transform transition hover:-translate-y-1 hover:shadow-xl"
        >
          <div className="bg-white/20 w-12 h-12 rounded-lg flex items-center justify-center mb-4 backdrop-blur-sm">
            <span className="text-2xl">💬</span>
          </div>
          <h3 className="text-xl font-bold mb-2">Chat avec l'IA</h3>
          <p className="text-indigo-100 text-sm">Pratiquez la conversation naturelle avec corrections instantanées et écoute audio.</p>
        </div>

        <div 
          onClick={() => setView(View.LESSONS)}
          className="bg-white rounded-2xl p-6 border border-gray-100 shadow-md cursor-pointer transform transition hover:-translate-y-1 hover:shadow-lg group"
        >
           <div className="bg-orange-100 w-12 h-12 rounded-lg flex items-center justify-center mb-4 text-orange-600 group-hover:bg-orange-200 transition-colors">
            <span className="text-2xl">📚</span>
          </div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">Leçons Structurées</h3>
          <p className="text-gray-500 text-sm">Générez des cours sur mesure : Grammaire, Voyage, Business...</p>
        </div>

        <div 
          onClick={() => setView(View.VISUAL_DICT)}
          className="bg-white rounded-2xl p-6 border border-gray-100 shadow-md cursor-pointer transform transition hover:-translate-y-1 hover:shadow-lg group"
        >
           <div className="bg-emerald-100 w-12 h-12 rounded-lg flex items-center justify-center mb-4 text-emerald-600 group-hover:bg-emerald-200 transition-colors">
            <span className="text-2xl">🖼️</span>
          </div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">Dictionnaire Visuel</h3>
          <p className="text-gray-500 text-sm">Apprenez le vocabulaire visuellement avec des images générées par l'IA.</p>
        </div>
      </div>

      <div className="mt-10">
        <h3 className="text-xl font-bold text-gray-800 mb-4">Astuce du jour</h3>
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 flex items-start gap-4">
            <span className="text-2xl">💡</span>
            <div>
                <h4 className="font-semibold text-blue-900">Consistency is key</h4>
                <p className="text-blue-800 text-sm mt-1">Pratiquer 10 minutes par jour est plus efficace que 2 heures une fois par semaine. Essayez de faire une petite conversation avec LinguaBot chaque matin.</p>
            </div>
        </div>
      </div>
    </div>
  );
};

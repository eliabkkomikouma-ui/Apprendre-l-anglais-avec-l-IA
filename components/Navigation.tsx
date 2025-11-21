import React from 'react';
import { View } from '../types';

interface NavigationProps {
  currentView: View;
  setView: (view: View) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ currentView, setView }) => {
  const navItems = [
    { id: View.DASHBOARD, label: 'Tableau de bord', icon: '📊' },
    { id: View.CHAT, label: 'Chat IA', icon: '💬' },
    { id: View.LESSONS, label: 'Leçons', icon: '📚' },
    { id: View.VISUAL_DICT, label: 'Dico Visuel', icon: '🖼️' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 md:relative md:w-64 md:h-screen md:border-t-0 md:border-r md:flex md:flex-col shadow-lg z-50">
      <div className="hidden md:flex items-center justify-center h-20 border-b border-gray-100">
        <h1 className="text-2xl font-bold text-indigo-600">Anglais Facile</h1>
      </div>
      <ul className="flex flex-row justify-around md:flex-col md:justify-start md:p-4 md:space-y-2">
        {navItems.map((item) => (
          <li key={item.id} className="flex-1 md:flex-none">
            <button
              onClick={() => setView(item.id)}
              className={`w-full flex flex-col md:flex-row items-center md:px-4 md:py-3 rounded-lg transition-colors duration-200
                ${currentView === item.id 
                  ? 'text-indigo-600 bg-indigo-50 md:bg-indigo-50' 
                  : 'text-gray-500 hover:text-indigo-500 hover:bg-gray-50'}`}
            >
              <span className="text-2xl md:text-xl md:mr-3 mb-1 md:mb-0">{item.icon}</span>
              <span className="text-xs md:text-sm font-medium">{item.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
};
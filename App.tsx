import React, { useState } from 'react';
import { Navigation } from './components/Navigation';
import { Dashboard } from './components/Dashboard';
import { ChatView } from './components/ChatView';
import { LessonView } from './components/LessonView';
import { VisualDictView } from './components/VisualDictView';
import { View } from './types';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>(View.DASHBOARD);

  const renderContent = () => {
    switch (currentView) {
      case View.DASHBOARD:
        return <Dashboard setView={setCurrentView} />;
      case View.CHAT:
        return <ChatView />;
      case View.LESSONS:
        return <LessonView />;
      case View.VISUAL_DICT:
        return <VisualDictView />;
      default:
        return <Dashboard setView={setCurrentView} />;
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-screen w-screen overflow-hidden bg-gray-50 text-slate-900">
      <Navigation currentView={currentView} setView={setCurrentView} />
      
      <main className="flex-1 h-full overflow-hidden relative md:pt-0">
        {renderContent()}
      </main>
    </div>
  );
};

export default App;

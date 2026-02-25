import React, { useState } from 'react';
import { ReactFlowProvider } from 'reactflow';
import Editor from './components/Editor';
import LandingPage from './components/LandingPage';
import ErrorBoundary from './ErrorBoundary';
import './App.css';

function App() {
  const [currentView, setCurrentView] = useState('landing'); // 'landing' | 'editor'
  const [initialData, setInitialData] = useState(null);

  const handleStartProject = (data) => {
    setInitialData(data);
    setCurrentView('editor');
  };

  const handleExitProject = () => {
    setInitialData(null);
    setCurrentView('landing');
  };

  return (
    <ErrorBoundary>
      <div className="app-container">
        {currentView === 'landing' ? (
          <LandingPage onStartProject={handleStartProject} />
        ) : (
          <ReactFlowProvider>
            <Editor initialData={initialData} onExit={handleExitProject} />
          </ReactFlowProvider>
        )}
      </div>
    </ErrorBoundary>
  );
}

export default App;

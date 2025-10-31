import React, { useState, useEffect } from 'react';

export const LoadingOverlay: React.FC = () => {
  const [progress, setProgress] = useState(0);
  const [displayText, setDisplayText] = useState("Inizializzazione...");

  useEffect(() => {
    let interval: number;

    // Start a timer to simulate progress
    setProgress(0);
    setDisplayText("Inizializzazione...");

    const initialJumpTimer = setTimeout(() => {
      setProgress(10);
      setDisplayText("Analisi dell'immagine in corso...");
    }, 200);

    interval = window.setInterval(() => {
      setProgress(oldProgress => {
        if (oldProgress >= 95) {
          clearInterval(interval);
          setDisplayText("Finalizzazione dei risultati...");
          return 95;
        }
        // Increment slowly and non-linearly to feel more "real"
        const increment = Math.random() * 2.5;
        return Math.min(oldProgress + increment, 95);
      });
    }, 150);

    // This is the cleanup function that will be called when the component is unmounted
    return () => {
      clearTimeout(initialJumpTimer);
      clearInterval(interval);
    };
  }, []); // The empty dependency array ensures this runs only once when the component mounts

  return (
    <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm flex flex-col items-center justify-center z-50 transition-opacity duration-300">
      <div className="w-full max-w-md px-4">
        <h2 className="text-lg font-semibold text-gray-200 text-center mb-3">{displayText}</h2>
        <div className="w-full bg-gray-700/50 rounded-full h-2.5 overflow-hidden ring-1 ring-white/10">
          <div 
            className="bg-gradient-to-r from-teal-400 to-blue-500 h-2.5 rounded-full transition-all duration-300 ease-linear"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
        <p className="text-center text-gray-400 text-sm mt-2 font-mono">{Math.round(progress)}%</p>
      </div>
       <p className="mt-6 text-sm text-gray-500">L'IA sta esaminando l'orario per la massima precisione.</p>
    </div>
  );
};

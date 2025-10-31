import React from 'react';

interface ErrorDisplayProps {
  message: string;
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ message }) => {
  return (
    <div className="mt-4 p-4 bg-red-900/50 border border-red-500/50 text-red-300 rounded-lg text-center animate-slideInUp">
      <p className="font-semibold">Oops! Qualcosa è andato storto.</p>
      <p className="text-sm mt-1">{message}</p>
    </div>
  );
};
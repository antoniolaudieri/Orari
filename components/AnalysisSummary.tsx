import React from 'react';

interface AnalysisSummaryProps {
  summary: string | null;
}

export const AnalysisSummary: React.FC<AnalysisSummaryProps> = ({ summary }) => {
  if (!summary) {
    return null;
  }

  return (
    <div className="mt-4 p-4 bg-blue-900/30 border border-blue-500/50 text-blue-200 rounded-lg animate-slideInUp">
      <p className="font-semibold text-blue-300">Sommario IA</p>
      <p className="text-sm mt-1">{summary}</p>
    </div>
  );
};
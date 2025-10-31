import React from 'react';

export const WelcomeMessage: React.FC = () => {
  return (
    <div className="text-center p-8 bg-gray-800/30 rounded-2xl border border-dashed border-gray-600">
      <h2 className="text-2xl font-semibold text-gray-300 mb-2">Benvenuto!</h2>
      <p className="text-gray-400 max-w-md mx-auto">
        Per iniziare, carica una foto del tuo orario di lavoro settimanale usando il pannello qui sopra.
      </p>
      <p className="text-gray-500 mt-4 text-sm">
        Assicurati che l'immagine sia chiara, ben illuminata e che il testo sia leggibile per ottenere i migliori risultati.
      </p>
    </div>
  );
};

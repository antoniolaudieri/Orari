import React, { useState, useRef, useEffect } from 'react';

interface ImageUploaderProps {
  onAnalyze: (file: File) => void;
  isLoading: boolean;
  initialPreview?: string | null;
}

const UploadIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
);

export const ImageUploader: React.FC<ImageUploaderProps> = ({ onAnalyze, isLoading, initialPreview }) => {
  const [preview, setPreview] = useState<string | null>(initialPreview || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPreview(initialPreview);
    if (!initialPreview && fileInputRef.current) {
        fileInputRef.current.value = "";
    }
  }, [initialPreview]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      onAnalyze(file); // Trigger analysis immediately
    }
  };

  const handleSelectImageClick = () => {
    fileInputRef.current?.click();
  };
  
  const handleClear = () => {
      setPreview(null);
      if(fileInputRef.current) {
          fileInputRef.current.value = "";
      }
      // Note: This only clears the local preview.
      // A full analysis clear happens in App.tsx when a new analysis starts.
  }

  return (
    <div className="bg-gray-800/50 p-4 sm:p-6 rounded-2xl ring-1 ring-white/10">
      <div className="flex flex-col sm:flex-row items-center gap-6">
        <div className="w-full sm:w-1/3 h-36 sm:h-40 flex-shrink-0 flex items-center justify-center border-2 border-dashed border-gray-600 rounded-lg bg-gray-900/50 overflow-hidden">
          {preview ? (
            <img src={preview} alt="Anteprima orario" className="h-full w-full object-contain" />
          ) : (
            <div className="text-center text-gray-500">
                <UploadIcon className="mx-auto h-8 w-8" />
                <p className="mt-1 text-sm">Anteprima Immagine</p>
            </div>
          )}
        </div>
        <div className="flex-1 text-center sm:text-left">
          <h3 className="text-lg font-semibold text-white">Carica il Tuo Orario</h3>
          <p className="text-sm text-gray-400 mt-1">Seleziona un'immagine: l'analisi partirà in automatico.</p>
          <div className="mt-4 flex flex-col sm:flex-row items-center gap-3">
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
              ref={fileInputRef}
              disabled={isLoading}
            />
            <button
              onClick={handleSelectImageClick}
              disabled={isLoading}
              className="w-full sm:w-auto px-6 py-3 bg-teal-500 text-white font-bold rounded-lg hover:bg-teal-600 transition-all duration-300 transform hover:-translate-y-1 disabled:opacity-50 disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg hover:shadow-xl shadow-teal-500/20 hover:shadow-teal-500/40"
            >
              <UploadIcon className="h-5 w-5" />
              Scegli File
            </button>
            {preview && (
                <button
                    onClick={handleClear}
                    disabled={isLoading}
                    className="w-full sm:w-auto px-4 py-2 bg-red-800/50 text-red-300 rounded-lg hover:bg-red-800/80 transition-all duration-200 transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Cancella
                </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
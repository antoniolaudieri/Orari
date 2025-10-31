import React, { useState } from 'react';

interface LoginPageProps {
  onLoginSuccess: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      if (response.ok) {
        onLoginSuccess();
      } else {
        const data = await response.json();
        setError(data.error || 'Credenziali non valide.');
      }
    } catch (err) {
      setError('Errore di connessione. Riprova più tardi.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 animate-scaleIn">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-teal-400 mx-auto mb-3"><path d="M12 2a10 10 0 1 0 10 10c0-4.42-2.87-8.1-7-9.44"/><path d="m13 2-3 9 9 3-3-9Z"/></svg>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                Orario Intelligente
            </h1>
            <p className="text-gray-400 mt-2">Accedi per continuare</p>
        </div>

        <form 
          onSubmit={handleSubmit} 
          className="bg-slate-800/50 p-8 rounded-2xl shadow-2xl ring-1 ring-white/10"
        >
          <div className="space-y-6">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-2">Username</label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full bg-slate-700/50 text-white rounded-lg px-4 py-2.5 border-none focus:outline-none focus:ring-2 focus:ring-teal-500 transition"
                placeholder="Ilaria"
              />
            </div>
            <div>
              <label htmlFor="password"  className="block text-sm font-medium text-gray-300 mb-2">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-slate-700/50 text-white rounded-lg px-4 py-2.5 border-none focus:outline-none focus:ring-2 focus:ring-teal-500 transition"
                placeholder="••••••••"
              />
            </div>
          </div>
          
          {error && <p className="mt-4 text-center text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-8 px-6 py-3 bg-teal-500 text-white font-bold rounded-lg hover:bg-teal-600 transition-all duration-300 transform hover:-translate-y-1 disabled:opacity-50 disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg hover:shadow-xl shadow-teal-500/20 hover:shadow-teal-500/40"
          >
            {isLoading ? 'Accesso in corso...' : 'Accedi'}
          </button>
        </form>
      </div>
    </div>
  );
};

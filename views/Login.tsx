import React, { useState } from 'react';
import { LogIn, Mail, Lock, AlertCircle, Eye, EyeOff, Scissors } from 'lucide-react';
import { User } from '../types';

interface LoginProps {
  onLogin: (email: string, password: string) => Promise<{ success: boolean; user?: User }> | { success: boolean; user?: User };
  users: User[];
  showDemoCredentials?: boolean;
}

export const Login: React.FC<LoginProps> = ({ onLogin, users, showDemoCredentials = false }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    // Simulate async login
    setTimeout(async () => {
      const result = await Promise.resolve(onLogin(email, password));
      if (!result.success) {
        setError('Неверный email или пароль');
      }
      setIsSubmitting(false);
    }, 500);
  };

  // Demo credentials display
  const authUsers = users.filter(u => u.role !== 'CLIENT' || u.id === 'u_client');

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-zinc-900 to-black flex items-center justify-center p-4">
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gold-500 rounded-full mix-blend-screen blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-gold-500 rounded-full mix-blend-screen blur-3xl"></div>
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gold-500 rounded-full mb-4">
            <Scissors className="w-8 h-8 text-black" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">Lumière</h1>
          <p className="text-zinc-400">Luxury Salon Management System</p>
        </div>

        {/* Login Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl p-8 backdrop-blur-sm">
          <h2 className="text-2xl font-bold text-white mb-6">Вход в систему</h2>

          {error && (
            <div className="mb-6 p-4 bg-red-900/20 border border-red-500 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-red-200 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            {/* Email Input */}
            <div>
              <label className="block text-sm font-medium text-zinc-200 mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-5 h-5 text-zinc-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full pl-10 pr-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:border-gold-500 focus:ring-1 focus:ring-gold-500 text-white placeholder-zinc-500"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label className="block text-sm font-medium text-zinc-200 mb-2">Пароль</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-5 h-5 text-zinc-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:border-gold-500 focus:ring-1 focus:ring-gold-500 text-white placeholder-zinc-500"
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-zinc-500 hover:text-zinc-300"
                  disabled={isSubmitting}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={isSubmitting || !email || !password}
              className="w-full py-2 px-4 bg-gold-500 text-black font-bold rounded-lg hover:bg-gold-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <LogIn className="w-5 h-5" />
              {isSubmitting ? 'Вход...' : 'Войти'}
            </button>
          </form>

          {import.meta.env.DEV && showDemoCredentials && authUsers.some(user => user.password) && (
            <div className="mt-8 pt-6 border-t border-zinc-800">
              <p className="text-xs text-zinc-400 mb-4 font-medium">ДЕМО УЧЕТНЫЕ ДАННЫЕ:</p>
              <div className="space-y-2">
                {authUsers.filter(user => user.password).map(user => (
                  <div key={user.id} className="text-xs bg-zinc-800/50 p-3 rounded border border-zinc-700">
                    <div className="text-zinc-300 font-mono">
                      <div>{user.email}</div>
                      <div className="text-zinc-500">Pass: {user.password}</div>
                    </div>
                    <div className="text-gold-400 text-xs mt-1">({user.role === 'MASTER' ? 'Стилист' : user.role === 'ADMIN' ? 'Админ' : 'Клиент'})</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-zinc-500 text-xs mt-8">
          © 2026 Lumière Salon. All rights reserved.
        </p>
      </div>
    </div>
  );
};


import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { Layers, Lock, Mail, User, ArrowRight, Loader2, AlertCircle, Shield, Briefcase, UserCheck } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, login, register, status, error: authError } = useAuthStore();

  const [activeTab, setActiveTab] = useState<'signin' | 'register'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If already logged in, redirect to home
  if (user) {
    return <Navigate to="/" replace />;
  }

  const fillAccount = (demoEmail: string, demoPass: string) => {
    setActiveTab('signin');
    setEmail(demoEmail);
    setPassword(demoPass);
    setLocalError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!email || !password) {
      setLocalError('Please provide both email and password.');
      return;
    }

    if (activeTab === 'register' && !name) {
      setLocalError('Please provide your full name.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (activeTab === 'signin') {
        await login(email, password);
      } else {
        await register(name, email, password);
      }
      navigate('/');
    } catch (err: any) {
      setLocalError(err?.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayError = localError || authError;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-primary-600 flex items-center justify-center text-white shadow-lg shadow-primary-600/30">
            <Layers className="h-6 w-6" />
          </div>
          <div className="text-left">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">SRMS</h1>
            <p className="text-xs text-slate-500 font-medium tracking-wide uppercase">
              Service Request Management
            </p>
          </div>
        </div>
        <h2 className="mt-6 text-center text-xl font-bold text-slate-900">
          {activeTab === 'signin' ? 'Sign in to your dashboard' : 'Create an Operator account'}
        </h2>
        <p className="mt-1 text-center text-sm text-slate-500">
          Real-time reactive workflow and service request orchestrator
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-xl shadow-slate-200/50 rounded-2xl border border-slate-200 sm:px-10">
          {/* Quick Demo Logins Bar */}
          <div className="mb-6 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-primary-600" />
              Quick Demo Accounts
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => fillAccount('operator1@srms.local', 'Password123!')}
                className="flex flex-col items-center justify-center p-2 rounded-lg bg-white border border-slate-200 hover:border-primary-500 hover:bg-primary-50 text-slate-700 hover:text-primary-700 transition shadow-xs text-center"
              >
                <Briefcase className="h-4 w-4 mb-1 text-slate-500" />
                <span className="text-xs font-semibold">Operator</span>
                <span className="text-[10px] text-slate-500">Omar</span>
              </button>

              <button
                type="button"
                onClick={() => fillAccount('supervisor@srms.local', 'Password123!')}
                className="flex flex-col items-center justify-center p-2 rounded-lg bg-white border border-slate-200 hover:border-sky-500 hover:bg-sky-50 text-slate-700 hover:text-sky-700 transition shadow-xs text-center"
              >
                <UserCheck className="h-4 w-4 mb-1 text-sky-600" />
                <span className="text-xs font-semibold">Supervisor</span>
                <span className="text-[10px] text-slate-500">Sarah</span>
              </button>

              <button
                type="button"
                onClick={() => fillAccount('admin@srms.local', 'Password123!')}
                className="flex flex-col items-center justify-center p-2 rounded-lg bg-white border border-slate-200 hover:border-purple-500 hover:bg-purple-50 text-slate-700 hover:text-purple-700 transition shadow-xs text-center"
              >
                <Shield className="h-4 w-4 mb-1 text-purple-600" />
                <span className="text-xs font-semibold">Admin</span>
                <span className="text-[10px] text-slate-500">System</span>
              </button>
            </div>
          </div>

          {/* Tab Selector */}
          <div className="flex border-b border-slate-200 mb-6">
            <button
              type="button"
              onClick={() => {
                setActiveTab('signin');
                setLocalError(null);
              }}
              className={`flex-1 pb-3 text-sm font-semibold border-b-2 text-center transition ${
                activeTab === 'signin'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('register');
                setLocalError(null);
              }}
              className={`flex-1 pb-3 text-sm font-semibold border-b-2 text-center transition ${
                activeTab === 'register'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Register
            </button>
          </div>

          {displayError && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-rose-700 text-xs">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
              <span>{displayError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {activeTab === 'register' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                <div className="relative rounded-lg shadow-xs">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <User className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Omar Operator"
                    className="block w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
              <div className="relative rounded-lg shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="operator1@srms.local"
                  className="block w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
              <div className="relative rounded-lg shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="block w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting || status === 'loading'}
                className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-transparent rounded-xl shadow-md text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {isSubmitting || status === 'loading' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <span>{activeTab === 'signin' ? 'Sign In' : 'Create Account'}</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;

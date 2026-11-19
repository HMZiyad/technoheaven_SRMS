import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './store/authStore';
import { Layout } from './components/layout/Layout';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export const App: React.FC = () => {
  const { restoreSession, status } = useAuthStore();

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
          <p className="text-sm font-medium text-slate-600">Initializing session...</p>
        </div>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/requests" replace />} />
            <Route
              path="requests"
              element={
                <div className="p-8 bg-white rounded-xl border border-slate-200 shadow-sm text-center">
                  <h1 className="text-2xl font-bold text-slate-800">Service Requests</h1>
                  <p className="mt-2 text-slate-500">Service request board and list will load here.</p>
                </div>
              }
            />
            <Route
              path="requests/new"
              element={
                <div className="p-8 bg-white rounded-xl border border-slate-200 shadow-sm text-center">
                  <h1 className="text-2xl font-bold text-slate-800">Create New Service Request</h1>
                  <p className="mt-2 text-slate-500">Service request creation form.</p>
                </div>
              }
            />
            <Route
              path="analytics"
              element={
                <div className="p-8 bg-white rounded-xl border border-slate-200 shadow-sm text-center">
                  <h1 className="text-2xl font-bold text-slate-800">Analytics & Real-Time Stats</h1>
                  <p className="mt-2 text-slate-500">System throughput and statistics dashboard.</p>
                </div>
              }
            />
          </Route>
          <Route
            path="/login"
            element={
              <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
                <div className="max-w-md w-full bg-white p-8 rounded-2xl border border-slate-200 shadow-sm text-center">
                  <h2 className="text-xl font-bold text-slate-900">Sign In to SRMS</h2>
                  <p className="mt-1 text-sm text-slate-500">Enter your credentials to continue</p>
                </div>
              </div>
            }
          />
          <Route
            path="/register"
            element={
              <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
                <div className="max-w-md w-full bg-white p-8 rounded-2xl border border-slate-200 shadow-sm text-center">
                  <h2 className="text-xl font-bold text-slate-900">Create Account</h2>
                  <p className="mt-1 text-sm text-slate-500">Register as an Operator to submit requests</p>
                </div>
              </div>
            }
          />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;

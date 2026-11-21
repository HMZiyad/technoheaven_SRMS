import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './store/authStore';
import { useRequestStore } from './store/requestStore';
import { useNotificationStore } from './store/notificationStore';
import { useSocket } from './hooks/useSocket';
import { Role, Status, EventEnvelope } from './types';
import { Layout } from './components/layout/Layout';
import { Toast } from './components/common/Toast';
import { LoginPage } from './pages/LoginPage';
import { OperatorDashboard } from './pages/OperatorDashboard';
import { SupervisorDashboard } from './pages/SupervisorDashboard';
import { RequestDetailPage } from './pages/RequestDetailPage';
import { AlertCircle, Home } from 'lucide-react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

/**
 * LiveSocketBridge wires all real-time events to the Zustand requestStore
 * and delivers clean updates to the notification bell store.
 */
const LiveSocketBridge: React.FC = () => {
  const { upsertRequest, patchRequest, setStats, setLastEventId } = useRequestStore();
  const { addNotification } = useNotificationStore();

  useSocket({
    onEvent: (event: EventEnvelope) => {
      if (event?.id) {
        setLastEventId(event.id);
      }
    },
    onRequestCreated: (event: EventEnvelope) => {
      const req = event.payload;
      if (req && req.id) {
        upsertRequest(req);
        addNotification({
          type: 'info',
          title: 'Request Created',
          message: `${req.reference ? `${req.reference}: ` : ''}${req.title || 'New service request'}`,
          requestId: req.id,
          reference: req.reference,
        });
      }
    },
    onRequestStatusChanged: (event: EventEnvelope) => {
      const { id, to } = event.payload || {};
      if (id && to) {
        patchRequest(id, { status: to });

        const existing = useRequestStore.getState().requests[id];
        const refLabel = existing?.reference || `Request #${id.slice(-6)}`;

        if (to === Status.COMPLETED) {
          addNotification({
            type: 'success',
            title: 'Status: Completed',
            message: `${refLabel} completed successfully.`,
            requestId: id,
            reference: existing?.reference,
          });
        } else if (to === Status.FAILED) {
          addNotification({
            type: 'error',
            title: 'Status: Failed',
            message: `${refLabel} processing encountered a failure.`,
            requestId: id,
            reference: existing?.reference,
          });
        } else if (to === Status.CANCELLED) {
          addNotification({
            type: 'warning',
            title: 'Status: Cancelled',
            message: `${refLabel} processing was cancelled.`,
            requestId: id,
            reference: existing?.reference,
          });
        } else {
          addNotification({
            type: 'info',
            title: 'Status Updated',
            message: `${refLabel} moved to ${to.replace(/_/g, ' ')}.`,
            requestId: id,
            reference: existing?.reference,
          });
        }
      }
    },
    onRequestProgress: (event: EventEnvelope) => {
      const { id, progress, stage } = event.payload || {};
      if (id) {
        patchRequest(id, { progress, currentStage: stage });
      }
    },
    onRequestUpdated: (event: EventEnvelope) => {
      const req = event.payload;
      if (req && req.id) {
        upsertRequest(req);
      }
    },
    onRequestCommentAdded: (event: EventEnvelope) => {
      const { comment } = event.payload || {};
      if (comment) {
        const existing = useRequestStore.getState().requests[comment.requestId];
        addNotification({
          type: 'info',
          title: 'New Comment',
          message: `${comment.author?.name || 'Staff'}: "${comment.body?.slice(0, 45) || ''}..."`,
          requestId: comment.requestId,
          reference: existing?.reference,
        });
      }
    },
    onStatsUpdated: (event: EventEnvelope) => {
      if (event.payload) {
        setStats(event.payload);
      }
    },
  });

  return null;
};

/**
 * Route protection wrapper based on session status.
 */
interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, status } = useAuthStore();

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
          <p className="text-sm font-medium text-slate-600">Verifying authentication session...</p>
        </div>
      </div>
    );
  }

  if (!user && status === 'unauthenticated') {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

/**
 * Role-aware Dashboard Selector
 * If OPERATOR -> OperatorDashboard
 * If SUPERVISOR or ADMIN -> SupervisorDashboard
 */
const DashboardDispatcher: React.FC = () => {
  const { user } = useAuthStore();

  if (user?.role === Role.SUPERVISOR || user?.role === Role.ADMIN) {
    return <SupervisorDashboard />;
  }

  return <OperatorDashboard />;
};

/**
 * 404 Fallback Page
 */
const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center p-8">
      <div className="h-16 w-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mb-4 border border-rose-100">
        <AlertCircle className="h-8 w-8" />
      </div>
      <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">404 - Page Not Found</h1>
      <p className="text-sm text-slate-500 mt-2 max-w-md">
        The destination you are attempting to reach does not exist or has been relocated.
      </p>
      <Link
        to="/"
        className="mt-6 inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-semibold shadow-md transition"
      >
        <Home className="h-4 w-4" />
        Return to Home
      </Link>
    </div>
  );
};

export const App: React.FC = () => {
  const { restoreSession } = useAuthStore();

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <LiveSocketBridge />
        <Toast />
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<LoginPage />} />

          {/* Protected Application Routes inside Layout */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardDispatcher />} />
            <Route path="requests" element={<DashboardDispatcher />} />
            <Route path="requests/new" element={<DashboardDispatcher />} />
            <Route path="analytics" element={<SupervisorDashboard />} />
            <Route path="requests/:id" element={<RequestDetailPage />} />
          </Route>

          {/* 404 Fallback */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;

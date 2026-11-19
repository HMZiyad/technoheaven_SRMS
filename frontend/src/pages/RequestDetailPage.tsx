import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Clock,
  User,
  Phone,
  Mail,
  RotateCw,
  AlertOctagon,
  AlertTriangle,
  CheckCircle,
  MessageSquare,
  Send,
  Loader2,
  Calendar,
  Layers,
  History as HistoryIcon,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useRequestStore } from '../store/requestStore';
import { useSocket } from '../hooks/useSocket';
import { toast } from '../store/toastStore';
import { api } from '../api/client';
import {
  ServiceRequest,
  StatusHistory,
  Comment,
  Role,
  Status,
} from '../types';
import { StatusBadge, PriorityBadge, RoleBadge } from '../components/common/Badge';
import { ProgressBar } from '../components/common/ProgressBar';

export const RequestDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { requests, upsertRequest, patchRequest } = useRequestStore();
  const { subscribeToRequest, unsubscribeFromRequest } = useSocket();

  const [request, setRequest] = useState<ServiceRequest | null>(
    (id && requests[id]) ? requests[id] : null
  );
  const [history, setHistory] = useState<StatusHistory[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Comment input state
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  // Action states
  const [isRetrying, setIsRetrying] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  // Subscribe to socket room for this request
  useEffect(() => {
    if (!id) return;
    subscribeToRequest(id);

    return () => {
      unsubscribeFromRequest(id);
    };
  }, [id, subscribeToRequest, unsubscribeFromRequest]);

  // Keep local request in sync with store
  useEffect(() => {
    if (id && requests[id]) {
      setRequest((prev) => ({
        ...(prev || {}),
        ...requests[id],
      }));
    }
  }, [id, requests]);

  // Fetch initial details, history, comments
  const loadData = useCallback(async () => {
    if (!id) return;
    try {
      setIsLoading(true);
      const [reqRes, histRes, commRes] = await Promise.all([
        api.get<{ data: ServiceRequest }>(`/requests/${id}`),
        api.get<{ data: StatusHistory[] }>(`/requests/${id}/history`).catch(() => ({ data: [] })),
        api.get<{ data: Comment[] }>(`/requests/${id}/comments`).catch(() => ({ data: [] })),
      ]);

      if (reqRes?.data) {
        setRequest(reqRes.data);
        upsertRequest(reqRes.data);
      }
      if (histRes?.data) {
        setHistory(histRes.data);
      }
      if (commRes?.data) {
        setComments(commRes.data);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load request details');
    } finally {
      setIsLoading(false);
    }
  }, [id, upsertRequest]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Listen to live comments via socket hook
  useSocket({
    onRequestCommentAdded: (event) => {
      if (event.requestId === id && event.payload?.comment) {
        setComments((prev) => {
          const exists = prev.some((c) => c.id === event.payload.comment.id);
          if (exists) return prev;
          return [...prev, event.payload.comment];
        });
      }
    },
    onRequestStatusChanged: (event) => {
      if (event.requestId === id) {
        // Refresh history to capture new transition
        api
          .get<{ data: StatusHistory[] }>(`/requests/${id}/history`)
          .then((res) => {
            if (res.data) setHistory(res.data);
          })
          .catch(() => {});
      }
    },
  });

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !newComment.trim()) return;

    setIsSubmittingComment(true);
    try {
      const res = await api.post<{ data: Comment }>(`/requests/${id}/comments`, {
        body: newComment.trim(),
      });

      if (res?.data) {
        setComments((prev) => {
          const exists = prev.some((c) => c.id === res.data.id);
          if (exists) return prev;
          return [...prev, res.data];
        });
      }
      setNewComment('');
      toast.success('Comment posted');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to post comment');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleRetry = async () => {
    if (!id) return;
    setIsRetrying(true);
    try {
      const res = await api.post<{ data: ServiceRequest }>(`/requests/${id}/retry`);
      if (res?.data) {
        setRequest(res.data);
        upsertRequest(res.data);
      }
      toast.success('Request re-enqueued for execution', 'Retried');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to retry request');
    } finally {
      setIsRetrying(false);
    }
  };

  const handleCancel = async () => {
    if (!id) return;
    setIsCancelling(true);
    try {
      const res = await api.post<{ data: ServiceRequest }>(`/requests/${id}/cancel`);
      if (res?.data) {
        setRequest(res.data);
        upsertRequest(res.data);
      } else {
        patchRequest(id, { cancelRequested: true, status: Status.CANCELLED });
        setRequest((prev) => prev ? { ...prev, cancelRequested: true, status: Status.CANCELLED } : null);
      }
      toast.info('Request cancellation processed', 'Cancelled');
      setShowCancelModal(false);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to cancel request');
    } finally {
      setIsCancelling(false);
    }
  };

  if (isLoading && !request) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600 mb-3" />
        <p className="text-sm font-medium text-slate-600">Loading service request details...</p>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 p-8">
        <AlertOctagon className="h-12 w-12 text-rose-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-slate-800">Request Not Found</h2>
        <p className="text-sm text-slate-500 mt-2">The requested service request does not exist or you lack permission to view it.</p>
        <button
          onClick={() => navigate('/')}
          className="mt-5 inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </button>
      </div>
    );
  }

  const isSupervisorOrAdmin = user?.role === Role.SUPERVISOR || user?.role === Role.ADMIN;
  const isOwner = user?.id === request.createdById;
  const canCancel =
    (isOwner || isSupervisorOrAdmin) &&
    request.status !== Status.COMPLETED &&
    request.status !== Status.CANCELLED &&
    !request.cancelRequested;
  const canRetry = isSupervisorOrAdmin && request.status === Status.FAILED;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-3.5 py-2 rounded-xl shadow-xs transition hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Dashboard</span>
        </button>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          {canRetry && (
            <button
              onClick={handleRetry}
              disabled={isRetrying}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-md transition disabled:opacity-50"
            >
              {isRetrying ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RotateCw className="h-4 w-4" />
              )}
              <span>Retry Request</span>
            </button>
          )}

          {canCancel && (
            <button
              onClick={() => setShowCancelModal(true)}
              disabled={isCancelling}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md transition disabled:opacity-50"
            >
              <AlertTriangle className="h-4 w-4" />
              <span>Cancel Request</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Request Header Card */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-6">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-mono text-xl font-bold text-primary-600 bg-primary-50 px-3 py-1 rounded-lg border border-primary-200">
                {request.reference}
              </span>
              <StatusBadge status={request.status} />
              <PriorityBadge priority={request.priority} />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mt-3">{request.title}</h1>
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
              <span>Category: <strong className="text-slate-600 capitalize">{request.category.toLowerCase()}</strong></span>
              <span>•</span>
              <span>Created: {new Date(request.createdAt).toLocaleString()}</span>
              {request.createdBy?.name && (
                <>
                  <span>•</span>
                  <span>Created By: <strong className="text-slate-600">{request.createdBy.name}</strong></span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Large Animated Progress Bar & Current Stage */}
        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Pipeline Stage
              </span>
              <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                {request.currentStage || (request.status === Status.COMPLETED ? 'Finalize' : 'Awaiting Stage')}
              </h3>
            </div>
            <div className="text-right">
              <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
                {request.progress}%
              </span>
            </div>
          </div>

          <ProgressBar
            progress={request.progress}
            status={request.status}
            currentStage={request.currentStage}
            showStages={true}
            size="lg"
          />

          {request.failureReason && (
            <div className="mt-3 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2.5">
              <AlertOctagon className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
              <div>
                <strong>Failure Reason:</strong> {request.failureReason}
              </div>
            </div>
          )}
        </div>

        {/* Description & Customer Information Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
          {/* Left: Description */}
          <div className="md:col-span-2 space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Description
            </h4>
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
              {request.description}
            </div>
          </div>

          {/* Right: Customer Card */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Customer Details
            </h4>
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-3 text-sm">
              <div className="flex items-center gap-2 text-slate-800">
                <User className="h-4 w-4 text-slate-400 shrink-0" />
                <span className="font-semibold">{request.customerName}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600 text-xs">
                <Mail className="h-4 w-4 text-slate-400 shrink-0" />
                <span className="truncate">{request.customerContact}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Status History Timeline & Comments Thread */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status History Timeline */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <HistoryIcon className="h-5 w-5 text-primary-600" />
            <h3 className="font-bold text-slate-900 text-base">Status History Timeline</h3>
          </div>

          {history.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">No status changes recorded yet.</p>
          ) : (
            <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
              {history.map((step, idx) => (
                <div key={step.id || idx} className="relative group">
                  <div className="absolute -left-[27px] top-1 h-3.5 w-3.5 rounded-full bg-primary-600 border-2 border-white ring-4 ring-primary-100" />
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      {step.fromStatus ? (
                        <>
                          <span className="font-semibold text-slate-600">{step.fromStatus}</span>
                          <span className="text-slate-400">&rarr;</span>
                        </>
                      ) : null}
                      <span className="font-bold text-slate-900">{step.toStatus}</span>
                    </div>

                    <div className="text-[11px] text-slate-400">
                      {new Date(step.createdAt).toLocaleString()}
                      {step.changedBy?.name && (
                        <span> • by <strong>{step.changedBy.name}</strong></span>
                      )}
                    </div>

                    {step.note && (
                      <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100 mt-1">
                        {step.note}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Comments Thread */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <MessageSquare className="h-5 w-5 text-primary-600" />
              <h3 className="font-bold text-slate-900 text-base">Comments & Audit Discussion</h3>
            </div>

            <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
              {comments.length === 0 ? (
                <p className="text-xs text-slate-400 py-8 text-center">
                  No comments yet. Start the conversation below.
                </p>
              ) : (
                comments.map((comment) => (
                  <div
                    key={comment.id}
                    className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5"
                  >
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-slate-800">
                        {comment.author?.name || 'Staff Member'}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 whitespace-pre-wrap">{comment.body}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Add Comment Form */}
          <form onSubmit={handleAddComment} className="pt-4 border-t border-slate-100 space-y-2">
            <textarea
              rows={2}
              required
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add an internal comment or status note..."
              className="w-full text-xs p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-slate-50 focus:bg-white transition"
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSubmittingComment || !newComment.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-semibold transition disabled:opacity-50"
              >
                {isSubmittingComment ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                <span>Send Comment</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Cancel Confirmation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-200 p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <div className="h-10 w-10 rounded-full bg-rose-50 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Cancel Request</h3>
            </div>
            <p className="text-sm text-slate-600">
              Are you sure you want to cancel request{' '}
              <strong className="text-slate-900">{request.reference}</strong>? Any running pipeline tasks will be terminated.
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                No, Keep Active
              </button>
              <button
                type="button"
                disabled={isCancelling}
                onClick={handleCancel}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-sm transition disabled:opacity-50"
              >
                {isCancelling ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Cancelling...</span>
                  </>
                ) : (
                  <span>Yes, Cancel Request</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RequestDetailPage;

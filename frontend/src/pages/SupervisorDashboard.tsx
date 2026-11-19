import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  Layers,
  Clock,
  CheckCircle,
  AlertOctagon,
  AlertTriangle,
  RotateCw,
  Search,
  Filter,
  X,
  ExternalLink,
  Flame,
  Loader2,
  TrendingUp,
  Inbox,
  ArrowRight,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useRequestStore } from '../store/requestStore';
import { toast } from '../store/toastStore';
import { api } from '../api/client';
import { ServiceRequest, StatsSummary, Status, Priority, Category } from '../types';
import { StatusBadge, PriorityBadge } from '../components/common/Badge';
import { ProgressBar } from '../components/common/ProgressBar';

export const SupervisorDashboard: React.FC = () => {
  const { user } = useAuthStore();
  const { requests, setRequests, upsertRequest, patchRequest, stats, setStats } = useRequestStore();

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshingStats, setIsRefreshingStats] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [urgentOnly, setUrgentOnly] = useState(false);

  // Track recent changes for animated row highlight
  const [recentlyChanged, setRecentlyChanged] = useState<Record<string, number>>({});
  const prevRequestsRef = useRef<Record<string, ServiceRequest>>({});

  useEffect(() => {
    // Detect changes between old requests and new requests
    const prev = prevRequestsRef.current;
    const now = Date.now();
    const updatedIds: string[] = [];

    Object.values(requests).forEach((req) => {
      const prevReq = prev[req.id];
      if (prevReq && (prevReq.status !== req.status || prevReq.progress !== req.progress)) {
        updatedIds.push(req.id);
      }
    });

    if (updatedIds.length > 0) {
      setRecentlyChanged((curr) => {
        const next = { ...curr };
        updatedIds.forEach((id) => {
          next[id] = now;
        });
        return next;
      });

      // Clear highlights after 2.5 seconds
      const timer = setTimeout(() => {
        setRecentlyChanged((curr) => {
          const next = { ...curr };
          updatedIds.forEach((id) => {
            if (next[id] === now) {
              delete next[id];
            }
          });
          return next;
        });
      }, 2500);

      return () => clearTimeout(timer);
    }

    prevRequestsRef.current = requests;
  }, [requests]);

  // Load requests and stats
  const fetchAllData = async () => {
    try {
      setIsLoading(true);
      const [reqRes, statsRes] = await Promise.all([
        api.get<{ data: ServiceRequest[] }>('/requests', { params: { limit: 100 } }),
        api.get<{ data: StatsSummary }>('/stats').catch(() => null),
      ]);

      if (reqRes?.data) {
        setRequests(reqRes.data);
      }
      if (statsRes?.data) {
        setStats(statsRes.data);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to fetch dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, [setRequests, setStats]);

  const handleRetry = async (requestId: string) => {
    setRetryingId(requestId);
    try {
      const res = await api.post<{ data: ServiceRequest }>(`/requests/${requestId}/retry`);
      if (res?.data) {
        upsertRequest(res.data);
      }
      toast.success('Request re-enqueued for processing', 'Retried');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to retry request');
    } finally {
      setRetryingId(null);
    }
  };

  const handleCancel = async (requestId: string) => {
    setCancellingId(requestId);
    try {
      const res = await api.post<{ data: ServiceRequest }>(`/requests/${requestId}/cancel`);
      if (res?.data) {
        upsertRequest(res.data);
      } else {
        patchRequest(requestId, { cancelRequested: true, status: Status.CANCELLED });
      }
      toast.info('Request cancellation processed', 'Cancelled');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to cancel request');
    } finally {
      setCancellingId(null);
    }
  };

  // Derive stats dynamically from request map if server stats aren't loaded yet
  const computedStats = useMemo(() => {
    const list = Object.values(requests);
    const total = stats?.total ?? list.length;
    const byStatus = stats?.byStatus ?? {};

    const queuedCount =
      byStatus[Status.QUEUED] ??
      list.filter((r) => r.status === Status.QUEUED || r.status === Status.SUBMITTED).length;
    const inProgressCount =
      byStatus[Status.IN_PROGRESS] ?? list.filter((r) => r.status === Status.IN_PROGRESS).length;
    const completedCount =
      byStatus[Status.COMPLETED] ?? list.filter((r) => r.status === Status.COMPLETED).length;
    const failedCount =
      byStatus[Status.FAILED] ?? list.filter((r) => r.status === Status.FAILED).length;

    let avgTimeStr = '0s';
    if (stats?.avgProcessingTimeMs) {
      const ms = stats.avgProcessingTimeMs;
      if (ms < 1000) avgTimeStr = `${ms}ms`;
      else if (ms < 60000) avgTimeStr = `${(ms / 1000).toFixed(1)}s`;
      else avgTimeStr = `${(ms / 60000).toFixed(1)}m`;
    }

    return {
      total,
      queued: queuedCount,
      inProgress: inProgressCount,
      completed: completedCount,
      failed: failedCount,
      avgTime: avgTimeStr,
    };
  }, [requests, stats]);

  // Filter requests
  const filteredRequests = useMemo(() => {
    return Object.values(requests)
      .filter((req) => {
        if (urgentOnly && req.priority !== Priority.URGENT) return false;
        if (statusFilter !== 'ALL' && req.status !== statusFilter) return false;
        if (priorityFilter !== 'ALL' && req.priority !== priorityFilter) return false;
        if (categoryFilter !== 'ALL' && req.category !== categoryFilter) return false;

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchRef = req.reference?.toLowerCase().includes(q);
          const matchTitle = req.title?.toLowerCase().includes(q);
          const matchCustomer = req.customerName?.toLowerCase().includes(q);
          const matchCreator = req.createdBy?.name?.toLowerCase().includes(q);
          return matchRef || matchTitle || matchCustomer || matchCreator;
        }

        return true;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [requests, urgentOnly, statusFilter, priorityFilter, categoryFilter, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Supervisor Console</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-sky-100 text-sky-800 border border-sky-200">
              Live Monitor
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Real-time system throughput, automated pipeline monitoring, and queue control.
          </p>
        </div>

        <button
          onClick={fetchAllData}
          disabled={isLoading}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition active:scale-95"
        >
          <RotateCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* Top Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Total */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total</span>
            <Layers className="h-4 w-4 text-primary-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{computedStats.total}</div>
          <span className="text-[10px] text-slate-400 mt-1">Across all operators</span>
        </div>

        {/* Queued */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Queued</span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-600">{computedStats.queued}</div>
          <span className="text-[10px] text-slate-400 mt-1">Pending pipeline</span>
        </div>

        {/* In Progress */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">In Progress</span>
            <Activity className="h-4 w-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold text-indigo-600">{computedStats.inProgress}</div>
          <span className="text-[10px] text-slate-400 mt-1">Simulating stages</span>
        </div>

        {/* Completed */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Completed</span>
            <CheckCircle className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-600">{computedStats.completed}</div>
          <span className="text-[10px] text-slate-400 mt-1">Successfully fulfilled</span>
        </div>

        {/* Failed */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Failed</span>
            <AlertOctagon className="h-4 w-4 text-rose-600" />
          </div>
          <div className="text-2xl font-bold text-rose-600">{computedStats.failed}</div>
          <span className="text-[10px] text-slate-400 mt-1">Actionable for retry</span>
        </div>

        {/* Avg Processing Time */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Avg Process Time</span>
            <TrendingUp className="h-4 w-4 text-sky-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{computedStats.avgTime}</div>
          <span className="text-[10px] text-slate-400 mt-1">End-to-end duration</span>
        </div>
      </div>

      {/* Requests Table Card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        {/* Search, Urgent toggle and Dropdowns */}
        <div className="flex flex-col lg:flex-row gap-3 items-center justify-between">
          <div className="relative w-full lg:w-80">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search reference, customer, or title..."
              className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2 w-full lg:w-auto items-center">
            {/* Urgent toggle filter */}
            <button
              onClick={() => setUrgentOnly(!urgentOnly)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                urgentOnly
                  ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-rose-300 hover:bg-rose-50/50'
              }`}
            >
              <Flame className={`h-3.5 w-3.5 ${urgentOnly ? 'text-white' : 'text-rose-500'}`} />
              Urgent Only
            </button>

            {/* Status */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:bg-white focus:ring-2 focus:ring-primary-500"
            >
              <option value="ALL">All Statuses</option>
              {Object.values(Status).map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, ' ')}
                </option>
              ))}
            </select>

            {/* Priority */}
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:bg-white focus:ring-2 focus:ring-primary-500"
            >
              <option value="ALL">All Priorities</option>
              {Object.values(Priority).map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>

            {/* Category */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:bg-white focus:ring-2 focus:ring-primary-500"
            >
              <option value="ALL">All Categories</option>
              {Object.values(Category).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            {(statusFilter !== 'ALL' || priorityFilter !== 'ALL' || categoryFilter !== 'ALL' || urgentOnly || searchQuery) && (
              <button
                onClick={() => {
                  setStatusFilter('ALL');
                  setPriorityFilter('ALL');
                  setCategoryFilter('ALL');
                  setUrgentOnly(false);
                  setSearchQuery('');
                }}
                className="text-xs text-primary-600 hover:text-primary-800 font-medium px-2 py-1.5"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Requests Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 font-medium text-xs uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Ref</th>
                <th className="py-3.5 px-4">Title & Category</th>
                <th className="py-3.5 px-4">Customer</th>
                <th className="py-3.5 px-4">Priority</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 min-w-[200px]">Pipeline Stage</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="py-4 px-4"><div className="h-4 bg-slate-200 rounded w-20" /></td>
                    <td className="py-4 px-4"><div className="h-4 bg-slate-200 rounded w-44 mb-1" /><div className="h-3 bg-slate-100 rounded w-24" /></td>
                    <td className="py-4 px-4"><div className="h-4 bg-slate-200 rounded w-28" /></td>
                    <td className="py-4 px-4"><div className="h-5 bg-slate-200 rounded w-16" /></td>
                    <td className="py-4 px-4"><div className="h-5 bg-slate-200 rounded w-20" /></td>
                    <td className="py-4 px-4"><div className="h-2 bg-slate-200 rounded-full w-full" /></td>
                    <td className="py-4 px-4 text-right"><div className="h-7 bg-slate-200 rounded w-20 ml-auto" /></td>
                  </tr>
                ))
              ) : filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center">
                      <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                        <Inbox className="h-6 w-6" />
                      </div>
                      <p className="text-base font-semibold text-slate-700">No matching requests</p>
                      <p className="text-xs text-slate-400 mt-1">Try adjusting your filters or search terms.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRequests.map((req) => {
                  const isHighlighted = !!recentlyChanged[req.id];
                  const canCancel =
                    req.status !== Status.COMPLETED &&
                    req.status !== Status.CANCELLED &&
                    !req.cancelRequested;
                  const canRetry = req.status === Status.FAILED;

                  return (
                    <tr
                      key={req.id}
                      className={`transition-colors duration-500 group ${
                        isHighlighted
                          ? 'bg-amber-50 ring-2 ring-amber-300 ring-inset'
                          : 'hover:bg-slate-50/80'
                      }`}
                    >
                      <td className="py-3.5 px-4 font-mono font-medium text-primary-600">
                        <Link
                          to={`/requests/${req.id}`}
                          className="hover:underline flex items-center gap-1"
                        >
                          {req.reference}
                          <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition" />
                        </Link>
                      </td>

                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="font-medium text-slate-900 truncate" title={req.title}>
                          {req.title}
                        </div>
                        <div className="text-xs text-slate-400 capitalize">
                          {req.category.toLowerCase()}
                          {req.createdBy?.name && ` • by ${req.createdBy.name}`}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-800">{req.customerName}</div>
                        <div className="text-xs text-slate-400">{req.customerContact}</div>
                      </td>

                      <td className="py-3.5 px-4">
                        <PriorityBadge priority={req.priority} />
                      </td>

                      <td className="py-3.5 px-4">
                        <StatusBadge status={req.status} />
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px] text-slate-500 font-medium">
                            <span>Stage: <strong className="text-slate-800">{req.currentStage || (req.status === Status.COMPLETED ? 'Finalize' : 'Waiting')}</strong></span>
                            <span>{req.progress}%</span>
                          </div>
                          <ProgressBar
                            progress={req.progress}
                            status={req.status}
                            currentStage={req.currentStage}
                            showStages={false}
                            size="sm"
                          />
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                        <Link
                          to={`/requests/${req.id}`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg transition"
                        >
                          Details
                        </Link>

                        {canRetry && (
                          <button
                            onClick={() => handleRetry(req.id)}
                            disabled={retryingId === req.id}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 px-2.5 py-1.5 rounded-lg transition disabled:opacity-50"
                          >
                            {retryingId === req.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <RotateCw className="h-3.5 w-3.5" />
                            )}
                            Retry
                          </button>
                        )}

                        {canCancel && (
                          <button
                            onClick={() => handleCancel(req.id)}
                            disabled={cancellingId === req.id}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-2.5 py-1.5 rounded-lg transition disabled:opacity-50"
                          >
                            {cancellingId === req.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : null}
                            Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SupervisorDashboard;

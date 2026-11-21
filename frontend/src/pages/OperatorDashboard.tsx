import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus,
  Search,
  Filter,
  X,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Clock,
  ExternalLink,
  ChevronRight,
  Send,
  Loader2,
  Inbox,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useRequestStore } from '../store/requestStore';
import { toast } from '../store/toastStore';
import { api } from '../api/client';
import { ServiceRequest, Status, Priority, Category } from '../types';
import { StatusBadge, PriorityBadge } from '../components/common/Badge';
import { ProgressBar } from '../components/common/ProgressBar';

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const OperatorDashboard: React.FC = () => {
  const { user } = useAuthStore();
  const { requests, setRequests, upsertRequest, patchRequest } = useRequestStore();

  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<ServiceRequest | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<Category>(Category.TECHNICAL);
  const [priority, setPriority] = useState<Priority>(Priority.MEDIUM);
  const [customerName, setCustomerName] = useState('');
  const [customerContact, setCustomerContact] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Fetch operator's requests on mount
  useEffect(() => {
    let isMounted = true;
    async function loadRequests() {
      try {
        setIsLoading(true);
        const res = await api.get<{ data: ServiceRequest[] }>('/requests', {
          params: { limit: 100 },
        });
        if (isMounted && res.data) {
          setRequests(res.data);
        }
      } catch (err: any) {
        toast.error(err?.message || 'Failed to load requests');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadRequests();
    return () => {
      isMounted = false;
    };
  }, [setRequests]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!title.trim() || !description.trim() || !customerName.trim() || !customerContact.trim()) {
      setFormError('Please fill in all required fields.');
      return;
    }

    setIsSubmitting(true);
    const idempotencyKey = generateUUID();

    try {
      const response = await api.post<{ data: ServiceRequest }>(
        '/requests',
        {
          title: title.trim(),
          description: description.trim(),
          category,
          priority,
          customerName: customerName.trim(),
          customerContact: customerContact.trim(),
        },
        {
          idempotencyKey,
        }
      );

      const created = response.data;
      upsertRequest(created);
      toast.success(`Request ${created.reference} created successfully!`, 'Created');

      // Reset form
      setTitle('');
      setDescription('');
      setCategory(Category.TECHNICAL);
      setPriority(Priority.MEDIUM);
      setCustomerName('');
      setCustomerContact('');
      setShowCreateModal(false);
    } catch (err: any) {
      setFormError(err?.message || 'Failed to create service request.');
      toast.error(err?.message || 'Failed to create service request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancelTarget) return;

    setIsCancelling(true);
    try {
      const response = await api.post<{ data: ServiceRequest }>(`/requests/${cancelTarget.id}/cancel`);
      if (response.data) {
        upsertRequest(response.data);
      } else {
        patchRequest(cancelTarget.id, { cancelRequested: true, status: Status.CANCELLED });
      }
      toast.info(`Request ${cancelTarget.reference} cancellation submitted.`, 'Cancelled');
      setCancelTarget(null);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to cancel request');
    } finally {
      setIsCancelling(false);
    }
  };

  // Filter requests belonging to this operator (or all returned)
  const filteredRequests = useMemo(() => {
    const list = Object.values(requests).filter((req) => {
      if (user?.id && req.createdById && req.createdById !== user.id) {
        return false;
      }

      if (statusFilter !== 'ALL' && req.status !== statusFilter) return false;
      if (priorityFilter !== 'ALL' && req.priority !== priorityFilter) return false;
      if (categoryFilter !== 'ALL' && req.category !== categoryFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesRef = req.reference?.toLowerCase().includes(q);
        const matchesTitle = req.title?.toLowerCase().includes(q);
        const matchesCustomer = req.customerName?.toLowerCase().includes(q);
        const matchesContact = req.customerContact?.toLowerCase().includes(q);
        return matchesRef || matchesTitle || matchesCustomer || matchesContact;
      }

      return true;
    });

    // Sort descending by created date
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [requests, user, statusFilter, priorityFilter, categoryFilter, searchQuery]);

  return (
    <div className="space-y-4">
      {/* Top Banner / Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-1">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Operator Dashboard</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Submit, track, and manage your dispatched service requests in real time.
          </p>
        </div>
        <Link
          to="/requests/new"
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-primary-600 hover:bg-primary-700 text-white font-semibold text-xs rounded-lg shadow-2xs transition active:scale-95"
        >
          <Plus className="h-4 w-4" />
          <span>New Service Request</span>
        </Link>
      </div>

      {/* Main Section: Search, Filters & Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-3 sm:px-4 bg-white border-b border-slate-200/80 flex flex-col md:flex-row gap-2.5 items-stretch md:items-center justify-between">
          {/* Search Box */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search reference, title, or customer..."
              className="w-full pl-9 pr-7 py-1.5 text-xs bg-slate-50/70 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-primary-500 focus:border-primary-500 transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Dropdown Filters */}
          <div className="flex flex-wrap gap-2 items-center">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:ring-1 focus:ring-primary-500 font-medium"
            >
              <option value="ALL">All Statuses</option>
              {Object.values(Status).map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, ' ')}
                </option>
              ))}
            </select>

            {/* Priority Filter */}
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:ring-1 focus:ring-primary-500 font-medium"
            >
              <option value="ALL">All Priorities</option>
              {Object.values(Priority).map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>

            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:ring-1 focus:ring-primary-500 font-medium"
            >
              <option value="ALL">All Categories</option>
              {Object.values(Category).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            {(statusFilter !== 'ALL' || priorityFilter !== 'ALL' || categoryFilter !== 'ALL' || searchQuery) && (
              <button
                onClick={() => {
                  setStatusFilter('ALL');
                  setPriorityFilter('ALL');
                  setCategoryFilter('ALL');
                  setSearchQuery('');
                }}
                className="text-xs text-primary-600 hover:text-primary-800 font-semibold px-2 py-1 transition"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Table of Requests */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200/80 text-left text-xs">
            <thead className="bg-slate-50/80 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-2.5 px-3.5">Reference</th>
                <th className="py-2.5 px-3.5">Title</th>
                <th className="py-2.5 px-3.5">Customer</th>
                <th className="py-2.5 px-3.5">Priority</th>
                <th className="py-2.5 px-3.5">Status</th>
                <th className="py-2.5 px-3.5 min-w-[170px]">Progress</th>
                <th className="py-2.5 px-3.5">Created At</th>
                <th className="py-2.5 px-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {isLoading ? (
                // Skeleton loading state
                Array.from({ length: 4 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="py-3 px-3.5"><div className="h-4 bg-slate-100 rounded w-16" /></td>
                    <td className="py-3 px-3.5"><div className="h-4 bg-slate-100 rounded w-44 mb-1" /><div className="h-3 bg-slate-50 rounded w-24" /></td>
                    <td className="py-3 px-3.5"><div className="h-4 bg-slate-100 rounded w-28" /></td>
                    <td className="py-3 px-3.5"><div className="h-4 bg-slate-100 rounded w-14" /></td>
                    <td className="py-3 px-3.5"><div className="h-4 bg-slate-100 rounded w-20" /></td>
                    <td className="py-3 px-3.5"><div className="h-2 bg-slate-100 rounded-full w-full" /></td>
                    <td className="py-3 px-3.5"><div className="h-4 bg-slate-100 rounded w-24" /></td>
                    <td className="py-3 px-3.5 text-right"><div className="h-6 bg-slate-100 rounded w-14 ml-auto" /></td>
                  </tr>
                ))
              ) : filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center">
                      <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-2">
                        <Inbox className="h-5 w-5" />
                      </div>
                      <p className="text-sm font-semibold text-slate-700">No service requests yet</p>
                      <p className="text-xs text-slate-400 mt-0.5 max-w-sm">
                        {searchQuery || statusFilter !== 'ALL'
                          ? 'No requests match your current filters. Try clearing search criteria.'
                          : 'Get started by creating your first service request.'}
                      </p>
                      <button
                        onClick={() => setShowCreateModal(true)}
                        className="mt-3.5 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition"
                      >
                        Create Request
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRequests.map((req) => {
                  const canCancel =
                    req.status !== Status.COMPLETED &&
                    req.status !== Status.CANCELLED &&
                    !req.cancelRequested;

                  return (
                    <tr
                      key={req.id}
                      className="hover:bg-slate-50/70 transition-colors group"
                    >
                      <td className="py-2.5 px-3.5 whitespace-nowrap">
                        <Link
                          to={`/requests/${req.id}`}
                          className="font-mono font-semibold text-slate-800 hover:text-primary-600 bg-slate-100 hover:bg-primary-50 px-2 py-0.5 rounded border border-slate-200/80 hover:border-primary-200 inline-flex items-center gap-1 transition"
                        >
                          {req.reference}
                          <ExternalLink className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 transition text-primary-500" />
                        </Link>
                      </td>
                      <td className="py-2.5 px-3.5 max-w-xs">
                        <div className="font-semibold text-slate-900 truncate" title={req.title}>
                          {req.title}
                        </div>
                        <div className="text-[11px] text-slate-500 capitalize mt-0.5">{req.category.toLowerCase()}</div>
                      </td>
                      <td className="py-2.5 px-3.5 whitespace-nowrap">
                        <div className="font-semibold text-slate-800">{req.customerName}</div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">{req.customerContact}</div>
                      </td>
                      <td className="py-2.5 px-3.5 whitespace-nowrap">
                        <PriorityBadge priority={req.priority} />
                      </td>
                      <td className="py-2.5 px-3.5 whitespace-nowrap">
                        <StatusBadge status={req.status} />
                      </td>
                      <td className="py-2.5 px-3.5 min-w-[170px]">
                        <div className="flex flex-col gap-1">
                          <div className="flex justify-between text-[11px] font-medium text-slate-600">
                            <span>Stage: <strong className="text-slate-900">{req.currentStage || 'Pending'}</strong></span>
                            <span className="font-mono text-slate-700 font-semibold">{req.progress}%</span>
                          </div>
                          <ProgressBar progress={req.progress} status={req.status} size="sm" />
                        </div>
                      </td>
                      <td className="py-2.5 px-3.5 text-xs text-slate-500 whitespace-nowrap font-mono">
                        {new Date(req.createdAt).toLocaleDateString()} {new Date(req.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-2.5 px-3.5 text-right space-x-1.5 whitespace-nowrap">
                        <Link
                          to={`/requests/${req.id}`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-md transition shadow-2xs"
                        >
                          View
                        </Link>
                        {canCancel && (
                          <button
                            onClick={() => setCancelTarget(req)}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2 py-1 rounded-md transition"
                          >
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

        {/* Table footer count */}
        <div className="px-4 py-2.5 bg-slate-50/60 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-500">
          <span>
            Showing <strong className="text-slate-800">{filteredRequests.length}</strong> service requests
          </span>
          <span className="text-[11px] text-slate-400">Real-time updates enabled</span>
        </div>
      </div>

      {/* New Service Request Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white w-full max-w-lg rounded-xl shadow-xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center px-5 py-3.5 border-b border-slate-200/80 bg-slate-50/80">
              <h3 className="font-bold text-slate-900 text-sm">Create Service Request</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-200/50 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-5 space-y-3.5">
              {formError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Request Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Database connectivity timeout in region eu-west"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full text-xs px-3 py-1.5 border border-slate-200 rounded-lg focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Provide comprehensive details regarding the issue or work required..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full text-xs px-3 py-1.5 border border-slate-200 rounded-lg focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as Category)}
                    className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-primary-500"
                  >
                    {Object.values(Category).map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as Priority)}
                    className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-primary-500"
                  >
                    {Object.values(Priority).map((pri) => (
                      <option key={pri} value={pri}>
                        {pri}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Customer Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. John Doe or Acme Corp"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full text-xs px-3 py-1.5 border border-slate-200 rounded-lg focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Customer Contact <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. customer@acme.com or +1-555-0199"
                    value={customerContact}
                    onChange={(e) => setCustomerContact(e.target.value)}
                    className="w-full text-xs px-3 py-1.5 border border-slate-200 rounded-lg focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg shadow-2xs transition disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5" />
                      <span>Submit Request</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {cancelTarget && (
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
              <strong className="text-slate-900">{cancelTarget.reference}</strong> ({cancelTarget.title})?
              This action will abort processing.
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setCancelTarget(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Keep Active
              </button>
              <button
                type="button"
                disabled={isCancelling}
                onClick={handleConfirmCancel}
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

export default OperatorDashboard;

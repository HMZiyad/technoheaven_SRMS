import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Send,
  Loader2,
  Sparkles,
  AlertTriangle,
  User,
  Mail,
  FileText,
  Tag,
  Flame,
} from 'lucide-react';
import { api } from '../api/client';
import { useRequestStore } from '../store/requestStore';
import { toast } from '../store/toastStore';
import { ServiceRequest, Category, Priority } from '../types';
import { PriorityBadge } from '../components/common/Badge';

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

const SAMPLE_TEMPLATES = [
  {
    title: 'VPN gateway timeout for regional remote team',
    description: 'Multiple users in the APAC region report connection timeouts when attempting to access internal staging databases through the VPN tunnel.',
    category: Category.TECHNICAL,
    priority: Priority.URGENT,
    customerName: 'Acme Global Operations',
    customerContact: 'ops@acmeglobal.com',
  },
  {
    title: 'Invoice discrepancy for Enterprise annual tier',
    description: 'Customer was billed twice for the annual support tier add-on. Requires immediate ledger reconciliation and credit memo issuance.',
    category: Category.BILLING,
    priority: Priority.HIGH,
    customerName: 'TechCorp Solutions',
    customerContact: 'finance@techcorp.io',
  },
  {
    title: 'Urgent SSL certificate renewal failure',
    description: 'Automated cert renewal failed on secondary ingress endpoint. Wildcard certificate expires in under 48 hours.',
    category: Category.EMERGENCY,
    priority: Priority.URGENT,
    customerName: 'CloudScale Infrastructure',
    customerContact: 'sre-alerts@cloudscale.net',
  },
];

export const NewRequestPage: React.FC = () => {
  const navigate = useNavigate();
  const { upsertRequest } = useRequestStore();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<Category>(Category.TECHNICAL);
  const [priority, setPriority] = useState<Priority>(Priority.MEDIUM);
  const [customerName, setCustomerName] = useState('');
  const [customerContact, setCustomerContact] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleApplyTemplate = (idx: number) => {
    const tmpl = SAMPLE_TEMPLATES[idx];
    if (tmpl) {
      setTitle(tmpl.title);
      setDescription(tmpl.description);
      setCategory(tmpl.category);
      setPriority(tmpl.priority);
      setCustomerName(tmpl.customerName);
      setCustomerContact(tmpl.customerContact);
      setFormError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!title.trim() || !description.trim() || !customerName.trim() || !customerContact.trim()) {
      setFormError('Please complete all required fields marked with *');
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
      toast.success(`Request ${created.reference} created successfully!`, 'Request Dispatched');
      navigate(`/requests/${created.id}`);
    } catch (err: any) {
      setFormError(err?.message || 'Failed to dispatch service request.');
      toast.error(err?.message || 'Failed to dispatch service request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Top Breadcrumb & Quick Nav */}
      <div className="flex items-center justify-between pb-1">
        <Link
          to="/requests"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-2xs transition hover:bg-slate-50"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Requests</span>
        </Link>

        {/* Quick Template Picker */}
        <div className="hidden sm:flex items-center gap-1.5 text-xs">
          <span className="text-slate-400 font-medium flex items-center gap-1">
            <Sparkles className="h-3.5 w-3.5 text-primary-500" />
            Quick fill:
          </span>
          <button
            type="button"
            onClick={() => handleApplyTemplate(0)}
            className="px-2 py-1 bg-white hover:bg-slate-50 border border-slate-200 rounded text-slate-700 font-medium text-[11px] transition"
          >
            VPN Outage
          </button>
          <button
            type="button"
            onClick={() => handleApplyTemplate(1)}
            className="px-2 py-1 bg-white hover:bg-slate-50 border border-slate-200 rounded text-slate-700 font-medium text-[11px] transition"
          >
            Invoice Issue
          </button>
          <button
            type="button"
            onClick={() => handleApplyTemplate(2)}
            className="px-2 py-1 bg-white hover:bg-slate-50 border border-slate-200 rounded text-slate-700 font-medium text-[11px] transition"
          >
            SSL Emergency
          </button>
        </div>
      </div>

      {/* Main Form Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:px-6 bg-white border-b border-slate-200/80">
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">New Service Request</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Submit a customer issue or operational ticket into the real-time processing pipeline.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{formError}</span>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Request Title <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                required
                maxLength={120}
                placeholder="e.g. Database connectivity timeout in region eu-west"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-primary-500 focus:border-primary-500 bg-slate-50/50 focus:bg-white transition"
              />
              <span className="absolute right-2.5 top-2.5 text-[10px] text-slate-400">
                {title.length}/120
              </span>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Issue Description <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={4}
              placeholder="Provide complete diagnostic details, steps to reproduce, or instructions for the fulfillment engineer..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-primary-500 focus:border-primary-500 bg-slate-50/50 focus:bg-white transition leading-relaxed"
            />
          </div>

          {/* Category & Priority Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            {/* Category */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5 text-slate-400" />
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
                className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-primary-500 font-medium"
              >
                {Object.values(Category).map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Priority */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Flame className="h-3.5 w-3.5 text-slate-400" />
                  Priority
                </label>
                <PriorityBadge priority={priority} />
              </div>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-primary-500 font-medium"
              >
                {Object.values(Priority).map((pri) => (
                  <option key={pri} value={pri}>
                    {pri}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Customer Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 border-t border-slate-100">
            {/* Customer Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-slate-400" />
                Customer / Organization Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Ziyad or Acme Enterprise"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-primary-500 focus:border-primary-500 bg-slate-50/50 focus:bg-white transition"
              />
            </div>

            {/* Customer Contact */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-slate-400" />
                Customer Contact (Email / Phone) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. customer@example.com or 01718700120"
                value={customerContact}
                onChange={(e) => setCustomerContact(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-primary-500 focus:border-primary-500 bg-slate-50/50 focus:bg-white transition"
              />
            </div>
          </div>

          {/* Action Footer */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">
              Assigned automatically based on category routing.
            </span>
            <div className="flex items-center gap-2">
              <Link
                to="/requests"
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg shadow-2xs transition active:scale-95 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Submitting Request...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    <span>Submit & Dispatch</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewRequestPage;

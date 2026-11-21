import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart3,
  Flame,
  User,
  RotateCw,
  Clock,
  CheckCircle2,
  AlertOctagon,
  Layers,
  ArrowUpRight,
  TrendingUp,
  Inbox,
  Activity,
  Tag,
  ShieldAlert,
  Award,
} from 'lucide-react';
import { api } from '../api/client';
import { useRequestStore } from '../store/requestStore';
import { ServiceRequest, Priority, Status, Category, StatsSummary } from '../types';
import { PriorityBadge, StatusBadge } from '../components/common/Badge';

export const AnalyticsPage: React.FC = () => {
  const { requests, setRequests } = useRequestStore();
  const [statsData, setStatsData] = useState<StatsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch all requests and stats
  const fetchAnalytics = async () => {
    try {
      setIsLoading(true);
      const [reqRes, statsRes] = await Promise.all([
        api.get<{ data: ServiceRequest[] }>('/requests', { params: { limit: 200 } }),
        api.get<{ data: StatsSummary }>('/stats').catch(() => null),
      ]);

      if (reqRes?.data) {
        setRequests(reqRes.data);
      }
      if (statsRes?.data) {
        setStatsData(statsRes.data);
      }
    } catch {
      // Handled gracefully with fallback to local store requests
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [setRequests]);

  const requestList = useMemo(() => Object.values(requests), [requests]);
  const totalCount = requestList.length;

  // 1. Priority Breakdown & Most Frequent Priority
  const priorityAnalytics = useMemo(() => {
    const counts: Record<string, { total: number; completed: number; active: number }> = {
      [Priority.URGENT]: { total: 0, completed: 0, active: 0 },
      [Priority.HIGH]: { total: 0, completed: 0, active: 0 },
      [Priority.MEDIUM]: { total: 0, completed: 0, active: 0 },
      [Priority.LOW]: { total: 0, completed: 0, active: 0 },
    };

    requestList.forEach((req) => {
      const p = req.priority || Priority.MEDIUM;
      if (!counts[p]) {
        counts[p] = { total: 0, completed: 0, active: 0 };
      }
      counts[p].total += 1;
      if (req.status === Status.COMPLETED) {
        counts[p].completed += 1;
      } else {
        counts[p].active += 1;
      }
    });

    const entries = Object.entries(counts).map(([priority, data]) => ({
      priority,
      count: data.total,
      completed: data.completed,
      active: data.active,
      percentage: totalCount > 0 ? Math.round((data.total / totalCount) * 100) : 0,
    }));

    // Sort descending by count
    entries.sort((a, b) => b.count - a.count);

    const mostPrevalent = entries.length > 0 && entries[0].count > 0 ? entries[0] : null;

    return {
      items: entries,
      mostPrevalent,
    };
  }, [requestList, totalCount]);

  // 2. Customer Demand Leaderboard ("Who asks for more service requests")
  const customerLeaderboard = useMemo(() => {
    const map: Record<
      string,
      {
        name: string;
        contact: string;
        count: number;
        completed: number;
        categories: Record<string, number>;
        lastRequestDate: string;
      }
    > = {};

    requestList.forEach((req) => {
      const name = req.customerName?.trim() || 'Unknown Customer';
      const key = name.toLowerCase();

      if (!map[key]) {
        map[key] = {
          name,
          contact: req.customerContact || 'N/A',
          count: 0,
          completed: 0,
          categories: {},
          lastRequestDate: req.createdAt,
        };
      }

      map[key].count += 1;
      if (req.status === Status.COMPLETED) {
        map[key].completed += 1;
      }

      const cat = req.category || 'GENERAL';
      map[key].categories[cat] = (map[key].categories[cat] || 0) + 1;

      if (new Date(req.createdAt) > new Date(map[key].lastRequestDate)) {
        map[key].lastRequestDate = req.createdAt;
      }
    });

    const list = Object.values(map).map((item) => {
      // Determine top category for customer
      let topCategory = 'Technical';
      let maxCatCount = 0;
      Object.entries(item.categories).forEach(([cat, c]) => {
        if (c > maxCatCount) {
          maxCatCount = c;
          topCategory = cat;
        }
      });

      return {
        ...item,
        topCategory,
        percentage: totalCount > 0 ? Math.round((item.count / totalCount) * 100) : 0,
      };
    });

    // Sort descending by request count
    list.sort((a, b) => b.count - a.count);

    const topRequester = list.length > 0 && list[0].count > 0 ? list[0] : null;

    return {
      list,
      topRequester,
    };
  }, [requestList, totalCount]);

  // 3. Category Breakdown
  const categoryAnalytics = useMemo(() => {
    const map: Record<string, number> = {};
    requestList.forEach((req) => {
      const c = req.category || Category.GENERAL;
      map[c] = (map[c] || 0) + 1;
    });

    const list = Object.entries(map).map(([category, count]) => ({
      category,
      count,
      percentage: totalCount > 0 ? Math.round((count / totalCount) * 100) : 0,
    }));

    list.sort((a, b) => b.count - a.count);
    return list;
  }, [requestList, totalCount]);

  // 4. Status Performance Metrics
  const statusMetrics = useMemo(() => {
    const completed = requestList.filter((r) => r.status === Status.COMPLETED).length;
    const inProgress = requestList.filter((r) => r.status === Status.IN_PROGRESS).length;
    const queued = requestList.filter(
      (r) => r.status === Status.QUEUED || r.status === Status.SUBMITTED
    ).length;
    const failed = requestList.filter((r) => r.status === Status.FAILED).length;
    const cancelled = requestList.filter((r) => r.status === Status.CANCELLED).length;

    const completionRate = totalCount > 0 ? Math.round((completed / totalCount) * 100) : 0;

    let avgTimeStr = '0s';
    if (statsData?.avgProcessingTimeMs) {
      const ms = statsData.avgProcessingTimeMs;
      if (ms < 1000) avgTimeStr = `${ms}ms`;
      else if (ms < 60000) avgTimeStr = `${(ms / 1000).toFixed(1)}s`;
      else avgTimeStr = `${(ms / 60000).toFixed(1)}m`;
    }

    return {
      completed,
      inProgress,
      queued,
      failed,
      cancelled,
      completionRate,
      avgTimeStr,
    };
  }, [requestList, totalCount, statsData]);

  // 5. Staff / Creator Breakdown
  const staffActivity = useMemo(() => {
    const map: Record<string, { name: string; email: string; count: number }> = {};
    requestList.forEach((req) => {
      const creator = req.createdBy;
      if (creator) {
        if (!map[creator.id]) {
          map[creator.id] = { name: creator.name, email: creator.email, count: 0 };
        }
        map[creator.id].count += 1;
      }
    });

    const list = Object.values(map);
    list.sort((a, b) => b.count - a.count);
    return list;
  }, [requestList]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-1">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">System Analytics & Demand Insights</h1>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/90">
              <BarChart3 className="h-3 w-3" />
              Live Telemetry
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time workload distribution, priority prevalence, customer demand, and fulfillment throughput.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchAnalytics}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-2xs transition active:scale-95 disabled:opacity-60"
          >
            <RotateCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin text-primary-600' : 'text-slate-500'}`} />
            <span>Refresh Analytics</span>
          </button>
        </div>
      </div>

      {/* Top Level Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Total Volume */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Requests</span>
            <Layers className="h-3.5 w-3.5 text-slate-400" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-slate-900">{totalCount}</div>
          <span className="text-[10px] text-slate-400 font-medium">Logged in system</span>
        </div>

        {/* Completion Rate */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Completion Rate</span>
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-emerald-600">
            {statusMetrics.completionRate}%
          </div>
          <span className="text-[10px] text-slate-400 font-medium">
            {statusMetrics.completed} of {totalCount} completed
          </span>
        </div>

        {/* Top Priority */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600">Top Priority</span>
            <Flame className="h-3.5 w-3.5 text-rose-500" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-rose-600 flex items-center gap-1.5">
            {priorityAnalytics.mostPrevalent ? priorityAnalytics.mostPrevalent.priority : 'N/A'}
          </div>
          <span className="text-[10px] text-slate-500 font-medium">
            {priorityAnalytics.mostPrevalent
              ? `${priorityAnalytics.mostPrevalent.percentage}% of all tickets`
              : 'No priority recorded'}
          </span>
        </div>

        {/* Top Requester */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">Top Requester</span>
            <Award className="h-3.5 w-3.5 text-indigo-500" />
          </div>
          <div className="text-lg font-bold tracking-tight text-slate-900 truncate" title={customerLeaderboard.topRequester?.name}>
            {customerLeaderboard.topRequester?.name || 'N/A'}
          </div>
          <span className="text-[10px] text-slate-500 font-medium">
            {customerLeaderboard.topRequester
              ? `${customerLeaderboard.topRequester.count} requests (${customerLeaderboard.topRequester.percentage}%)`
              : 'No requests'}
          </span>
        </div>
      </div>

      {/* Section 1: WHICH PRIORITY IS THE MOST (Detailed Breakdown & Workload Analysis) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 bg-white border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Flame className="h-4 w-4 text-rose-500" />
              Priority Distribution & Workload Prevalence
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Breakdown of incoming requests by operational priority tier to identify urgency hot spots.
            </p>
          </div>

          {priorityAnalytics.mostPrevalent && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-rose-50 border border-rose-200 rounded-lg text-xs font-semibold text-rose-800">
              <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping" />
              <span>
                <strong>{priorityAnalytics.mostPrevalent.priority}</strong> is the most common priority (
                {priorityAnalytics.mostPrevalent.count} requests · {priorityAnalytics.mostPrevalent.percentage}%)
              </span>
            </div>
          )}
        </div>

        {/* Visual Stacked Distribution Bar */}
        <div className="p-4 bg-slate-50/50 border-b border-slate-100">
          <div className="h-4 w-full bg-slate-200 rounded-full overflow-hidden flex shadow-inner">
            {priorityAnalytics.items.map((item) => {
              if (item.count === 0) return null;
              const color =
                item.priority === Priority.URGENT
                  ? 'bg-rose-500'
                  : item.priority === Priority.HIGH
                  ? 'bg-orange-500'
                  : item.priority === Priority.MEDIUM
                  ? 'bg-amber-400'
                  : 'bg-slate-400';
              return (
                <div
                  key={item.priority}
                  style={{ width: `${item.percentage}%` }}
                  title={`${item.priority}: ${item.count} (${item.percentage}%)`}
                  className={`${color} h-full transition-all duration-300 relative group`}
                />
              );
            })}
          </div>
          <div className="flex flex-wrap items-center justify-between mt-2 text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5 font-medium">
              <span className="h-2 w-2 rounded-full bg-rose-500" /> Urgent
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <span className="h-2 w-2 rounded-full bg-orange-500" /> High
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <span className="h-2 w-2 rounded-full bg-amber-400" /> Medium
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <span className="h-2 w-2 rounded-full bg-slate-400" /> Low
            </span>
          </div>
        </div>

        {/* Priority Grid Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 bg-white">
          {priorityAnalytics.items.map((item) => {
            const isTop = item.priority === priorityAnalytics.mostPrevalent?.priority && item.count > 0;
            return (
              <div
                key={item.priority}
                className={`p-4 flex flex-col justify-between ${isTop ? 'bg-rose-50/20' : ''}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <PriorityBadge priority={item.priority} />
                  {isTop && (
                    <span className="text-[10px] font-bold text-rose-700 bg-rose-100/80 px-1.5 py-0.5 rounded uppercase">
                      Most Active
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-slate-900 tracking-tight font-mono">
                      {item.count}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">
                      ({item.percentage}% of total)
                    </span>
                  </div>

                  {/* Micro Progress Bar */}
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden mt-2">
                    <div
                      className={`h-full rounded-full ${
                        item.priority === Priority.URGENT
                          ? 'bg-rose-500'
                          : item.priority === Priority.HIGH
                          ? 'bg-orange-500'
                          : item.priority === Priority.MEDIUM
                          ? 'bg-amber-400'
                          : 'bg-slate-400'
                      }`}
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                </div>

                <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Completed: <strong className="text-slate-800">{item.completed}</strong></span>
                  <span>Active: <strong className="text-slate-800">{item.active}</strong></span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 2: WHO ASKS FOR MORE SERVICE REQUESTS (Customer Leaderboard) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left 2 Cols: Customer Demand Leaderboard */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-4 bg-white border-b border-slate-200/80 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <User className="h-4 w-4 text-indigo-500" />
                Customer Request Leaderboard (Who Requests Most)
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Ranked breakdown of organizations and customers generating the highest ticket volume.
              </p>
            </div>
            <span className="text-xs font-semibold text-slate-500">
              {customerLeaderboard.list.length} Customers
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-left text-xs">
              <thead className="bg-slate-50/70 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-2.5 px-4 w-12 text-center">Rank</th>
                  <th className="py-2.5 px-4">Customer</th>
                  <th className="py-2.5 px-4">Total Requests</th>
                  <th className="py-2.5 px-4">% Share</th>
                  <th className="py-2.5 px-4">Top Category</th>
                  <th className="py-2.5 px-4 text-right">Completed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {customerLeaderboard.list.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No customer data available yet.
                    </td>
                  </tr>
                ) : (
                  customerLeaderboard.list.map((cust, idx) => {
                    const isTop1 = idx === 0 && cust.count > 0;
                    return (
                      <tr
                        key={cust.name}
                        className={`transition hover:bg-slate-50/70 ${
                          isTop1 ? 'bg-indigo-50/30' : ''
                        }`}
                      >
                        <td className="py-2.5 px-4 text-center font-bold">
                          {idx === 0 ? (
                            <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-amber-100 text-amber-800 text-[10px]">
                              #1
                            </span>
                          ) : idx === 1 ? (
                            <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-slate-200 text-slate-700 text-[10px]">
                              #2
                            </span>
                          ) : idx === 2 ? (
                            <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-amber-50 text-amber-900 border border-amber-200 text-[10px]">
                              #3
                            </span>
                          ) : (
                            <span className="text-slate-400 font-mono text-[11px]">#{idx + 1}</span>
                          )}
                        </td>

                        <td className="py-2.5 px-4">
                          <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                            {cust.name}
                            {isTop1 && (
                              <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100/70 px-1.5 py-0.2 rounded uppercase">
                                Top Requester
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">{cust.contact}</div>
                        </td>

                        <td className="py-2.5 px-4 font-mono font-bold text-slate-800">
                          {cust.count} {cust.count === 1 ? 'request' : 'requests'}
                        </td>

                        <td className="py-2.5 px-4 min-w-[120px]">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-indigo-500 rounded-full"
                                style={{ width: `${cust.percentage}%` }}
                              />
                            </div>
                            <span className="text-[11px] font-semibold text-slate-600 font-mono">
                              {cust.percentage}%
                            </span>
                          </div>
                        </td>

                        <td className="py-2.5 px-4">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200 capitalize">
                            <Tag className="h-2.5 w-2.5 text-slate-400" />
                            {cust.topCategory.toLowerCase()}
                          </span>
                        </td>

                        <td className="py-2.5 px-4 text-right font-mono font-semibold text-emerald-600">
                          {cust.completed} / {cust.count}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Col: Category Breakdown & Staff Activity */}
        <div className="space-y-4">
          {/* Category Distribution */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-4 space-y-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Tag className="h-3.5 w-3.5 text-slate-500" />
              Category Breakdown
            </h3>

            <div className="space-y-2.5">
              {categoryAnalytics.length === 0 ? (
                <p className="text-xs text-slate-400">No categories found.</p>
              ) : (
                categoryAnalytics.map((cat) => (
                  <div key={cat.category} className="space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-slate-800 capitalize">
                        {cat.category.toLowerCase()}
                      </span>
                      <span className="font-mono text-slate-500 font-medium">
                        {cat.count} ({cat.percentage}%)
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary-600 rounded-full"
                        style={{ width: `${cat.percentage}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Operator Activity */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-4 space-y-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5 text-slate-500" />
              Staff Activity (Who Dispatched)
            </h3>

            <div className="space-y-2">
              {staffActivity.length === 0 ? (
                <p className="text-xs text-slate-400">No staff data logged.</p>
              ) : (
                staffActivity.map((staff) => (
                  <div
                    key={staff.email}
                    className="p-2.5 bg-slate-50/70 rounded-lg border border-slate-200/80 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-semibold text-slate-900">{staff.name}</div>
                      <div className="text-[10px] text-slate-400">{staff.email}</div>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-bold text-primary-600">{staff.count}</span>
                      <span className="text-[10px] text-slate-400 block">tickets</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsPage;

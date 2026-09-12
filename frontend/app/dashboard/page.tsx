"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Shield,
  Star,
  Award,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  PlusCircle,
  Search,
  ArrowRight,
  TrendingUp,
  MapPin,
  ExternalLink,
  ChevronRight,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import PublicNavbar from "../../components/navigation/PublicNavbar";
import Footer from "../../components/layout/Footer";
import { useAuth } from "../../hooks/useAuth";
import { getMyComplaints } from "../../lib/api";
import { formatDateIST } from "../../lib/date";
import { PriorityBadge, StatusBadge, DashboardMetricCard, EmptyState } from "../../components/ui";

export default function CitizenDashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: isAuthLoading, refreshProfile } = useAuth();

  const [complaints, setComplaints] = useState<any[]>([]);
  const [isLoadingComplaints, setIsLoadingComplaints] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Authentication gate
  useEffect(() => {
    if (!isAuthLoading) {
      if (!isAuthenticated) {
        router.push("/login?redirect=/dashboard");
      } else if (user && user.role !== "CITIZEN") {
        // If an official user accidentally visits citizen dashboard, direct them to their portal
        if (user.role === "MUNICIPAL_ADMIN") router.push("/admin");
        else if (user.role === "DEPARTMENT_OFFICER") router.push("/department");
        else if (user.role === "COLLECTOR") router.push("/collector");
      }
    }
  }, [isAuthLoading, isAuthenticated, user, router]);

  // Load complaints
  const fetchComplaints = async () => {
    setIsLoadingComplaints(true);
    setErrorMessage(null);
    try {
      const data = await getMyComplaints();
      setComplaints(data || []);
      // Also refresh profile to ensure badge/credits counter is fresh
      await refreshProfile();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to load your complaints.");
    } finally {
      setIsLoadingComplaints(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && user?.role === "CITIZEN") {
      fetchComplaints();
    }
  }, [isAuthenticated, user?.role]);

  if (isAuthLoading || (!isAuthenticated && !user)) {
    return (
      <div className="min-h-screen bg-[#F5F4F0] flex flex-col">
        <PublicNavbar />
        <main className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-2 text-[#1F5E91] font-semibold text-sm">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>Loading citizen dashboard...</span>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Summary counts
  const totalCount = complaints.length;
  const openCount = complaints.filter((c) =>
    ["NEW", "AI_ANALYZED", "NEEDS_CLARIFICATION", "READY_FOR_ROUTING"].includes(c.status)
  ).length;
  const inProgressCount = complaints.filter((c) =>
    ["ASSIGNED", "IN_PROGRESS", "AWAITING_CITIZEN"].includes(c.status)
  ).length;
  const resolvedCount = complaints.filter((c) =>
    ["RESOLVED", "CLOSED"].includes(c.status)
  ).length;

  return (
    <div className="min-h-screen bg-[#F5F4F0] flex flex-col selection:bg-[#1F5E91] selection:text-white">
      <PublicNavbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Welcome & Profile Summary Card */}
        <div className="rounded-2xl border border-[#E9E9E9] bg-white p-6 sm:p-8 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#1F5E91] bg-[#1F5E91]/10 px-2.5 py-0.5 rounded-full border border-[#1F5E91]/20">
                  Citizen Portal
                </span>
                {user?.ward && (
                  <span className="text-xs text-[#667085] flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-[#1F5E91]" />
                    {user.ward}
                  </span>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-[#123B5D] tracking-tight">
                Welcome, {user?.full_name || "Citizen"}!
              </h1>
              <p className="text-xs sm:text-sm text-[#667085]">
                Track your neighborhood grievances, earn civic credits, and monitor official municipal responses.
              </p>
            </div>

            {/* Gamification / Civic Impact Metrics */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-3 bg-[#F5F4F0] border border-[#E9E9E9] rounded-xl px-4 py-2.5">
                <div className="h-9 w-9 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700">
                  <Star className="h-5 w-5 fill-amber-500 text-amber-500" />
                </div>
                <div>
                  <div className="text-lg font-black text-[#123B5D]">
                    {user?.civic_credits ?? 0}
                  </div>
                  <div className="text-[10px] font-bold uppercase text-[#667085] tracking-wider">
                    Civic Credits
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 bg-[#F5F4F0] border border-[#E9E9E9] rounded-xl px-4 py-2.5">
                <div className="h-9 w-9 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
                  <Award className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <div className="text-lg font-black text-[#123B5D]">
                    {user?.badges_count ?? 0}
                  </div>
                  <div className="text-[10px] font-bold uppercase text-[#667085] tracking-wider">
                    Badges Earned
                  </div>
                </div>
              </div>

              <Link
                href="/profile"
                className="flex items-center gap-1.5 text-xs font-bold text-[#1F5E91] hover:text-[#123B5D] hover:bg-[#1F5E91]/10 px-3 py-2.5 rounded-xl border border-[#1F5E91]/20 transition"
              >
                <span>View Full Profile</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>

        {/* Complaint Summary Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <DashboardMetricCard
            title="Total Filed"
            value={totalCount}
            subtitle="Grievances under account"
            variant="neutral"
            icon={<FileText className="h-4 w-4" />}
          />
          <DashboardMetricCard
            title="Open / Triage"
            value={openCount}
            subtitle="Pending allocation"
            variant="warning"
            icon={<AlertCircle className="h-4 w-4" />}
          />
          <DashboardMetricCard
            title="In Progress"
            value={inProgressCount}
            subtitle="Assigned to officers"
            variant="blue"
            icon={<Clock className="h-4 w-4" />}
          />
          <DashboardMetricCard
            title="Resolved"
            value={resolvedCount}
            subtitle="Verified & closed"
            variant="success"
            icon={<CheckCircle2 className="h-4 w-4" />}
          />
        </div>

        {/* Action Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-[#123B5D] text-white shadow-xs">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-[#F39A32]/20 flex items-center justify-center text-[#F39A32] shrink-0">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold">Have an issue in your locality?</h2>
              <p className="text-xs text-white/80">
                Submit with photos or description. JanSetu AI will route it directly to the responsible Pune department.
              </p>
            </div>
          </div>

          <Link
            href="/report"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-[#F39A32] hover:bg-[#e08922] px-5 py-2.5 text-xs font-bold text-[#123B5D] shadow transition active:scale-95 shrink-0"
          >
            <PlusCircle className="h-4 w-4" />
            <span>Report New Grievance</span>
          </Link>
        </div>

        {/* Recent Complaints Section */}
        <div className="rounded-2xl border border-[#E9E9E9] bg-white p-4 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#E9E9E9]">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[#123B5D]">My Registered Grievances</h2>
              <p className="text-xs text-[#667085]">
                Only complaints linked to your authenticated account are displayed here.
              </p>
            </div>

            <button
              onClick={fetchComplaints}
              disabled={isLoadingComplaints}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1F5E91] hover:text-[#123B5D] px-2.5 py-1.5 rounded-lg border border-[#E9E9E9] hover:bg-[#F5F4F0] transition shrink-0"
              title="Refresh list"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoadingComplaints ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>

          {errorMessage && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-800 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {isLoadingComplaints ? (
            <div className="py-12 flex flex-col items-center justify-center text-[#667085] gap-2">
              <RefreshCw className="h-6 w-6 animate-spin text-[#1F5E91]" />
              <span className="text-xs font-semibold">Retrieving your complaints...</span>
            </div>
          ) : complaints.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No Grievances Reported Yet"
              description="You haven't filed any civic complaints yet. Notice a pothole, leaking water pipe, or broken streetlight? Report it to earn your first 10 Civic Credits!"
              actionLabel="Report Your First Grievance"
              onAction={() => router.push("/report")}
            />
          ) : (
            <>
              {/* Desktop & Tablet View (Hidden on mobile) */}
              <div className="hidden md:block responsive-table-container custom-scrollbar border border-[#E9E9E9] rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead>
                    <tr className="border-b border-[#E9E9E9] text-[11px] uppercase font-bold text-[#667085] tracking-wider bg-[#F5F4F0]/80">
                      <th className="py-2.5 px-3.5">Tracking ID</th>
                      <th className="py-2.5 px-3.5">Issue Summary</th>
                      <th className="py-2.5 px-3.5">Department</th>
                      <th className="py-2.5 px-3.5">Priority</th>
                      <th className="py-2.5 px-3.5">Status</th>
                      <th className="py-2.5 px-3.5">Submitted</th>
                      <th className="py-2.5 px-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E9E9E9] text-xs">
                    {complaints.map((c) => (
                      <tr key={c.id || c.tracking_number} className="hover:bg-[#F5F4F0]/50 transition">
                        <td className="py-2.5 px-3.5 font-mono font-bold text-[#1F5E91] whitespace-nowrap">
                          {c.tracking_number}
                        </td>
                        <td className="py-2.5 px-3.5 max-w-xs font-medium text-[#1F2933]">
                          <p className="truncate" title={c.raw_text || c.issue_summary}>
                            {c.issue_summary || c.raw_text || "Civic Complaint"}
                          </p>
                        </td>
                        <td className="py-2.5 px-3.5 whitespace-nowrap text-[#1F2933]">
                          {c.department_name || c.department_id || "Civic Services"}
                        </td>
                        <td className="py-2.5 px-3.5 whitespace-nowrap">
                          <PriorityBadge priority={c.priority || c.urgency_level} />
                        </td>
                        <td className="py-2.5 px-3.5 whitespace-nowrap">
                          <StatusBadge status={c.status} />
                        </td>
                        <td className="py-2.5 px-3.5 whitespace-nowrap text-[#667085]">
                          {formatDateIST(c.created_at)}
                        </td>
                        <td className="py-2.5 px-3.5 whitespace-nowrap text-right">
                          <Link
                            href={`/track?id=${encodeURIComponent(c.tracking_number)}`}
                            className="inline-flex items-center gap-1 rounded-lg bg-[#1F5E91]/10 hover:bg-[#1F5E91] text-[#1F5E91] hover:text-white px-2.5 py-1 font-bold transition text-[11px]"
                          >
                            <span>Track</span>
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View (Hidden on tablet/desktop) */}
              <div className="block md:hidden space-y-3">
                {complaints.map((c) => (
                  <div
                    key={c.id || c.tracking_number}
                    className="rounded-xl border border-[#E9E9E9] bg-[#F5F4F0]/40 p-3.5 space-y-2.5 hover:border-[#1F5E91]/30 transition"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold text-[#1F5E91]">
                        {c.tracking_number}
                      </span>
                      <PriorityBadge priority={c.priority || c.urgency_level} />
                    </div>

                    <p className="text-xs font-semibold text-[#123B5D] line-clamp-2">
                      {c.issue_summary || c.raw_text || "Civic Complaint"}
                    </p>

                    <div className="flex items-center justify-between text-[11px] text-[#667085] pt-1 border-t border-[#E9E9E9]">
                      <span>{c.department_name || c.department_id || "Civic Services"}</span>
                      <span>{formatDateIST(c.created_at)}</span>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <StatusBadge status={c.status} />
                      <Link
                        href={`/track?id=${encodeURIComponent(c.tracking_number)}`}
                        className="inline-flex items-center gap-1 rounded-lg bg-[#1F5E91] text-white px-3 py-1 font-bold transition text-[11px] shadow-xs active:scale-95"
                      >
                        <span>Track</span>
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}

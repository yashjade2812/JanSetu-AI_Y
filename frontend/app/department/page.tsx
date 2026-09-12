"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Shield,
  Building2,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Send,
  Eye,
  RefreshCw,
  X,
  FileText,
  User,
  MapPin,
  Sparkles,
  ArrowRight,
  AlertCircle,
  UserCheck,
  Phone,
  Briefcase,
  Search,
  Check,
  RotateCcw,
  PlayCircle,
  BadgeCheck,
  Calendar,
} from "lucide-react";
import OfficialNavbar from "../../components/navigation/OfficialNavbar";
import {
  getTickets,
  getTicketDetail,
  updateTicketStatus,
  getMe,
  getDepartmentPersonnel,
  assignTicketPersonnel,
  getTicketAssignment,
  updateAssignmentStatus,
  reassignTicketPersonnel,
} from "../../lib/api";
import { formatDateIST } from "../../lib/date";
import ComplaintLocationCard from "../../components/location/ComplaintLocationCard";
import {
  PriorityBadge,
  StatusBadge,
  SLABadge,
  DashboardMetricCard,
  EmptyState,
} from "../../components/ui";

export default function DepartmentPage() {
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [tickets, setTickets] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Status Filter State
  const [assignmentFilter, setAssignmentFilter] = useState("ALL");

  // Selected ticket detail management
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Personnel Assignment Modal & Drawer State
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [ticketForAssignment, setTicketForAssignment] = useState<any>(null);
  const [assignmentData, setAssignmentData] = useState<any>(null);
  const [departmentPersonnel, setDepartmentPersonnel] = useState<any[]>([]);
  const [searchPersonnel, setSearchPersonnel] = useState("");
  const [selectedPersonnelId, setSelectedPersonnelId] = useState("");
  const [assignmentNote, setAssignmentNote] = useState("");
  const [reassignMode, setReassignMode] = useState(false);
  const [reassignmentReason, setReassignmentReason] = useState("");
  const [isAssigning, setIsAssigning] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [assignModalSuccess, setAssignModalSuccess] = useState<string | null>(null);
  const [assignModalError, setAssignModalError] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const user = await getMe();
      setCurrentUser(user);

      if (user.role !== "DEPARTMENT_OFFICER" && user.role !== "MUNICIPAL_ADMIN") {
        router.push("/login");
        return;
      }

      // Query tickets - backend enforces department isolation!
      const tix = await getTickets();
      // Ensure recent entries are strictly on top for all departments
      const sorted = [...tix].sort((a, b) => {
        const timeA = new Date(a.created_at || a.submitted_at || 0).getTime();
        const timeB = new Date(b.created_at || b.submitted_at || 0).getTime();
        return timeB - timeA;
      });
      setTickets(sorted);
    } catch (err: any) {
      console.error("Department dashboard error:", err);
      router.push("/login");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenTicket = async (id: string) => {
    setActionError(null);
    setActionSuccess(null);
    try {
      const detail = await getTicketDetail(id);
      setSelectedTicket(detail);
      setDetailModalOpen(true);
    } catch (err: any) {
      alert("Failed to load ticket: " + err.message);
    }
  };

  const handleOpenAssignModal = async (ticket: any) => {
    setTicketForAssignment(ticket);
    setAssignModalSuccess(null);
    setAssignModalError(null);
    setSelectedPersonnelId("");
    setAssignmentNote("");
    setReassignMode(false);
    setReassignmentReason("");
    setAssignModalOpen(true);
    setModalLoading(true);

    try {
      // 1. Fetch eligible departmental personnel (strictly within department)
      const deptId = ticket.department_id || currentUser?.department_id;
      const [personnelList, assignInfo] = await Promise.all([
        getDepartmentPersonnel(deptId).catch(() => []),
        getTicketAssignment(ticket.id).catch(() => null),
      ]);
      setDepartmentPersonnel(personnelList);
      setAssignmentData(assignInfo);
    } catch (err: any) {
      setAssignModalError(err.message || "Failed to load personnel data.");
    } finally {
      setModalLoading(false);
    }
  };

  const handleConfirmAssignment = async () => {
    if (!ticketForAssignment || !selectedPersonnelId) return;
    setIsAssigning(true);
    setAssignModalError(null);
    setAssignModalSuccess(null);

    const targetPerson = departmentPersonnel.find((p) => p.id === selectedPersonnelId);

    try {
      if (reassignMode) {
        if (!reassignmentReason.trim()) {
          setAssignModalError("Reassignment reason is required.");
          setIsAssigning(false);
          return;
        }
        await reassignTicketPersonnel(
          ticketForAssignment.id,
          selectedPersonnelId,
          reassignmentReason.trim(),
          assignmentNote.trim() || undefined
        );
        setAssignModalSuccess("Personnel successfully reassigned.");
      } else {
        await assignTicketPersonnel(
          ticketForAssignment.id,
          selectedPersonnelId,
          assignmentNote.trim() || undefined
        );
        setAssignModalSuccess("Personnel successfully assigned to ticket.");
      }

      // Optimistically update tickets list IMMEDIATELY so counts, tabs, badges reflect new status
      setTickets((prev) =>
        prev.map((t) => {
          if (t.id === ticketForAssignment.id) {
            return {
              ...t,
              assigned_officer_id: selectedPersonnelId,
              assigned_officer_name: targetPerson?.full_name || t.assigned_officer_name,
              assigned_personnel: targetPerson || t.assigned_personnel,
              assignment_status: "Assigned",
              status: ["NEW", "READY_FOR_ROUTING", "AI_ANALYZED"].includes(t.status) ? "ASSIGNED" : t.status,
            };
          }
          return t;
        })
      );

      setTicketForAssignment((prev: any) =>
        prev
          ? {
              ...prev,
              assigned_officer_id: selectedPersonnelId,
              assigned_officer_name: targetPerson?.full_name || prev.assigned_officer_name,
              assigned_personnel: targetPerson || prev.assigned_personnel,
              assignment_status: "Assigned",
              status: ["NEW", "READY_FOR_ROUTING", "AI_ANALYZED"].includes(prev.status) ? "ASSIGNED" : prev.status,
            }
          : null
      );

      // Refresh assignment info & sync real-time values from backend
      const updatedAssign = await getTicketAssignment(ticketForAssignment.id);
      setAssignmentData(updatedAssign);
      setReassignMode(false);
      setReassignmentReason("");
      setSelectedPersonnelId("");
      setAssignmentNote("");
      await loadData();
    } catch (err: any) {
      setAssignModalError(err.message || "Assignment failed.");
    } finally {
      setIsAssigning(false);
    }
  };

  const handleStartWorkInProgress = async () => {
    if (!ticketForAssignment) return;
    setIsAssigning(true);
    setAssignModalError(null);
    setAssignModalSuccess(null);

    try {
      await updateAssignmentStatus(
        ticketForAssignment.id,
        "IN_PROGRESS",
        "Field crew dispatched to commence operations."
      );
      setAssignModalSuccess("Ticket status updated to Work in Progress.");

      // Optimistically update tickets list immediately
      setTickets((prev) =>
        prev.map((t) => {
          if (t.id === ticketForAssignment.id) {
            return {
              ...t,
              status: "IN_PROGRESS",
              assignment_status: "Work in Progress",
            };
          }
          return t;
        })
      );

      setTicketForAssignment((prev: any) =>
        prev
          ? {
              ...prev,
              status: "IN_PROGRESS",
              assignment_status: "Work in Progress",
            }
          : null
      );

      const updatedAssign = await getTicketAssignment(ticketForAssignment.id);
      setAssignmentData(updatedAssign);
      await loadData();
    } catch (err: any) {
      setAssignModalError(err.message || "Failed to start work.");
    } finally {
      setIsAssigning(false);
    }
  };

  const handleMarkResolvedFromModal = async () => {
    if (!ticketForAssignment) return;
    setIsAssigning(true);
    setAssignModalError(null);
    setAssignModalSuccess(null);

    try {
      await updateAssignmentStatus(
        ticketForAssignment.id,
        "RESOLVED",
        "Field operations completed per departmental operating procedures."
      );
      setAssignModalSuccess("Ticket marked as Completed & Resolved.");

      // Optimistically update tickets list immediately
      setTickets((prev) =>
        prev.map((t) => {
          if (t.id === ticketForAssignment.id) {
            return {
              ...t,
              status: "RESOLVED",
              assignment_status: "Resolved",
            };
          }
          return t;
        })
      );

      setTicketForAssignment((prev: any) =>
        prev
          ? {
              ...prev,
              status: "RESOLVED",
              assignment_status: "Resolved",
            }
          : null
      );

      const updatedAssign = await getTicketAssignment(ticketForAssignment.id);
      setAssignmentData(updatedAssign);
      await loadData();
    } catch (err: any) {
      setAssignModalError(err.message || "Failed to resolve ticket.");
    } finally {
      setIsAssigning(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!selectedTicket) return;
    setActionError(null);
    try {
      await updateTicketStatus(
        selectedTicket.id,
        newStatus,
        newStatus === "RESOLVED"
          ? resolutionNotes || "Repairs executed per standard department operating procedure."
          : undefined
      );
      setActionSuccess(`Ticket successfully transitioned to ${newStatus}`);

      // Optimistically update tickets list immediately
      setTickets((prev) =>
        prev.map((t) => {
          if (t.id === selectedTicket.id) {
            return {
              ...t,
              status: newStatus,
              assignment_status:
                newStatus === "RESOLVED"
                  ? "Resolved"
                  : newStatus === "IN_PROGRESS"
                  ? "Work in Progress"
                  : t.assignment_status,
            };
          }
          return t;
        })
      );

      const updated = await getTicketDetail(selectedTicket.id);
      setSelectedTicket(updated);
      setResolutionNotes("");
      await loadData();
    } catch (err: any) {
      setActionError(err.message);
    }
  };
  const getPriorityBadge = (prio: string) => {
    switch (prio) {
      case "P0":
        return <span className="rounded bg-rose-600 px-2 py-0.5 text-[11px] font-bold text-white shadow-sm">P0 Emergency</span>;
      case "P1":
        return <span className="rounded bg-orange-600 px-2 py-0.5 text-[11px] font-bold text-white shadow-sm">P1 High</span>;
      case "P2":
        return <span className="rounded bg-amber-500 px-2 py-0.5 text-[11px] font-bold text-white shadow-sm">P2 Med</span>;
      default:
        return <span className="rounded bg-blue-600 px-2 py-0.5 text-[11px] font-bold text-white shadow-sm">P3 Low</span>;
    }
  };

  // Real-time Database Status Categorization Predicates
  const isResolved = (t: any) =>
    t.status === "RESOLVED" ||
    t.status === "CLOSED" ||
    t.assignment_status === "Resolved";

  const isInProgress = (t: any) =>
    !isResolved(t) &&
    (t.status === "IN_PROGRESS" || t.assignment_status === "Work in Progress");

  const isAssigned = (t: any) =>
    !isResolved(t) &&
    !isInProgress(t) &&
    (Boolean(t.assigned_officer_id) || t.assignment_status === "Assigned" || t.status === "ASSIGNED");

  const isUnassigned = (t: any) =>
    !isResolved(t) &&
    !isInProgress(t) &&
    !isAssigned(t);

  const getAssignmentBadge = (itemOrStatus: any) => {
    if (typeof itemOrStatus === "object" && itemOrStatus !== null) {
      if (isResolved(itemOrStatus)) {
        return (
          <span className="inline-flex items-center gap-1 rounded bg-emerald-50 text-emerald-700 px-2.5 py-0.5 font-bold text-[11px] border border-emerald-200">
            <BadgeCheck className="h-3 w-3 text-emerald-600" />
            Resolved
          </span>
        );
      }
      if (isInProgress(itemOrStatus)) {
        return (
          <span className="inline-flex items-center gap-1 rounded bg-blue-50 text-blue-700 px-2.5 py-0.5 font-bold text-[11px] border border-blue-200">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-pulse" />
            Work in Progress
          </span>
        );
      }
      if (isAssigned(itemOrStatus)) {
        return (
          <span className="inline-flex items-center gap-1 rounded bg-indigo-50 text-indigo-700 px-2.5 py-0.5 font-bold text-[11px] border border-indigo-200">
            <CheckCircle2 className="h-3 w-3 text-indigo-600" />
            Assigned
          </span>
        );
      }
      return (
        <span className="inline-flex items-center gap-1 rounded bg-amber-50 text-amber-700 px-2.5 py-0.5 font-bold text-[11px] border border-amber-200">
          <Clock className="h-3 w-3 text-amber-500" />
          Unassigned
        </span>
      );
    }

    switch (itemOrStatus) {
      case "Work in Progress":
        return (
          <span className="inline-flex items-center gap-1 rounded bg-blue-50 text-blue-700 px-2.5 py-0.5 font-bold text-[11px] border border-blue-200">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-pulse" />
            Work in Progress
          </span>
        );
      case "Assigned":
        return (
          <span className="inline-flex items-center gap-1 rounded bg-indigo-50 text-indigo-700 px-2.5 py-0.5 font-bold text-[11px] border border-indigo-200">
            <CheckCircle2 className="h-3 w-3 text-indigo-600" />
            Assigned
          </span>
        );
      case "Resolved":
        return (
          <span className="inline-flex items-center gap-1 rounded bg-emerald-50 text-emerald-700 px-2.5 py-0.5 font-bold text-[11px] border border-emerald-200">
            <BadgeCheck className="h-3 w-3 text-emerald-600" />
            Resolved
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded bg-amber-50 text-amber-700 px-2.5 py-0.5 font-bold text-[11px] border border-amber-200">
            <Clock className="h-3 w-3 text-amber-500" />
            Unassigned
          </span>
        );
    }
  };

  // Real-time Counts based on Database Values
  const allCount = tickets.length;
  const unassignedCount = tickets.filter(isUnassigned).length;
  const assignedCount = tickets.filter(isAssigned).length;
  const inProgressCount = tickets.filter(isInProgress).length;
  const resolvedCount = tickets.filter(isResolved).length;
  const openTicketsCount = tickets.filter((t) => !["RESOLVED", "CLOSED"].includes(t.status)).length;
  const criticalCount = tickets.filter((t) => t.priority === "P0" || t.priority === "P1").length;
  const breachedCount = tickets.filter((t) => t.sla?.status === "BREACHED").length;

  // Filtered tickets list according to selected real-time status tab
  const filteredTickets = tickets.filter((t) => {
    if (assignmentFilter === "UNASSIGNED") return isUnassigned(t);
    if (assignmentFilter === "ASSIGNED") return isAssigned(t);
    if (assignmentFilter === "IN_PROGRESS") return isInProgress(t);
    if (assignmentFilter === "RESOLVED") return isResolved(t);
    return true; // ALL
  });

  // Filter personnel inside modal by search
  const filteredPersonnel = departmentPersonnel.filter((p) => {
    if (!searchPersonnel.trim()) return true;
    const q = searchPersonnel.toLowerCase();
    return (
      p.full_name?.toLowerCase().includes(q) ||
      p.designation?.toLowerCase().includes(q) ||
      p.employee_id?.toLowerCase().includes(q) ||
      p.ward?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      <OfficialNavbar
        title={`${currentUser?.department_id ? currentUser.department_id.replace("_", " ") : "Department"} Operational Queue`}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 sm:px-6 lg:px-8 space-y-6">
        {/* Department Title Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="rounded-md bg-emerald-600 px-2 py-0.5 text-xs font-bold text-white uppercase tracking-wider">
                Field Operations Center
              </span>
              <span className="text-xs text-slate-500 font-medium">
                Officer: {currentUser?.full_name || "Official"} ({currentUser?.designation || "Superintending Officer"})
              </span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">
              {currentUser?.department_id ? currentUser.department_id.replace("_", " ") : "Department"} Dispatch & Maintenance Queue
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Backend isolated to your assigned department • Assign active personnel, dispatch field crews, and track IST SLA progress
            </p>
          </div>

          <button
            onClick={loadData}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-100 hover:bg-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 transition self-start sm:self-auto"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Refresh Queue</span>
          </button>
        </div>

        {/* Department Operational Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <DashboardMetricCard
            label="Open Tickets"
            value={openTicketsCount}
            variant="blue"
          />
          <DashboardMetricCard
            label="Critical (P0/P1)"
            value={criticalCount}
            variant="critical"
          />
          <DashboardMetricCard
            label="SLA Breached"
            value={breachedCount}
            variant="critical"
          />
          <DashboardMetricCard
            label="Resolved"
            value={resolvedCount}
            variant="success"
          />
        </div>

        {/* Priority Dispatch Table Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-indigo-600" />
                  Department Action Queue
                </h2>
                <span className="rounded-full bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 text-[10px] font-bold text-indigo-700">
                  Strict Department Isolation
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Showing {filteredTickets.length} tickets belonging strictly to {currentUser?.department_id?.replace("_", " ")}
              </p>
            </div>

            {/* Quick Status Filter Tabs with Real-Time Counts */}
            <div className="flex flex-wrap gap-1.5 bg-slate-100 p-1 rounded-xl">
              {[
                { id: "ALL", label: "All Tickets", count: allCount, badgeColor: "text-slate-700 bg-slate-200" },
                { id: "UNASSIGNED", label: "Unassigned", count: unassignedCount, badgeColor: "text-amber-800 bg-amber-100" },
                { id: "ASSIGNED", label: "Assigned", count: assignedCount, badgeColor: "text-indigo-800 bg-indigo-100" },
                { id: "IN_PROGRESS", label: "In Progress", count: inProgressCount, badgeColor: "text-blue-800 bg-blue-100" },
                { id: "RESOLVED", label: "Resolved", count: resolvedCount, badgeColor: "text-emerald-800 bg-emerald-100" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setAssignmentFilter(tab.id)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-2 ${
                    assignmentFilter === tab.id
                      ? "bg-white text-indigo-700 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                      assignmentFilter === tab.id
                        ? "bg-indigo-600 text-white"
                        : tab.badgeColor
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {filteredTickets.length === 0 ? (
            <EmptyState
              title="No tickets in queue"
              description={`There are currently no tickets matching the selected filter in ${currentUser?.department_id?.replace("_", " ") || "your department"}.`}
              actionText="Reset Filter"
              onAction={() => setAssignmentFilter("ALL")}
            />
          ) : (
            <>
              {/* Desktop / Tablet Compact Table */}
              <div className="responsive-table-container custom-scrollbar hidden md:block rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs min-w-[780px]">
                  <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="py-2.5 px-3.5">Tracking ID</th>
                      <th className="py-2.5 px-3.5">Issue Summary</th>
                      <th className="py-2.5 px-3.5">Location</th>
                      <th className="py-2.5 px-3.5">Filed (IST)</th>
                      <th className="py-2.5 px-3.5">Priority</th>
                      <th className="py-2.5 px-3.5">Assignment Status</th>
                      <th className="py-2.5 px-3.5">Assigned Personnel</th>
                      <th className="py-2.5 px-3.5">SLA State</th>
                      <th className="py-2.5 px-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {filteredTickets.map((t) => (
                      <tr
                        key={t.id}
                        onClick={() => handleOpenTicket(t.id)}
                        className="hover:bg-slate-50/80 cursor-pointer transition"
                      >
                        <td className="py-2.5 px-3.5 font-mono font-bold text-indigo-600 whitespace-nowrap">
                          {t.tracking_number}
                        </td>
                        <td className="py-2.5 px-3.5 font-semibold text-slate-900 max-w-xs truncate">
                          {t.issue_summary}
                        </td>
                        <td className="py-2.5 px-3.5 text-slate-600 whitespace-nowrap">
                          {t.location_name || <span className="text-rose-500">Missing</span>}
                        </td>
                        <td className="py-2.5 px-3.5 text-slate-500 whitespace-nowrap text-[11px]">
                          {formatDateIST(t.created_at)}
                        </td>
                        <td className="py-2.5 px-3.5 whitespace-nowrap">
                          <PriorityBadge priority={t.priority} size="sm" />
                        </td>
                        <td className="py-2.5 px-3.5 whitespace-nowrap">
                          {getAssignmentBadge(t)}
                        </td>
                        <td className="py-2.5 px-3.5 whitespace-nowrap">
                          {t.assigned_officer_name ? (
                            <div className="flex items-center gap-2">
                              <div className="h-6 w-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-[10px] shrink-0">
                                {t.assigned_officer_name.split(" ").map((n: string) => n[0]).slice(0, 2).join("")}
                              </div>
                              <div>
                                <div className="font-bold text-slate-800 leading-tight">{t.assigned_officer_name}</div>
                                <div className="text-[10px] text-slate-400">{t.assigned_personnel?.designation || "Field Officer"}</div>
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">Pending assignment</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3.5 whitespace-nowrap">
                          <SLABadge status={t.sla?.status} size="sm" />
                        </td>
                        <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => handleOpenAssignModal(t)}
                              className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 text-[11px] font-bold shadow-xs transition"
                            >
                              <UserCheck className="h-3 w-3" />
                              <span>{t.assigned_officer_name ? "Manage Staff" : "Assign"}</span>
                            </button>
                            <button
                              onClick={() => handleOpenTicket(t.id)}
                              className="inline-flex items-center gap-1 rounded-lg bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 text-[11px] font-bold text-slate-700 transition"
                            >
                              <Eye className="h-3 w-3" />
                              <span>Details</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Responsive Cards (< md) */}
              <div className="block md:hidden space-y-3">
                {filteredTickets.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => handleOpenTicket(t.id)}
                    className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs hover:border-indigo-300 transition cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="font-mono text-xs font-bold text-indigo-600">
                        {t.tracking_number}
                      </span>
                      <PriorityBadge priority={t.priority} size="sm" />
                    </div>
                    <h3 className="font-bold text-xs text-slate-900 line-clamp-2">
                      {t.issue_summary}
                    </h3>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1.5">
                      <span className="truncate">📍 {t.location_name || "Missing location"}</span>
                      <span className="shrink-0 ml-2">{formatDateIST(t.created_at)}</span>
                    </div>
                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap text-xs">
                      {getAssignmentBadge(t)}
                      {t.assigned_officer_name ? (
                        <span className="text-[11px] text-slate-700 font-semibold truncate max-w-[150px]">
                          Staff: {t.assigned_officer_name}
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">Unassigned</span>
                      )}
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
                      <SLABadge status={t.sla?.status} size="sm" />
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleOpenAssignModal(t)}
                          className="inline-flex items-center gap-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1 text-[11px] font-bold shadow-xs transition"
                        >
                          <UserCheck className="h-3 w-3" />
                          <span>{t.assigned_officer_name ? "Manage Staff" : "Assign"}</span>
                        </button>
                        <button
                          onClick={() => handleOpenTicket(t.id)}
                          className="inline-flex items-center gap-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 text-[11px] font-bold transition"
                        >
                          <Eye className="h-3 w-3" />
                          <span>Details</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </main>

      {/* ─── PERSONNEL ASSIGNMENT MODAL & DRAWER ─── */}
      {assignModalOpen && ticketForAssignment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="max-w-2xl w-full max-h-[92vh] flex flex-col rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 p-6 bg-slate-50/60">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                    {ticketForAssignment.tracking_number}
                  </span>
                  <span className="rounded bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700 uppercase">
                    {ticketForAssignment.department_id?.replace("_", " ")}
                  </span>
                  {getPriorityBadge(ticketForAssignment.priority)}
                </div>
                <h2 className="text-lg font-black text-slate-900">
                  Assign Departmental Field Personnel
                </h2>
                <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                  Issue: {ticketForAssignment.issue_summary}
                </p>
              </div>
              <button
                onClick={() => setAssignModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {assignModalSuccess && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs font-semibold text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>{assignModalSuccess}</span>
                </div>
              )}
              {assignModalError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs font-semibold text-rose-800 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                  <span>{assignModalError}</span>
                </div>
              )}

              {modalLoading ? (
                <div className="py-12 text-center text-slate-500 space-y-2">
                  <RefreshCw className="h-6 w-6 animate-spin mx-auto text-indigo-600" />
                  <p className="text-xs font-semibold">Loading departmental staff directory...</p>
                </div>
              ) : (
                <>
                  {/* Current Assignment Card if Assigned */}
                  {assignmentData?.current_assignment && !reassignMode && (
                    <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-900 flex items-center gap-1.5">
                          <UserCheck className="h-3.5 w-3.5 text-indigo-600" />
                          Currently Assigned Personnel
                        </span>
                        {getAssignmentBadge(
                          assignmentData.current_assignment.assignment_status === "IN_PROGRESS"
                            ? "Work in Progress"
                            : assignmentData.current_assignment.assignment_status === "RESOLVED"
                            ? "Resolved"
                            : "Assigned"
                        )}
                      </div>

                      <div className="flex items-start justify-between gap-4 bg-white p-3.5 rounded-xl border border-indigo-100 shadow-sm">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-indigo-600 text-white flex items-center justify-center font-black text-sm shrink-0">
                            {assignmentData.current_assignment.personnel?.full_name?.split(" ").map((n: string) => n[0]).slice(0, 2).join("") || "PMC"}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 text-sm">
                              {assignmentData.current_assignment.personnel?.full_name}
                            </div>
                            <div className="text-xs text-slate-600 font-medium">
                              {assignmentData.current_assignment.personnel?.designation || "Field Maintenance Officer"}
                            </div>
                            <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1">
                              <span className="flex items-center gap-1 font-mono">
                                <Phone className="h-3 w-3 text-slate-400" />
                                {assignmentData.current_assignment.personnel?.phone || assignmentData.current_assignment.personnel?.mobile_number}
                              </span>
                              <span>•</span>
                              <span>{assignmentData.current_assignment.personnel?.ward || "Central Zone"}</span>
                              {assignmentData.current_assignment.personnel?.employee_id && (
                                <>
                                  <span>•</span>
                                  <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded">
                                    {assignmentData.current_assignment.personnel.employee_id}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="text-right text-[10px] text-slate-400 whitespace-nowrap">
                          <span>Assigned on</span>
                          <div className="font-semibold text-slate-600">
                            {formatDateIST(assignmentData.current_assignment.assigned_at)}
                          </div>
                        </div>
                      </div>

                      {assignmentData.current_assignment.assignment_note && (
                        <div className="text-xs text-slate-600 bg-white/70 p-2.5 rounded-lg border border-slate-100">
                          <span className="font-bold text-slate-500 text-[10px] uppercase block mb-0.5">Note:</span>
                          &ldquo;{assignmentData.current_assignment.assignment_note}&rdquo;
                        </div>
                      )}

                      {/* Quick Status Control Buttons */}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {assignmentData.current_assignment.assignment_status !== "IN_PROGRESS" &&
                          assignmentData.current_assignment.assignment_status !== "RESOLVED" && (
                            <button
                              onClick={handleStartWorkInProgress}
                              disabled={isAssigning}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3.5 py-2 shadow-sm transition disabled:opacity-50"
                            >
                              <PlayCircle className="h-3.5 w-3.5" />
                              <span>Start / Mark Work in Progress</span>
                            </button>
                          )}

                        {assignmentData.current_assignment.assignment_status === "IN_PROGRESS" && (
                          <button
                            onClick={handleMarkResolvedFromModal}
                            disabled={isAssigning}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3.5 py-2 shadow-sm transition disabled:opacity-50"
                          >
                            <BadgeCheck className="h-3.5 w-3.5" />
                            <span>Mark Work Completed & Resolved</span>
                          </button>
                        )}

                        <button
                          onClick={() => {
                            setReassignMode(true);
                            setAssignModalError(null);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3.5 py-2 transition"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          <span>Reassign to Another Person</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Reassignment / New Assignment Directory Picker */}
                  {(!assignmentData?.current_assignment || reassignMode) && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                            {reassignMode ? "Select New Department Personnel" : "Select Departmental Personnel"}
                          </h3>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Active field officers in {ticketForAssignment.department_id?.replace("_", " ")} Department
                          </p>
                        </div>
                        {reassignMode && (
                          <button
                            onClick={() => setReassignMode(false)}
                            className="text-xs font-bold text-slate-500 hover:text-slate-800"
                          >
                            Cancel Reassignment
                          </button>
                        )}
                      </div>

                      {/* Search Bar */}
                      <div className="relative">
                        <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          value={searchPersonnel}
                          onChange={(e) => setSearchPersonnel(e.target.value)}
                          placeholder="Search personnel by name, designation, or employee ID..."
                          className="w-full rounded-xl border border-slate-200 pl-9 pr-4 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none"
                        />
                      </div>

                      {/* Personnel Selection Cards Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto pr-1">
                        {filteredPersonnel.length === 0 ? (
                          <div className="col-span-2 text-center py-6 text-slate-400 text-xs">
                            No matching personnel found in this department.
                          </div>
                        ) : (
                          filteredPersonnel.map((p) => {
                            const isSelected = selectedPersonnelId === p.id;
                            return (
                              <div
                                key={p.id}
                                onClick={() => setSelectedPersonnelId(p.id)}
                                className={`cursor-pointer rounded-xl border p-3 transition flex items-start justify-between gap-3 ${
                                  isSelected
                                    ? "border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20 shadow-sm"
                                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
                                }`}
                              >
                                <div className="flex items-start gap-2.5">
                                  <div
                                    className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                                      isSelected
                                        ? "bg-indigo-600 text-white"
                                        : "bg-slate-100 text-slate-700"
                                    }`}
                                  >
                                    {p.full_name?.split(" ").map((n: string) => n[0]).slice(0, 2).join("")}
                                  </div>
                                  <div>
                                    <div className="font-bold text-slate-900 text-xs">{p.full_name}</div>
                                    <div className="text-[11px] text-indigo-700 font-medium">
                                      {p.designation || "Field Officer"}
                                    </div>
                                    <div className="text-[10px] text-slate-500 flex items-center gap-1 font-mono mt-0.5">
                                      <Phone className="h-2.5 w-2.5 text-slate-400" />
                                      {p.phone || p.mobile_number}
                                    </div>
                                    <div className="text-[10px] text-slate-400 mt-0.5">{p.ward || "Zonal Division"}</div>
                                  </div>
                                </div>

                                <div className="shrink-0 flex flex-col items-end gap-1">
                                  <span className="rounded-full bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">
                                    Available
                                  </span>
                                  {isSelected && (
                                    <div className="h-5 w-5 rounded-full bg-indigo-600 text-white flex items-center justify-center mt-1">
                                      <Check className="h-3 w-3" />
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Reassignment Reason Input (Mandatory when reassigning) */}
                      {reassignMode && (
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-700 block">
                            Reassignment Reason <span className="text-rose-600">*</span>
                          </label>
                          <input
                            type="text"
                            value={reassignmentReason}
                            onChange={(e) => setReassignmentReason(e.target.value)}
                            placeholder="e.g., Specialized heavy compaction machinery required on site."
                            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none"
                          />
                        </div>
                      )}

                      {/* Optional Assignment Note Input */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700 block">
                          Assignment Note / SOP Instructions (Optional)
                        </label>
                        <textarea
                          rows={2}
                          value={assignmentNote}
                          onChange={(e) => setAssignmentNote(e.target.value)}
                          placeholder="e.g., Coordinate with Zonal Substation Engineer upon arrival."
                          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none resize-none"
                        />
                      </div>
                    </div>
                  )}

                  {/* Reassignment History Log */}
                  {assignmentData?.history && assignmentData.history.length > 0 && (
                    <div className="border-t border-slate-100 pt-4 space-y-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Assignment & Reassignment History ({assignmentData.history.length})
                      </span>
                      <div className="space-y-2 max-h-36 overflow-y-auto">
                        {assignmentData.history.map((h: any) => (
                          <div
                            key={h.id}
                            className="rounded-lg bg-slate-50 p-2.5 text-xs text-slate-600 border border-slate-200/60 flex items-start justify-between gap-3"
                          >
                            <div>
                              <div className="font-bold text-slate-800">
                                {h.personnel?.full_name || "Personnel"} ({h.personnel?.designation || "Officer"})
                              </div>
                              {h.reassignment_reason && (
                                <div className="text-[11px] text-slate-500 mt-0.5">
                                  <span className="font-semibold text-slate-600">Reason:</span> {h.reassignment_reason}
                                </div>
                              )}
                              {h.assignment_note && (
                                <div className="text-[10px] text-slate-400 mt-0.5 italic">
                                  Note: &ldquo;{h.assignment_note}&rdquo;
                                </div>
                              )}
                            </div>
                            <div className="text-right whitespace-nowrap text-[10px] text-slate-400">
                              <span className="font-semibold uppercase text-slate-500">{h.assignment_status}</span>
                              <div>{formatDateIST(h.assigned_at || h.created_at)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="border-t border-slate-100 p-4 bg-slate-50 flex items-center justify-between gap-3">
              <span className="text-[11px] text-slate-400">
                Department Isolation Active • PMC Field Personnel Database
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setAssignModalOpen(false)}
                  className="rounded-xl border border-slate-200 bg-white hover:bg-slate-100 px-4 py-2 text-xs font-bold text-slate-700 transition"
                >
                  Close
                </button>

                {(!assignmentData?.current_assignment || reassignMode) && (
                  <button
                    onClick={handleConfirmAssignment}
                    disabled={isAssigning || !selectedPersonnelId}
                    className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-5 py-2 text-xs font-bold text-white shadow-md transition disabled:opacity-50"
                  >
                    <UserCheck className="h-3.5 w-3.5" />
                    <span>
                      {isAssigning
                        ? "Saving..."
                        : reassignMode
                        ? "Confirm Reassignment"
                        : "Assign Personnel"}
                    </span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── TICKET DETAIL MODAL ─── */}
      {detailModalOpen && selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="max-w-3xl w-full max-h-[90vh] overflow-y-auto rounded-2xl bg-white border border-slate-200 shadow-2xl p-6 sm:p-8">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4 mb-6">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                    {selectedTicket.tracking_number}
                  </span>
                  <PriorityBadge priority={selectedTicket.priority} size="sm" />
                </div>
                <h2 className="text-xl font-black text-slate-900">{selectedTicket.issue_summary}</h2>
              </div>
              <button
                onClick={() => setDetailModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {actionSuccess && (
              <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">
                {actionSuccess}
              </div>
            )}
            {actionError && (
              <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">
                {actionError}
              </div>
            )}

            {/* Quick Properties */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs mb-6">
              <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Current Status</span>
                <div className="mt-1">
                  <StatusBadge status={selectedTicket.status} size="sm" />
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">SLA State</span>
                <div className="mt-1">
                  <SLABadge status={selectedTicket.sla?.status} size="sm" />
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Location</span>
                <span className="font-bold text-slate-800 mt-1 block truncate">
                  {selectedTicket.location_name || "Missing"}
                </span>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Citizen</span>
                <span className="font-bold text-slate-800 mt-1 block truncate">
                  {selectedTicket.citizen_name || "Resident"}
                </span>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Filed (IST)</span>
                <span className="font-bold text-slate-800 mt-1 block truncate">
                  {formatDateIST(selectedTicket.created_at)}
                </span>
              </div>
            </div>

            {/* Assigned Personnel Card Section */}
            <div className="rounded-xl bg-indigo-50/50 border border-indigo-100 p-4 mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-900 flex items-center gap-1.5">
                  <UserCheck className="h-3.5 w-3.5 text-indigo-600" />
                  Assigned Field Personnel
                </span>
                <button
                  onClick={() => {
                    setDetailModalOpen(false);
                    handleOpenAssignModal(selectedTicket);
                  }}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 underline"
                >
                  {selectedTicket.assigned_officer_id ? "Manage / Reassign" : "Assign Personnel"}
                </button>
              </div>

              {selectedTicket.assignment?.current_assignment ? (
                <div className="bg-white p-3.5 rounded-xl border border-indigo-100 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-900 text-xs">
                      {selectedTicket.assignment.current_assignment.personnel?.full_name}
                    </div>
                    <div className="text-[11px] text-slate-600">
                      {selectedTicket.assignment.current_assignment.personnel?.designation} •{" "}
                      <span className="font-mono">{selectedTicket.assignment.current_assignment.personnel?.phone}</span>
                    </div>
                  </div>
                  {getAssignmentBadge(
                    selectedTicket.assignment.current_assignment.assignment_status === "IN_PROGRESS"
                      ? "Work in Progress"
                      : "Assigned"
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic">
                  No personnel assigned yet. Click &ldquo;Assign Personnel&rdquo; to dispatch field staff.
                </p>
              )}
            </div>

            {/* Raw Grievance Narrative */}
            <div className="rounded-xl bg-slate-50 p-4 text-xs text-slate-700 leading-relaxed mb-6 border border-slate-100">
              <span className="font-bold text-slate-500 block text-[10px] uppercase mb-1">
                Citizen Grievance Description
              </span>
              &ldquo;{selectedTicket.raw_complaint_text}&rdquo;
            </div>

            {/* Complaint Location & Interactive Map */}
            <ComplaintLocationCard
              locationName={selectedTicket.location_name}
              latitude={selectedTicket.latitude}
              longitude={selectedTicket.longitude}
              ward={selectedTicket.ward}
              trackingNumber={selectedTicket.tracking_number}
              className="mb-6"
            />

            {/* AI Analysis & SOP Guidance */}
            {selectedTicket.ai_analysis && (
              <div className="rounded-xl bg-indigo-50/60 border border-indigo-100 p-4 text-xs text-indigo-950 mb-6">
                <span className="font-bold text-indigo-900 block text-[10px] uppercase mb-1">
                  AI Department SOP Action Recommendations
                </span>
                <ul className="list-disc pl-4 space-y-1 text-[11px] mb-3">
                  {selectedTicket.ai_analysis.recommended_actions?.map((act: string, i: number) => (
                    <li key={i}>{act}</li>
                  ))}
                </ul>
                <div className="pt-2 border-t border-indigo-200/60 text-[11px] italic text-indigo-800">
                  {selectedTicket.ai_analysis.citizen_response_draft}
                </div>
              </div>
            )}

            {/* Officer Action Controls */}
            <div className="border-t border-slate-100 pt-6 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Officer Dispatch & Resolution Controls
              </h3>

              <div className="flex flex-wrap gap-2">
                {selectedTicket.status !== "IN_PROGRESS" && selectedTicket.status !== "RESOLVED" && (
                  <button
                    onClick={() => handleStatusChange("IN_PROGRESS")}
                    className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 shadow-sm transition"
                  >
                    Accept & Mark In Progress
                  </button>
                )}

                {selectedTicket.status !== "RESOLVED" && (
                  <div className="w-full space-y-2 pt-2 border-t border-slate-100">
                    <label className="text-[11px] font-bold text-slate-600 block">
                      Resolution Verification Note
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={resolutionNotes}
                        onChange={(e) => setResolutionNotes(e.target.value)}
                        placeholder="e.g., Sluice valve replaced; potable water pressure restored."
                        className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-xs"
                      />
                      <button
                        onClick={() => handleStatusChange("RESOLVED")}
                        className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 shrink-0 shadow-sm transition"
                      >
                        Mark Resolved
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

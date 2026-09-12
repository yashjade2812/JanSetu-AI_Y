"use client";

import React from "react";
import { CheckCircle2, Clock, AlertCircle, HelpCircle, ArrowRight, ShieldCheck } from "lucide-react";

export interface StatusBadgeProps {
  status?: string | null;
  className?: string;
  size?: "sm" | "md";
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  className = "",
  size = "md",
}) => {
  const s = (status || "NEW").toUpperCase().trim();
  const sizeStyles = size === "sm" ? "text-[10px] px-1.5 py-0.5" : "text-[11px] px-2 py-0.5";

  switch (s) {
    case "RESOLVED":
      return (
        <span
          className={`inline-flex items-center gap-1 rounded-md font-semibold border bg-emerald-50 border-emerald-200 text-emerald-800 whitespace-nowrap ${sizeStyles} ${className}`}
        >
          <CheckCircle2 className="h-3 w-3 text-emerald-600 shrink-0" />
          <span>Resolved</span>
        </span>
      );
    case "IN_PROGRESS":
      return (
        <span
          className={`inline-flex items-center gap-1 rounded-md font-semibold border bg-blue-50 border-blue-200 text-blue-800 whitespace-nowrap ${sizeStyles} ${className}`}
        >
          <Clock className="h-3 w-3 text-blue-600 shrink-0" />
          <span>In Progress</span>
        </span>
      );
    case "ASSIGNED":
      return (
        <span
          className={`inline-flex items-center gap-1 rounded-md font-semibold border bg-sky-50 border-sky-200 text-sky-800 whitespace-nowrap ${sizeStyles} ${className}`}
        >
          <ShieldCheck className="h-3 w-3 text-sky-600 shrink-0" />
          <span>Assigned</span>
        </span>
      );
    case "NEEDS_CLARIFICATION":
      return (
        <span
          className={`inline-flex items-center gap-1 rounded-md font-semibold border bg-amber-50 border-amber-200 text-amber-800 whitespace-nowrap ${sizeStyles} ${className}`}
        >
          <HelpCircle className="h-3 w-3 text-amber-600 shrink-0" />
          <span>Needs Clarification</span>
        </span>
      );
    case "ESCALATED":
      return (
        <span
          className={`inline-flex items-center gap-1 rounded-md font-semibold border bg-rose-50 border-rose-200 text-rose-800 whitespace-nowrap ${sizeStyles} ${className}`}
        >
          <AlertCircle className="h-3 w-3 text-rose-600 shrink-0" />
          <span>Escalated</span>
        </span>
      );
    case "AI_ANALYZED":
      return (
        <span
          className={`inline-flex items-center gap-1 rounded-md font-semibold border bg-indigo-50 border-indigo-200 text-indigo-800 whitespace-nowrap ${sizeStyles} ${className}`}
        >
          <span>AI Analysed</span>
        </span>
      );
    case "READY_FOR_ROUTING":
      return (
        <span
          className={`inline-flex items-center gap-1 rounded-md font-semibold border bg-cyan-50 border-cyan-200 text-cyan-800 whitespace-nowrap ${sizeStyles} ${className}`}
        >
          <span>Ready for Routing</span>
        </span>
      );
    case "CLOSED":
      return (
        <span
          className={`inline-flex items-center gap-1 rounded-md font-semibold border bg-slate-100 border-slate-200 text-slate-700 whitespace-nowrap ${sizeStyles} ${className}`}
        >
          <span>Closed</span>
        </span>
      );
    case "NEW":
    default:
      return (
        <span
          className={`inline-flex items-center gap-1 rounded-md font-semibold border bg-slate-100 border-slate-200 text-slate-700 whitespace-nowrap ${sizeStyles} ${className}`}
        >
          <span>{s.replace("_", " ")}</span>
        </span>
      );
  }
};

export default StatusBadge;

"use client";

import React from "react";
import { Clock, AlertTriangle, CheckCircle2, PauseCircle } from "lucide-react";

export interface SLABadgeProps {
  status?: string | null;
  className?: string;
  size?: "sm" | "md";
}

export const SLABadge: React.FC<SLABadgeProps> = ({
  status,
  className = "",
  size = "md",
}) => {
  const s = (status || "WITHIN_SLA").toUpperCase().trim();
  const sizeStyles = size === "sm" ? "text-[10px] px-1.5 py-0.5" : "text-[11px] px-2 py-0.5";

  switch (s) {
    case "BREACHED":
      return (
        <span
          className={`inline-flex items-center gap-1 rounded-md font-bold border bg-rose-50 border-rose-200 text-rose-800 whitespace-nowrap ${sizeStyles} ${className}`}
        >
          <AlertTriangle className="h-3 w-3 text-rose-600 shrink-0" />
          <span>SLA Breached</span>
        </span>
      );
    case "AT_RISK":
      return (
        <span
          className={`inline-flex items-center gap-1 rounded-md font-bold border bg-amber-50 border-amber-200 text-amber-800 whitespace-nowrap ${sizeStyles} ${className}`}
        >
          <Clock className="h-3 w-3 text-amber-600 shrink-0" />
          <span>At Risk</span>
        </span>
      );
    case "PAUSED":
      return (
        <span
          className={`inline-flex items-center gap-1 rounded-md font-medium border bg-slate-100 border-slate-200 text-slate-700 whitespace-nowrap ${sizeStyles} ${className}`}
        >
          <PauseCircle className="h-3 w-3 text-slate-500 shrink-0" />
          <span>Awaiting Citizen</span>
        </span>
      );
    case "RESOLVED":
      return (
        <span
          className={`inline-flex items-center gap-1 rounded-md font-medium border bg-emerald-50 border-emerald-200 text-emerald-800 whitespace-nowrap ${sizeStyles} ${className}`}
        >
          <CheckCircle2 className="h-3 w-3 text-emerald-600 shrink-0" />
          <span>Met SLA</span>
        </span>
      );
    case "WITHIN_SLA":
    default:
      return (
        <span
          className={`inline-flex items-center gap-1 rounded-md font-semibold border bg-emerald-50 border-emerald-200 text-emerald-800 whitespace-nowrap ${sizeStyles} ${className}`}
        >
          <Clock className="h-3 w-3 text-emerald-600 shrink-0" />
          <span>Within SLA</span>
        </span>
      );
  }
};

export default SLABadge;

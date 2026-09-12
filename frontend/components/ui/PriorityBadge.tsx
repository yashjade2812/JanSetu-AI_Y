"use client";

import React from "react";
import { AlertTriangle, AlertCircle, Clock, Info } from "lucide-react";

export interface PriorityBadgeProps {
  priority?: string | null;
  className?: string;
  size?: "sm" | "md";
  showIcon?: boolean;
}

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({
  priority,
  className = "",
  size = "md",
  showIcon = false,
}) => {
  const p = (priority || "P3").toUpperCase().trim();

  const sizeStyles = size === "sm" ? "text-[10px] px-1.5 py-0.5" : "text-[11px] px-2 py-0.5";

  switch (p) {
    case "P0":
      return (
        <span
          className={`inline-flex items-center gap-1 rounded font-bold uppercase tracking-wider bg-rose-600 text-white shadow-2xs whitespace-nowrap ${sizeStyles} ${className}`}
          title="P0 Critical - Immediate hazard / high-urgency priority"
        >
          {showIcon && <AlertTriangle className="h-3 w-3 shrink-0 animate-pulse" />}
          <span>P0 Critical</span>
        </span>
      );
    case "P1":
      return (
        <span
          className={`inline-flex items-center gap-1 rounded font-bold uppercase tracking-wider bg-orange-600 text-white shadow-2xs whitespace-nowrap ${sizeStyles} ${className}`}
          title="P1 High - Severe disruption / 12h resolution target"
        >
          {showIcon && <AlertCircle className="h-3 w-3 shrink-0" />}
          <span>P1 High</span>
        </span>
      );
    case "P2":
      return (
        <span
          className={`inline-flex items-center gap-1 rounded font-bold uppercase tracking-wider bg-amber-500 text-white shadow-2xs whitespace-nowrap ${sizeStyles} ${className}`}
          title="P2 Medium - Moderate disruption / 24h resolution target"
        >
          {showIcon && <Clock className="h-3 w-3 shrink-0" />}
          <span>P2 Med</span>
        </span>
      );
    case "P3":
    default:
      return (
        <span
          className={`inline-flex items-center gap-1 rounded font-bold uppercase tracking-wider bg-blue-600 text-white shadow-2xs whitespace-nowrap ${sizeStyles} ${className}`}
          title="P3 Low - Routine inquiry / 48h resolution target"
        >
          {showIcon && <Info className="h-3 w-3 shrink-0" />}
          <span>P3 Low</span>
        </span>
      );
  }
};

export default PriorityBadge;

"use client";

import React from "react";

export interface DashboardMetricCardProps {
  label?: string;
  title?: string;
  value: string | number;
  subtext?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  variant?: "neutral" | "critical" | "warning" | "success" | "purple" | "blue";
  className?: string;
}

export const DashboardMetricCard: React.FC<DashboardMetricCardProps> = ({
  label,
  title,
  value,
  subtext,
  subtitle,
  icon,
  variant = "neutral",
  className = "",
}) => {
  const displayLabel = label || title || "";
  const displaySubtext = subtext || subtitle;
  const variantStyles = {
    neutral: "border-slate-200 bg-white text-slate-900",
    critical: "border-rose-300 bg-rose-50/70 text-rose-800",
    warning: "border-amber-300 bg-amber-50/70 text-amber-800",
    success: "border-emerald-200 bg-emerald-50/70 text-emerald-800",
    purple: "border-purple-200 bg-purple-50/70 text-purple-900",
    blue: "border-[#1F5E91]/20 bg-blue-50/60 text-[#123B5D]",
  }[variant];

  const labelColor = {
    neutral: "text-slate-500",
    critical: "text-rose-700",
    warning: "text-amber-700",
    success: "text-emerald-700",
    purple: "text-purple-700",
    blue: "text-[#1F5E91]",
  }[variant];

  const numberColor = {
    neutral: "text-slate-900",
    critical: "text-rose-700",
    warning: "text-amber-700",
    success: "text-emerald-700",
    purple: "text-purple-900",
    blue: "text-[#123B5D]",
  }[variant];

  return (
    <div
      className={`rounded-xl border p-4 sm:p-5 shadow-xs transition hover:shadow-sm ${variantStyles} ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={`text-[10px] sm:text-xs font-bold uppercase tracking-wider block truncate ${labelColor}`}>
          {displayLabel}
        </span>
        {icon && <div className="shrink-0">{icon}</div>}
      </div>
      <span className={`text-2xl sm:text-3xl font-black mt-1.5 sm:mt-2 block tracking-tight ${numberColor}`}>
        {value}
      </span>
      {displaySubtext && (
        <span className="text-[11px] text-slate-500 mt-1 block truncate">
          {displaySubtext}
        </span>
      )}
    </div>
  );
};

export default DashboardMetricCard;

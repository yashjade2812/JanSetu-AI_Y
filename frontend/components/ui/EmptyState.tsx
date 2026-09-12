"use client";

import React from "react";
import { SearchX, Inbox } from "lucide-react";

export interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode | React.ElementType;
  actionText?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = "No records found",
  description = "There are currently no items matching your criteria.",
  icon,
  actionText,
  actionLabel,
  onAction,
  className = "",
}) => {
  const displayActionText = actionText || actionLabel;

  const renderIcon = () => {
    if (!icon) return <Inbox className="h-5 w-5" />;
    if (React.isValidElement(icon)) return icon;
    if (typeof icon === "function" || typeof icon === "object") {
      const IconComp = icon as React.ElementType;
      return <IconComp className="h-5 w-5" />;
    }
    return null;
  };

  return (
    <div
      className={`rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center flex flex-col items-center justify-center ${className}`}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-400 mb-3 border border-slate-200">
        {renderIcon()}
      </div>
      <h3 className="text-sm font-bold text-slate-800">{title}</h3>
      <p className="text-xs text-slate-500 mt-1 max-w-sm">{description}</p>
      {displayActionText && onAction && (
        <button
          onClick={onAction}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[#1F5E91] hover:bg-[#123B5D] px-3.5 py-1.5 text-xs font-bold text-white transition shadow-xs cursor-pointer"
        >
          {displayActionText}
        </button>
      )}
    </div>
  );
};

export default EmptyState;

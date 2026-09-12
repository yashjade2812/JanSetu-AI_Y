"use client";

import React from "react";
import Link from "next/link";

export interface JanSetuLogoProps {
  /** "full" renders the bridge SVG with typography & metadata; "icon" renders the bridge SVG mark only */
  variant?: "full" | "icon";
  /** sm = 32px high, md = 44px high (40-52px range), lg = 56px high */
  size?: "sm" | "md" | "lg";
  /** "light" (for white/light backgrounds) or "dark" (for navy/slate backgrounds) */
  theme?: "light" | "dark";
  /** Show the "PMC Portal" badge next to title */
  showBadge?: boolean;
  /** Show the "AI-Powered Citizen Service Platform" tagline */
  showTagline?: boolean;
  /** Optional clickable destination */
  href?: string;
  /** Additional container classes */
  className?: string;
}

export const JanSetuLogo: React.FC<JanSetuLogoProps> = ({
  variant = "full",
  size = "md",
  theme = "light",
  showBadge = true,
  showTagline = true,
  href,
  className = "",
}) => {
  const isDark = theme === "dark";

  // Exact 2:1 ratio matching the uploaded SVG (1549x775)
  const sizeConfig = {
    sm: {
      box: "h-8 w-16",
      rounded: "rounded-lg",
      title: "text-lg",
      badge: "text-[9px] px-1.5 py-0.5",
      tagline: "text-[10px]",
      gap: "gap-2.5",
    },
    md: {
      // 44px height is within the recommended 40-52px range
      box: "h-11 w-[88px]",
      rounded: "rounded-xl",
      title: "text-2xl",
      badge: "text-[10px] px-2 py-0.5",
      tagline: "text-[11px]",
      gap: "gap-3.5",
    },
    lg: {
      box: "h-14 w-28",
      rounded: "rounded-2xl",
      title: "text-3xl",
      badge: "text-xs px-2.5 py-0.5",
      tagline: "text-xs",
      gap: "gap-4",
    },
  }[size];

  // SVG Bridge Logo Mark
  const logoMark = (
    <div
      className={`relative inline-flex items-center justify-center overflow-hidden shrink-0 shadow-md ${
        sizeConfig.rounded
      } ${sizeConfig.box} ${
        isDark
          ? "border border-white/20 bg-[#003669]"
          : "border-2 border-[#1F5E91] bg-[#003669]"
      } transition-transform duration-200 hover:scale-[1.02]`}
    >
      <img
        src="/branding/jansetu-logo.svg"
        alt="JanSetu AI Official Bridge Logo"
        className="h-full w-full object-contain pointer-events-none select-none"
        loading="eager"
      />
    </div>
  );

  if (variant === "icon") {
    if (href) {
      return (
        <Link
          href={href}
          className={`inline-flex items-center focus:outline-none focus:ring-2 focus:ring-[#F39A32]/50 ${sizeConfig.rounded} ${className}`}
          aria-label="JanSetu AI Home"
        >
          {logoMark}
        </Link>
      );
    }
    return <div className={`inline-flex items-center ${className}`}>{logoMark}</div>;
  }

  // Full Variant with Typography & Metadata
  const content = (
    <div className={`inline-flex items-center ${sizeConfig.gap} ${className}`}>
      {logoMark}
      <div className="flex flex-col justify-center leading-tight">
        <div className="flex items-center gap-2">
          <span
            className={`font-black tracking-tight ${sizeConfig.title} ${
              isDark ? "text-white" : "text-[#123B5D]"
            }`}
          >
            JanSetu <span className="text-[#F39A32]">AI</span>
          </span>
          {showBadge && (
            <span
              className={`hidden sm:inline-block font-extrabold uppercase tracking-wide rounded-md border ${
                sizeConfig.badge
              } ${
                isDark
                  ? "bg-white/10 text-white/90 border-white/20"
                  : "bg-[#1F5E91]/10 text-[#1F5E91] border-[#1F5E91]/20"
              }`}
            >
              PMC Portal
            </span>
          )}
        </div>
        {showTagline && (
          <p
            className={`font-semibold tracking-tight ${sizeConfig.tagline} ${
              isDark ? "text-white/70" : "text-[#667085]"
            }`}
          >
            From Citizen Voice to Government Action
          </p>
        )}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="inline-flex items-center focus:outline-none focus:ring-2 focus:ring-[#F39A32]/50 rounded-xl group"
        aria-label="JanSetu AI Home"
      >
        {content}
      </Link>
    );
  }

  return content;
};

export default JanSetuLogo;

"use client";

import React from "react";
import Link from "next/link";
import { FileEdit, BrainCircuit, CornerDownRight, CheckCircle, ArrowRight, ShieldCheck } from "lucide-react";
import { useTranslation } from "../../context/LanguageContext";

export const HowItWorksSection: React.FC = () => {
  const { t } = useTranslation();

  const steps = [
    {
      step: "01",
      title: t("howItWorks.step1Title"),
      desc: t("howItWorks.step1Desc"),
      icon: FileEdit,
      pillBg: "bg-[#1F5E91] text-white",
    },
    {
      step: "02",
      title: t("howItWorks.step2Title"),
      desc: t("howItWorks.step2Desc"),
      icon: BrainCircuit,
      pillBg: "bg-[#1F5E91] text-white",
    },
    {
      step: "03",
      title: t("howItWorks.step3Title"),
      desc: t("howItWorks.step3Desc"),
      icon: CornerDownRight,
      pillBg: "bg-[#1F5E91] text-white",
    },
    {
      step: "04",
      title: t("howItWorks.step4Title"),
      desc: t("howItWorks.step4Desc"),
      icon: CheckCircle,
      pillBg: "bg-[#1F5E91] text-white",
    },
  ];

  return (
    <section className="py-14 sm:py-20 bg-white border-b border-[#E9E9E9]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-14">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-[#1F5E91]/10 px-3.5 py-1 text-xs font-bold text-[#1F5E91] border border-[#1F5E91]/20 mb-3">
            <ShieldCheck className="h-3.5 w-3.5 text-[#F39A32]" />
            <span>{t("howItWorks.tag")}</span>
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-[#123B5D] tracking-tight">
            {t("howItWorks.title")}
          </h2>
          <p className="mt-2 text-sm sm:text-base text-[#667085]">
            {t("howItWorks.subtitle")}
          </p>
        </div>

        {/* 4 Connected Step Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 relative">
          {steps.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className="relative rounded-2xl border border-[#E9E9E9] bg-[#F5F4F0] p-6 flex flex-col justify-between hover:shadow-md transition-all hover:-translate-y-0.5"
              >
                <div>
                  {/* Step badge & Icon */}
                  <div className="flex items-center justify-between mb-4">
                    <span className={`flex h-10 w-10 items-center justify-center rounded-xl font-black text-sm shadow-sm ${item.pillBg}`}>
                      {item.step}
                    </span>
                    <div className="p-2 rounded-lg bg-white text-[#1F5E91] border border-[#E9E9E9]">
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>

                  <h3 className="text-lg font-bold text-[#1F2933]">
                    {item.title}
                  </h3>
                  <p className="text-xs text-[#667085] mt-2 leading-relaxed">
                    {item.desc}
                  </p>
                </div>

                <div className="mt-6 pt-3 border-t border-[#E9E9E9] text-[11px] font-bold text-[#1F5E91] flex items-center justify-between">
                  <span>{t("howItWorks.stepCounter", { current: idx + 1 })}</span>
                  {idx < steps.length - 1 ? (
                    <ArrowRight className="h-3.5 w-3.5 text-[#667085] hidden lg:block" />
                  ) : (
                    <span className="text-emerald-600">{t("howItWorks.complete")}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Detailed Architecture Link */}
        <div className="text-center mt-10">
          <Link
            href="/how-it-works"
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-[#1F5E91] hover:text-[#123B5D] transition"
          >
            <span>{t("howItWorks.explorePipeline")}</span>
            <ArrowRight className="h-4 w-4 text-[#F39A32]" />
          </Link>
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection;

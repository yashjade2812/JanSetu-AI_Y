"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FileText,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Send,
  Copy,
  Check,
  Building2,
  Star,
  LayoutDashboard,
  RotateCcw,
  ShieldCheck,
  Lock,
} from "lucide-react";
import PublicNavbar from "../../components/navigation/PublicNavbar";
import Footer from "../../components/layout/Footer";
import { submitComplaint, analyzeTextLive, saveComplaintDraft } from "../../lib/api";
import { useTranslation } from "../../context/LanguageContext";
import { useAuth } from "../../hooks/useAuth";
import LocationPicker from "../../components/location/LocationPicker";
import { validateComplaintForm } from "../../lib/validation/mandatoryValidation";

const DRAFT_LOCAL_STORAGE_KEY = "jansetu_report_draft";

function ReportFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isDraftFromUrl = searchParams.get("draft") === "true";

  const { t, language } = useTranslation();
  const { user, isAuthenticated, refreshProfile } = useAuth();

  // Form state
  const [rawText, setRawText] = useState("");
  const [locationName, setLocationName] = useState("");
  const [latitude, setLatitude] = useState<number | undefined>(undefined);
  const [longitude, setLongitude] = useState<number | undefined>(undefined);

  // Validation & Auto-Focus refs & state
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const locationInputRef = useRef<HTMLInputElement>(null);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  // AI & Submission state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiPreview, setAiPreview] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);
  const [submitSuccess, setSubmitSuccess] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedTracking, setCopiedTracking] = useState(false);
  const [draftRestoredBanner, setDraftRestoredBanner] = useState(false);

  // Real-time authoritative semantic validation
  const formValidation = validateComplaintForm({
    rawText,
    locationName,
    category: aiPreview?.summary,
    department: aiPreview?.department,
  });
  const descValidation = formValidation.validations.raw_text;
  const locValidation = formValidation.validations.location;

  // Restore draft on mount if available
  useEffect(() => {
    try {
      const savedDraft = localStorage.getItem(DRAFT_LOCAL_STORAGE_KEY);
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft);
        if (parsed.rawText) setRawText(parsed.rawText);
        if (parsed.locationName || parsed.locationAddress) setLocationName(parsed.locationName || parsed.locationAddress);
        if (parsed.latitude) setLatitude(parsed.latitude);
        if (parsed.longitude) setLongitude(parsed.longitude);
        if (parsed.aiPreview) setAiPreview(parsed.aiPreview);
        setDraftRestoredBanner(true);
      }
    } catch (e) {
      console.warn("Could not restore local draft:", e);
    }
  }, [isDraftFromUrl]);

  const clearDraft = () => {
    localStorage.removeItem(DRAFT_LOCAL_STORAGE_KEY);
    setRawText("");
    setLocationName("");
    setLatitude(undefined);
    setLongitude(undefined);
    setAiPreview(null);
    setDraftRestoredBanner(false);
  };

  // Instant AI check
  const handlePreAnalyze = async () => {
    if (!rawText.trim() || rawText.trim().length < 5) return;
    setIsAnalyzing(true);
    setErrorMessage(null);
    try {
      const res = await analyzeTextLive(rawText, language);
      setAiPreview(res);
      if (res.extracted_location && !locationName) {
        setLocationName(res.extracted_location);
      }
    } catch (err: any) {
      console.error("AI triage error:", err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Silent background AI triage check (debounced)
  useEffect(() => {
    if (rawText.trim().length < 10) return;
    const timer = setTimeout(() => {
      handlePreAnalyze();
    }, 1200);
    return () => clearTimeout(timer);
  }, [rawText, language]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Prevent duplicate submission events
    if (isSubmitting || isSubmittingRef.current) return;

    // Strict Mandatory Validation Gate
    if (!formValidation.canSubmit) {
      setHasAttemptedSubmit(true);
      const firstUnres = formValidation.firstUnresolved;
      setFocusedField(firstUnres?.field || null);

      if (firstUnres?.field === "raw_text") {
        setErrorMessage(firstUnres.question || "Please provide a valid description for your grievance. Could you please provide more details about the issue?");
        descriptionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        descriptionRef.current?.focus();
      } else if (firstUnres?.field === "location") {
        setErrorMessage(firstUnres.question || "Please provide or select a location in Pune for your grievance. Where is this issue located?");
        locationInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        locationInputRef.current?.focus();
      } else {
        setErrorMessage(firstUnres?.question || "Please complete all mandatory information before submitting. Could you please provide the missing required information?");
      }
      return;
    }

    // If citizen is unauthenticated, preserve draft and redirect to login
    if (!isAuthenticated) {
      const draftPayload = {
        rawText,
        locationName: locationName.trim(),
        locationAddress: locationName.trim(),
        latitude,
        longitude,
        language,
        aiPreview,
        savedAt: new Date().toISOString(),
      };

      try {
        localStorage.setItem(DRAFT_LOCAL_STORAGE_KEY, JSON.stringify(draftPayload));
        // Save to backend draft storage as well
        await saveComplaintDraft({
          complaint_data: draftPayload,
        });
      } catch (err) {
        console.warn("Could not save backend draft:", err);
      }

      router.push("/login?redirect=/report&draft=true");
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const result = await submitComplaint({
        raw_text: rawText,
        preferred_language: language,
        location_name: locationName.trim() || undefined,
        location_address: locationName.trim() || undefined,
        latitude: typeof latitude === "number" && !isNaN(latitude) ? latitude : undefined,
        longitude: typeof longitude === "number" && !isNaN(longitude) ? longitude : undefined,
        client_timestamp: new Date().toISOString(),
      });

      // Clear draft upon successful submission
      localStorage.removeItem(DRAFT_LOCAL_STORAGE_KEY);
      setDraftRestoredBanner(false);
      setSubmitSuccess(result);

      // Refresh profile to reflect +10 credits and new badges
      await refreshProfile();
    } catch (err: any) {
      setErrorMessage(err.message || "Unable to submit your complaint. Please try again.");
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTracking(true);
    setTimeout(() => setCopiedTracking(false), 2500);
  };

  return (
    <div className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 sm:px-6 lg:px-8">
      {/* If submitted successfully, show confirmation screen */}
      {submitSuccess ? (
        <div className="rounded-2xl border border-[#E9E9E9] bg-white p-8 sm:p-12 shadow-md text-center animate-in fade-in zoom-in-95 duration-300">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 mb-6 shadow-sm">
            <CheckCircle2 className="h-10 w-10" />
          </div>

          <span className="rounded-full bg-emerald-100 px-3.5 py-1 text-xs font-black text-emerald-800 border border-emerald-300 uppercase tracking-wider">
            {t("reportPage.successBadge") || "Grievance Registered"}
          </span>

          <h1 className="mt-4 text-3xl font-black text-[#123B5D] tracking-tight">
            {t("reportPage.successTitle") || "Complaint Submitted Successfully"}
          </h1>

          <p className="mt-2 text-sm text-[#667085] max-w-lg mx-auto">
            {t("reportPage.successSubtitle") ||
              "Your grievance has been securely logged with the Pune Municipal Corporation and routed for immediate review."}
          </p>

          {/* Civic Credits Award Celebration */}
          <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-amber-50 px-4 py-1.5 text-xs font-bold text-amber-900 border border-amber-300 shadow-xs animate-bounce">
            <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
            <span>+10 Civic Credits Earned for Citizen Participation!</span>
          </div>

          {/* Official Tracking ID Card */}
          <div className="mt-8 rounded-2xl bg-[#123B5D] text-white p-6 max-w-md mx-auto shadow-lg text-left border-2 border-[#1F5E91]">
            <div className="flex items-center justify-between text-[11px] font-bold text-white/70 uppercase tracking-widest">
              <span>{t("reportPage.trackingCardTitle") || "Tracking Number"}</span>
              <span className="text-[#F39A32]">{t("reportPage.trackingCardSave") || "Save for Reference"}</span>
            </div>

            <div className="mt-2 flex items-center justify-between bg-white/10 p-3 rounded-xl border border-white/10">
              <span className="text-xl sm:text-2xl font-mono font-black text-[#F39A32] tracking-wider select-all">
                {submitSuccess.tracking_number}
              </span>
              <button
                onClick={() => copyToClipboard(submitSuccess.tracking_number)}
                className="p-2 rounded-lg bg-white/15 hover:bg-white/25 text-white transition active:scale-95"
                title="Copy Tracking Number"
              >
                {copiedTracking ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>

            <div className="mt-4 pt-4 border-t border-white/15 grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-white/60 block text-[10px] uppercase font-bold">
                  {t("reportPage.initialStatus") || "Current Status"}
                </span>
                <span className="font-semibold text-emerald-400 mt-0.5 block">
                  {submitSuccess.status}
                </span>
              </div>
              <div>
                <span className="text-white/60 block text-[10px] uppercase font-bold">
                  {t("reportPage.assignedDepartment") || "Assigned Department"}
                </span>
                <span className="font-semibold text-cyan-300 mt-0.5 block truncate">
                  {submitSuccess.ai_preview?.department?.replace("_", " ") || "Municipal Dept"}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-8 flex flex-col sm:flex-row justify-center gap-4">
            <Link
              href={`/track?id=${submitSuccess.tracking_number}`}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1F5E91] hover:bg-[#123B5D] px-6 py-3.5 text-sm font-bold text-white shadow-md transition-all active:scale-[0.98]"
            >
              <span>Track Online</span>
              <ArrowRight className="h-4 w-4" />
            </Link>

            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#F5F4F0] hover:bg-[#E9E9E9] border border-[#E9E9E9] px-6 py-3.5 text-sm font-bold text-[#123B5D] transition"
            >
              <LayoutDashboard className="h-4 w-4 text-[#1F5E91]" />
              <span>Go to Citizen Dashboard</span>
            </Link>

            <button
              onClick={() => {
                setSubmitSuccess(null);
                setRawText("");
                setLocationName("");
                setLatitude(undefined);
                setLongitude(undefined);
                setAiPreview(null);
              }}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#E9E9E9] bg-white hover:bg-[#F5F4F0] px-5 py-3.5 text-sm font-bold text-[#667085] transition"
            >
              Report Another Issue
            </button>
          </div>
        </div>
      ) : (
        /* Intake Form */
        <div className="rounded-2xl border border-[#E9E9E9] bg-white p-6 sm:p-10 shadow-sm space-y-6">
          {/* Draft Restored Notice Banner */}
          {draftRestoredBanner && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-xs flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5 text-[#1F5E91]">
                <RotateCcw className="h-4 w-4 shrink-0" />
                <span>
                  <strong>Draft Restored:</strong> Your previously entered grievance has been restored. Review and click Submit when ready.
                </span>
              </div>
              <button
                type="button"
                onClick={clearDraft}
                className="text-xs font-bold text-[#667085] hover:text-rose-600 underline whitespace-nowrap"
              >
                Clear Draft
              </button>
            </div>
          )}

          {/* Form Top Banner */}
          <div className="flex items-center justify-between border-b border-[#E9E9E9] pb-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#123B5D] text-white shadow-md border-2 border-[#1F5E91]">
                <FileText className="h-6 w-6 text-[#F39A32]" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-[#123B5D] tracking-tight">
                  {t("reportPage.formTitle") || "Report Civic Grievance"}
                </h1>
                <p className="text-xs text-[#667085] mt-0.5">
                  {t("reportPage.formSubtitle") || "AI analyzes issue urgency, assigns department, and awards civic credits."}
                </p>
              </div>
            </div>

            {isAuthenticated && user && (
              <div className="hidden sm:flex items-center gap-2 bg-[#F5F4F0] border border-[#E9E9E9] px-3 py-1.5 rounded-xl">
                <ShieldCheck className="h-4 w-4 text-[#1F5E91]" />
                <span className="text-xs font-bold text-[#123B5D]">
                  Filing as {user.full_name}
                </span>
              </div>
            )}
          </div>

          {errorMessage && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-800 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Main Grievance Narrative */}
            <div>
              <div className="mb-2">
                <label className="text-xs font-bold uppercase tracking-wider text-[#1F2933] flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-[#1F5E91]" />
                  {t("reportPage.describeLabel") || "Describe the Issue"} <span className="text-rose-500">*</span>
                </label>
              </div>
              <textarea
                ref={descriptionRef}
                rows={4}
                value={rawText}
                onChange={(e) => {
                  setRawText(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                onBlur={() => {
                  if (rawText.length > 10 && !aiPreview) {
                    handlePreAnalyze();
                  }
                }}
                placeholder={t("reportPage.textareaPlaceholder") || "e.g. Water pipeline leak near Baner road causing road flooding..."}
                className={`w-full rounded-xl border p-4 text-xs sm:text-sm text-[#1F2933] placeholder-[#667085] bg-white leading-relaxed transition ${
                  (hasAttemptedSubmit || rawText.length > 0) && descValidation.status !== "VALID"
                    ? "border-rose-400 ring-2 ring-rose-200 focus:border-rose-500 focus:ring-rose-300"
                    : "border-[#E9E9E9] focus:border-[#1F5E91] focus:outline-none focus:ring-1 focus:ring-[#1F5E91]"
                }`}
              />

              {/* Description Inline Clarification Banner */}
              {(hasAttemptedSubmit || rawText.length > 0) && descValidation.status !== "VALID" && (
                <div
                  id="desc-clarification"
                  role="alert"
                  className={`mt-2 rounded-xl p-3 text-xs flex items-start gap-2.5 transition-all duration-200 border ${
                    descValidation.status === "INVALID"
                      ? "bg-rose-50 border-rose-200 text-rose-900"
                      : descValidation.status === "INSUFFICIENT"
                      ? "bg-amber-50 border-amber-200 text-amber-900"
                      : "bg-blue-50 border-blue-200 text-blue-900"
                  }`}
                >
                  <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                    <span className="px-1.5 py-0.5 text-[10px] font-black rounded uppercase bg-rose-600 text-white tracking-wider">
                      {descValidation.requirement}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 text-[10px] font-bold rounded uppercase ${
                        descValidation.status === "INVALID"
                          ? "bg-rose-200 text-rose-800"
                          : descValidation.status === "INSUFFICIENT"
                          ? "bg-amber-200 text-amber-800"
                          : "bg-slate-200 text-slate-800"
                      }`}
                    >
                      {descValidation.status}
                    </span>
                  </div>
                  <p className="font-medium leading-relaxed flex-1">
                    {descValidation.question}
                  </p>
                </div>
              )}
            </div>

            {/* Location Picker with GPS & Map */}
            <div>
              <LocationPicker
                id="location-input"
                inputRef={locationInputRef}
                hasError={(hasAttemptedSubmit || locationName.length > 0) && locValidation.status !== "VALID"}
                value={locationName}
                latitude={latitude}
                longitude={longitude}
                required={true}
                onChange={(address, lat, lng) => {
                  setLocationName(address);
                  setLatitude(lat);
                  setLongitude(lng);
                  if (errorMessage) setErrorMessage(null);
                }}
              />

              {/* Location Inline Clarification Banner */}
              {(hasAttemptedSubmit || locationName.length > 0) && locValidation.status !== "VALID" && (
                <div
                  id="location-clarification"
                  role="alert"
                  className={`mt-2.5 rounded-xl p-3 text-xs flex items-start gap-2.5 transition-all duration-200 border ${
                    locValidation.status === "INVALID"
                      ? "bg-rose-50 border-rose-200 text-rose-900"
                      : locValidation.status === "INSUFFICIENT"
                      ? "bg-amber-50 border-amber-200 text-amber-900"
                      : "bg-blue-50 border-blue-200 text-blue-900"
                  }`}
                >
                  <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                    <span className="px-1.5 py-0.5 text-[10px] font-black rounded uppercase bg-rose-600 text-white tracking-wider">
                      {locValidation.requirement}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 text-[10px] font-bold rounded uppercase ${
                        locValidation.status === "INVALID"
                          ? "bg-rose-200 text-rose-800"
                          : locValidation.status === "INSUFFICIENT"
                          ? "bg-amber-200 text-amber-800"
                          : "bg-slate-200 text-slate-800"
                      }`}
                    >
                      {locValidation.status}
                    </span>
                  </div>
                  <p className="font-medium leading-relaxed flex-1">
                    {locValidation.question}
                  </p>
                </div>
              )}
            </div>

            {/* Submit Bar */}
            <div className="pt-4 border-t border-[#E9E9E9] flex items-center justify-between">
              <Link
                href="/"
                className="text-xs font-bold text-[#667085] hover:text-[#1F2933]"
              >
                Cancel
              </Link>

              <div className="flex items-center gap-3">
                {!isAuthenticated && (
                  <span className="text-xs text-[#667085] hidden sm:flex items-center gap-1">
                    <Lock className="h-3 w-3 text-amber-600" />
                    <span>Signing in saves draft & earns credits</span>
                  </span>
                )}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#1F5E91] hover:bg-[#123B5D] px-6 py-3 text-xs sm:text-sm font-bold text-white shadow hover:shadow-md disabled:opacity-50 transition active:scale-95 cursor-pointer"
                >
                  <Send className="h-4 w-4" />
                  <span>
                    {isSubmitting
                      ? "Submitting Grievance..."
                      : isAuthenticated
                      ? "Submit Grievance (+10 Credits)"
                      : "Sign In & Submit Draft"}
                  </span>
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default function ReportPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-[#F5F4F0] flex flex-col selection:bg-[#1F5E91] selection:text-white">
      <PublicNavbar />

      {/* Page Breadcrumb / Header */}
      <div className="bg-white border-b border-[#E9E9E9] py-4">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-[#667085]">
            <Link href="/" className="hover:text-[#1F5E91]">{t("reportPage.breadcrumbHome") || "Home"}</Link>
            <span>/</span>
            <span className="font-bold text-[#1F2933]">{t("reportPage.breadcrumbServices") || "Citizen Services"}</span>
            <span>/</span>
            <span className="font-bold text-[#1F5E91]">{t("reportPage.breadcrumbCurrent") || "Report Issue"}</span>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 text-xs font-bold text-[#123B5D]">
            <Building2 className="h-4 w-4 text-[#F39A32]" />
            <span>{t("reportPage.govMandate") || "Pune Municipal Corporation"}</span>
          </div>
        </div>
      </div>

      <main className="flex-1 flex flex-col">
        <Suspense fallback={<div className="p-8 text-center text-sm font-semibold text-[#667085]">Loading grievance console...</div>}>
          <ReportFormContent />
        </Suspense>
      </main>

      <Footer />
    </div>
  );
}

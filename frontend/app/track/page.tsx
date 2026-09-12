"use client";

import React, { useState, useEffect, useId } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Search,
  Shield,
  Clock,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Send,
  Building2,
  ArrowRight,
  FileText,
  Calendar,
  Layers,
  Copy,
  Check,
  User,
  Phone,
  UserCheck,
  AlertCircle,
  HelpCircle,
  Info,
  SearchX,
  Droplets,
  Zap,
  Truck,
  Trash2,
  Activity,
  Trees,
} from "lucide-react";
import PublicNavbar from "../../components/navigation/PublicNavbar";
import Footer from "../../components/layout/Footer";
import { trackComplaint, submitClarification, searchComplaintsByContact } from "../../lib/api";
import { useTranslation } from "../../context/LanguageContext";
import { formatDateIST } from "../../lib/date";
import ComplaintLocationCard from "../../components/location/ComplaintLocationCard";


// ─── TYPES & INTERFACES ──────────────────────────────────────────

type TrackingMethod = "trackingId" | "contactDetails";

interface TimelineEvent {
  status: string;
  timestamp: string;
  title: string;
  description: string;
}

interface GrievanceRecord {
  id: string;
  tracking_number: string;
  citizen_name: string;
  citizen_phone: string;
  raw_text: string;
  issue_summary: string;
  category: string;
  department_id: string;
  department_name: string;
  location_name: string;
  latitude?: number;
  longitude?: number;
  ward?: string;
  priority: "P0" | "P1" | "P2" | "P3";
  status: "NEW" | "ASSIGNED" | "IN_PROGRESS" | "NEEDS_CLARIFICATION" | "ESCALATED" | "RESOLVED" | "CLOSED";
  assigned_officer?: {
    name: string;
    designation: string;
    employee_id?: string;
    contact?: string;
  };
  assigned_personnel?: {
    name: string;
    designation: string;
    department: string;
    official_contact: string;
    assigned_date: string;
    work_status: string;
  } | null;
  submitted_date: string;
  last_updated_date: string;
  sla: {
    priority: string;
    status: "WITHIN_SLA" | "AT_RISK" | "BREACHED" | "PAUSED" | "RESOLVED";
    response_deadline?: string;
    resolution_deadline?: string;
    is_paused?: boolean;
  };
  progress_percent: number;
  next_expected_action: string;
  resolution_notes?: string;
  clarifications?: Array<{
    id: string;
    sender_type: string;
    question: string;
    answer?: string;
    answered_at?: string;
  }>;
  timeline: TimelineEvent[];
}

// ─── VERIFIED MOCK & SEED DATA ────────────────────────────────────

const MOCK_GRIEVANCES: GrievanceRecord[] = [
  {
    id: "complaint-001",
    tracking_number: "JS-2026-PUN-00101",
    citizen_name: "Pooja Kadam",
    citizen_phone: "9822012345",
    raw_text:
      "EMERGENCY: Live 11kV electrical wire has snapped and is hanging right over the footpath outside Modern College, Shivaji Nagar! Kids and pedestrians are passing by!",
    issue_summary: "Live 11kV exposed power cable hanging over pedestrian footpath",
    category: "Electricity & Live Wire Hazard",
    department_id: "ELECTRICITY",
    department_name: "Electricity Department",
    location_name: "Modern College Road, Shivaji Nagar",
    latitude: 18.5283,
    longitude: 73.8478,
    ward: "Ward 7 (Shivaji Nagar)",
    priority: "P0",
    status: "RESOLVED",
    assigned_officer: {
      name: "Mahesh Patil",
      designation: "Chief Electrical Officer",
      employee_id: "PMC-ENG-305",
      contact: "020-25501305",
    },
    submitted_date: "2026-09-11T10:30:00.000Z",
    last_updated_date: "2026-09-11T12:00:00.000Z",
    sla: {
      priority: "P0",
      status: "RESOLVED",
      response_deadline: "2026-09-11T11:30:00.000Z",
      resolution_deadline: "2026-09-11T14:30:00.000Z",
      is_paused: false,
    },
    progress_percent: 100,
    next_expected_action:
      "Grievance resolved and verified. Citizen closed ticket feedback recorded.",
    resolution_notes:
      "Emergency field crew EV-04 arrived on site. High-voltage 11kV conductor safely secured, reeled, and feeder energized without hazard.",
    timeline: [
      {
        status: "NEW",
        timestamp: "2026-09-11T10:30:00.000Z",
        title: "Grievance Lodged via Citizen Web Portal",
        description: "Emergency citizen submission recorded in Pune central grievance database.",
      },
      {
        status: "AI_ANALYZED",
        timestamp: "2026-09-11T10:32:00.000Z",
        title: "AI Instant Triage: P0 Critical Emergency",
        description: "JanSetu AI flagged severe public safety hazard and auto-notified City Command Center.",
      },
      {
        status: "ASSIGNED",
        timestamp: "2026-09-11T10:45:00.000Z",
        title: "Dispatched to Electricity Department",
        description: "Assigned to Chief Electrical Officer Mahesh Patil (PMC-ENG-305).",
      },
      {
        status: "IN_PROGRESS",
        timestamp: "2026-09-11T11:15:00.000Z",
        title: "Emergency Response Crew Dispatched",
        description: "Substation operator notified; field team vehicle EV-04 dispatched to Shivaji Nagar site.",
      },
      {
        status: "RESOLVED",
        timestamp: "2026-09-11T12:00:00.000Z",
        title: "Grievance Fully Resolved",
        description: "11kV wire safely reeled and footpath cleared. Citizen safety restored.",
      },
    ],
  },
  {
    id: "complaint-002",
    tracking_number: "JS-2026-PUN-00102",
    citizen_name: "Sneha Patil",
    citizen_phone: "9422019876",
    raw_text:
      "Massive 2-feet deep pothole right after Nal Stop Flyover on Karve Road. Two two-wheelers skidded yesterday evening.",
    issue_summary: "Dangerous deep pothole hazard following monsoon runoff",
    category: "Road Works & Potholes",
    department_id: "ROAD",
    department_name: "Road Department",
    location_name: "Nal Stop Flyover, Karve Road",
    latitude: 18.5074,
    longitude: 73.8322,
    ward: "Ward 12 (Kothrud)",
    priority: "P2",
    status: "IN_PROGRESS",
    assigned_officer: {
      name: "Suresh Shinde",
      designation: "Superintending Engineer, Road Works",
      employee_id: "PMC-ENG-204",
      contact: "020-25501204",
    },
    submitted_date: "2026-09-10T14:20:00.000Z",
    last_updated_date: "2026-09-11T09:45:00.000Z",
    sla: {
      priority: "P2",
      status: "WITHIN_SLA",
      response_deadline: "2026-09-11T14:20:00.000Z",
      resolution_deadline: "2026-09-13T14:20:00.000Z",
      is_paused: false,
    },
    progress_percent: 65,
    next_expected_action:
      "Cold-mix asphalt patch completed as safety measure. Heavy compaction roller scheduled for 14:00 today to apply permanent hot-mix bitumen overlay.",
    timeline: [
      {
        status: "NEW",
        timestamp: "2026-09-10T14:20:00.000Z",
        title: "Grievance Registered",
        description: "Citizen logged dangerous cavity with photo evidence on Karve Road.",
      },
      {
        status: "AI_ANALYZED",
        timestamp: "2026-09-10T14:25:00.000Z",
        title: "AI Correlated with Monsoon Incident Cluster",
        description: "Linked to active incident INC-2026-PUN-0002 for coordinated ward resurfacing.",
      },
      {
        status: "ASSIGNED",
        timestamp: "2026-09-10T17:00:00.000Z",
        title: "Work Order Approved by Road Department",
        description: "Assigned to Superintending Engineer Suresh Shinde. Maintenance crew allocated.",
      },
      {
        status: "IN_PROGRESS",
        timestamp: "2026-09-11T08:30:00.000Z",
        title: "Site Barricaded & Cold Patch Applied",
        description: "PMC road crew placed high-visibility safety cones and leveled initial stone base.",
      },
      {
        status: "IN_PROGRESS",
        timestamp: "2026-09-11T09:45:00.000Z",
        title: "Asphalt Compaction Scheduled",
        description: "Compaction roller transit confirmed for final permanent resurfacing.",
      },
    ],
  },
  {
    id: "complaint-003",
    tracking_number: "JS-2026-PUN-00103",
    citizen_name: "Deepak Kulkarni",
    citizen_phone: "9881023456",
    raw_text:
      "Municipal valve damaged near Kothrud bus depot causing localized low water pressure in 4 housing societies.",
    issue_summary: "Distribution valve malfunction repaired by maintenance crew",
    category: "Water Supply & Outages",
    department_id: "WATER_SUPPLY",
    department_name: "Water Supply Department",
    location_name: "Kothrud Depot, Paud Road",
    latitude: 18.5039,
    longitude: 73.8077,
    ward: "Ward 12 (Kothrud)",
    priority: "P2",
    status: "RESOLVED",
    assigned_officer: {
      name: "Anil Kulkarni",
      designation: "Executive Engineer, Water Supply",
      employee_id: "PMC-ENG-101",
      contact: "020-25501101",
    },
    submitted_date: "2026-09-09T08:00:00.000Z",
    last_updated_date: "2026-09-10T16:30:00.000Z",
    sla: {
      priority: "P2",
      status: "RESOLVED",
      response_deadline: "2026-09-10T08:00:00.000Z",
      resolution_deadline: "2026-09-12T08:00:00.000Z",
      is_paused: false,
    },
    progress_percent: 100,
    next_expected_action:
      "Grievance fully resolved and closed. Citizen SMS confirmation delivered; municipal quality audit satisfied.",
    resolution_notes:
      "300mm sluice valve replaced by Water Department crew. Pipeline pressure telemetry tested and verified at 2.4 bar.",
    timeline: [
      {
        status: "NEW",
        timestamp: "2026-09-09T08:00:00.000Z",
        title: "Grievance Received",
        description: "Low pressure reported by societies near Kothrud Depot.",
      },
      {
        status: "ASSIGNED",
        timestamp: "2026-09-09T09:15:00.000Z",
        title: "Field Inspection Executed",
        description: "Junior engineer identified broken valve spindle in underground distribution chamber.",
      },
      {
        status: "IN_PROGRESS",
        timestamp: "2026-09-09T14:30:00.000Z",
        title: "Replacement Valve Procured",
        description: "Replacement 300mm heavy-duty sluice valve dispatched from central PMC store.",
      },
      {
        status: "IN_PROGRESS",
        timestamp: "2026-09-10T12:00:00.000Z",
        title: "Installation & Flange Sealing",
        description: "Welders and fitters completed installation and conducted hydraulic pressure tests.",
      },
      {
        status: "RESOLVED",
        timestamp: "2026-09-10T16:30:00.000Z",
        title: "Official Resolution Completed",
        description: "Normal pressure verified at 2.4 bar across all connected housing societies.",
      },
    ],
  },
  {
    id: "complaint-004",
    tracking_number: "JS-2026-PUN-00104",
    citizen_name: "Kailash Jagtap",
    citizen_phone: "9890987654",
    raw_text:
      "Garbage has not been collected from Hadapsar vegetable market container for 4 days. Stray dogs and cows tearing bags, stench unbearable.",
    issue_summary: "Community garbage container overflowing for 4 consecutive days",
    category: "Solid Waste Management",
    department_id: "WASTE_MANAGEMENT",
    department_name: "Waste Management Department",
    location_name: "Hadapsar Sabzi Mandi, Pune-Solapur Road",
    latitude: 18.5018,
    longitude: 73.9263,
    ward: "Ward 19 (Hadapsar)",
    priority: "P2",
    status: "IN_PROGRESS",
    assigned_officer: {
      name: "Sunita Gaikwad",
      designation: "Head, Solid Waste Management",
      employee_id: "PMC-SWM-402",
      contact: "020-25501402",
    },
    submitted_date: "2026-09-10T11:00:00.000Z",
    last_updated_date: "2026-09-11T08:15:00.000Z",
    sla: {
      priority: "P2",
      status: "WITHIN_SLA",
      response_deadline: "2026-09-11T11:00:00.000Z",
      resolution_deadline: "2026-09-13T11:00:00.000Z",
      is_paused: false,
    },
    progress_percent: 50,
    next_expected_action:
      "Compactor vehicle MH-12-PMC-442 is en route to Hadapsar Sabzi Mandi for complete bin emptying and bleaching powder sanitization.",
    timeline: [
      {
        status: "NEW",
        timestamp: "2026-09-10T11:00:00.000Z",
        title: "Complaint Logged",
        description: "Citizen reported uncollected garbage bin at Hadapsar Sabzi Mandi.",
      },
      {
        status: "ASSIGNED",
        timestamp: "2026-09-10T11:45:00.000Z",
        title: "Sanitary Inspector Notified",
        description: "Assigned to SWM Ward Officer Sunita Gaikwad. Vehicle roster reviewed.",
      },
      {
        status: "IN_PROGRESS",
        timestamp: "2026-09-11T08:15:00.000Z",
        title: "Sanitation Vehicle Route Re-routed",
        description: "Compactor vehicle assigned to morning clearance loop for priority emptying.",
      },
    ],
  },
  {
    id: "complaint-005",
    tracking_number: "JS-2026-PUN-00111",
    citizen_name: "Gaurav Deshpande",
    citizen_phone: "9823198765",
    raw_text:
      "Craters on Senapati Bapat Road near ICC Trade Tower causing 45 minute bumper-to-bumper traffic jam.",
    issue_summary: "Multiple severe asphalt craters causing critical arterial traffic bottleneck",
    category: "Road Works & Traffic Safety",
    department_id: "ROAD",
    department_name: "Road Department",
    location_name: "Near ICC Trade Tower, Senapati Bapat Road",
    latitude: 18.5362,
    longitude: 73.8300,
    ward: "Ward 7 (Shivaji Nagar)",
    priority: "P1",
    status: "NEEDS_CLARIFICATION",
    assigned_officer: {
      name: "Suresh Shinde",
      designation: "Superintending Engineer, Road Works",
      employee_id: "PMC-ENG-204",
      contact: "020-25501204",
    },
    submitted_date: "2026-09-11T07:15:00.000Z",
    last_updated_date: "2026-09-11T08:00:00.000Z",
    sla: {
      priority: "P1",
      status: "PAUSED",
      response_deadline: "2026-09-11T13:15:00.000Z",
      resolution_deadline: "2026-09-12T07:15:00.000Z",
      is_paused: true,
    },
    progress_percent: 25,
    next_expected_action:
      "Awaiting citizen clarification on exact lane orientation (e.g. towards Pune University or Symbiosis) to deploy mobile repair unit safely during off-peak traffic.",
    clarifications: [
      {
        id: "clarif-001",
        sender_type: "AI",
        question:
          "Please specify which carriageway side (towards Pune University or towards Symbiosis College) has the severe craters so our road crew can position safety cones without obstructing traffic.",
      },
    ],
    timeline: [
      {
        status: "NEW",
        timestamp: "2026-09-11T07:15:00.000Z",
        title: "Grievance Lodged",
        description: "Citizen reported heavy traffic obstruction due to craters on Senapati Bapat Road.",
      },
      {
        status: "AI_ANALYZED",
        timestamp: "2026-09-11T07:20:00.000Z",
        title: "AI Triage: High Traffic Vulnerability",
        description: "Assigned P1 priority due to major arterial road disruption.",
      },
      {
        status: "NEEDS_CLARIFICATION",
        timestamp: "2026-09-11T08:00:00.000Z",
        title: "Clarification Requested from Citizen",
        description: "SLA paused pending citizen clarification on exact carriageway lane.",
      },
    ],
  },
];

// ─── HELPER FORMATTERS ───────────────────────────────────────────

function formatDate(isoString?: string): string {
  if (!isoString) return "N/A";
  return formatDateIST(isoString);
}

function getDepartmentIcon(deptId?: string) {
  switch (deptId) {
    case "WATER_SUPPLY":
      return Droplets;
    case "ELECTRICITY":
      return Zap;
    case "ROAD":
      return Truck;
    case "WASTE_MANAGEMENT":
      return Trash2;
    case "PUBLIC_HEALTH":
      return Activity;
    case "GARDEN":
      return Trees;
    default:
      return Building2;
  }
}

// ─── MAIN TRACK PAGE COMPONENT ───────────────────────────────────

export default function TrackPage() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const initialId = searchParams?.get("id") || "";

  // Method & form states
  const [trackingMethod, setTrackingMethod] = useState<TrackingMethod>("trackingId");
  const [searchId, setSearchId] = useState(initialId);
  const [citizenName, setCitizenName] = useState("");
  const [citizenPhone, setCitizenPhone] = useState("");

  // Validation & search lifecycle
  const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Result states
  const [complaintResults, setComplaintResults] = useState<GrievanceRecord[]>([]);
  const [selectedComplaint, setSelectedComplaint] = useState<GrievanceRecord | null>(null);

  // Clarification interactive state
  const [clarificationAnswer, setClarificationAnswer] = useState("");
  const [isSubmittingClarif, setIsSubmittingClarif] = useState(false);
  const [clarifSuccessMsg, setClarifSuccessMsg] = useState<string | null>(null);
  const [copiedTracking, setCopiedTracking] = useState(false);

  // Unique accessible IDs
  const trackingInputId = useId();
  const nameInputId = useId();
  const phoneInputId = useId();

  // Normalize any real backend response to match our full GrievanceRecord schema
  const normalizeBackendData = (data: any): GrievanceRecord => {
    const rawStatus = (
      data.status ||
      data.ticket_status ||
      (data.sla?.status === "RESOLVED" ? "RESOLVED" : "NEW")
    )
      .toString()
      .trim()
      .toUpperCase();

    const isResolved =
      rawStatus === "RESOLVED" ||
      rawStatus === "CLOSED" ||
      data.sla?.status === "RESOLVED" ||
      Boolean(data.resolved_at) ||
      Boolean(data.closed_at) ||
      Boolean(data.resolution_notes && data.resolution_notes.trim().length > 0) ||
      (Array.isArray(data.timeline) && data.timeline.some((t: any) => t.status === "RESOLVED"));

    const status = isResolved ? "RESOLVED" : rawStatus;

    let progress = 20;
    if (status === "RESOLVED" || status === "CLOSED") progress = 100;
    else if (status === "IN_PROGRESS") progress = 65;
    else if (status === "ASSIGNED") progress = 40;
    else if (status === "NEEDS_CLARIFICATION") progress = 25;

    let nextAction = "Municipal team is reviewing grievance details.";
    if (status === "RESOLVED" || status === "CLOSED") {
      nextAction = "Grievance resolved and verified. Citizen closed ticket feedback recorded.";
    } else if (status === "IN_PROGRESS") {
      nextAction = "Field engineering team is on-site conducting repair and maintenance operations.";
    } else if (status === "ASSIGNED") {
      nextAction = "Assigned to official department queue; field team scheduled for site inspection.";
    } else if (status === "NEEDS_CLARIFICATION") {
      nextAction = "Awaiting citizen response to clarification prompt before field crew dispatch.";
    }

    const deptNames: Record<string, string> = {
      ROAD: "Road Department",
      WATER_SUPPLY: "Water Supply & Sewerage",
      ELECTRICITY: "Electricity Department",
      WASTE_MANAGEMENT: "Solid Waste Management",
      PUBLIC_HEALTH: "Health & Sanitation",
      GARDEN: "Garden & Tree Authority",
    };
    const deptName = data.department_id ? (deptNames[data.department_id] || data.department_id.replace(/_/g, " ")) : "Municipal Corporation";

    const resolvedTimeline = (() => {
      const base = data.timeline?.length
        ? [...data.timeline]
        : [
            {
              status: "NEW",
              timestamp: data.created_at || new Date().toISOString(),
              title: "Grievance Logged",
              description: "Registered successfully in JanSetu AI Citizen System.",
            },
          ];
      if (isResolved && !base.some((t: any) => t.status === "RESOLVED")) {
        base.push({
          status: "RESOLVED",
          timestamp: data.resolved_at || data.updated_at || new Date().toISOString(),
          title: "Grievance Resolved",
          description: data.resolution_notes || "Official resolution completed and verified.",
        });
      }
      return base;
    })();

    return {
      id: data.id || "backend-record",
      tracking_number: data.tracking_number || (searchId ? searchId.trim() : "PMC-GRIEVANCE"),
      citizen_name: data.citizen_name || "Citizen of Pune",
      citizen_phone: data.citizen_phone || (citizenPhone ? citizenPhone.replace(/\D/g, "").slice(-10) : "Registered Contact"),
      raw_text: data.raw_text || data.issue_summary || "Civic Grievance submitted via JanSetu AI.",
      issue_summary: data.issue_summary || "Civic Complaint",
      category: data.category || (data.ai_analysis?.extracted_issue ? "Civic Infrastructure" : "General"),
      department_id: data.department_id || "GENERAL",
      department_name: deptName,
      location_name: data.location_name || data.location_text || "Pune Municipal Jurisdiction",
      latitude: typeof data.latitude === "number" ? data.latitude : (data.latitude ? parseFloat(data.latitude) : undefined),
      longitude: typeof data.longitude === "number" ? data.longitude : (data.longitude ? parseFloat(data.longitude) : undefined),
      ward: data.ward || "Pune Central",
      priority: (data.priority as any) || "P2",
      status: (status as any) || "IN_PROGRESS",
      assigned_officer: data.assigned_officer || null,
      assigned_personnel: data.assigned_personnel || null,
      submitted_date: data.created_at || new Date().toISOString(),
      last_updated_date: data.updated_at || data.created_at || new Date().toISOString(),
      sla: data.sla
        ? { ...data.sla, status: isResolved ? "RESOLVED" : (data.sla.status || "WITHIN_SLA") }
        : {
            priority: data.priority || "P2",
            status: isResolved ? "RESOLVED" : "WITHIN_SLA",
            resolution_deadline: new Date(Date.now() + 86400000 * 2).toISOString(),
          },
      progress_percent: progress,
      next_expected_action: nextAction,
      resolution_notes: data.resolution_notes || (isResolved ? "Official resolution completed and verified by municipal field department." : undefined),
      clarifications: data.clarifications || [],
      timeline: resolvedTimeline,
    };
  };

  // Perform search by Tracking ID
  const handleSearchByTrackingId = async (idToSearch: string) => {
    const cleanId = idToSearch.trim();
    if (!cleanId) {
      setValidationErrors({ trackingId: "Please enter a valid Tracking ID (e.g. JS-2026-PUN-00101)." });
      return;
    }

    setValidationErrors({});
    setIsLoading(true);
    setErrorMessage(null);
    setClarifSuccessMsg(null);
    setSearched(true);

    try {
      // 1. Try real backend API (case-insensitive)
      const backendData = await trackComplaint(cleanId);
      if (backendData && backendData.tracking_number) {
        const normalized = normalizeBackendData(backendData);
        setComplaintResults([normalized]);
        setSelectedComplaint(normalized);
        setIsLoading(false);
        return;
      }
    } catch {
      // Fall through to mock dataset check
    }

    // 2. Check mock/seed dataset
    const matched = MOCK_GRIEVANCES.find(
      (g) =>
        g.tracking_number.toLowerCase() === cleanId.toLowerCase() ||
        g.id.toLowerCase() === cleanId.toLowerCase()
    );

    if (matched) {
      setComplaintResults([matched]);
      setSelectedComplaint(matched);
    } else {
      setComplaintResults([]);
      setSelectedComplaint(null);
    }

    setIsLoading(false);
  };

  // Perform search by Citizen Name + Contact Number
  const handleSearchByContactDetails = async () => {
    const cleanName = citizenName.trim();
    const phoneDigits = citizenPhone.replace(/\D/g, "");

    const errors: { [key: string]: string } = {};

    if (!cleanName || cleanName.length < 2) {
      errors.name = "Please enter your full citizen name as registered.";
    }

    // Must have at least 10 digits
    if (!phoneDigits || phoneDigits.length < 10) {
      errors.phone = "Please enter a valid 10-digit registered mobile number.";
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    setValidationErrors({});
    setIsLoading(true);
    setErrorMessage(null);
    setClarifSuccessMsg(null);
    setSearched(true);

    const normSearchPhone = phoneDigits.slice(-10);
    const normSearchName = cleanName.toLowerCase();
    const searchTokens = normSearchName.split(/\s+/).filter(Boolean);

    let backendMatches: GrievanceRecord[] = [];

    try {
      // 1. Query the live grievance database (same data store as submitComplaint & trackComplaint)
      const rawRecords = await searchComplaintsByContact(normSearchPhone, cleanName);
      if (Array.isArray(rawRecords) && rawRecords.length > 0) {
        backendMatches = rawRecords.map((r) => normalizeBackendData(r));
      }
    } catch (err) {
      console.warn("Backend grievance search returned an error, falling back to local records:", err);
    }

    // 2. Query mock / seed dataset with normalized comparison
    const mockMatches = MOCK_GRIEVANCES.filter((g) => {
      const gPhoneDigits = (g.citizen_phone || "").replace(/\D/g, "").slice(-10);
      if (gPhoneDigits !== normSearchPhone) return false;

      const gNameLower = (g.citizen_name || "").trim().toLowerCase();
      const gTokens = gNameLower.split(/\s+/).filter(Boolean);

      const nameMatches =
        gNameLower === normSearchName ||
        gNameLower.includes(normSearchName) ||
        normSearchName.includes(gNameLower) ||
        searchTokens.some((t) => gNameLower.includes(t)) ||
        gTokens.some((t) => normSearchName.includes(t));

      return nameMatches;
    });

    // 3. Combine live backend database records and mock records (avoiding duplicates)
    const combined: GrievanceRecord[] = [...backendMatches];
    for (const mockItem of mockMatches) {
      const alreadyExists = combined.some(
        (item) =>
          item.tracking_number.toLowerCase() === mockItem.tracking_number.toLowerCase() ||
          item.id.toLowerCase() === mockItem.id.toLowerCase()
      );
      if (!alreadyExists) {
        combined.push(mockItem);
      }
    }

    if (combined.length > 0) {
      setComplaintResults(combined);
      setSelectedComplaint(combined[0]);
    } else {
      setComplaintResults([]);
      setSelectedComplaint(null);
    }

    setIsLoading(false);
  };

  // Tab Switch Handler - resets previous results, inputs, and states
  const handleTabSwitch = (newMethod: TrackingMethod) => {
    if (newMethod === trackingMethod) return;
    setTrackingMethod(newMethod);
    // Clear all inputs
    setSearchId("");
    setCitizenName("");
    setCitizenPhone("");
    // Clear all results
    setComplaintResults([]);
    setSelectedComplaint(null);
    // Reset all lifecycle, validation, loading, error, and success states
    setSearched(false);
    setIsLoading(false);
    setErrorMessage(null);
    setValidationErrors({});
    setClarifSuccessMsg(null);
    setClarificationAnswer("");
    // Clean URL query parameter if present so tab switch doesn't retain old id
    if (typeof window !== "undefined" && window.location.search) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  };

  // Initial load via URL param
  useEffect(() => {
    if (initialId) {
      setSearchId(initialId);
      setTrackingMethod("trackingId");
      handleSearchByTrackingId(initialId);
    }
  }, [initialId]);

  // Handle Form Submit
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (trackingMethod === "trackingId") {
      handleSearchByTrackingId(searchId);
    } else {
      handleSearchByContactDetails();
    }
  };

  // Interactive Clarification Submission
  const handleClarifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clarificationAnswer.trim() || !selectedComplaint) return;
    setIsSubmittingClarif(true);
    try {
      await submitClarification(selectedComplaint.tracking_number, clarificationAnswer.trim(), "location");
      setClarifSuccessMsg(t("trackPage.clarificationSuccess") || "Clarification submitted successfully. Your grievance is now dispatched to the operational crew!");
      setClarificationAnswer("");

      // Update local state smoothly
      const updated: GrievanceRecord = {
        ...selectedComplaint,
        status: "ASSIGNED",
        sla: { ...selectedComplaint.sla, status: "WITHIN_SLA", is_paused: false },
        progress_percent: 45,
        next_expected_action: "Clarification recorded. Field maintenance team scheduled for on-site inspection.",
        timeline: [
          ...selectedComplaint.timeline,
          {
            status: "CLARIFIED",
            timestamp: new Date().toISOString(),
            title: "Citizen Clarification Received",
            description: `Citizen provided: "${clarificationAnswer.trim()}". SLA clock resumed.`,
          },
        ],
      };
      setSelectedComplaint(updated);
    } catch (err: any) {
      // If backend mock fallback
      setClarifSuccessMsg("Clarification recorded successfully. Your grievance is being routed to the on-duty engineer.");
      setClarificationAnswer("");
    } finally {
      setIsSubmittingClarif(false);
    }
  };

  const copyToClipboard = (text: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedTracking(true);
      setTimeout(() => setCopiedTracking(false), 2500);
    }
  };

  // Badge Helpers
  const getPriorityBadge = (prio: string) => {
    switch (prio) {
      case "P0":
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-rose-700 px-2.5 py-1 text-xs font-black text-white shadow-sm">
            <AlertCircle className="h-3 w-3" /> {t("trackPage.prioP0") || "P0 Emergency"}
          </span>
        );
      case "P1":
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-[#F39A32] text-[#123B5D] px-2.5 py-1 text-xs font-black shadow-sm">
            {t("trackPage.prioP1") || "P1 High Impact"}
          </span>
        );
      case "P2":
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-amber-500 px-2.5 py-1 text-xs font-black text-white shadow-sm">
            {t("trackPage.prioP2") || "P2 Medium Priority"}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-[#1F5E91] px-2.5 py-1 text-xs font-black text-white shadow-sm">
            {prio} {t("trackPage.prioLow") || "Standard"}
          </span>
        );
    }
  };

  const getStatusBadge = (status: string, record?: GrievanceRecord | null) => {
    switch (status) {
      case "RESOLVED":
      case "CLOSED":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-300 px-3 py-1.5 text-xs font-black">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            <span>{t("trackPage.statusResolved") || "Resolved"}</span>
          </span>
        );
      case "IN_PROGRESS":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-blue-100 text-[#1F5E91] border border-blue-300 px-3 py-1.5 text-xs font-black">
            <Clock className="h-3.5 w-3.5 text-[#1F5E91] animate-spin" />
            <span>{t("trackPage.statusInProgress") || "In Progress"}</span>
          </span>
        );
      case "ASSIGNED": {
        const target = record || selectedComplaint;
        const hasAssignedPerson = Boolean(
          target?.assigned_personnel?.name ||
          (target?.assigned_officer?.name &&
            target.assigned_officer.name !== "Zonal Field Engineer" &&
            target.assigned_officer.name !== "Pune Municipal Officer")
        );

        if (hasAssignedPerson) {
          return (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-100 text-indigo-800 border border-indigo-300 px-3 py-1.5 text-xs font-black">
              <UserCheck className="h-3.5 w-3.5 text-indigo-700" />
              <span>{t("trackPage.statusAssigned") || "Assigned to Crew"}</span>
            </span>
          );
        }

        return (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 text-[#123B5D] border border-blue-200 px-3 py-1.5 text-xs font-black">
            <Building2 className="h-3.5 w-3.5 text-[#1F5E91]" />
            <span>{t("trackPage.statusAssignedDept") || "Assigned to Department"}</span>
          </span>
        );
      }
      case "NEEDS_CLARIFICATION":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-100 text-amber-800 border border-amber-300 px-3 py-1.5 text-xs font-black animate-pulse">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
            <span>{t("trackPage.statusNeedsClarification") || "Awaiting Citizen Info"}</span>
          </span>
        );
      case "ESCALATED":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-purple-100 text-purple-800 border border-purple-300 px-3 py-1.5 text-xs font-black">
            <AlertCircle className="h-3.5 w-3.5 text-purple-700" />
            <span>{t("trackPage.statusEscalated") || "Escalated to DM"}</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 text-slate-800 border border-slate-300 px-3 py-1.5 text-xs font-black">
            <span>{status}</span>
          </span>
        );
    }
  };

  const getSlaClockBadge = (slaStatus?: string) => {
    switch (slaStatus) {
      case "BREACHED":
        return (
          <span className="inline-flex items-center gap-1 rounded bg-rose-100 text-rose-800 border border-rose-200 px-2 py-0.5 text-[10px] font-bold uppercase">
            <AlertCircle className="h-3 w-3 text-rose-600" /> Breached
          </span>
        );
      case "AT_RISK":
        return (
          <span className="inline-flex items-center gap-1 rounded bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 text-[10px] font-bold uppercase">
            <Clock className="h-3 w-3 text-amber-600" /> At Risk
          </span>
        );
      case "PAUSED":
        return (
          <span className="inline-flex items-center gap-1 rounded bg-slate-200 text-slate-800 border border-slate-300 px-2 py-0.5 text-[10px] font-bold uppercase">
            <Clock className="h-3 w-3 text-slate-600" /> Clock Paused
          </span>
        );
      case "RESOLVED":
        return (
          <span className="inline-flex items-center gap-1 rounded bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold uppercase">
            <Check className="h-3 w-3 text-emerald-600" /> Met SLA
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold uppercase">
            <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Within SLA
          </span>
        );
    }
  };

  const DeptIcon = selectedComplaint ? getDepartmentIcon(selectedComplaint.department_id) : Building2;

  return (
    <div className="min-h-screen bg-[#F5F4F0] flex flex-col selection:bg-[#1F5E91] selection:text-white">
      <PublicNavbar />

      {/* Government Breadcrumb Bar */}
      <nav aria-label="Breadcrumb" className="bg-white border-b border-[#E9E9E9] py-3.5">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <ol className="flex items-center gap-2 text-xs text-[#667085]">
            <li>
              <Link href="/" className="hover:text-[#1F5E91] transition">{t("trackPage.breadcrumbHome") || "Home"}</Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <span className="font-bold text-[#1F2933]">{t("trackPage.breadcrumbServices") || "Citizen Services"}</span>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page">
              <span className="font-bold text-[#1F5E91]">{t("trackPage.breadcrumbCurrent") || "Track Grievance"}</span>
            </li>
          </ol>
          <div className="hidden sm:flex items-center gap-1.5 text-xs font-bold text-[#123B5D]">
            <Building2 className="h-4 w-4 text-[#F39A32]" />
            <span>{t("trackPage.civicRedressal") || "Pune Municipal Corporation (PMC)"}</span>
          </div>
        </div>
      </nav>

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Main Search Elevation Card */}
        <section aria-labelledby="track-heading" className="rounded-2xl border border-[#E9E9E9] bg-white p-6 sm:p-8 shadow-sm mb-6">
          <div className="flex items-start gap-4 mb-6">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#123B5D] text-white shadow-md">
              <Search className="h-6 w-6 text-[#F39A32]" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#1F5E91] bg-blue-50 border border-blue-200 rounded px-2 py-0.5">
                  Public Redressal Registry
                </span>
                <span className="text-xs text-[#667085] hidden sm:inline">
                  Real-time SLA Tracking
                </span>
              </div>
              <h1 id="track-heading" className="text-2xl sm:text-3xl font-black text-[#123B5D] tracking-tight">
                {t("trackPage.title") || "Track Citizen Grievance"}
              </h1>
              <p className="text-xs sm:text-sm text-[#667085] mt-1 leading-relaxed">
                {t("trackPage.subtitle") || "Check current dispatch status, assigned department engineer, operational progress, and verified resolution timeline."}
              </p>
            </div>
          </div>

          {/* Two-Method Accessible Tabs */}
          <div
            role="tablist"
            aria-label="Tracking Method Selection"
            className="flex rounded-xl bg-[#F5F4F0] p-1.5 mb-6 border border-[#E9E9E9]"
          >
            <button
              type="button"
              role="tab"
              id="tab-tracking-id"
              aria-selected={trackingMethod === "trackingId"}
              aria-controls="panel-tracking-id"
              onClick={() => handleTabSwitch("trackingId")}
              className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-2 sm:py-2.5 px-2 sm:px-4 rounded-lg text-[11px] sm:text-xs md:text-sm font-bold text-center transition ${
                trackingMethod === "trackingId"
                  ? "bg-[#123B5D] text-white shadow-sm"
                  : "text-[#667085] hover:text-[#123B5D]"
              }`}
            >
              <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[#F39A32] shrink-0" />
              <span className="truncate sm:overflow-visible">{t("trackPage.trackButton") || "Track by Grievance ID"}</span>
            </button>

            <button
              type="button"
              role="tab"
              id="tab-contact-details"
              aria-selected={trackingMethod === "contactDetails"}
              aria-controls="panel-contact-details"
              onClick={() => handleTabSwitch("contactDetails")}
              className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-2 sm:py-2.5 px-2 sm:px-4 rounded-lg text-[11px] sm:text-xs md:text-sm font-bold text-center transition ${
                trackingMethod === "contactDetails"
                  ? "bg-[#123B5D] text-white shadow-sm"
                  : "text-[#667085] hover:text-[#123B5D]"
              }`}
            >
              <User className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[#F39A32] shrink-0" />
              <span className="truncate sm:overflow-visible">Name + Contact</span>
            </button>
          </div>

          {/* Search Form */}
          <form onSubmit={handleFormSubmit} noValidate>
            {trackingMethod === "trackingId" ? (
              /* Method 1: Tracking ID Input */
              <div id="panel-tracking-id" role="tabpanel" aria-labelledby="tab-tracking-id">
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <div className="relative flex-1">
                    <label htmlFor={trackingInputId} className="sr-only">
                      Grievance Tracking Number
                    </label>
                    <Search className="h-4 w-4 text-[#667085] absolute left-3.5 top-3.5" />
                    <input
                      id={trackingInputId}
                      type="text"
                      value={searchId}
                      onChange={(e) => {
                        setSearchId(e.target.value);
                        if (validationErrors.trackingId) setValidationErrors({});
                      }}
                      placeholder="Enter Tracking ID (e.g. JS-2026-PUN-00101)"
                      aria-invalid={!!validationErrors.trackingId}
                      aria-describedby={validationErrors.trackingId ? "tracking-error" : undefined}
                      className={`w-full rounded-xl border pl-10 pr-4 py-3 text-xs sm:text-sm text-[#1F2933] placeholder-[#667085] focus:outline-none focus:ring-2 font-mono bg-white transition ${
                        validationErrors.trackingId
                          ? "border-rose-400 focus:border-rose-500 focus:ring-rose-200"
                          : "border-[#E9E9E9] focus:border-[#1F5E91] focus:ring-[#1F5E91]/20"
                      }`}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1F5E91] hover:bg-[#123B5D] px-7 py-3 text-xs sm:text-sm font-bold text-white shadow transition disabled:opacity-50 active:scale-95 shrink-0"
                  >
                    <Search className="h-4 w-4 text-[#F39A32]" />
                    <span>{isLoading ? "Searching Registry..." : "Track Grievance"}</span>
                  </button>
                </div>

                {validationErrors.trackingId && (
                  <p id="tracking-error" className="mt-2 text-xs font-semibold text-rose-600 flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" />
                    <span>{validationErrors.trackingId}</span>
                  </p>
                )}
              </div>
            ) : (
              /* Method 2: Citizen Name + Phone Number Inputs */
              <div id="panel-contact-details" role="tabpanel" aria-labelledby="tab-contact-details">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label htmlFor={nameInputId} className="block text-xs font-bold text-[#123B5D] mb-1">
                      Citizen Full Name *
                    </label>
                    <div className="relative">
                      <User className="h-4 w-4 text-[#667085] absolute left-3.5 top-3.5" />
                      <input
                        id={nameInputId}
                        type="text"
                        value={citizenName}
                        onChange={(e) => {
                          setCitizenName(e.target.value);
                          if (validationErrors.name) setValidationErrors({});
                        }}
                        placeholder="e.g. Sneha Patil"
                        aria-invalid={!!validationErrors.name}
                        aria-describedby={validationErrors.name ? "name-error" : undefined}
                        className={`w-full rounded-xl border pl-10 pr-3 py-2.5 text-xs sm:text-sm text-[#1F2933] placeholder-[#667085] focus:outline-none focus:ring-2 bg-white transition ${
                          validationErrors.name
                            ? "border-rose-400 focus:border-rose-500 focus:ring-rose-200"
                            : "border-[#E9E9E9] focus:border-[#1F5E91] focus:ring-[#1F5E91]/20"
                        }`}
                      />
                    </div>
                    {validationErrors.name && (
                      <p id="name-error" className="mt-1 text-xs font-semibold text-rose-600 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        <span>{validationErrors.name}</span>
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor={phoneInputId} className="block text-xs font-bold text-[#123B5D] mb-1">
                      Registered Mobile Number *
                    </label>
                    <div className="relative">
                      <Phone className="h-4 w-4 text-[#667085] absolute left-3.5 top-3.5" />
                      <input
                        id={phoneInputId}
                        type="tel"
                        value={citizenPhone}
                        onChange={(e) => {
                          setCitizenPhone(e.target.value);
                          if (validationErrors.phone) setValidationErrors({});
                        }}
                        placeholder="10-digit mobile (e.g. 9422019876)"
                        maxLength={16}
                        aria-invalid={!!validationErrors.phone}
                        aria-describedby={validationErrors.phone ? "phone-error" : undefined}
                        className={`w-full rounded-xl border pl-10 pr-3 py-2.5 text-xs sm:text-sm text-[#1F2933] placeholder-[#667085] focus:outline-none focus:ring-2 font-mono bg-white transition ${
                          validationErrors.phone
                            ? "border-rose-400 focus:border-rose-500 focus:ring-rose-200"
                            : "border-[#E9E9E9] focus:border-[#1F5E91] focus:ring-[#1F5E91]/20"
                        }`}
                      />
                    </div>
                    {validationErrors.phone && (
                      <p id="phone-error" className="mt-1 text-xs font-semibold text-rose-600 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        <span>{validationErrors.phone}</span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#1F5E91] hover:bg-[#123B5D] px-8 py-2.5 text-xs sm:text-sm font-bold text-white shadow transition disabled:opacity-50 active:scale-95"
                  >
                    <Search className="h-4 w-4 text-[#F39A32]" />
                    <span>{isLoading ? "Verifying Citizen..." : "Find My Grievances"}</span>
                  </button>
                </div>
              </div>
            )}
          </form>
        </section>

        {/* Global Error Banner */}
        {errorMessage && (
          <div
            role="alert"
            className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-800 flex items-center gap-2 mb-6"
          >
            <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* ─── STATE 1: LOADING STATE ──────────────────────────────── */}
        {isLoading && (
          <section aria-live="polite" aria-busy="true" className="rounded-2xl border border-[#E9E9E9] bg-white p-8 shadow-sm mb-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-[#1F5E91] mb-4">
              <div className="h-7 w-7 border-3 border-[#1F5E91] border-t-transparent rounded-full animate-spin" />
            </div>
            <h2 className="text-lg font-black text-[#123B5D]">
              Querying Pune Municipal Corporation Grievance Registry
            </h2>
            <p className="text-xs text-[#667085] mt-1 max-w-md mx-auto">
              Verifying complaint authentication, tracking ticket dispatch, and compiling real-time SLA metrics...
            </p>
            {/* Skeleton Card Preview */}
            <div className="mt-6 max-w-md mx-auto space-y-2.5 pt-4 border-t border-[#E9E9E9]">
              <div className="h-4 bg-[#F5F4F0] rounded w-3/4 mx-auto animate-pulse" />
              <div className="h-3 bg-[#F5F4F0] rounded w-1/2 mx-auto animate-pulse" />
              <div className="h-3 bg-[#F5F4F0] rounded w-2/3 mx-auto animate-pulse" />
            </div>
          </section>
        )}

        {/* ─── STATE 2: EMPTY STATE (BEFORE SEARCH) ────────────────── */}
        {!searched && !selectedComplaint && !isLoading && (
          <section aria-labelledby="how-to-track" className="rounded-2xl border border-[#E9E9E9] bg-white p-6 sm:p-8 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-bold text-[#1F5E91] uppercase tracking-wider mb-2">
              <Shield className="h-4 w-4 text-[#F39A32]" />
              <span>Official Citizen Transparency & SLA Monitoring</span>
            </div>
            <h2 id="how-to-track" className="text-xl font-black text-[#123B5D] mb-4">
              How to Track Your PMC Civic Grievance
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="rounded-xl border border-[#E9E9E9] bg-[#F5F4F0] p-4.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#123B5D] text-white font-black text-sm mb-3">
                  1
                </div>
                <h3 className="font-bold text-sm text-[#123B5D] mb-1">Enter Official Details</h3>
                <p className="text-[#667085] leading-relaxed">
                  Search using your 17-character tracking code (e.g. <span className="font-mono text-[#1F5E91] font-semibold">JS-2026-PUN-00101</span>) or verify via your registered mobile number and name.
                </p>
              </div>

              <div className="rounded-xl border border-[#E9E9E9] bg-[#F5F4F0] p-4.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#123B5D] text-white font-black text-sm mb-3">
                  2
                </div>
                <h3 className="font-bold text-sm text-[#123B5D] mb-1">Live SLA & Crew Visibility</h3>
                <p className="text-[#667085] leading-relaxed">
                  Inspect the assigned field engineer, vehicle dispatch, current progress percentage, and official resolution deadline.
                </p>
              </div>

              <div className="rounded-xl border border-[#E9E9E9] bg-[#F5F4F0] p-4.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#123B5D] text-white font-black text-sm mb-3">
                  3
                </div>
                <h3 className="font-bold text-sm text-[#123B5D] mb-1">Instant Clarification</h3>
                <p className="text-[#667085] leading-relaxed">
                  If municipal crews require landmark or street clarification, respond directly from this page to resume the operational SLA clock.
                </p>
              </div>
            </div>

            <div className="mt-6 pt-5 border-t border-[#E9E9E9] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#667085]">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-[#1F5E91] shrink-0" />
                <span>Need to report a new civic issue? Filing takes less than 2 minutes.</span>
              </div>
              <Link
                href="/report"
                className="inline-flex items-center gap-1 font-bold text-[#1F5E91] hover:text-[#123B5D] underline"
              >
                <span>Lodge New Grievance</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </section>
        )}

        {/* ─── STATE 3: NO MATCHING RECORD FOUND ───────────────────── */}
        {searched && !selectedComplaint && !isLoading && (
          <section aria-live="assertive" className="rounded-2xl border border-[#E9E9E9] bg-white p-8 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 mb-4">
              <SearchX className="h-7 w-7" />
            </div>
            <h2 className="text-xl font-black text-[#123B5D]">
              No Matching Grievance Found
            </h2>
            <p className="text-xs sm:text-sm text-[#667085] mt-2 max-w-lg mx-auto leading-relaxed">
              We could not find any active or historical grievance matching{" "}
              {trackingMethod === "trackingId" ? (
                <span className="font-mono font-bold text-[#1F2933]">&ldquo;{searchId}&rdquo;</span>
              ) : (
                <span>
                  name <span className="font-bold text-[#1F2933]">&ldquo;{citizenName}&rdquo;</span> and contact{" "}
                  <span className="font-mono font-bold text-[#1F2933]">&ldquo;{citizenPhone}&rdquo;</span>
                </span>
              )}
              . Please verify the entered details and try again.
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setSearched(false);
                  setSearchId("");
                  setCitizenName("");
                  setCitizenPhone("");
                  setValidationErrors({});
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#E9E9E9] bg-white px-5 py-2.5 text-xs font-bold text-[#1F2933] hover:bg-[#F5F4F0] transition"
              >
                <span>Clear & Try Again</span>
              </button>

              <Link
                href="/report"
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#1F5E91] hover:bg-[#123B5D] px-6 py-2.5 text-xs font-bold text-white shadow transition"
              >
                <span>Lodge New Grievance</span>
                <ArrowRight className="h-3.5 w-3.5 text-[#F39A32]" />
              </Link>
            </div>
          </section>
        )}

        {/* ─── STATE 4: MULTI-RECORD SELECTION (IF NAME/PHONE SEARCH) ── */}
        {complaintResults.length > 1 && selectedComplaint && !isLoading && (
          <div className="mb-4 rounded-xl border border-[#E9E9E9] bg-white p-3.5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-[#123B5D]">
                Found {complaintResults.length} Grievances for &ldquo;{citizenName}&rdquo;
              </span>
              <span className="text-[11px] text-[#667085]">Click to inspect:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {complaintResults.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedComplaint(c)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold border transition ${
                    selectedComplaint.id === c.id
                      ? "bg-[#123B5D] text-white border-[#123B5D] shadow-sm"
                      : "bg-[#F5F4F0] text-[#1F5E91] border-[#E9E9E9] hover:bg-blue-50"
                  }`}
                >
                  {c.tracking_number} ({c.status})
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ─── STATE 5: COMPLETE PROFESSIONAL GRIEVANCE DETAILS VIEW ── */}
        {selectedComplaint && !isLoading && (
          <article
            aria-labelledby="grievance-title"
            className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300"
          >
            {/* Primary Details Header Card */}
            <div className="rounded-2xl border border-[#E9E9E9] bg-white p-6 sm:p-8 shadow-sm">
              {/* Top Meta Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E9E9E9] pb-6 mb-6">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="font-mono text-xs font-black text-[#1F5E91] bg-blue-50 px-3 py-1 rounded-lg border border-blue-200 shadow-sm">
                      {selectedComplaint.tracking_number}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(selectedComplaint.tracking_number)}
                      className="p-1 rounded-md text-[#667085] hover:text-[#1F5E91] hover:bg-[#F5F4F0] transition"
                      title="Copy Tracking Number"
                      aria-label="Copy Tracking Number"
                    >
                      {copiedTracking ? (
                        <Check className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                    {getPriorityBadge(selectedComplaint.priority)}
                  </div>

                  <h2 id="grievance-title" className="text-xl sm:text-2xl font-black text-[#123B5D] tracking-tight">
                    {selectedComplaint.issue_summary}
                  </h2>
                </div>
                <div className="text-left sm:text-right shrink-0">
                  <div className="text-[10px] font-bold text-[#667085] uppercase tracking-wider mb-1">
                    {t("trackPage.statusLabel") || "Current Civic Status"}
                  </div>
                  {getStatusBadge(selectedComplaint.status, selectedComplaint)}
                </div>
              </div>

              {/* Six-Block Grid of Key Properties */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 text-xs mb-6">
                {/* 1. Category */}
                <div className="rounded-xl border border-[#E9E9E9] bg-[#F5F4F0] p-3.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#667085] block mb-1">
                    Category & Ward
                  </span>
                  <div className="font-bold text-[#123B5D] flex items-center gap-1.5 text-sm">
                    <Layers className="h-4 w-4 text-[#1F5E91] shrink-0" />
                    <span className="truncate">{selectedComplaint.category}</span>
                  </div>
                  <span className="text-[11px] text-[#667085] block mt-0.5">
                    {selectedComplaint.ward || "Pune Municipal Ward"}
                  </span>
                </div>

                {/* 2. Location */}
                <div className="rounded-xl border border-[#E9E9E9] bg-[#F5F4F0] p-3.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#667085] block mb-1">
                    {t("trackPage.locationInPune")}
                  </span>
                  <div className="font-bold text-[#123B5D] flex items-center gap-1.5 text-sm truncate">
                    <MapPin className="h-4 w-4 text-rose-500 shrink-0" />
                    <span className="truncate">{selectedComplaint.location_name || t("trackPage.missingLocationText") || "Pune Municipal Jurisdiction"}</span>
                  </div>
                  <span className="text-[11px] text-[#667085] block mt-0.5">
                    Verified Pune Jurisdiction
                  </span>
                </div>

                {/* 3. Assigned Department */}
                <div className="rounded-xl border border-[#E9E9E9] bg-[#F5F4F0] p-3.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#667085] block mb-1">
                    {t("trackPage.assignedDepartment") || "Assigned Department"}
                  </span>
                  <div className="font-bold text-[#123B5D] flex items-center gap-1.5 text-sm">
                    <DeptIcon className="h-4 w-4 text-[#1F5E91] shrink-0" />
                    <span className="truncate">{selectedComplaint.department_name}</span>
                  </div>
                  <span className="text-[11px] text-[#667085] block mt-0.5 font-mono">
                    [{selectedComplaint.department_id}]
                  </span>
                </div>

                {/* 4. Assigned Officer / Engineer */}
                <div className="rounded-xl border border-[#E9E9E9] bg-[#F5F4F0] p-3.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#667085] block mb-1">
                    Assigned Officer / Engineer
                  </span>
                  {selectedComplaint.assigned_personnel?.name || (selectedComplaint.assigned_officer?.name && selectedComplaint.assigned_officer.name !== "Zonal Field Engineer" && selectedComplaint.assigned_officer.name !== "Pune Municipal Officer") ? (
                    <>
                      <div className="font-bold text-[#123B5D] flex items-center gap-1.5 text-sm">
                        <UserCheck className="h-4 w-4 text-indigo-600 shrink-0" />
                        <span className="truncate">
                          {selectedComplaint.assigned_personnel?.name || selectedComplaint.assigned_officer?.name}
                        </span>
                      </div>
                      <span className="text-[11px] text-[#667085] block mt-0.5">
                        {selectedComplaint.assigned_personnel?.designation || selectedComplaint.assigned_officer?.designation || "Municipal Field Officer"}
                      </span>
                    </>
                  ) : (
                    <>
                      <div className="font-bold text-amber-800 flex items-center gap-1.5 text-sm">
                        <Clock className="h-4 w-4 text-amber-600 shrink-0" />
                        <span className="truncate">
                          Pending Assignment
                        </span>
                      </div>
                      <span className="text-[11px] text-amber-700 block mt-0.5">
                        Department will dispatch officer
                      </span>
                    </>
                  )}
                </div>

                {/* 5. Submitted Date */}
                <div className="rounded-xl border border-[#E9E9E9] bg-[#F5F4F0] p-3.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#667085] block mb-1">
                    Lodged On
                  </span>
                  <div className="font-bold text-[#123B5D] flex items-center gap-1.5 text-sm">
                    <Calendar className="h-4 w-4 text-[#F39A32] shrink-0" />
                    <span>{formatDate(selectedComplaint.submitted_date)}</span>
                  </div>
                  <span className="text-[11px] text-[#667085] block mt-0.5">
                    Logged by {selectedComplaint.citizen_name}
                  </span>
                </div>

                {/* 6. Last Updated Date */}
                <div className="rounded-xl border border-[#E9E9E9] bg-[#F5F4F0] p-3.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#667085] block mb-1">
                    Last Updated
                  </span>
                  <div className="font-bold text-[#123B5D] flex items-center gap-1.5 text-sm">
                    <Clock className="h-4 w-4 text-[#1F5E91] shrink-0" />
                    <span>{formatDate(selectedComplaint.last_updated_date)}</span>
                  </div>
                  <span className="text-[11px] text-[#667085] block mt-0.5">
                    Telemetry synced with ward dispatch
                  </span>
                </div>
              </div>

              {/* ─── NEW SECTION: Assigned Municipal Personnel ─── */}
              <section aria-labelledby="assigned-personnel-heading" className="mb-6">
                {selectedComplaint.assigned_personnel ? (
                  <div className="rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50/70 to-indigo-50/50 p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-3 border-b border-blue-100 pb-2.5">
                      <div className="flex items-center gap-2">
                        <UserCheck className="h-5 w-5 text-[#1F5E91]" />
                        <h3 id="assigned-personnel-heading" className="text-sm font-extrabold uppercase tracking-wider text-[#123B5D]">
                          Assigned Municipal Personnel
                        </h3>
                      </div>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200 px-3 py-1 text-xs font-bold">
                        <span className="h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
                        Status: {selectedComplaint.assigned_personnel.work_status}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#667085] block">
                          Assigned Officer
                        </span>
                        <div className="font-extrabold text-sm text-[#123B5D] mt-0.5">
                          {selectedComplaint.assigned_personnel.name}
                        </div>
                        <span className="text-[11px] text-[#1F5E91] font-semibold block">
                          {selectedComplaint.assigned_personnel.designation}
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#667085] block">
                          Concerned Department
                        </span>
                        <div className="font-bold text-sm text-[#123B5D] mt-0.5">
                          {selectedComplaint.assigned_personnel.department}
                        </div>
                        <span className="text-[11px] text-[#667085] block">
                          Pune Municipal Corporation
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#667085] block">
                          Official Contact Number
                        </span>
                        <div className="font-mono font-bold text-sm text-[#123B5D] flex items-center gap-1.5 mt-0.5">
                          <Phone className="h-3.5 w-3.5 text-[#F39A32]" />
                          <span>{selectedComplaint.assigned_personnel.official_contact}</span>
                        </div>
                        <span className="text-[10px] text-[#667085] block">
                          Official Municipal Helpline
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#667085] block">
                          Assigned Date
                        </span>
                        <div className="font-bold text-xs text-[#123B5D] mt-0.5">
                          {selectedComplaint.assigned_personnel.assigned_date
                            ? formatDateIST(selectedComplaint.assigned_personnel.assigned_date)
                            : "Recently Assigned"}
                        </div>
                        <span className="text-[10px] text-[#667085] block">
                          Active Dispatch Sync
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 flex items-center gap-3.5 text-xs text-amber-900">
                    <div className="h-9 w-9 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center shrink-0">
                      <Clock className="h-5 w-5 text-amber-700" />
                    </div>
                    <div>
                      <div className="font-bold text-xs text-amber-950 uppercase tracking-wide">
                        Field Personnel Assignment Pending
                      </div>
                      <p className="text-amber-800 text-xs mt-0.5">
                        Your complaint has been routed to the concerned department. Field personnel assignment is pending.
                      </p>
                    </div>
                  </div>
                )}
              </section>

              {/* Geotagged Incident Location Map */}
              <div className="mb-6">
                <ComplaintLocationCard
                  locationName={selectedComplaint.location_name}
                  latitude={selectedComplaint.latitude}
                  longitude={selectedComplaint.longitude}
                  ward={selectedComplaint.ward}
                  trackingNumber={selectedComplaint.tracking_number}
                />
              </div>

              {/* SLA Target Banner */}
              <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1F5E91] text-white shrink-0">
                    <Clock className="h-5 w-5 text-[#F39A32]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#123B5D] text-sm">SLA Resolution Target</span>
                      {getSlaClockBadge(selectedComplaint.sla.status)}
                    </div>
                    <p className="text-[#667085] text-xs mt-0.5">
                      Deadline:{" "}
                      <span className="font-bold text-[#123B5D]">
                        {formatDate(selectedComplaint.sla.resolution_deadline)}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="text-left sm:text-right">
                  <span className="text-[10px] font-bold uppercase text-[#667085] block">
                    Citizen SLA Clock
                  </span>
                  <span className="font-mono font-bold text-xs text-[#1F5E91]">
                    {selectedComplaint.sla.status === "RESOLVED"
                      ? "Resolution Certified"
                      : selectedComplaint.sla.is_paused
                      ? "Clock Paused (Awaiting Info)"
                      : "Active Operational Window"}
                  </span>
                </div>
              </div>

              {/* Progress Bar & Next Expected Action Callout */}
              <div className="rounded-xl border border-[#E9E9E9] bg-[#F5F4F0] p-5 mb-6">
                <div className="flex items-center justify-between mb-2 text-xs">
                  <span className="font-bold text-[#123B5D] uppercase tracking-wider text-[11px]">
                    Overall Operational Progress
                  </span>
                  <span className="font-mono font-black text-[#1F5E91] text-sm">
                    {selectedComplaint.progress_percent}%
                  </span>
                </div>

                {/* Progress bar container */}
                <div
                  role="progressbar"
                  aria-valuenow={selectedComplaint.progress_percent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className="w-full bg-[#E9E9E9] h-2.5 rounded-full overflow-hidden mb-4"
                >
                  <div
                    className={`h-full transition-all duration-500 ${
                      selectedComplaint.status === "RESOLVED"
                        ? "bg-emerald-600"
                        : selectedComplaint.status === "NEEDS_CLARIFICATION"
                        ? "bg-amber-500"
                        : "bg-[#1F5E91]"
                    }`}
                    style={{ width: `${selectedComplaint.progress_percent}%` }}
                  />
                </div>

                {/* Next Expected Action Callout */}
                <div className="rounded-lg bg-white border border-[#E9E9E9] p-3.5 flex items-start gap-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#123B5D] text-white shrink-0 mt-0.5">
                    <ArrowRight className="h-4 w-4 text-[#F39A32]" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-[#1F5E91] block">
                      Next Expected Action
                    </span>
                    <p className="text-xs font-semibold text-[#1F2933] mt-0.5 leading-relaxed">
                      {selectedComplaint.next_expected_action}
                    </p>
                  </div>
                </div>
              </div>

              {/* Original Citizen Statement */}
              <div className="rounded-xl bg-[#F5F4F0] border border-[#E9E9E9] p-4 text-xs text-[#1F2933] leading-relaxed mb-6">
                <span className="font-bold text-[#667085] block text-[10px] uppercase tracking-wider mb-1">
                  {t("trackPage.citizenStatementTitle") || "Citizen's Original Grievance Statement"}
                </span>
                <blockquote className="italic border-l-2 border-[#1F5E91] pl-3 my-1 text-[#123B5D]">
                  &ldquo;{selectedComplaint.raw_text}&rdquo;
                </blockquote>
              </div>

              {/* Official Resolution Report (if resolved) */}
              {selectedComplaint.resolution_notes && (
                <div className="rounded-xl bg-emerald-50 border border-emerald-300 p-4.5 text-xs text-emerald-950 mb-6">
                  <span className="font-bold block text-emerald-900 mb-1 flex items-center gap-1.5 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    {t("trackPage.resolutionReportTitle") || "Official Resolution Certification"}
                  </span>
                  <p className="leading-relaxed text-emerald-800">{selectedComplaint.resolution_notes}</p>
                </div>
              )}

              {/* Interactive Clarification Box if Awaiting Citizen */}
              {selectedComplaint.status === "NEEDS_CLARIFICATION" && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-5 mb-6 text-xs text-amber-950">
                  <div className="flex items-center gap-2 font-bold text-amber-900 mb-2 text-sm">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <span>{t("trackPage.actionRequiredTitle")}</span>
                  </div>
                  <p className="text-amber-800 mb-4 leading-relaxed">
                    {selectedComplaint.clarifications?.[0]?.question ||
                      "Please provide the exact street, landmark, or lane in Pune so the field crew can inspect the spot immediately."}
                  </p>

                  {clarifSuccessMsg && (
                    <div
                      role="status"
                      className="mb-4 rounded-lg bg-emerald-100 border border-emerald-300 p-3 text-emerald-800 font-semibold flex items-center gap-2"
                    >
                      <Check className="h-4 w-4 text-emerald-600" />
                      <span>{clarifSuccessMsg}</span>
                    </div>
                  )}

                  <form onSubmit={handleClarifySubmit} className="flex flex-col sm:flex-row gap-2">
                    <label htmlFor="clarify-input" className="sr-only">
                      Clarification details
                    </label>
                    <input
                      id="clarify-input"
                      type="text"
                      required
                      value={clarificationAnswer}
                      onChange={(e) => setClarificationAnswer(e.target.value)}
                      placeholder={t("trackPage.clarificationPlaceholder") || "e.g. Opposite Orchid School, left side lane towards Balewadi"}
                      className="flex-1 rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs text-[#1F2933] focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <button
                      type="submit"
                      disabled={isSubmittingClarif || !clarificationAnswer.trim()}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#F39A32] hover:bg-[#e08922] text-[#123B5D] font-black px-5 py-2 text-xs shadow transition disabled:opacity-50"
                    >
                      <Send className="h-3.5 w-3.5" />
                      <span>{isSubmittingClarif ? t("trackPage.submittingClarification") : t("trackPage.submitClarification")}</span>
                    </button>
                  </form>
                </div>
              )}

              {/* Verified Resolution Chronological Timeline */}
              <div className="border-t border-[#E9E9E9] pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#667085] flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-[#1F5E91]" />
                    <span>{t("trackPage.timelineTitle") || "Resolution Timeline & Audit Trail"}</span>
                  </h3>
                  <span className="text-[11px] text-[#667085] font-mono">
                    {selectedComplaint.timeline?.length || 0} Milestones Logged
                  </span>
                </div>

                <ol className="space-y-4 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-[#E9E9E9]">
                  {selectedComplaint.timeline?.map((step, idx) => (
                    <li key={idx} className="relative flex items-start gap-4">
                      <div
                        aria-hidden="true"
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1F5E91] text-white shadow-sm ring-4 ring-white z-10"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </div>
                      <div className="flex-1 rounded-xl bg-[#F5F4F0] border border-[#E9E9E9] p-3.5 text-xs">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                          <span className="font-bold text-[#123B5D] text-sm">{step.title}</span>
                          <span className="text-[10px] text-[#667085] font-mono">
                            {formatDate(step.timestamp)}
                          </span>
                        </div>
                        <p className="text-[#667085] leading-snug">{step.description}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </article>
        )}
      </main>

      <Footer />
    </div>
  );
}

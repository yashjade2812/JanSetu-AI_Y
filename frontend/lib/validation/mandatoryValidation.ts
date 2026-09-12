/**
 * JanSetu AI - Strict Mandatory Field Validation & Inline Clarification Library
 * Client-side semantic validators synchronized with backend authoritative rules.
 */

export type FieldStatus = "EMPTY" | "INVALID" | "INSUFFICIENT" | "VALID";
export type RequirementLevel = "MANDATORY" | "IMPORTANT" | "OPTIONAL";

export interface FieldValidation {
  field: string;
  label: string;
  requirement: RequirementLevel;
  status: FieldStatus;
  priority: number;
  question?: string;
}

export interface FormValidationResult {
  canSubmit: boolean;
  validations: Record<string, FieldValidation>;
  unresolvedMandatory: FieldValidation[];
  firstUnresolved: FieldValidation | null;
}

const PUNE_LOCALITIES = [
  "alandi", "dehu", "wagholi", "phursungi", "uruli kanchan", "chakan",
  "shirur", "talegaon dabhade", "hinjawadi", "hinjewadi", "baner",
  "kothrud", "hadapsar", "shivaji nagar", "shivajinagar", "bhosari",
  "dighi", "thergaon", "pimple saudagar", "pimpri", "chinchwad",
  "viman nagar", "yerwada", "vadgaon budruk", "vadgaon", "katraj",
  "kondhwa", "karve nagar", "karvenagar", "warje", "bavdhan", "aundh",
  "deccan gymkhana", "deccan", "model colony", "pune camp", "camp",
  "budhwar peth", "sadashiv peth", "swargate", "bibwewadi", "dhayari",
  "dapodi", "nigdi", "akurdi", "magarpatta", "kharadi", "wakad",
  "balewadi", "kalyani nagar", "senapati bapat road", "sb road",
  "fc road", "fergusson college road", "jm road", "jangali maharaj road",
  "sinhagad road", "paud road", "pashan", "tingre nagar", "lohegaon",
  "vishrantwadi", "gokhalenagar", "erandwane", "parvati", "padmavati",
  "dhankawadi", "wanowrie", "fatima nagar", "moledina road", "ravet",
  "punawale", "tathawade", "moshi", "chikhali", "charoli", "ravivar peth",
  "kasba peth", "shukrawar peth", "somwar peth", "mangalwar peth", "guruwar peth",
  "ganesh peth", "bhavani peth", "nana peth", "rasta peth", "narayan peth",
  "shaniwar peth"
];

const LOCATION_INDICATORS = [
  "road", "rd", "street", "st", "lane", "gali", "chowk", "chawk", "circle",
  "nagar", "colony", "society", "soc", "enclave", "sector", "sec", "ward",
  "peth", "wadi", "vihar", "heights", "residency", "park", "garden",
  "near", "nr", "opposite", "opp", "behind", "beside", "adjacent", "facing",
  "crossroad", "junction", "signal", "bus stop", "bus stand", "depot",
  "railway station", "station", "metro", "bridge", "flyover", "underpass",
  "hospital", "clinic", "dispensary", "school", "college", "campus",
  "mall", "market", "bazaar", "complex", "building", "bldg", "tower",
  "apartment", "apt", "flat", "gate", "phata", "corner", "point", "hall"
];

const OVERLY_BROAD_LOCATIONS = [
  "pune", "pune city", "pcmc", "pmc", "maharashtra", "india",
  "pune district", "pune division", "city"
];

const JUNK_TEXT_PATTERNS = [
  "asdf", "test", "testing", "hello", "hi", "???", "123", "1234",
  "fix", "please", "urgent", "a", "b", "c", ".", "..", "...", "xyz",
  "abc", "foo", "bar", "temp", "random", "none", "na", "n/a", "nil"
];

const UNRELATED_TEXT_PATTERNS = [
  "please solve this quickly",
  "please solve quickly",
  "please fix this problem",
  "please solve this",
  "help me",
  "call me",
  "problem here",
  "issue here",
  "fix it",
  "not working",
  "something is wrong",
  "urgent help",
  "nobody is responding"
];

const CIVIC_DOMAIN_KEYWORDS = [
  "water", "pipe", "pipeline", "tap", "leak", "leakage", "drain", "drainage",
  "sewage", "gutter", "overflow", "contamination", "road", "pothole", "asphalt",
  "footpath", "divider", "pavement", "light", "streetlight", "pole", "wire",
  "electric", "electricity", "power", "spark", "sparking", "transformer",
  "garbage", "waste", "trash", "bin", "dump", "dumping", "sweeping",
  "health", "dengue", "malaria", "mosquito", "sanitation", "hospital",
  "tree", "branch", "foliage", "fallen", "park", "encroach", "encroachment",
  "hawker", "illegal", "unauthorized", "hoarding", "bus stop", "public asset",
  "pressure", "supply", "drinking water", "flooding", "smell", "odor"
];

/**
 * Validates Location string semantically.
 */
export function validateLocation(location: string | null | undefined): { status: FieldStatus; question?: string } {
  if (!location) {
    return {
      status: "EMPTY",
      question: "Where is this issue located? To help us route your complaint correctly, could you please provide the area, street, ward, or a nearby landmark?",
    };
  }

  const clean = location.trim();
  if (!clean) {
    return {
      status: "EMPTY",
      question: "Where is this issue located? To help us route your complaint correctly, could you please provide the area, street, ward, or a nearby landmark?",
    };
  }

  const lower = clean.toLowerCase();

  // Junk text
  if (JUNK_TEXT_PATTERNS.includes(lower)) {
    return {
      status: "INVALID",
      question: "Where is this issue located in Pune? Please enter a valid street name, landmark, or area in Pune rather than random text.",
    };
  }

  // Repeated character patterns
  const uniqueChars = new Set(lower.replace(/\s+/g, ""));
  if (uniqueChars.size <= 3 && lower.length >= 4) {
    return {
      status: "INVALID",
      question: "Where is this issue located in Pune? Please enter a valid street name, landmark, or area in Pune rather than random text.",
    };
  }

  // Unrelated comments
  for (const pattern of UNRELATED_TEXT_PATTERNS) {
    if (lower.includes(pattern)) {
      return {
        status: "INVALID",
        question: "Where is this issue located? Please enter an actual location or landmark rather than an unrelated comment.",
      };
    }
  }

  // Overly broad single city names
  const cleanAlpha = lower.replace(/[^a-zA-Z\s]/g, "").trim();
  if (OVERLY_BROAD_LOCATIONS.includes(cleanAlpha)) {
    return {
      status: "INSUFFICIENT",
      question: "Could you please provide a more specific location or nearby landmark? Please provide a more specific area, street, ward, or nearby landmark so the concerned department can locate the issue.",
    };
  }

  // Minimum length
  if (clean.length < 4) {
    return {
      status: "INSUFFICIENT",
      question: "Location is too short. Could you please provide a more specific location or nearby landmark?",
    };
  }

  // Usable locality or indicator
  const hasLocality = PUNE_LOCALITIES.some((loc) => lower.includes(loc));
  const hasIndicator = LOCATION_INDICATORS.some((ind) => lower.includes(ind));
  const hasSectorOrWard = /\b(sector|ward|lane|road|gali|plot)\s*\d+\b/i.test(lower);

  if (!hasLocality && !hasIndicator && !hasSectorOrWard) {
    const words = clean.split(/\s+/);
    if (words.length < 2 || clean.length < 8) {
      return {
        status: "INVALID",
        question: "Please enter a recognizable street, colony, ward, or nearby landmark in Pune. Could you please provide a more specific location or nearby landmark?",
      };
    }
  }

  return { status: "VALID" };
}

/**
 * Validates Complaint Description (raw_text) semantically.
 */
export function validateDescription(text: string | null | undefined): { status: FieldStatus; question?: string } {
  if (!text) {
    return {
      status: "EMPTY",
      question: "What issue are you experiencing? Please describe the civic issue you are facing.",
    };
  }

  const clean = text.trim();
  if (!clean) {
    return {
      status: "EMPTY",
      question: "What issue are you experiencing? Please describe the civic issue you are facing.",
    };
  }

  const lower = clean.toLowerCase();

  // Junk patterns
  if (JUNK_TEXT_PATTERNS.includes(lower)) {
    return {
      status: "INVALID",
      question: "Please provide a meaningful description of the issue rather than placeholder text. Could you please describe the specific civic problem you are facing?",
    };
  }

  // Repeated character patterns
  const uniqueChars = new Set(clean);
  if (uniqueChars.size <= 2 && clean.length > 4) {
    return {
      status: "INVALID",
      question: "Please provide a clear and meaningful description of your grievance. Could you please provide more details about the issue?",
    };
  }

  // Unrelated generic phrases
  for (const pattern of UNRELATED_TEXT_PATTERNS) {
    if (lower === pattern || lower === `${pattern}.` || lower === `${pattern}!`) {
      return {
        status: "INVALID",
        question: "Please describe the specific civic problem you are facing (e.g. water leakage, pothole, street light outage). Could you please describe the specific civic problem you are facing?",
      };
    }
  }

  // Word count & civic domain check
  const words = lower.split(/\s+/).filter((w) => w.length > 1);
  const hasCivicKeyword = CIVIC_DOMAIN_KEYWORDS.some((kw) => lower.includes(kw));

  if (clean.length < 10 || words.length < 3) {
    if (!hasCivicKeyword || words.length < 3) {
      if (words.length > 0 && clean.length >= 3 && clean.length <= 40) {
        const topic = clean.replace(/[?.!]+$/, "").trim();
        return {
          status: "INSUFFICIENT",
          question: `Could you please describe the ${topic} in more detail? Please provide more details regarding what issue is occurring.`,
        };
      }
      return {
        status: "INSUFFICIENT",
        question: "Could you please provide more details about the issue? Please provide more details regarding what issue is occurring.",
      };
    }
  }

  return { status: "VALID" };
}

export function validateComplaintType(
  category?: string | null,
  department?: string,
  descStatus?: FieldStatus
): { status: FieldStatus; question?: string } {
  // If explicitly provided, check its value
  if (category !== undefined && category !== null && category !== "") {
    const val = category.trim().toUpperCase();
    if (val === "UNKNOWN" || val === "GENERAL" || val === "OTHER") {
      const dept = (department || "").trim().toUpperCase();
      if (dept && dept !== "OTHER_HUMAN_REVIEW" && dept !== "UNKNOWN") {
        return { status: "VALID" };
      }
      return {
        status: "EMPTY",
        question: "Which category does your complaint relate to? Please confirm or select the category of your complaint.",
      };
    }
    return { status: "VALID" };
  }

  // If department is provided and valid
  const dept = (department || "").trim().toUpperCase();
  if (dept && dept !== "OTHER_HUMAN_REVIEW" && dept !== "UNKNOWN" && dept !== "") {
    return { status: "VALID" };
  }

  // If description is valid, category is auto-classified by AI triage
  if (descStatus === "VALID") {
    return { status: "VALID" };
  }

  return {
    status: "EMPTY",
    question: "Which category does your complaint relate to? Please confirm or select the category of your complaint.",
  };
}

/**
 * Evaluates entire complaint form for submission eligibility.
 */
export function validateComplaintForm(params: {
  rawText: string;
  locationName: string;
  category?: string;
  department?: string;
}): FormValidationResult {
  const descVal = validateDescription(params.rawText);
  const locVal = validateLocation(params.locationName);
  const typeVal = validateComplaintType(params.category, params.department, descVal.status);

  const validations: Record<string, FieldValidation> = {
    raw_text: {
      field: "raw_text",
      label: "Complaint Description",
      requirement: "MANDATORY",
      priority: 1,
      status: descVal.status,
      question: descVal.question,
    },
    location: {
      field: "location",
      label: "Location",
      requirement: "MANDATORY",
      priority: 2,
      status: locVal.status,
      question: locVal.question,
    },
    complaint_type: {
      field: "complaint_type",
      label: "Complaint Category",
      requirement: "MANDATORY",
      priority: 3,
      status: typeVal.status,
      question: typeVal.question,
    },
  };

  const mandatoryFields = Object.values(validations).filter(
    (f) => f.requirement === "MANDATORY"
  );

  const unresolvedMandatory = mandatoryFields.filter(
    (f) => f.status !== "VALID"
  );

  unresolvedMandatory.sort((a, b) => a.priority - b.priority);

  const firstUnresolved = unresolvedMandatory.length > 0 ? unresolvedMandatory[0] : null;
  const canSubmit = unresolvedMandatory.length === 0;

  return {
    canSubmit,
    validations,
    unresolvedMandatory,
    firstUnresolved,
  };
}

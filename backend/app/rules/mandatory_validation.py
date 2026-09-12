"""
JanSetu AI - Strict Mandatory Field Validation & Inline Clarification System
Authoritative validation rules enforcing that every mandatory field must be
strictly VALID (not EMPTY, INVALID, or INSUFFICIENT) before a complaint can be submitted.
"""

import re
from typing import Dict, Any, List, Optional, Tuple

# =====================================================================
# 1. Requirement Levels
# =====================================================================
REQUIREMENT_MANDATORY = "MANDATORY"
REQUIREMENT_IMPORTANT = "IMPORTANT"
REQUIREMENT_OPTIONAL = "OPTIONAL"

# =====================================================================
# 2. Validation Statuses
# =====================================================================
STATUS_EMPTY = "EMPTY"
STATUS_INVALID = "INVALID"
STATUS_INSUFFICIENT = "INSUFFICIENT"
STATUS_VALID = "VALID"

# =====================================================================
# 3. Known Localities & Keywords in Pune Region
# =====================================================================
PUNE_LOCALITIES = [
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
]

LOCATION_INDICATORS = [
    "road", "rd", "street", "st", "lane", "gali", "chowk", "chawk", "circle",
    "nagar", "colony", "society", "soc", "enclave", "sector", "sec", "ward",
    "peth", "wadi", "nagar", "vihar", "heights", "residency", "park", "garden",
    "near", "nr", "opposite", "opp", "behind", "beside", "adjacent", "facing",
    "crossroad", "junction", "signal", "bus stop", "bus stand", "depot",
    "railway station", "station", "metro", "bridge", "flyover", "underpass",
    "hospital", "clinic", "dispensary", "school", "college", "campus",
    "mall", "market", "bazaar", "complex", "building", "bldg", "tower",
    "apartment", "apt", "flat", "gate", "phata", "corner", "point", "hall"
]

OVERLY_BROAD_LOCATIONS = [
    "pune", "pune city", "pcmc", "pmc", "maharashtra", "india",
    "pune district", "pune division", "city"
]

JUNK_TEXT_PATTERNS = [
    "asdf", "test", "testing", "hello", "hi", "???", "123", "1234",
    "fix", "please", "urgent", "a", "b", "c", ".", "..", "...", "xyz",
    "abc", "foo", "bar", "temp", "random", "none", "na", "n/a", "nil"
]

UNRELATED_TEXT_PATTERNS = [
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
]

CIVIC_DOMAIN_KEYWORDS = [
    "water", "pipe", "pipeline", "tap", "leak", "leakage", "drain", "drainage",
    "sewage", "gutter", "overflow", "contamination", "road", "pothole", "asphalt",
    "footpath", "divider", "pavement", "light", "streetlight", "pole", "wire",
    "electric", "electricity", "power", "spark", "sparking", "transformer",
    "garbage", "waste", "trash", "bin", "dump", "dumping", "sweeping",
    "health", "dengue", "malaria", "mosquito", "sanitation", "hospital",
    "tree", "branch", "foliage", "fallen", "park", "encroach", "encroachment",
    "hawker", "illegal", "unauthorized", "hoarding", "bus stop", "public asset",
    "pressure", "supply", "drinking water", "flooding", "smell", "odor"
]

# =====================================================================
# 4. Central Category Requirements Mapping
# =====================================================================
COMPLAINT_REQUIREMENTS: Dict[str, Dict[str, Dict[str, Any]]] = {
    "WATER_SUPPLY": {
        "raw_text": {
            "requirement": REQUIREMENT_MANDATORY,
            "priority": 1,
            "label": "Complaint Description",
            "question": "Please describe the specific water supply disruption or problem you are facing.",
        },
        "location": {
            "requirement": REQUIREMENT_MANDATORY,
            "priority": 2,
            "label": "Location",
            "question": "To help us route your complaint correctly, could you please provide the area, street, ward, or a nearby landmark?",
        },
        "complaint_type": {
            "requirement": REQUIREMENT_MANDATORY,
            "priority": 3,
            "label": "Complaint Category",
            "question": "Please confirm or select the category of your complaint.",
        },
        "duration": {
            "requirement": REQUIREMENT_IMPORTANT,
            "priority": 4,
            "label": "Duration",
            "question": "How long has this water supply issue been occurring?",
        },
    },
    "ROAD": {
        "raw_text": {
            "requirement": REQUIREMENT_MANDATORY,
            "priority": 1,
            "label": "Complaint Description",
            "question": "Please describe the road damage, pothole, or footpath issue.",
        },
        "location": {
            "requirement": REQUIREMENT_MANDATORY,
            "priority": 2,
            "label": "Location",
            "question": "Could you share the specific road name, crossroad, or landmark in Pune where this road issue is located?",
        },
        "complaint_type": {
            "requirement": REQUIREMENT_MANDATORY,
            "priority": 3,
            "label": "Complaint Category",
            "question": "Please confirm or select the category of your complaint.",
        },
        "landmark": {
            "requirement": REQUIREMENT_IMPORTANT,
            "priority": 4,
            "label": "Landmark",
            "question": "Is there a specific junction, shop, or landmark near the road spot?",
        },
    },
    "ELECTRICITY": {
        "raw_text": {
            "requirement": REQUIREMENT_MANDATORY,
            "priority": 1,
            "label": "Complaint Description",
            "question": "Please describe the electrical hazard, streetlight, or feeder problem.",
        },
        "location": {
            "requirement": REQUIREMENT_MANDATORY,
            "priority": 2,
            "label": "Location",
            "question": "Where is this electrical issue or faulty streetlight located? Please provide the street or pole landmark.",
        },
        "complaint_type": {
            "requirement": REQUIREMENT_MANDATORY,
            "priority": 3,
            "label": "Complaint Category",
            "question": "Please confirm or select the category of your complaint.",
        },
        "safety_context": {
            "requirement": REQUIREMENT_IMPORTANT,
            "priority": 4,
            "label": "Safety Context",
            "question": "Is there any active sparking or danger to pedestrians at the spot?",
        },
    },
    "WASTE_MANAGEMENT": {
        "raw_text": {
            "requirement": REQUIREMENT_MANDATORY,
            "priority": 1,
            "label": "Complaint Description",
            "question": "Please describe the garbage, waste accumulation, or community bin issue.",
        },
        "location": {
            "requirement": REQUIREMENT_MANDATORY,
            "priority": 2,
            "label": "Location",
            "question": "Please provide the exact street or colony location where garbage has accumulated.",
        },
        "complaint_type": {
            "requirement": REQUIREMENT_MANDATORY,
            "priority": 3,
            "label": "Complaint Category",
            "question": "Please confirm or select the category of your complaint.",
        },
    },
    "PUBLIC_HEALTH": {
        "raw_text": {
            "requirement": REQUIREMENT_MANDATORY,
            "priority": 1,
            "label": "Complaint Description",
            "question": "Please describe the health or sanitation grievance.",
        },
        "location": {
            "requirement": REQUIREMENT_MANDATORY,
            "priority": 2,
            "label": "Location",
            "question": "Which area or locality in Pune is facing this sewage or health concern?",
        },
        "complaint_type": {
            "requirement": REQUIREMENT_MANDATORY,
            "priority": 3,
            "label": "Complaint Category",
            "question": "Please confirm or select the category of your complaint.",
        },
    },
    "GARDEN": {
        "raw_text": {
            "requirement": REQUIREMENT_MANDATORY,
            "priority": 1,
            "label": "Complaint Description",
            "question": "Please describe the tree branch hazard or park maintenance issue.",
        },
        "location": {
            "requirement": REQUIREMENT_MANDATORY,
            "priority": 2,
            "label": "Location",
            "question": "Which public park, road side, or garden in Pune has this tree or foliage issue?",
        },
        "complaint_type": {
            "requirement": REQUIREMENT_MANDATORY,
            "priority": 3,
            "label": "Complaint Category",
            "question": "Please confirm or select the category of your complaint.",
        },
    },
    "PUBLIC_PROPERTY_MANAGEMENT": {
        "raw_text": {
            "requirement": REQUIREMENT_MANDATORY,
            "priority": 1,
            "label": "Complaint Description",
            "question": "Please describe the damaged public property or civic infrastructure.",
        },
        "location": {
            "requirement": REQUIREMENT_MANDATORY,
            "priority": 2,
            "label": "Location",
            "question": "Where is the damaged municipal building, bus shelter, or public property located?",
        },
        "complaint_type": {
            "requirement": REQUIREMENT_MANDATORY,
            "priority": 3,
            "label": "Complaint Category",
            "question": "Please confirm or select the category of your complaint.",
        },
    },
    "ENCROACHMENT": {
        "raw_text": {
            "requirement": REQUIREMENT_MANDATORY,
            "priority": 1,
            "label": "Complaint Description",
            "question": "Please describe the illegal encroachment or blocked public space.",
        },
        "location": {
            "requirement": REQUIREMENT_MANDATORY,
            "priority": 2,
            "label": "Location",
            "question": "Which footpath, road margin, or public area in Pune has this unauthorized encroachment?",
        },
        "complaint_type": {
            "requirement": REQUIREMENT_MANDATORY,
            "priority": 3,
            "label": "Complaint Category",
            "question": "Please confirm or select the category of your complaint.",
        },
    },
    "OTHER_HUMAN_REVIEW": {
        "raw_text": {
            "requirement": REQUIREMENT_MANDATORY,
            "priority": 1,
            "label": "Complaint Description",
            "question": "Please provide details about the civic problem you wish to report.",
        },
        "location": {
            "requirement": REQUIREMENT_MANDATORY,
            "priority": 2,
            "label": "Location",
            "question": "To help us route your complaint correctly, could you please provide the area, street, ward, or a nearby landmark?",
        },
        "complaint_type": {
            "requirement": REQUIREMENT_MANDATORY,
            "priority": 3,
            "label": "Complaint Category",
            "question": "Please confirm or select the category of your complaint.",
        },
    },
}

DEFAULT_REQUIREMENTS = COMPLAINT_REQUIREMENTS["OTHER_HUMAN_REVIEW"]


# =====================================================================
# 5. Semantic Field Validators
# =====================================================================

def validate_description(text: Optional[str]) -> Tuple[str, Optional[str]]:
    """
    Strict semantic validator for Complaint Description (raw_text).
    Returns (status, clarification_question_or_error)
    """
    if text is None:
        return STATUS_EMPTY, "Please provide a description of the civic issue."

    clean = text.strip()
    if not clean:
        return STATUS_EMPTY, "Please provide a description of the civic issue."

    lower = clean.lower()

    # Reject trivial junk / random text
    if lower in JUNK_TEXT_PATTERNS:
        return STATUS_INVALID, "Please provide a meaningful description of the issue rather than placeholder text."

    # Reject repeated identical characters (e.g. 'aaaaa', 'asdfasdf')
    if len(set(clean)) <= 2 and len(clean) > 4:
        return STATUS_INVALID, "Please provide a clear and meaningful description of your grievance."

    # Check for empty generic phrases with no details
    for pattern in UNRELATED_TEXT_PATTERNS:
        if lower == pattern or lower == f"{pattern}." or lower == f"{pattern}!":
            return STATUS_INVALID, "Please describe the specific civic problem you are facing (e.g. water leakage, pothole, street light outage)."

    # Length & word count check
    words = [w for w in lower.split() if len(w) > 1]
    has_civic_keyword = any(kw in lower for kw in CIVIC_DOMAIN_KEYWORDS)

    if len(clean) < 10 or len(words) < 3:
        if not has_civic_keyword:
            return STATUS_INSUFFICIENT, "Please provide more details regarding what issue is occurring."

    return STATUS_VALID, None


def validate_location(location: Optional[str]) -> Tuple[str, Optional[str]]:
    """
    Strict semantic validator for Location.
    Must contain usable location information (Area, Street, Road, Ward, Locality, Landmark).
    Rejects random text, unrelated comments, and overly broad single-word cities.
    Returns (status, clarification_question_or_error)
    """
    if location is None:
        return STATUS_EMPTY, "To help us route your complaint correctly, could you please provide the area, street, ward, or a nearby landmark?"

    clean = location.strip()
    if not clean:
        return STATUS_EMPTY, "To help us route your complaint correctly, could you please provide the area, street, ward, or a nearby landmark?"

    lower = clean.lower()

    # Reject trivial junk / random text
    if lower in JUNK_TEXT_PATTERNS:
        return STATUS_INVALID, "Please enter a valid street name, landmark, or area in Pune rather than random text."

    # Reject repeated character patterns (e.g. 'asdfasdf', 'zzzzz')
    if len(set(lower.replace(" ", ""))) <= 3 and len(lower) >= 4:
        return STATUS_INVALID, "Please enter a valid street name, landmark, or area in Pune rather than random text."

    # Reject unrelated conversational sentences
    for pattern in UNRELATED_TEXT_PATTERNS:
        if pattern in lower:
            return STATUS_INVALID, "Please enter an actual location or landmark rather than an unrelated comment."

    # Check for overly broad single city names lacking operational precision
    clean_alpha = re.sub(r"[^a-zA-Z\s]", "", lower).strip()
    if clean_alpha in OVERLY_BROAD_LOCATIONS:
        return (
            STATUS_INSUFFICIENT,
            "Please provide a more specific area, street, ward, or nearby landmark so the concerned department can locate the issue.",
        )

    # Minimum length requirement
    if len(clean) < 4:
        return (
            STATUS_INSUFFICIENT,
            "Location is too short. Please provide a specific street, locality, or nearby landmark.",
        )

    # Check if location contains any recognizable Pune locality or spatial indicator
    has_locality = any(loc in lower for loc in PUNE_LOCALITIES)
    has_indicator = any(ind in lower for ind in LOCATION_INDICATORS)

    # Check if words contain numbers with road or sector (e.g. 'Sector 5', 'Ward 12', 'Plot 40')
    has_sector_or_ward = bool(re.search(r"\b(sector|ward|lane|road|gali|lane|plot)\s*\d+\b", lower))

    if not (has_locality or has_indicator or has_sector_or_ward):
        # If it has at least 2 distinct words with at least 8 characters, allow as landmark/society name
        words = clean.split()
        if len(words) < 2 or len(clean) < 8:
            return (
                STATUS_INVALID,
                "Please enter a recognizable street, colony, ward, or nearby landmark in Pune.",
            )

    return STATUS_VALID, None


def validate_complaint_type(complaint_type: Optional[str], department: Optional[str] = None) -> Tuple[str, Optional[str]]:
    """
    Strict validator for Complaint Type / Category.
    Cannot be UNKNOWN or empty.
    Returns (status, clarification_question_or_error)
    """
    val = (complaint_type or "").strip()
    if not val or val.upper() in ["UNKNOWN", "GENERAL", "OTHER"]:
        # If department is valid and not fallback, category is derived
        dept = (department or "").strip().upper()
        if dept and dept not in ["OTHER_HUMAN_REVIEW", "UNKNOWN", ""]:
            return STATUS_VALID, None
        return STATUS_EMPTY, "Please confirm or select the category of your complaint."

    return STATUS_VALID, None


# =====================================================================
# 6. Overall Complaint Submission Validator
# =====================================================================

def validate_complaint_submission(
    data: Dict[str, Any],
    department: Optional[str] = None,
    is_emergency: bool = False,
) -> Dict[str, Any]:
    """
    Authoritatively validates all mandatory fields for a grievance submission.
    Returns:
      {
        "can_submit": bool,
        "is_emergency": bool,
        "validations": Dict[str, Dict[str, Any]],
        "invalid_fields": List[Dict[str, Any]],
        "first_unresolved": Optional[Dict[str, Any]],
      }
    """
    dept_key = (department or data.get("department") or "OTHER_HUMAN_REVIEW").strip().upper()
    req_config = COMPLAINT_REQUIREMENTS.get(dept_key, DEFAULT_REQUIREMENTS)

    validations: Dict[str, Dict[str, Any]] = {}
    invalid_fields: List[Dict[str, Any]] = []

    # 1. Validate Description (raw_text)
    raw_text = data.get("raw_text")
    desc_status, desc_q = validate_description(raw_text)
    desc_config = req_config.get("raw_text", DEFAULT_REQUIREMENTS["raw_text"])
    desc_res = {
        "field": "raw_text",
        "label": desc_config["label"],
        "requirement": desc_config["requirement"],
        "priority": desc_config["priority"],
        "status": desc_status,
        "question": desc_q or desc_config["question"],
    }
    validations["raw_text"] = desc_res
    if desc_config["requirement"] == REQUIREMENT_MANDATORY and desc_status != STATUS_VALID:
        invalid_fields.append(desc_res)

    # 2. Validate Location
    location_val = data.get("location_name") or data.get("location_text") or data.get("location")
    loc_status, loc_q = validate_location(location_val)
    loc_config = req_config.get("location", DEFAULT_REQUIREMENTS["location"])
    loc_res = {
        "field": "location",
        "label": loc_config["label"],
        "requirement": loc_config["requirement"],
        "priority": loc_config["priority"],
        "status": loc_status,
        "question": loc_q or loc_config["question"],
    }
    validations["location"] = loc_res
    if loc_config["requirement"] == REQUIREMENT_MANDATORY and loc_status != STATUS_VALID:
        invalid_fields.append(loc_res)

    # 3. Validate Complaint Type
    category_val = data.get("complaint_type") or data.get("category") or data.get("summary")
    type_status, type_q = validate_complaint_type(category_val, dept_key)
    type_config = req_config.get("complaint_type", DEFAULT_REQUIREMENTS["complaint_type"])
    type_res = {
        "field": "complaint_type",
        "label": type_config["label"],
        "requirement": type_config["requirement"],
        "priority": type_config["priority"],
        "status": type_status,
        "question": type_q or type_config["question"],
    }
    validations["complaint_type"] = type_res
    if type_config["requirement"] == REQUIREMENT_MANDATORY and type_status != STATUS_VALID:
        invalid_fields.append(type_res)

    # Sort invalid fields by priority ascending (1 is highest priority)
    invalid_fields.sort(key=lambda f: f.get("priority", 99))

    first_unresolved = invalid_fields[0] if invalid_fields else None
    can_submit = len(invalid_fields) == 0

    return {
        "can_submit": can_submit,
        "is_emergency": is_emergency,
        "validations": validations,
        "invalid_fields": invalid_fields,
        "first_unresolved": first_unresolved,
    }


class MandatoryValidationException(Exception):
    """Exception raised when complaint submission fails mandatory field validation."""
    def __init__(
        self,
        invalid_fields: List[Dict[str, Any]],
        message: str = "Please complete all mandatory information before submitting your complaint.",
    ):
        self.invalid_fields = invalid_fields
        self.message = message
        super().__init__(message)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "success": False,
            "error": "MANDATORY_FIELDS_INCOMPLETE",
            "message": self.message,
            "invalid_fields": self.invalid_fields,
        }


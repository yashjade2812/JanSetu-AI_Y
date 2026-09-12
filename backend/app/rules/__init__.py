"""
JanSetu AI - Deterministic Rules Subsystem Export
"""

from app.rules.roles import CITIZEN, MUNICIPAL_ADMIN, DEPARTMENT_OFFICER, COLLECTOR, ALL_ROLES, is_valid_role
from app.rules.departments import (
    WATER_SUPPLY, ELECTRICITY, PUBLIC_HEALTH, WASTE_MANAGEMENT,
    PUBLIC_PROPERTY_MANAGEMENT, GARDEN, ROAD, ENCROACHMENT, OTHER_HUMAN_REVIEW,
    DEPARTMENTS, DEPARTMENT_IDS, validate_department
)
from app.rules.priorities import P0, P1, P2, P3, ALL_PRIORITIES, is_valid_priority
from app.rules.ticket_states import (
    NEW, AI_ANALYZED, NEEDS_CLARIFICATION, AWAITING_CITIZEN, READY_FOR_ROUTING,
    ASSIGNED, IN_PROGRESS, RESOLVED, CLOSED, ESCALATED, SLA_BREACHED, REJECTED,
    can_transition
)
from app.rules.sla_policy import DEMO_SLA_POLICY, calculate_deadlines, evaluate_sla_status
from app.rules.priority_rules import evaluate_priority
from app.rules.routing_rules import route_to_department
from app.rules.permissions import (
    can_view_ticket, can_modify_ticket, can_reroute_department,
    can_view_admin_metrics, can_view_collector_brief
)
from app.rules.escalation_rules import check_auto_escalation
from app.rules.mandatory_validation import (
    REQUIREMENT_MANDATORY, REQUIREMENT_IMPORTANT, REQUIREMENT_OPTIONAL,
    STATUS_EMPTY, STATUS_INVALID, STATUS_INSUFFICIENT, STATUS_VALID,
    COMPLAINT_REQUIREMENTS, DEFAULT_REQUIREMENTS,
    validate_description, validate_location, validate_complaint_type,
    validate_complaint_submission,
)

__all__ = [
    "CITIZEN", "MUNICIPAL_ADMIN", "DEPARTMENT_OFFICER", "COLLECTOR", "ALL_ROLES", "is_valid_role",
    "WATER_SUPPLY", "ELECTRICITY", "PUBLIC_HEALTH", "WASTE_MANAGEMENT",
    "PUBLIC_PROPERTY_MANAGEMENT", "GARDEN", "ROAD", "ENCROACHMENT", "OTHER_HUMAN_REVIEW",
    "DEPARTMENTS", "DEPARTMENT_IDS", "validate_department",
    "P0", "P1", "P2", "P3", "ALL_PRIORITIES", "is_valid_priority",
    "NEW", "AI_ANALYZED", "NEEDS_CLARIFICATION", "AWAITING_CITIZEN", "READY_FOR_ROUTING",
    "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CLOSED", "ESCALATED", "SLA_BREACHED", "REJECTED",
    "can_transition",
    "DEMO_SLA_POLICY", "calculate_deadlines", "evaluate_sla_status",
    "evaluate_priority",
    "route_to_department",
    "can_view_ticket", "can_modify_ticket", "can_reroute_department",
    "can_view_admin_metrics", "can_view_collector_brief",
    "check_auto_escalation",
    "REQUIREMENT_MANDATORY", "REQUIREMENT_IMPORTANT", "REQUIREMENT_OPTIONAL",
    "STATUS_EMPTY", "STATUS_INVALID", "STATUS_INSUFFICIENT", "STATUS_VALID",
    "COMPLAINT_REQUIREMENTS", "DEFAULT_REQUIREMENTS",
    "validate_description", "validate_location", "validate_complaint_type",
    "validate_complaint_submission",
]

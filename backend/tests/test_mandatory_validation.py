"""
JanSetu AI - Comprehensive Mandatory Field Validation & Inline Clarification Tests

Covers all 10 scenarios:
1. Empty mandatory field -> Blocked, status EMPTY
2. Random junk text -> Blocked, status INVALID
3. Unrelated conversational text -> Blocked, status INVALID
4. Valid location -> Allowed, status VALID
5. Multiple mandatory fields with one missing -> Blocked, identifies missing field
6. All mandatory fields valid -> Allowed, HTTP 201
7. Valid then deleted -> Status reverts to EMPTY, blocked
8. Direct API bypass without mandatory fields -> HTTP 400 Bad Request (MANDATORY_FIELDS_INCOMPLETE)
9. Overly broad city name alone -> INSUFFICIENT, asks for specific area/landmark
10. P0 Emergency safety hazard -> Allowed with HTTP 201 ASSIGNED & parallel clarification
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.rules.mandatory_validation import (
    validate_location,
    validate_description,
    validate_complaint_type,
    validate_complaint_submission,
    STATUS_EMPTY,
    STATUS_INVALID,
    STATUS_INSUFFICIENT,
    STATUS_VALID,
    REQUIREMENT_MANDATORY,
)

client = TestClient(app)


# =====================================================================
# Scenario 1: Empty Mandatory Field
# =====================================================================
def test_scenario_1_empty_mandatory_field():
    """User provides empty location -> Blocked, status EMPTY, prompt returned."""
    status, question = validate_location("")
    assert status == STATUS_EMPTY
    assert "route your complaint correctly" in question

    status_none, question_none = validate_location(None)
    assert status_none == STATUS_EMPTY
    assert "route your complaint correctly" in question_none

    val_res = validate_complaint_submission({
        "raw_text": "Low water pressure for 3 days in our residential pipeline.",
        "location_name": "",
    }, department="WATER_SUPPLY")

    assert val_res["can_submit"] is False
    assert val_res["first_unresolved"]["field"] == "location"
    assert val_res["first_unresolved"]["status"] == STATUS_EMPTY


# =====================================================================
# Scenario 2: Random / Gibberish Text
# =====================================================================
def test_scenario_2_random_junk_text():
    """User enters gibberish ('asdf', '123', '???') -> Blocked, status INVALID."""
    status, question = validate_location("asdf")
    assert status == STATUS_INVALID
    assert "valid street name" in question

    status_num, _ = validate_location("123")
    assert status_num in [STATUS_INVALID, STATUS_INSUFFICIENT]

    desc_status, desc_q = validate_description("asdf")
    assert desc_status == STATUS_INVALID
    assert "meaningful description" in desc_q


# =====================================================================
# Scenario 3: Unrelated Conversational Text
# =====================================================================
def test_scenario_3_unrelated_text():
    """User enters conversational comment ('Please solve this quickly') -> Blocked, status INVALID."""
    status, question = validate_location("Please solve this quickly")
    assert status == STATUS_INVALID
    assert "actual location" in question

    desc_status, desc_q = validate_description("Please solve this quickly")
    assert desc_status == STATUS_INVALID
    assert "specific civic problem" in desc_q


# =====================================================================
# Scenario 4: Valid Location
# =====================================================================
def test_scenario_4_valid_location():
    """User provides recognized area, street or landmark in Pune -> VALID."""
    status1, q1 = validate_location("Sector 5 near City Mall")
    assert status1 == STATUS_VALID
    assert q1 is None

    status2, q2 = validate_location("Baner Road near Balewadi Phata, Pune")
    assert status2 == STATUS_VALID
    assert q2 is None

    status3, q3 = validate_location("Kothrud near Karve Statue")
    assert status3 == STATUS_VALID
    assert q3 is None


# =====================================================================
# Scenario 5: Multiple Mandatory Fields (Description valid, Location missing)
# =====================================================================
def test_scenario_5_multiple_mandatory_fields():
    """Description valid, location empty -> can_submit is False, identifies location as unresolved."""
    val_res = validate_complaint_submission({
        "raw_text": "Massive sewage overflow from main drain spreading onto street.",
        "location_name": "",
        "complaint_type": "Drainage Overflow",
    }, department="DRAINAGE")

    assert val_res["can_submit"] is False
    assert len(val_res["invalid_fields"]) == 1
    assert val_res["invalid_fields"][0]["field"] == "location"
    assert val_res["invalid_fields"][0]["status"] == STATUS_EMPTY


# =====================================================================
# Scenario 6: All Mandatory Fields Valid
# =====================================================================
def test_scenario_6_all_mandatory_fields_valid():
    """When all mandatory fields are valid -> can_submit is True, HTTP 201 created."""
    val_res = validate_complaint_submission({
        "raw_text": "Severely damaged road with multiple deep potholes creating vehicular accidents.",
        "location_name": "FC Road near Fergusson College Main Gate, Pune",
        "complaint_type": "Road Works",
    }, department="ROAD")

    assert val_res["can_submit"] is True
    assert len(val_res["invalid_fields"]) == 0
    assert val_res["first_unresolved"] is None

    # End-to-end API test
    response = client.post(
        "/api/v1/complaints/",
        json={
            "raw_text": "Severely damaged road with multiple deep potholes creating vehicular accidents.",
            "location_name": "FC Road near Fergusson College Main Gate, Pune",
            "preferred_language": "en",
        },
    )
    assert response.status_code == 201
    res_data = response.json()
    assert res_data["status"] == "ASSIGNED"
    assert "tracking_number" in res_data


# =====================================================================
# Scenario 7: Valid Then Deleted
# =====================================================================
def test_scenario_7_valid_then_deleted():
    """Field valid, then cleared back to empty -> status reverts to EMPTY, submit blocked."""
    # 1. Initially valid
    status_valid, _ = validate_location("Kothrud Depot, Pune")
    assert status_valid == STATUS_VALID

    # 2. Citizen deletes text
    status_reverted, question = validate_location("")
    assert status_reverted == STATUS_EMPTY
    assert question is not None

    val_res = validate_complaint_submission({
        "raw_text": "Water pipeline burst causing street flooding.",
        "location_name": "",
    }, department="WATER_SUPPLY")
    assert val_res["can_submit"] is False


# =====================================================================
# Scenario 8: Frontend Bypass Blocked (Direct API Call)
# =====================================================================
def test_scenario_8_frontend_bypass_blocked_by_backend():
    """Attempting to bypass frontend validation returns HTTP 400 Bad Request with details."""
    response = client.post(
        "/api/v1/complaints/",
        json={
            "raw_text": "Low water pressure reported in the building for the past two days.",
            "preferred_language": "en",
            # location_name omitted intentionally
        },
    )
    assert response.status_code == 400
    err_data = response.json()
    assert err_data["error"] == "MANDATORY_FIELDS_INCOMPLETE"
    assert any(field["field"] == "location" for field in err_data["invalid_fields"])
    assert err_data["invalid_fields"][0]["requirement"] == REQUIREMENT_MANDATORY


# =====================================================================
# Scenario 9: Overly Broad Location
# =====================================================================
def test_scenario_9_overly_broad_location():
    """User provides just 'Pune' -> Blocked, status INSUFFICIENT, asks for specific area/landmark."""
    status, question = validate_location("Pune")
    assert status == STATUS_INSUFFICIENT
    assert "more specific area" in question

    status_city, q_city = validate_location("Pune City")
    assert status_city == STATUS_INSUFFICIENT
    assert "more specific area" in q_city


# =====================================================================
# Scenario 10: P0 Emergency Safety Bypass
# =====================================================================
def test_scenario_10_emergency_safety_bypass():
    """P0 emergency hazard (live wire sparking) routes immediately as ASSIGNED with parallel clarification."""
    emergency_text = "EMERGENCY: Live high-voltage wire snapped on footpath sparking vigorously near school gate!"
    response = client.post(
        "/api/v1/complaints/",
        json={
            "raw_text": emergency_text,
            "preferred_language": "en",
            # location missing on purpose to verify emergency bypass
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "ASSIGNED"
    tracking_no = data["tracking_number"]

    # Verify clarification is recorded in parallel for dispatch team
    track_res = client.get(f"/api/v1/complaints/{tracking_no}")
    assert track_res.status_code == 200
    track_info = track_res.json()
    assert track_info["priority"] == "P0"
    assert len(track_info["clarifications"]) > 0
    question_lower = track_info["clarifications"][0]["question"].lower()
    assert any(term in question_lower for term in ["area", "street", "landmark", "location"])

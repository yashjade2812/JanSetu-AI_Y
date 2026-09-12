"""
JanSetu AI - Complaint Ingestion & Tracking Integration Tests
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_submit_and_track_complaint():
    # 1. Submit emergency complaint with missing location (honoring P0 safety bypass with parallel clarification)
    submit_res = client.post(
        "/api/v1/complaints/",
        json={
            "raw_text": "EMERGENCY: Live high voltage electrical wire snapped over footpath sparking near pedestrians!",
            "citizen_name": "Ajit Pawar",
            "citizen_phone": "9822100200",
            "preferred_language": "en",
        },
    )
    assert submit_res.status_code == 201
    data = submit_res.json()
    assert "tracking_number" in data
    assert data["status"] == "ASSIGNED"
    tracking_num = data["tracking_number"]

    # 2. Track complaint
    track_res = client.get(f"/api/v1/complaints/{tracking_num}")
    assert track_res.status_code == 200
    track_data = track_res.json()
    assert track_data["tracking_number"] == tracking_num
    assert track_data["department_id"] == "ELECTRICITY"
    assert track_data["priority"] == "P0"
    assert len(track_data["clarifications"]) > 0

    # 3. Submit clarification answering the location question
    clarify_res = client.post(
        f"/api/v1/complaints/{tracking_num}/clarify",
        json={"answer": "Baner near Balewadi Phata", "requested_field": "location"},
    )
    assert clarify_res.status_code == 200
    assert clarify_res.json()["new_status"] == "ASSIGNED"

    # 4. Verify updated state
    track_updated = client.get(f"/api/v1/complaints/{tracking_num}").json()
    assert track_updated["location_name"] == "Baner near Balewadi Phata"
    assert track_updated["status"] == "ASSIGNED"


def test_submit_valid_complaint_preserves_location_and_starts_ai():
    """
    Submits a valid complaint payload matching frontend contract:
    Verifies HTTP 201, complaint created, AI analysis triggered, and location preserved.
    """
    payload = {
        "raw_text": "High pressure water pipe burst overflowing near Swargate PMT bus stop.",
        "preferred_language": "en",
        "location_name": "Swargate Bus Stand, Pune",
        "latitude": 18.5018,
        "longitude": 73.8636,
        "client_timestamp": "2026-09-12T02:00:00.000Z",
    }

    # Test endpoint without trailing slash as well
    response = client.post("/api/v1/complaints", json=payload)
    assert response.status_code == 201
    data = response.json()

    assert "id" in data
    assert "tracking_number" in data
    assert "ticket_id" in data
    assert "ai_preview" in data

    ai_preview = data["ai_preview"]
    assert ai_preview is not None
    assert "department" in ai_preview
    assert "priority" in ai_preview

    # Verify tracking endpoint returns preserved location details
    tracking_num = data["tracking_number"]
    track_res = client.get(f"/api/v1/complaints/{tracking_num}")
    assert track_res.status_code == 200
    track_data = track_res.json()

    assert track_data["location_name"] == "Swargate Bus Stand, Pune"
    assert track_data["latitude"] == pytest.approx(18.5018, abs=0.001)
    assert track_data["longitude"] == pytest.approx(73.8636, abs=0.001)


def test_submit_invalid_payload_returns_422_detail():
    """
    Submits invalid complaint payloads to ensure FastAPI validation rules
    return 422 with structured detail arrays for client-side formatting.
    """
    # 1. raw_text too short (< 5 characters)
    short_res = client.post(
        "/api/v1/complaints/",
        json={
            "raw_text": "leak",
            "preferred_language": "en",
            "location_name": "Kothrud",
        },
    )
    assert short_res.status_code == 422
    short_data = short_res.json()
    assert "detail" in short_data
    assert isinstance(short_data["detail"], list)
    error_entry = short_data["detail"][0]
    assert error_entry["loc"] == ["body", "raw_text"]
    assert error_entry["type"] == "string_too_short"

    # 2. invalid latitude (string instead of float)
    invalid_lat_res = client.post(
        "/api/v1/complaints/",
        json={
            "raw_text": "Water pipeline leakage issue",
            "preferred_language": "en",
            "location_name": "Kothrud",
            "latitude": "invalid-coord",
        },
    )
    assert invalid_lat_res.status_code == 422
    lat_data = invalid_lat_res.json()
    assert any("latitude" in err.get("loc", []) for err in lat_data["detail"])


"""
Comprehensive Automated Verification Suite for Tracking Number Generation & Rollback
Covers Test A, Test B, Test C (concurrency), and Test D (error rollback & sanitization).
"""

import asyncio
import os
import sys
from unittest.mock import patch

backend_dir = os.path.join(os.path.dirname(__file__), "..", "backend")
backend_dir = os.path.abspath(backend_dir)
sys.path.insert(0, backend_dir)

from app.db.session import AsyncSessionLocal, engine, init_db
from app.services.complaint_service import complaint_service
from app.schemas.complaint import ComplaintCreate
from sqlalchemy import text, select
from app.models.complaint import ComplaintModel
from app.api.v1.complaints import submit_complaint
from fastapi import HTTPException
from app.ai.pipeline.orchestrator import orchestrator


MOCK_AI_RES = {
    "summary": "Civic pipeline grievance",
    "department": "WATER_SUPPLY",
    "priority": "P1",
    "severity": "P1",
    "urgency": "HIGH",
    "extracted_location": "Baner Road, Pune",
    "missing_fields": [],
    "actionability": "HIGH",
    "sentiment_score": -0.5,
    "confidence": 0.95,
    "confidence_level": "HIGH",
    "detected_language": "en",
    "extracted_duration": "2 hours",
    "recommended_actions": ["Dispatch repair crew"],
    "clarification_questions": [],
    "field_certainties": {},
    "citizen_response": "Grievance received.",
    "priority_reason": "Water disruption",
    "department_reason": "Water pipeline issue",
}


async def run_tests():
    print(f"============================================================", flush=True)
    print(f"Verifying Tracking Number Resolution on: {engine.dialect.name.upper()}", flush=True)
    print(f"============================================================\n", flush=True)

    # Ensure init_db synchronizes sequence
    await init_db()

    # Query highest tracking number before tests
    async with AsyncSessionLocal() as session:
        if "postgres" in engine.dialect.name:
            res = await session.execute(text("""
                SELECT COALESCE(
                    GREATEST(
                        MAX(
                            CASE 
                                WHEN tracking_number ~ 'JS-[0-9]{4}-[A-Z]+-[0-9]+'
                                THEN CAST(SPLIT_PART(tracking_number, '-', 4) AS BIGINT)
                                ELSE 100
                            END
                        ),
                        100
                    ),
                    100
                )
                FROM complaints
            """))
            initial_max = res.scalar()
        else:
            res = await session.execute(text("SELECT tracking_number FROM complaints"))
            all_rows = [r[0] for r in res.fetchall()]
            initial_max = max([int(r.split("-")[-1]) for r in all_rows if r.startswith("JS-")], default=100)

    print(f"[PRE-CHECK] Initial highest numeric suffix in complaints: {initial_max}", flush=True)
    assert initial_max >= 179, f"Expected initial max >= 179, got {initial_max}"

    with patch.object(orchestrator, "analyze_complaint", return_value=dict(MOCK_AI_RES)):
        # ------------------------------------------------------------
        # TEST A: Submit one complaint
        # ------------------------------------------------------------
        print("\n--- Running Test A: Submit one complaint ---", flush=True)
        async with AsyncSessionLocal() as session:
            complaint_in = ComplaintCreate(
                raw_text="Major water pipeline burst flooding the roadway near Baner road crossroad",
                preferred_language="en",
                location_address="Baner Road crossroad, Pune",
                location_name="Baner Road crossroad, Pune",
                latitude=18.5590,
                longitude=73.7868,
            )
            result_a = await complaint_service.create_complaint(complaint_in, session)
            tracking_a = result_a["tracking_number"]
            print(f"[TEST A PASSED] Created Complaint with Tracking Number: {tracking_a}", flush=True)
            num_a = int(tracking_a.split("-")[-1])
            assert num_a > initial_max, f"Expected tracking number suffix {num_a} > {initial_max}"
            print(f"  Verified suffix {num_a} is strictly greater than pre-existing max {initial_max}", flush=True)

        # ------------------------------------------------------------
        # TEST B: Submit another complaint
        # ------------------------------------------------------------
        print("\n--- Running Test B: Submit second complaint ---", flush=True)
        async with AsyncSessionLocal() as session:
            complaint_in_b = ComplaintCreate(
                raw_text="Streetlight outage causing total darkness near Aundh DP road junction",
                preferred_language="en",
                location_address="Aundh DP road junction, Pune",
                location_name="Aundh DP road junction, Pune",
                latitude=18.5600,
                longitude=73.8000,
            )
            result_b = await complaint_service.create_complaint(complaint_in_b, session)
            tracking_b = result_b["tracking_number"]
            print(f"[TEST B PASSED] Created Second Complaint with Tracking Number: {tracking_b}", flush=True)
            num_b = int(tracking_b.split("-")[-1])
            assert num_b > num_a, f"Expected tracking number {num_b} > {num_a}"
            assert tracking_a != tracking_b, "Tracking numbers must be unique"
            print(f"  Verified sequential increment: {tracking_a} -> {tracking_b}", flush=True)

        # ------------------------------------------------------------
        # TEST C: Test rapid concurrent submissions
        # ------------------------------------------------------------
        print("\n--- Running Test C: Rapid concurrent submissions ---", flush=True)
        CONCURRENT_COUNT = 5

        async def submit_single(idx: int):
            async with AsyncSessionLocal() as session:
                c_in = ComplaintCreate(
                    raw_text=f"Concurrent test grievance {idx}: Pothole issue on main Shivaji Nagar road near bus stop",
                    preferred_language="en",
                    location_address=f"Shivaji Nagar Ward {idx}, Pune",
                    location_name=f"Shivaji Nagar Ward {idx}, Pune",
                    latitude=18.5300 + (idx * 0.001),
                    longitude=73.8500 + (idx * 0.001),
                )
                res = await complaint_service.create_complaint(c_in, session)
                return res["tracking_number"]

        concurrent_results = await asyncio.gather(*[submit_single(i) for i in range(CONCURRENT_COUNT)])
        print(f"[TEST C RESULTS] Generated tracking numbers for {CONCURRENT_COUNT} concurrent submissions:", flush=True)
        for num in concurrent_results:
            print(f"  - {num}", flush=True)

        # Verify uniqueness across all concurrent requests
        unique_set = set(concurrent_results)
        assert len(unique_set) == CONCURRENT_COUNT, f"Duplicate detected in concurrent submissions: {concurrent_results}"
        print(f"[TEST C PASSED] All {CONCURRENT_COUNT} concurrent submissions received strictly unique tracking numbers with zero collisions!", flush=True)

    # ------------------------------------------------------------
    # TEST D: Force error, verify transaction rollback and error sanitization
    # ------------------------------------------------------------
    print("\n--- Running Test D: Force error & verify clean rollback / sanitized response ---", flush=True)
    async with AsyncSessionLocal() as session:
        # Test D1: Verification of rollback on IntegrityError
        # Attempt to insert a complaint manually with an existing tracking number inside a transaction
        existing_tn = tracking_a
        dup_complaint = ComplaintModel(
            tracking_number=existing_tn,
            citizen_name="Test Citizen",
            raw_text="Test duplicate injection",
            status="NEW",
        )
        session.add(dup_complaint)
        rollback_occurred = False
        try:
            await session.flush()
        except Exception as exc:
            await session.rollback()
            rollback_occurred = True
            print(f"  Simulated IntegrityError caught successfully. Rollback executed.", flush=True)

        assert rollback_occurred, "Expected duplicate flush to raise an exception"

        # Verify session is operational after rollback
        test_query = await session.execute(select(ComplaintModel.id).where(ComplaintModel.tracking_number == existing_tn))
        row = test_query.scalar()
        assert row is not None, "Original complaint must still exist"
        print(f"  Session healthy and operational after rollback.", flush=True)

    # Test D2: Verify API endpoint sanitization - no raw SQL exposed to client
    print("\n  Testing API endpoint error sanitization...", flush=True)
    with patch.object(complaint_service, "create_complaint", side_effect=Exception("Database syntax error near table XYZ password=secret")):
        async with AsyncSessionLocal() as session:
            try:
                await submit_complaint(
                    complaint_in=ComplaintCreate(
                        raw_text="Testing error sanitization",
                        location_name="Pune",
                    ),
                    optional_user=None,
                    db=session,
                )
                assert False, "Should have raised HTTPException"
            except HTTPException as http_exc:
                print(f"  HTTPException caught: Status {http_exc.status_code}, Detail: '{http_exc.detail}'", flush=True)
                assert "syntax error" not in http_exc.detail.lower(), "Raw SQL error must not leak!"
                assert "secret" not in http_exc.detail.lower(), "Internal details must not leak!"
                assert http_exc.detail == "Unable to submit your complaint. Please try again."
                print("  [TEST D PASSED] Clean sanitized error message confirmed. No SQL or internal state exposed.", flush=True)

    print("\n============================================================", flush=True)
    print("ALL TESTS (A, B, C, D) PASSED CLEANLY AND DECISIVELY!", flush=True)
    print("============================================================\n", flush=True)


if __name__ == "__main__":
    asyncio.run(run_tests())

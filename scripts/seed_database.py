"""
JanSetu AI - Database Initialization & Demo Seeding Script
Seeds the 8 controlled PMC departments, demo accounts, realistic Pune grievances,
clustered incidents, deterministic SLAs, escalations, and audit trails.
"""

import sys
import os
import asyncio
import json
import uuid
from datetime import datetime, timedelta, timezone

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from app.db.session import engine, Base, AsyncSessionLocal, init_db
from app.models.department import DepartmentModel
from app.models.user import UserModel
from app.models.complaint import ComplaintModel
from app.models.ticket import TicketModel
from app.models.ai_analysis import AIAnalysisModel
from app.models.sla import SLAModel
from app.models.incident import IncidentModel
from app.models.escalation import EscalationModel
from app.models.clarification import ClarificationModel
from app.models.notification import NotificationModel
from app.models.audit_log import AuditLogModel
from app.core.security import get_password_hash
from app.rules.departments import CONTROLLED_DEPARTMENTS
from app.rules.roles import MUNICIPAL_ADMIN, DEPARTMENT_OFFICER, COLLECTOR, CITIZEN
from app.rules.sla_policy import calculate_deadlines
from app.core.time import get_ist_now


from sqlalchemy import select, text

async def seed_data():
    print("[INIT] Initializing database schema...")
    await init_db()

    # Check if already seeded
    already_seeded = False
    async with AsyncSessionLocal() as session:
        existing_depts = await session.execute(select(DepartmentModel))
        if existing_depts.scalars().first():
            already_seeded = True

    if already_seeded:
        print("[INFO] Database already seeded. Preserving existing operational records and verifying demo accounts...")
        from scripts.seed_demo_users import seed_demo_users
        await seed_demo_users()
        return

    async with AsyncSessionLocal() as session:

        print("[DEPTS] Seeding 8 Controlled PMC Departments...")
        for dept_def in CONTROLLED_DEPARTMENTS:
            dept = DepartmentModel(
                id=dept_def["id"],
                name=dept_def["name"],
                description=dept_def["description"],
                contact_email=f"{dept_def['id'].lower()}@pmc.gov.in",
                is_active=True,
            )
            session.add(dept)
        await session.flush()

        print("[USERS] Seeding Official & Demo Accounts...")
        users_data = [
            {
                "email": "admin@jansetu.local",
                "employee_id": "PMC-ADM-001",
                "full_name": "Rajesh Deshmukh (Municipal Commissioner Office)",
                "role": MUNICIPAL_ADMIN,
                "department_id": None,
                "password": "admin123",
            },
            {
                "email": "collector@jansetu.local",
                "employee_id": "IAS-PUN-004",
                "full_name": "Dr. Suhas Diwase (District Collector)",
                "role": COLLECTOR,
                "department_id": None,
                "password": "collector123",
            },
            {
                "email": "water.officer@jansetu.local",
                "employee_id": "PMC-ENG-101",
                "full_name": "Anil Kulkarni (Executive Engineer, Water Supply)",
                "role": DEPARTMENT_OFFICER,
                "department_id": "WATER_SUPPLY",
                "password": "officer123",
            },
            {
                "email": "road.officer@jansetu.local",
                "employee_id": "PMC-ENG-204",
                "full_name": "Suresh Shinde (Superintending Engineer, Road Works)",
                "role": DEPARTMENT_OFFICER,
                "department_id": "ROAD",
                "password": "officer123",
            },
            {
                "email": "electricity.officer@jansetu.local",
                "employee_id": "PMC-ENG-305",
                "full_name": "Mahesh Patil (Chief Electrical Officer)",
                "role": DEPARTMENT_OFFICER,
                "department_id": "ELECTRICITY",
                "password": "officer123",
            },
            {
                "email": "waste.officer@jansetu.local",
                "employee_id": "PMC-SWM-402",
                "full_name": "Sunita Gaikwad (Head, Solid Waste Management)",
                "role": DEPARTMENT_OFFICER,
                "department_id": "WASTE_MANAGEMENT",
                "password": "officer123",
            },
            {
                "email": "health.officer@jansetu.local",
                "employee_id": "PMC-MOH-501",
                "full_name": "Dr. Sanjeev Wavare (Chief Health Officer)",
                "role": DEPARTMENT_OFFICER,
                "department_id": "PUBLIC_HEALTH",
                "password": "officer123",
            },
            {
                "email": "property.officer@jansetu.local",
                "employee_id": "PMC-PPM-601",
                "full_name": "Vikas More (Superintendent, Public Property Management)",
                "role": DEPARTMENT_OFFICER,
                "department_id": "PUBLIC_PROPERTY_MANAGEMENT",
                "password": "officer123",
            },
            {
                "email": "garden.officer@jansetu.local",
                "employee_id": "PMC-GDN-701",
                "full_name": "Ashok Ghorpade (Chief Garden Superintendent)",
                "role": DEPARTMENT_OFFICER,
                "department_id": "GARDEN",
                "password": "officer123",
            },
            {
                "email": "encroachment.officer@jansetu.local",
                "employee_id": "PMC-ENC-801",
                "full_name": "Madhav Jagtap (Deputy Commissioner, Encroachment)",
                "role": DEPARTMENT_OFFICER,
                "department_id": "ENCROACHMENT",
                "password": "officer123",
            },
            {
                "email": "citizen@jansetu.local",
                "employee_id": None,
                "full_name": "Pooja Kadam (Citizen of Pune)",
                "role": CITIZEN,
                "department_id": None,
                "password": "citizen123",
            },
        ]

        officer_map = {}
        admin_user = None
        collector_user = None

        for u_data in users_data:
            user = UserModel(
                email=u_data["email"],
                employee_id=u_data["employee_id"],
                full_name=u_data["full_name"],
                role=u_data["role"],
                department_id=u_data["department_id"],
                password_hash=get_password_hash(u_data["password"]),
                is_active=True,
            )
            session.add(user)
            await session.flush()
            if u_data["role"] == DEPARTMENT_OFFICER:
                officer_map[u_data["department_id"]] = user
            elif u_data["role"] == MUNICIPAL_ADMIN:
                admin_user = user
            elif u_data["role"] == COLLECTOR:
                collector_user = user

        print("[INCIDENTS] Seeding Clustered Incidents...")
        now = get_ist_now()

        inc1 = IncidentModel(
            incident_number="INC-2026-PUN-0001",
            title="Major Water Pipeline Breach - Baner & Balewadi Corridor",
            description="300mm distribution trunk main severed during metro underground excavation near Balewadi Phata.",
            department_id="WATER_SUPPLY",
            severity="P1",
            status="VERIFIED",
            location_name="Baner Road near Balewadi Phata",
            latitude=18.5590,
            longitude=73.7868,
            complaint_count=6,
            first_reported_at=now - timedelta(hours=36),
            last_activity_at=now - timedelta(hours=2),
        )
        session.add(inc1)

        inc2 = IncidentModel(
            incident_number="INC-2026-PUN-0002",
            title="Monsoon Road Depression & Pothole Hazard - Karve Road",
            description="Multiple deep craters formed following storm runoff between Nal Stop and Kothrud Stand.",
            department_id="ROAD",
            severity="P2",
            status="RESOLVING",
            location_name="Karve Road, Kothrud",
            latitude=18.5074,
            longitude=73.8077,
            complaint_count=4,
            first_reported_at=now - timedelta(days=3),
            last_activity_at=now - timedelta(hours=5),
        )
        session.add(inc2)
        await session.flush()

        print("[GRIEVANCES] Seeding Realistic Pune Civic Grievances...")

        sample_grievances = [
            # 1. P0 Emergency: Live Wire
            {
                "raw_text": "EMERGENCY: Live 11kV electrical wire has snapped and is hanging right over the footpath outside Modern College, Shivaji Nagar! Kids and pedestrians are passing by!",
                "dept": "ELECTRICITY",
                "priority": "P0",
                "summary": "Live 11kV exposed power cable hanging over pedestrian footpath",
                "location": "Modern College, Shivaji Nagar",
                "ward": "Ward 7 (Shivaji Nagar)",
                "status": "ASSIGNED",
                "lat": 18.5314, "lng": 73.8446,
                "age_hours": 1,
                "sla_status": "WITHIN_SLA",
                "is_emergency": True,
                "is_escalated": True,
                "escalation_reason": "P0 Emergency Auto-Escalation to Commissioner & Collector",
                "citizen": "Rahul More",
                "citizen_phone": "9822011234",
            },
            # 2. Baner Water Supply Cluster (Tied to INC-2026-PUN-0001)
            {
                "raw_text": "There has been no water supply in our area for three days and nobody is responding. Sector 5 society water tanks are completely empty.",
                "dept": "WATER_SUPPLY",
                "priority": "P1",
                "summary": "Complete municipal water supply disruption for 3 consecutive days",
                "location": "Baner Road near Balewadi Phata",
                "ward": "Ward 9 (Baner-Balewadi)",
                "status": "IN_PROGRESS",
                "lat": 18.5590, "lng": 73.7868,
                "age_hours": 28,
                "sla_status": "AT_RISK",
                "incident_id": inc1.id,
                "citizen": "Priya Joshi",
                "citizen_phone": "9890123456",
            },
            {
                "raw_text": "Zero water pressure in Pan Card Club road societies. Water tankers are charging Rs 3000. Please send PMC water supply emergency tanker immediately.",
                "dept": "WATER_SUPPLY",
                "priority": "P1",
                "summary": "Zero water pressure in residential societies requiring emergency tanker supply",
                "location": "Pan Card Club Road, Baner",
                "ward": "Ward 9 (Baner-Balewadi)",
                "status": "IN_PROGRESS",
                "lat": 18.5620, "lng": 73.7820,
                "age_hours": 20,
                "sla_status": "WITHIN_SLA",
                "incident_id": inc1.id,
                "citizen": "Vikas Agarwal",
                "citizen_phone": "9765432100",
            },
            {
                "raw_text": "Potable water pipeline leakage causing massive drinking water flooding on the road opposite Orchid School Balewadi while residents have dry taps.",
                "dept": "WATER_SUPPLY",
                "priority": "P1",
                "summary": "Main water pipeline burst flooding road while nearby taps remain dry",
                "location": "Opposite Orchid School, Balewadi",
                "ward": "Ward 9 (Baner-Balewadi)",
                "status": "ASSIGNED",
                "lat": 18.5680, "lng": 73.7740,
                "age_hours": 12,
                "sla_status": "WITHIN_SLA",
                "incident_id": inc1.id,
                "citizen": "Sunil Nair",
                "citizen_phone": "9923456789",
            },
            # 3. SLA Breached Water Ticket
            {
                "raw_text": "Contaminated brown sewage smelling water coming from tap since Sunday morning in Shaniwar Peth. We cannot drink this water.",
                "dept": "WATER_SUPPLY",
                "priority": "P1",
                "summary": "Severe tap water contamination with sewage infiltration",
                "location": "Shaniwar Peth near Appa Balwant Chowk",
                "ward": "Ward 14 (Kasba-Shaniwar Peth)",
                "status": "ESCALATED",
                "lat": 18.5186, "lng": 73.8553,
                "age_hours": 38,  # >24h resolution SLA breached!
                "sla_status": "BREACHED",
                "is_escalated": True,
                "escalation_reason": "SLA 24-hour resolution deadline breached",
                "citizen": "Anand Bapat",
                "citizen_phone": "9823055443",
            },
            # 4. Resolved Water Ticket
            {
                "raw_text": "Municipal valve damaged near Kothrud bus depot causing localized low water pressure.",
                "dept": "WATER_SUPPLY",
                "priority": "P2",
                "summary": "Distribution valve malfunction repaired by maintenance team",
                "location": "Kothrud Depot, Paud Road",
                "ward": "Ward 12 (Kothrud)",
                "status": "RESOLVED",
                "lat": 18.5039, "lng": 73.8052,
                "age_hours": 40,
                "sla_status": "RESOLVED",
                "resolution_notes": "Sluice valve replaced by Water Department crew. Normal pressure restored at 06:00 AM.",
                "citizen": "Deepak Kulkarni",
                "citizen_phone": "9881023456",
            },
            # 5. Pothole cluster (Road Dept)
            {
                "raw_text": "Massive 2-feet deep pothole right after Nal Stop Flyover on Karve Road. Two two-wheelers skidded yesterday evening.",
                "dept": "ROAD",
                "priority": "P2",
                "summary": "Dangerous deep pothole hazard following monsoon runoff",
                "location": "Nal Stop Flyover, Karve Road",
                "ward": "Ward 12 (Kothrud)",
                "status": "IN_PROGRESS",
                "lat": 18.5074, "lng": 73.8315,
                "age_hours": 18,
                "sla_status": "WITHIN_SLA",
                "incident_id": inc2.id,
                "citizen": "Sneha Patil",
                "citizen_phone": "9422019876",
            },
            {
                "raw_text": "Craters on Senapati Bapat Road near ICC Trade Tower causing 45 minute bumper-to-bumper traffic jam.",
                "dept": "ROAD",
                "priority": "P2",
                "summary": "Multiple severe asphalt craters causing critical arterial traffic bottleneck",
                "location": "ICC Trade Tower, Senapati Bapat Road",
                "ward": "Ward 7 (Shivaji Nagar)",
                "status": "ASSIGNED",
                "lat": 18.5362, "lng": 73.8299,
                "age_hours": 10,
                "sla_status": "WITHIN_SLA",
                "citizen": "Gaurav Deshpande",
                "citizen_phone": "9823198765",
            },
            # 6. Waste Management: Overflowing Bins
            {
                "raw_text": "Garbage has not been collected from Hadapsar vegetable market container for 4 days. Stray dogs and cows tearing bags, stench unbearable.",
                "dept": "WASTE_MANAGEMENT",
                "priority": "P2",
                "summary": "Community garbage container overflowing for 4 consecutive days",
                "location": "Hadapsar Sabzi Mandi, Pune-Solapur Road",
                "ward": "Ward 19 (Hadapsar)",
                "status": "IN_PROGRESS",
                "lat": 18.5029, "lng": 73.9280,
                "age_hours": 26,
                "sla_status": "WITHIN_SLA",
                "citizen": "Kailash Jagtap",
                "citizen_phone": "9890987654",
            },
            {
                "raw_text": "Illegal open dumping of construction debris and debris on the riverside road near Deccan Gymkhana.",
                "dept": "WASTE_MANAGEMENT",
                "priority": "P2",
                "summary": "Illegal debris and solid waste dumping on riverbed road",
                "location": "Mutha Riverbed Road, Deccan Gymkhana",
                "ward": "Ward 10 (Deccan)",
                "status": "RESOLVED",
                "lat": 18.5167, "lng": 73.8415,
                "age_hours": 50,
                "sla_status": "RESOLVED",
                "resolution_notes": "SWM dumper truck cleared 4 tonnes of debris. Warning signage installed.",
                "citizen": "Nilesh Godbole",
                "citizen_phone": "9822456789",
            },
            # 7. Public Health: Dengue & Stagnant Water
            {
                "raw_text": "Heavy water stagnation in an abandoned construction plot behind Phoenix Market City, Viman Nagar. Severe mosquito breeding, 4 dengue cases reported in building.",
                "dept": "PUBLIC_HEALTH",
                "priority": "P1",
                "summary": "Severe mosquito larvae breeding in stagnant water with reported dengue cases",
                "location": "Behind Phoenix Marketcity, Viman Nagar",
                "ward": "Ward 3 (Viman Nagar-Lohgaon)",
                "status": "IN_PROGRESS",
                "lat": 18.5627, "lng": 73.9168,
                "age_hours": 15,
                "sla_status": "WITHIN_SLA",
                "citizen": "Dr. Rohit Sharma",
                "citizen_phone": "9922033445",
            },
            # 8. Garden Dept: Dangerous Fallen Tree
            {
                "raw_text": "Large banyan tree branch cracked and partially hanging over high-voltage street cables inside Sambhaji Park, JM Road.",
                "dept": "GARDEN",
                "priority": "P2",
                "summary": "Hazardous cracked tree branch hanging over electrical line",
                "location": "Sambhaji Park, JM Road, Shivajinagar",
                "ward": "Ward 7 (Shivaji Nagar)",
                "status": "ASSIGNED",
                "lat": 18.5255, "lng": 73.8485,
                "age_hours": 6,
                "sla_status": "WITHIN_SLA",
                "citizen": "Vinod Sane",
                "citizen_phone": "9822119988",
            },
            # 9. Encroachment Dept: Footpath Blockade
            {
                "raw_text": "Illegal food stalls and commercial displays completely blocking the pedestrian walkway outside Goodluck Cafe, FC Road. Senior citizens forced to walk on road.",
                "dept": "ENCROACHMENT",
                "priority": "P2",
                "summary": "Footpath obstruction by unauthorized commercial vendors",
                "location": "Goodluck Chowk, FC Road, Deccan",
                "ward": "Ward 10 (Deccan)",
                "status": "ASSIGNED",
                "lat": 18.5196, "lng": 73.8413,
                "age_hours": 22,
                "sla_status": "WITHIN_SLA",
                "citizen": "Ananya Chitale",
                "citizen_phone": "9860123450",
            },
            # 10. Public Property Management: Vandalized Bus Stop
            {
                "raw_text": "PMPML bus shelter glass shattered and roof sheet blown off near Swargate ST Stand. Passengers getting drenched in rain.",
                "dept": "PUBLIC_PROPERTY_MANAGEMENT",
                "priority": "P3",
                "summary": "Damaged municipal transit bus shelter roof and panels",
                "location": "Swargate Bus Terminal, Jedhe Chowk",
                "ward": "Ward 16 (Swargate-Parvati)",
                "status": "ASSIGNED",
                "lat": 18.5018, "lng": 73.8586,
                "age_hours": 44,
                "sla_status": "WITHIN_SLA",
                "citizen": "Santosh Gaikwad",
                "citizen_phone": "9822001122",
            },
            # 11. Clarification Required Case: Missing Location
            {
                "raw_text": "Drainage manhole cover is missing on our main road. Anyone can fall inside at night. Please fix urgently.",
                "dept": "ROAD",
                "priority": "P1",
                "summary": "Uncovered drainage manhole pose severe nighttime hazard",
                "location": None,  # Intentionally missing location to demonstrate clarification!
                "ward": "Ward 11 (Aundh)",
                "status": "NEEDS_CLARIFICATION",
                "lat": 18.5580, "lng": 73.8073,
                "age_hours": 4,
                "sla_status": "PAUSED",
                "citizen": "Ramesh Shinde",
                "citizen_phone": "9422003344",
                "clarification_question": "Which specific street or landmark is this uncovered manhole located near?",
            },
        ]

        # Add more records to reach ~35 grievances across Pune
        pune_localities = [
            ("Aundh near D-Mart", 18.5626, 73.8087, "WATER_SUPPLY", "P2", "Low municipal water pressure during morning hours"),
            ("Kalyani Nagar Jogger's Park", 18.5492, 73.9038, "GARDEN", "P3", "Sprinkler system broken leading to dry lawn"),
            ("Magarpatta City Gate 1", 18.5144, 73.9298, "ROAD", "P2", "Damaged speed breaker without reflective paint"),
            ("Katraj Snake Park Junction", 18.4552, 73.8672, "ELECTRICITY", "P2", "Street lights non-functional along 500m stretch"),
            ("Camp, MG Road", 18.5158, 73.8785, "ENCROACHMENT", "P2", "Unauthorized merchandise hawkers on covered walkway"),
            ("Bavdhan near Chandani Chowk", 18.5089, 73.7749, "ROAD", "P1", "Mud slide on arterial connecting slope after heavy rain"),
            ("Koregaon Park Lane 7", 18.5398, 73.8967, "WASTE_MANAGEMENT", "P2", "Dry leaves and garden waste dumped on road corner"),
            ("Kondhwa Khurd near NIBM", 18.4772, 73.8951, "PUBLIC_HEALTH", "P1", "Garbage water pooling near municipal school entrance"),
            ("Yerwada near Jail Road", 18.5529, 73.8828, "WATER_SUPPLY", "P2", "Intermittent muddy water supply for 2 days"),
            ("Pashan Lake Road", 18.5376, 73.7928, "PUBLIC_PROPERTY_MANAGEMENT", "P3", "Damaged jogging track railings along lake perimeter"),
            ("Sinhagad Road near Anand Nagar", 18.4789, 73.8211, "ROAD", "P2", "Uneven road surface after water pipe trenching"),
            ("Wakad Bridge Pune border", 18.5987, 73.7681, "ELECTRICITY", "P1", "Transformer sparking during high load hours"),
            ("Dhayari Phata", 18.4489, 73.8156, "WASTE_MANAGEMENT", "P2", "Irregular door-to-door waste collection for a week"),
            ("Bibwewadi near Lake Town", 18.4691, 73.8612, "PUBLIC_HEALTH", "P2", "Pest control and anti-larval spray requested for colony"),
            ("Model Colony, Shivajinagar", 18.5332, 73.8356, "GARDEN", "P2", "Overgrown branches blocking street illumination"),
            ("Kasba Peth historical precinct", 18.5195, 73.8569, "PUBLIC_PROPERTY_MANAGEMENT", "P3", "Heritage plaque disfigured and needs restoration"),
            ("Bhekrai Nagar, Phursungi", 18.4823, 73.9621, "WATER_SUPPLY", "P1", "Pipeline valve burst causing dry taps for 48 hours"),
            ("Wadgaon Sheri", 18.5512, 73.9245, "ROAD", "P2", "Water accumulation due to blocked roadside stormwater chamber"),
            ("Warje Malwadi", 18.4812, 73.7989, "ELECTRICITY", "P2", "Underground cable fault causing frequent power tripping"),
            ("Salunke Vihar Road, Wanowrie", 18.4862, 73.8988, "ENCROACHMENT", "P2", "Illegal tea stall occupying vehicular parking space"),
        ]

        for i, (loc, lat, lng, dept, prio, summary) in enumerate(pune_localities):
            sample_grievances.append({
                "raw_text": f"Grievance regarding {summary.lower()} at {loc}. Citizens facing daily hardship.",
                "dept": dept,
                "priority": prio,
                "summary": summary,
                "location": loc,
                "ward": f"Ward {(i % 15) + 1}",
                "status": "RESOLVED" if (i % 4 == 0) else ("IN_PROGRESS" if (i % 2 == 0) else "ASSIGNED"),
                "lat": lat, "lng": lng,
                "age_hours": (i + 1) * 3,
                "sla_status": "RESOLVED" if (i % 4 == 0) else ("AT_RISK" if (i % 5 == 0) else "WITHIN_SLA"),
                "citizen": f"Citizen {i+1}",
                "citizen_phone": f"98220{10000+i}",
            })

        for idx, g in enumerate(sample_grievances):
            created_time = now - timedelta(hours=g["age_hours"])
            tracking_num = f"JS-2026-PUN-{101 + idx:05d}"

            complaint = ComplaintModel(
                tracking_number=tracking_num,
                citizen_name=g.get("citizen", "Pune Resident"),
                citizen_phone=g.get("citizen_phone", "9822000000"),
                preferred_language="en",
                raw_text=g["raw_text"],
                input_channel="WEB",
                status=g["status"],
                created_at=created_time,
                updated_at=created_time + timedelta(hours=1),
            )
            session.add(complaint)
            await session.flush()

            ticket = TicketModel(
                complaint_id=complaint.id,
                department_id=g["dept"],
                assigned_officer_id=str(officer_map[g["dept"]].id) if g["dept"] in officer_map else None,
                incident_id=g.get("incident_id"),
                status=g["status"],
                priority=g["priority"],
                severity=g["priority"],
                urgency=g["priority"],
                sentiment_score=-0.7 if g["priority"] in ["P0", "P1"] else -0.3,
                issue_summary=g["summary"],
                category=g["dept"].lower(),
                location_name=g["location"],
                ward=g.get("ward", "Pune Central"),
                latitude=g.get("lat"),
                longitude=g.get("lng"),
                is_emergency=g.get("is_emergency", False),
                is_escalated=g.get("is_escalated", False),
                escalation_reason=g.get("escalation_reason"),
                resolution_notes=g.get("resolution_notes"),
                resolved_at=(created_time + timedelta(hours=g["age_hours"] - 2)) if g["status"] == "RESOLVED" else None,
                created_at=created_time,
                updated_at=created_time + timedelta(hours=2),
            )
            session.add(ticket)
            await session.flush()

            analysis = AIAnalysisModel(
                complaint_id=complaint.id,
                ticket_id=ticket.id,
                detected_language="en",
                extracted_issue=g["summary"],
                extracted_location=g["location"],
                extracted_duration="3 days" if "days" in g["raw_text"] else None,
                recommended_department=g["dept"],
                recommended_priority=g["priority"],
                recommended_actions=json.dumps([
                    "Dispatch field maintenance inspection unit",
                    "Notify Ward Assistant Commissioner",
                    "Verify citizen contact for updates"
                ]),
                actionability_score=0.5 if not g["location"] else 1.0,
                missing_fields=json.dumps(["location"] if not g["location"] else []),
                clarification_questions=json.dumps([g["clarification_question"]] if g.get("clarification_question") else []),
                confidence_score=0.95,
                confidence_level="HIGH",
                field_certainties=json.dumps({"issue": 0.98, "department": 0.95, "priority": 0.92}),
                citizen_response_draft=f"Dear Resident, your grievance regarding {g['summary']} has been registered under ticket {tracking_num} and assigned to {g['dept']}.",
                explanation=f"Identified as {g['priority']} based on safety/disruption indicators. Routed to {g['dept']}.",
                created_at=created_time,
            )
            session.add(analysis)

            # SLA Record
            resp_dl, res_dl = calculate_deadlines(g["priority"], start_time=created_time)
            sla = SLAModel(
                ticket_id=ticket.id,
                priority=g["priority"],
                response_deadline=resp_dl,
                resolution_deadline=res_dl,
                status=g.get("sla_status", "WITHIN_SLA"),
                is_paused=(g["status"] == "NEEDS_CLARIFICATION"),
                paused_at=created_time if g["status"] == "NEEDS_CLARIFICATION" else None,
                resolved_at=ticket.resolved_at,
                created_at=created_time,
            )
            session.add(sla)

            # Clarification question if applicable
            if g.get("clarification_question"):
                clarif = ClarificationModel(
                    complaint_id=complaint.id,
                    ticket_id=ticket.id,
                    sender_type="AI",
                    question=g["clarification_question"],
                    requested_field="location",
                    created_at=created_time,
                )
                session.add(clarif)

            # Escalation record if applicable
            if g.get("is_escalated"):
                esc = EscalationModel(
                    ticket_id=ticket.id,
                    escalated_by_id=str(admin_user.id) if admin_user else None,
                    escalated_to_role=COLLECTOR if g["priority"] in ["P0", "P1"] else MUNICIPAL_ADMIN,
                    reason=g.get("escalation_reason", "Urgent escalation"),
                    status="PENDING",
                    created_at=created_time + timedelta(hours=1),
                )
                session.add(esc)

            # Initial Audit Log
            audit = AuditLogModel(
                entity_name="ticket",
                entity_id=str(ticket.id),
                action="CREATED",
                actor_type="AI",
                new_state=json.dumps({"status": g["status"], "priority": g["priority"], "department": g["dept"]}),
                created_at=created_time,
            )
            session.add(audit)

        # Seed in-app notifications
        print("[NOTIFS] Seeding In-App Notifications...")
        notifications_data = [
            {
                "role": MUNICIPAL_ADMIN,
                "title": "[ALERT] P0 Emergency Alert: Live Electrical Hazard",
                "message": "Live 11kV cable reported hanging at Modern College, Shivaji Nagar. Immediate dispatch required.",
                "type": "EMERGENCY",
            },
            {
                "role": MUNICIPAL_ADMIN,
                "title": "[INCIDENT] Systemic Incident Detected: Baner Water Main",
                "message": "Incident INC-2026-PUN-0001 formed with 6 clustered water complaints near Balewadi Phata.",
                "type": "INCIDENT",
            },
            {
                "role": DEPARTMENT_OFFICER,
                "department_id": "WATER_SUPPLY",
                "title": "[SLA] SLA Breach Warning: Shaniwar Peth",
                "message": "Ticket JS-2026-PUN-00105 has exceeded the 24-hour P1 resolution deadline.",
                "type": "SLA_BREACH",
            },
            {
                "role": COLLECTOR,
                "title": "[ESCALATION] Collector Escalation: Critical Water Disruption",
                "message": "Multiple ward escalations recorded for Baner-Balewadi pipeline rupture.",
                "type": "ESCALATION",
            },
        ]
        for n in notifications_data:
            notif = NotificationModel(
                role=n.get("role"),
                department_id=n.get("department_id"),
                title=n["title"],
                message=n["message"],
                notification_type=n["type"],
                created_at=now - timedelta(hours=2),
            )
            session.add(notif)

        await session.commit()

        if "postgres" in engine.dialect.name:
            from sqlalchemy import text
            await session.execute(text("CREATE SEQUENCE IF NOT EXISTS complaint_tracking_seq START WITH 101;"))
            await session.execute(text("""
                SELECT setval('complaint_tracking_seq', (
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
                ), true);
            """))
            await session.commit()

        print("[SUCCESS] Successfully seeded JanSetu AI with 8 departments, demo accounts, and 31 realistic Pune grievances!")

    # Ensure demo accounts and standard badge definitions are seeded
    from scripts.seed_demo_users import seed_demo_users
    await seed_demo_users()

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed_data())

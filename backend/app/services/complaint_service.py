"""
JanSetu AI - Complaint Lifecycle Service
Handles submission, AI extraction, clarification, and deterministic ticket creation.
"""

import json
import logging
import random
import re
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func, text

logger = logging.getLogger(__name__)

from app.models.complaint import ComplaintModel
from app.models.ticket import TicketModel
from app.models.ai_analysis import AIAnalysisModel
from app.models.sla import SLAModel
from app.models.clarification import ClarificationModel
from app.models.audit_log import AuditLogModel
from app.models.complaint_update import ComplaintUpdateModel
from app.models.complaint_draft import ComplaintDraftModel
from app.models.user import UserModel
from app.models.assignment import AssignmentModel
from app.schemas.complaint import ComplaintCreate

from app.core.time import get_ist_now, format_ist_iso, to_ist_naive
from app.ai.pipeline.orchestrator import orchestrator
from app.rules.sla_policy import calculate_deadlines, evaluate_sla_status
from app.rules.escalation_rules import check_auto_escalation
from app.services.contribution_service import contribution_service
from app.rules.mandatory_validation import (
    validate_complaint_submission,
    MandatoryValidationException,
)


class ComplaintService:
    async def _generate_next_tracking_number(
        self,
        db: AsyncSession,
        year: int = 2026,
        city_code: str = "PUN",
    ) -> str:
        """
        Atomically generates a unique, sequential tracking number (e.g., 'JS-2026-PUN-00180').
        Uses PostgreSQL native SEQUENCE ('complaint_tracking_seq') for atomic, concurrency-safe
        generation, with fallback synchronization against existing complaint records.
        """
        dialect_name = ""
        try:
            if hasattr(db, "bind") and db.bind:
                dialect_name = db.bind.dialect.name
            elif hasattr(db, "get_bind"):
                bind = db.get_bind()
                if bind:
                    dialect_name = bind.dialect.name
        except Exception:
            pass

        next_val = None

        if "postgres" in dialect_name:
            try:
                res = await db.execute(text("SELECT nextval('complaint_tracking_seq');"))
                next_val = res.scalar()
            except Exception as seq_err:
                logger.warning(f"complaint_tracking_seq nextval failed, ensuring sequence exists: {seq_err}")
                await db.execute(text("CREATE SEQUENCE IF NOT EXISTS complaint_tracking_seq START WITH 101;"))
                await db.execute(text("""
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
                res = await db.execute(text("SELECT nextval('complaint_tracking_seq');"))
                next_val = res.scalar()
        else:
            # SQLite / Test / other dialect fallback
            await db.execute(text("CREATE TABLE IF NOT EXISTS complaint_tracking_counter (id INTEGER PRIMARY KEY, last_val INTEGER);"))
            res = await db.execute(text("SELECT last_val FROM complaint_tracking_counter WHERE id = 1;"))
            row = res.fetchone()
            if row is None:
                comp_res = await db.execute(select(ComplaintModel.tracking_number))
                all_t = [r[0] for r in comp_res.fetchall()]
                max_val = 100
                for t in all_t:
                    parts = str(t).split("-")
                    if len(parts) >= 4 and parts[-1].isdigit():
                        max_val = max(max_val, int(parts[-1]))
                await db.execute(text(f"INSERT OR REPLACE INTO complaint_tracking_counter (id, last_val) VALUES (1, {max_val});"))
            
            await db.execute(text("UPDATE complaint_tracking_counter SET last_val = last_val + 1 WHERE id = 1;"))
            res = await db.execute(text("SELECT last_val FROM complaint_tracking_counter WHERE id = 1;"))
            next_val = res.scalar()

        if next_val is None:
            comp_res = await db.execute(select(ComplaintModel.tracking_number))
            all_t = [r[0] for r in comp_res.fetchall()]
            max_val = 100
            for t in all_t:
                parts = str(t).split("-")
                if len(parts) >= 4 and parts[-1].isdigit():
                    max_val = max(max_val, int(parts[-1]))
            next_val = max_val + 1

        # Defense-in-depth: Ensure candidate does not collide with any existing record
        while True:
            candidate = f"JS-{year}-{city_code}-{next_val:05d}"
            existing = await db.execute(select(ComplaintModel.id).where(ComplaintModel.tracking_number == candidate))
            if not existing.scalar_one_or_none():
                return candidate
            logger.warning(f"Candidate tracking number {candidate} already exists, advancing sequence...")
            if "postgres" in dialect_name:
                res = await db.execute(text("SELECT nextval('complaint_tracking_seq');"))
                next_val = res.scalar()
            else:
                await db.execute(text("UPDATE complaint_tracking_counter SET last_val = last_val + 1 WHERE id = 1;"))
                res = await db.execute(text("SELECT last_val FROM complaint_tracking_counter WHERE id = 1;"))
                next_val = res.scalar()

    async def create_complaint(self, data: ComplaintCreate, db: AsyncSession, citizen_id: Optional[str] = None) -> Dict[str, Any]:
        """Processes intake, runs AI extraction, and creates deterministic service ticket."""
        # 1. Generate unique human-readable tracking number atomically
        tracking_number = await self._generate_next_tracking_number(db)

        # 2. Run AI Analysis
        ai_res = await orchestrator.analyze_complaint(data.raw_text, data.preferred_language)

        # Allow citizen-provided location override
        resolved_input_loc = data.location_address or data.location_name or data.location_text
        final_location = resolved_input_loc or ai_res.get("extracted_location")
        if resolved_input_loc:
            ai_res["extracted_location"] = resolved_input_loc
            ai_res["missing_fields"] = [f for f in ai_res.get("missing_fields", []) if f != "location"]
            ai_res["actionability"] = "HIGH"

        priority = ai_res["priority"]
        dept_id = ai_res["department"]
        is_emergency = (priority == "P0")

        # 2.5 Strict Mandatory Field Validation
        val_res = validate_complaint_submission(
            data={
                "raw_text": data.raw_text,
                "location_name": final_location,
                "complaint_type": ai_res.get("summary") or ai_res.get("complaint_type"),
            },
            department=dept_id,
            is_emergency=is_emergency,
        )

        if not val_res["can_submit"] and not is_emergency:
            raise MandatoryValidationException(
                invalid_fields=val_res["invalid_fields"],
                message="Please complete all mandatory information before submitting your complaint.",
            )

        # 3. Determine Initial Ticket Status
        if is_emergency:
            initial_status = "ASSIGNED"  # P0 emergency bypass: route immediately
        elif not val_res["can_submit"]:
            initial_status = "NEEDS_CLARIFICATION"
        else:
            initial_status = "ASSIGNED"

        # Explicitly anchor complaint creation to Indian Standard Time (IST)
        submitted_time = to_ist_naive(getattr(data, "client_timestamp", None)) or get_ist_now()
        loc_str = resolved_input_loc

        try:
            # 4. Save Complaint
            complaint = ComplaintModel(
                tracking_number=tracking_number,
                citizen_id=citizen_id,
                citizen_name=data.citizen_name,
                citizen_phone=data.citizen_phone,
                citizen_email=data.citizen_email,
                preferred_language=data.preferred_language,
                raw_text=data.raw_text,
                input_channel=data.input_channel,
                location_text=loc_str,
                latitude=data.latitude,
                longitude=data.longitude,
                audio_url=data.audio_url,
                image_url=data.image_url,
                status=initial_status,
                created_at=submitted_time,
                updated_at=submitted_time,
            )
            db.add(complaint)
            await db.flush()

            # Record initial citizen timeline update
            update_log = ComplaintUpdateModel(
                complaint_id=complaint.id,
                actor_id=citizen_id,
                actor_role="CITIZEN" if citizen_id else "PUBLIC",
                status=initial_status,
                message=f"Grievance recorded with tracking ID {tracking_number} and routed to {dept_id}.",
                internal_note=None,
                created_at=submitted_time,
            )
            db.add(update_log)

            # Award Civic Credits if citizen is authenticated (+10 for valid complaint)
            if citizen_id:
                await contribution_service.award_credits(
                    user_id=citizen_id,
                    event_type="VALID_COMPLAINT",
                    credits=10,
                    reference_id=str(complaint.id),
                    description=f"Civic grievance registered: {tracking_number}",
                    db=db,
                )

            # 5. Save Ticket
            ticket = TicketModel(
                complaint_id=complaint.id,
                department_id=dept_id,
                status=initial_status,
                priority=priority,
                severity=ai_res.get("severity", priority),
                urgency=ai_res.get("urgency", priority),
                sentiment_score=ai_res.get("sentiment_score", 0.0),
                issue_summary=ai_res.get("summary", "Civic Grievance"),
                category=ai_res.get("complaint_type", "general"),
                location_name=final_location,
                ward="Ward 12 (Pune West)",
                latitude=data.latitude,
                longitude=data.longitude,
                is_emergency=is_emergency,
                is_escalated=is_emergency,
                escalation_reason="P0 Emergency Auto-Escalation" if is_emergency else None,
                created_at=submitted_time,
                updated_at=submitted_time,
            )
            db.add(ticket)
            await db.flush()

            # 6. Save AI Analysis
            analysis = AIAnalysisModel(
                complaint_id=complaint.id,
                ticket_id=ticket.id,
                detected_language=ai_res.get("detected_language", data.preferred_language),
                extracted_issue=ai_res.get("summary", ""),
                extracted_location=final_location,
                extracted_duration=ai_res.get("extracted_duration"),
                recommended_department=dept_id,
                recommended_priority=priority,
                recommended_actions=json.dumps(ai_res.get("recommended_actions", [])),
                actionability_score=1.0 if not ai_res.get("missing_fields") else 0.5,
                missing_fields=json.dumps(ai_res.get("missing_fields", [])),
                clarification_questions=json.dumps(ai_res.get("clarification_questions", [])),
                confidence_score=ai_res.get("confidence", 0.9),
                confidence_level=ai_res.get("confidence_level", "HIGH"),
                field_certainties=json.dumps(ai_res.get("field_certainties", {})),
                citizen_response_draft=ai_res.get("citizen_response", ""),
                explanation=f"{ai_res.get('priority_reason', '')} | {ai_res.get('department_reason', '')}",
                raw_model_response=json.dumps(ai_res),
                created_at=submitted_time,
            )
            db.add(analysis)

            # 7. Create SLA Record
            resp_dl, res_dl = calculate_deadlines(priority, start_time=submitted_time)
            sla = SLAModel(
                ticket_id=ticket.id,
                priority=priority,
                response_deadline=resp_dl,
                resolution_deadline=res_dl,
                status="PAUSED" if initial_status == "NEEDS_CLARIFICATION" else "WITHIN_SLA",
                is_paused=(initial_status == "NEEDS_CLARIFICATION"),
                paused_at=submitted_time if initial_status == "NEEDS_CLARIFICATION" else None,
                created_at=submitted_time,
                updated_at=submitted_time,
            )
            db.add(sla)

            # 8. Create Clarification Request if needed
            unresolved = val_res.get("first_unresolved")
            if (initial_status == "NEEDS_CLARIFICATION" or (is_emergency and not val_res["can_submit"])) and unresolved:
                clarif = ClarificationModel(
                    complaint_id=complaint.id,
                    ticket_id=ticket.id,
                    sender_type="AI",
                    question=unresolved.get("question") or (ai_res.get("clarification_questions", [""])[0] if ai_res.get("clarification_questions") else "Please provide the exact location."),
                    requested_field=unresolved.get("field", "location"),
                )
                db.add(clarif)
            elif initial_status == "NEEDS_CLARIFICATION" and ai_res.get("clarification_questions"):
                clarif = ClarificationModel(
                    complaint_id=complaint.id,
                    ticket_id=ticket.id,
                    sender_type="AI",
                    question=ai_res["clarification_questions"][0],
                    requested_field="location",
                )
                db.add(clarif)

            # 9. Audit Log
            audit = AuditLogModel(
                entity_name="complaint",
                entity_id=str(complaint.id),
                action="CREATED",
                actor_type="CITIZEN",
                new_state=json.dumps({"status": initial_status, "priority": priority, "department": dept_id}),
            )
            db.add(audit)
            await db.commit()
        except Exception:
            await db.rollback()
            raise

        return {
            "id": str(complaint.id),
            "tracking_number": tracking_number,
            "status": initial_status,
            "ticket_id": str(ticket.id),
            "ai_preview": ai_res,
        }

    async def _format_complaint_dict(self, complaint: ComplaintModel, db: AsyncSession) -> Dict[str, Any]:
        """Formats a ComplaintModel instance into the complete public tracking payload."""
        # Fetch associated ticket
        t_res = await db.execute(select(TicketModel).where(TicketModel.complaint_id == complaint.id))
        ticket = t_res.scalars().first()

        # Fetch AI analysis
        ai_res = await db.execute(select(AIAnalysisModel).where(AIAnalysisModel.complaint_id == complaint.id))
        analysis = ai_res.scalars().first()

        # Fetch SLA
        sla_data = None
        if ticket:
            s_res = await db.execute(select(SLAModel).where(SLAModel.ticket_id == ticket.id))
            sla = s_res.scalars().first()
            if sla:
                current_sla_status = evaluate_sla_status(
                    sla.priority,
                    sla.created_at,
                    sla.resolved_at,
                    sla.is_paused
                )
                sla_data = {
                    "priority": sla.priority,
                    "response_deadline": format_ist_iso(sla.response_deadline),
                    "resolution_deadline": format_ist_iso(sla.resolution_deadline),
                    "status": current_sla_status,
                    "is_paused": sla.is_paused,
                }

        # Fetch clarification questions
        c_res = await db.execute(
            select(ClarificationModel).where(ClarificationModel.complaint_id == complaint.id).order_by(ClarificationModel.created_at.desc())
        )
        clarifications = c_res.scalars().all()

        clarif_list = [
            {
                "id": str(c.id),
                "sender_type": c.sender_type,
                "question": c.question,
                "answer": c.answer,
                "answered_at": format_ist_iso(c.answered_at) if c.answered_at else None,
            }
            for c in clarifications
        ]

        # Construct public timeline
        timeline = [
            {"status": "NEW", "timestamp": format_ist_iso(complaint.created_at), "title": "Grievance Submitted", "description": "Received via citizen portal."}
        ]
        if analysis:
            timeline.append({"status": "AI_ANALYZED", "timestamp": format_ist_iso(analysis.created_at), "title": "AI Triaged & Classified", "description": f"Routed to {ticket.department_id if ticket else 'department'}."})
        if ticket and ticket.status == "NEEDS_CLARIFICATION":
            timeline.append({"status": "NEEDS_CLARIFICATION", "timestamp": format_ist_iso(complaint.updated_at or complaint.created_at), "title": "Clarification Requested", "description": "Additional location details requested from citizen."})
        if ticket and ticket.status in ["ASSIGNED", "IN_PROGRESS", "RESOLVED"]:
            timeline.append({"status": "ASSIGNED", "timestamp": format_ist_iso(ticket.created_at), "title": "Dispatched to Department", "description": "Department field crew notified."})
        # Determine effective status (coordinate ticket and complaint state)
        is_resolved = (
            (ticket and (ticket.status == "RESOLVED" or ticket.resolved_at is not None))
            or complaint.status == "RESOLVED"
            or bool(ticket and ticket.resolution_notes and len(ticket.resolution_notes.strip()) > 0)
        )
        effective_status = "RESOLVED" if is_resolved else (ticket.status if ticket else complaint.status)

        if ticket and ticket.status in ["IN_PROGRESS", "RESOLVED"]:
            timeline.append({"status": "IN_PROGRESS", "timestamp": format_ist_iso(ticket.updated_at or ticket.created_at), "title": "Work In Progress", "description": "Official maintenance activity underway."})
        if is_resolved:
            resolved_timestamp = (
                ticket.resolved_at if (ticket and ticket.resolved_at)
                else (complaint.updated_at if complaint.updated_at else complaint.created_at)
            )
            timeline.append({
                "status": "RESOLVED",
                "timestamp": format_ist_iso(resolved_timestamp),
                "title": "Grievance Resolved",
                "description": (ticket.resolution_notes if ticket and ticket.resolution_notes else "Official resolution completed. Service restored.")
            })

        if is_resolved and sla_data:
            sla_data["status"] = "RESOLVED"

        resolved_note = (
            ticket.resolution_notes.strip()
            if (ticket and ticket.resolution_notes and ticket.resolution_notes.strip())
            else ("Official resolution completed. Field team maintenance verified." if is_resolved else None)
        )

        # Compute privacy-safe assigned municipal personnel for citizen view
        assigned_personnel = None

        if ticket and ticket.assigned_officer_id:
            user_res = await db.execute(select(UserModel).where(UserModel.id == ticket.assigned_officer_id))
            officer_user = user_res.scalars().first()
            if officer_user:
                assign_res = await db.execute(
                    select(AssignmentModel)
                    .where(AssignmentModel.ticket_id == ticket.id)
                    .order_by(AssignmentModel.created_at.desc())
                )
                active_assign = assign_res.scalars().first()

                work_status = "Assigned"
                if active_assign and active_assign.assignment_status == "IN_PROGRESS":
                    work_status = "Work in Progress"
                elif active_assign and active_assign.assignment_status == "RESOLVED":
                    work_status = "Resolved"
                elif effective_status == "IN_PROGRESS":
                    work_status = "Work in Progress"
                elif is_resolved:
                    work_status = "Resolved"

                assigned_dt = active_assign.assigned_at if (active_assign and active_assign.assigned_at) else (active_assign.created_at if active_assign else ticket.created_at)
                dept_name = ticket.department_id.replace("_", " ").title() + " Department" if ticket.department_id else "Municipal Department"

                assigned_personnel = {
                    "name": officer_user.full_name,
                    "designation": officer_user.designation or "Field Maintenance Officer",
                    "department": dept_name,
                    "official_contact": officer_user.phone or "+91 020 2550 1000",
                    "assigned_date": format_ist_iso(assigned_dt),
                    "work_status": work_status,
                }

        return {
            "id": str(complaint.id),
            "tracking_number": complaint.tracking_number,
            "raw_text": complaint.raw_text,
            "citizen_name": complaint.citizen_name,
            "citizen_phone": complaint.citizen_phone,
            "status": effective_status,
            "created_at": format_ist_iso(complaint.created_at),
            "updated_at": format_ist_iso(complaint.updated_at or complaint.created_at),
            "resolved_at": format_ist_iso(ticket.resolved_at) if (ticket and ticket.resolved_at) else (format_ist_iso(complaint.updated_at or complaint.created_at) if is_resolved else None),
            "department_id": ticket.department_id if ticket else "OTHER_HUMAN_REVIEW",
            "priority": ticket.priority if ticket else "P2",
            "issue_summary": ticket.issue_summary if ticket else "Civic Complaint",
            "location_name": ticket.location_name if (ticket and ticket.location_name) else getattr(complaint, "location_text", None),
            "location_text": ticket.location_name if (ticket and ticket.location_name) else getattr(complaint, "location_text", None),
            "location_address": ticket.location_name if (ticket and ticket.location_name) else getattr(complaint, "location_text", None),
            "latitude": ticket.latitude if (ticket and ticket.latitude is not None) else getattr(complaint, "latitude", None),
            "longitude": ticket.longitude if (ticket and ticket.longitude is not None) else getattr(complaint, "longitude", None),
            "resolution_notes": resolved_note,
            "sla": sla_data,
            "clarifications": clarif_list,
            "timeline": timeline,
            "assigned_personnel": assigned_personnel,
            "ai_analysis": {
                "extracted_issue": analysis.extracted_issue if analysis else "",
                "confidence_score": analysis.confidence_score if analysis else 0.9,
                "confidence_level": analysis.confidence_level if analysis else "HIGH",
                "recommended_actions": json.loads(analysis.recommended_actions) if analysis else [],
                "citizen_response_draft": analysis.citizen_response_draft if analysis else "",
                "explanation": analysis.explanation if analysis else "",
            } if analysis else None,
        }


    async def get_by_tracking_or_id(self, identifier: str, db: AsyncSession) -> Optional[Dict[str, Any]]:
        """Retrieves full complaint details for public tracking with case-insensitive matching."""
        ident = identifier.strip()
        query = select(ComplaintModel).where(
            or_(
                func.lower(ComplaintModel.tracking_number) == ident.lower(),
                func.lower(ComplaintModel.id) == ident.lower()
            )
        )
        res = await db.execute(query)
        complaint = res.scalars().first()
        if not complaint:
            return None

        return await self._format_complaint_dict(complaint, db)

    async def search_by_contact(
        self, phone: str, name: Optional[str], db: AsyncSession
    ) -> List[Dict[str, Any]]:
        """Retrieves all matching complaints by citizen registered phone number and name."""
        clean_phone = re.sub(r"\D", "", phone or "")
        phone_suffix = clean_phone[-10:] if len(clean_phone) >= 10 else clean_phone
        clean_name = " ".join((name or "").strip().lower().split())

        if not phone_suffix:
            return []

        stmt = select(ComplaintModel).order_by(ComplaintModel.created_at.desc())
        res = await db.execute(stmt)
        complaints = res.scalars().all()

        matching = []
        for comp in complaints:
            if not comp.citizen_phone:
                continue
            comp_phone = re.sub(r"\D", "", comp.citizen_phone)
            comp_phone_suffix = comp_phone[-10:] if len(comp_phone) >= 10 else comp_phone

            if comp_phone_suffix != phone_suffix:
                continue

            comp_name = " ".join((comp.citizen_name or "").strip().lower().split())
            name_matches = False
            if not clean_name:
                name_matches = True
            elif clean_name == comp_name:
                name_matches = True
            elif clean_name in comp_name or comp_name in clean_name:
                name_matches = True
            else:
                c_tokens = set(comp_name.split())
                s_tokens = set(clean_name.split())
                if c_tokens and s_tokens and (c_tokens.intersection(s_tokens)):
                    name_matches = True

            if name_matches:
                matching.append(comp)

        results = []
        for comp in matching:
            details = await self._format_complaint_dict(comp, db)
            if details:
                results.append(details)
        return results

    async def submit_clarification(self, identifier: str, answer: str, field: str, db: AsyncSession) -> Dict[str, Any]:
        """Receives citizen clarification, updates ticket location, resumes SLA, and transitions status."""
        query = select(ComplaintModel).where(
            or_(
                ComplaintModel.tracking_number == identifier.strip(),
                ComplaintModel.id == identifier.strip()
            )
        )
        res = await db.execute(query)
        complaint = res.scalars().first()
        if not complaint:
            raise ValueError("Complaint not found")

        # Update latest clarification record
        c_query = select(ClarificationModel).where(
            ClarificationModel.complaint_id == complaint.id,
            ClarificationModel.answer.is_(None)
        ).order_by(ClarificationModel.created_at.desc())
        c_res = await db.execute(c_query)
        clarif = c_res.scalars().first()
        now_ist = get_ist_now()
        if clarif:
            clarif.answer = answer.strip()
            clarif.answered_at = now_ist

        # Update Ticket
        t_res = await db.execute(select(TicketModel).where(TicketModel.complaint_id == complaint.id))
        ticket = t_res.scalars().first()
        if ticket:
            ticket.location_name = answer.strip()
            ticket.status = "ASSIGNED"
            ticket.updated_at = now_ist

            # Resume SLA
            s_res = await db.execute(select(SLAModel).where(SLAModel.ticket_id == ticket.id))
            sla = s_res.scalars().first()
            if sla and sla.is_paused:
                sla.is_paused = False
                sla.status = "WITHIN_SLA"
                sla.updated_at = now_ist

        complaint.status = "ASSIGNED"
        complaint.updated_at = now_ist

        # Award credits for clarification provided
        if complaint.citizen_id:
            await contribution_service.award_credits(
                user_id=complaint.citizen_id,
                event_type="CLARIFICATION_PROVIDED",
                credits=5,
                reference_id=f"{complaint.id}_clarify_{field}",
                description=f"Clarification provided for {complaint.tracking_number}",
                db=db,
            )

        update_log = ComplaintUpdateModel(
            complaint_id=complaint.id,
            actor_id=complaint.citizen_id,
            actor_role="CITIZEN",
            status="ASSIGNED",
            message=f"Citizen provided clarification for {field}: '{answer}'. SLA resumed.",
            internal_note=None,
            created_at=now_ist,
        )
        db.add(update_log)

        # Audit
        audit = AuditLogModel(
            entity_name="complaint",
            entity_id=str(complaint.id),
            action="CLARIFIED",
            actor_type="CITIZEN",
            new_state=json.dumps({"location": answer.strip(), "status": "ASSIGNED"}),
        )
        db.add(audit)
        await db.commit()

        return {"status": "ok", "message": "Clarification processed successfully", "new_status": "ASSIGNED"}

    async def get_my_complaints(self, citizen_id: str, db: AsyncSession) -> List[Dict[str, Any]]:
        """Retrieves all complaints belonging strictly to the authenticated citizen."""
        stmt = (
            select(ComplaintModel)
            .where(ComplaintModel.citizen_id == citizen_id)
            .order_by(ComplaintModel.created_at.desc())
        )
        res = await db.execute(stmt)
        complaints = res.scalars().all()
        results = []
        for comp in complaints:
            details = await self._format_complaint_dict(comp, db)
            if details:
                results.append(details)
        return results

    async def save_draft(
        self,
        complaint_data: Dict[str, Any],
        session_id: Optional[str],
        user_id: Optional[str],
        db: AsyncSession,
    ) -> ComplaintDraftModel:
        """Stores or updates in-progress complaint draft for an authenticated citizen or session."""
        now = get_ist_now()
        draft = ComplaintDraftModel(
            session_id=session_id,
            user_id=user_id,
            complaint_data=json.dumps(complaint_data),
            created_at=now,
            expires_at=now + timedelta(days=7),
        )
        db.add(draft)
        await db.commit()
        await db.refresh(draft)
        return draft

    async def get_draft(
        self,
        draft_id: str,
        user_id: Optional[str],
        session_id: Optional[str],
        db: AsyncSession,
    ) -> Optional[Dict[str, Any]]:
        """Retrieves in-progress complaint draft verifying ownership."""
        res = await db.execute(
            select(ComplaintDraftModel).where(ComplaintDraftModel.id == draft_id)
        )
        draft = res.scalars().first()
        if not draft:
            return None
        # Enforce draft privacy: user_id or session_id must match
        if user_id and draft.user_id and draft.user_id != user_id:
            return None
        if not user_id and session_id and draft.session_id and draft.session_id != session_id:
            return None

        try:
            parsed_data = json.loads(draft.complaint_data)
        except Exception:
            parsed_data = {}

        return {
            "id": str(draft.id),
            "session_id": draft.session_id,
            "complaint_data": parsed_data,
            "created_at": draft.created_at,
            "expires_at": draft.expires_at,
        }

    async def add_complaint_update(
        self,
        complaint_id: str,
        actor_id: Optional[str],
        actor_role: str,
        status: str,
        message: str,
        internal_note: Optional[str],
        db: AsyncSession,
    ) -> ComplaintUpdateModel:
        """Creates official update entry for a complaint."""
        update_entry = ComplaintUpdateModel(
            complaint_id=complaint_id,
            actor_id=actor_id,
            actor_role=actor_role,
            status=status,
            message=message,
            internal_note=internal_note,
            created_at=get_ist_now(),
        )
        db.add(update_entry)
        await db.flush()
        return update_entry

    async def get_complaint_updates(
        self,
        complaint_id: str,
        is_official: bool,
        db: AsyncSession,
    ) -> List[Dict[str, Any]]:
        """Retrieves timeline updates. Strips confidential internal_note for citizens."""
        stmt = (
            select(ComplaintUpdateModel)
            .where(ComplaintUpdateModel.complaint_id == complaint_id)
            .order_by(ComplaintUpdateModel.created_at.asc())
        )
        res = await db.execute(stmt)
        updates = res.scalars().all()
        return [
            {
                "id": str(u.id),
                "actor_role": u.actor_role,
                "status": u.status,
                "message": u.message,
                "internal_note": u.internal_note if is_official else None,  # Strictly hidden from citizens
                "created_at": format_ist_iso(u.created_at),
            }
            for u in updates
        ]


complaint_service = ComplaintService()

"""
JanSetu AI - Citizen Complaints API Controller
Handles grievance ingestion, AI understanding, citizen ownership, drafts,
public tracking, timeline updates, and citizen clarification.
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)

from app.db.session import get_db
from app.api.dependencies import get_current_user, get_optional_user, require_roles
from app.models.user import UserModel
from app.schemas.complaint import (
    ComplaintCreate,
    ClarificationSubmit,
    DraftSaveRequest,
    DraftResponse,
)
from app.services.complaint_service import complaint_service
from app.rules.mandatory_validation import MandatoryValidationException

router = APIRouter(prefix="/complaints", tags=["Complaints"])


@router.post("", status_code=status.HTTP_201_CREATED, include_in_schema=False)
@router.post("/", status_code=status.HTTP_201_CREATED)
async def submit_complaint(
    complaint_in: ComplaintCreate,
    optional_user: Optional[UserModel] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Ingests raw citizen complaint, executes AI extraction pipeline,
    strictly validates all mandatory fields, determines priority & department routing,
    associates citizen_id if authenticated, and initiates SLA clock.
    """
    try:
        citizen_id = str(optional_user.id) if optional_user else None
        result = await complaint_service.create_complaint(complaint_in, db, citizen_id=citizen_id)
        return result
    except MandatoryValidationException as mve:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content=mve.to_dict(),
        )
    except HTTPException:
        await db.rollback()
        raise
    except IntegrityError as ie:
        await db.rollback()
        logger.error(f"Database integrity violation during complaint creation: {ie}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Unable to submit your complaint due to a data conflict. Please try again.",
        )
    except SQLAlchemyError as se:
        await db.rollback()
        logger.error(f"Database error during complaint creation: {se}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to submit your complaint. Please try again.",
        )
    except Exception as e:
        await db.rollback()
        logger.error(f"Unexpected error during complaint creation: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to submit your complaint. Please try again.",
        )


@router.get("/my")
async def get_my_complaints(
    current_user: UserModel = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[Dict[str, Any]]:
    """
    Returns grievances submitted exclusively by the currently authenticated citizen.
    Citizens can never access another citizen's complaints.
    """
    if current_user.role != "CITIZEN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The /my complaints queue is exclusively available to citizen accounts.",
        )
    return await complaint_service.get_my_complaints(str(current_user.id), db)


@router.post("/draft")
async def save_complaint_draft(
    draft_in: DraftSaveRequest,
    optional_user: Optional[UserModel] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """
    Preserves in-progress complaint draft before login or across registration.
    """
    user_id = str(optional_user.id) if optional_user else None
    draft = await complaint_service.save_draft(
        complaint_data=draft_in.complaint_data,
        session_id=draft_in.session_id,
        user_id=user_id,
        db=db,
    )
    return {
        "status": "ok",
        "draft_id": str(draft.id),
        "message": "Complaint draft saved successfully.",
    }


@router.get("/draft/{draft_id}")
async def get_complaint_draft(
    draft_id: str,
    session_id: Optional[str] = Query(None),
    optional_user: Optional[UserModel] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """
    Restores preserved complaint draft verifying ownership by user_id or session_id.
    """
    user_id = str(optional_user.id) if optional_user else None
    draft = await complaint_service.get_draft(
        draft_id=draft_id,
        user_id=user_id,
        session_id=session_id,
        db=db,
    )
    if not draft:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Draft not found or expired.",
        )
    return draft


@router.get("/search")
async def search_complaints(
    phone: str = Query(..., description="10-digit registered mobile number"),
    name: Optional[str] = Query(None, description="Citizen full name"),
    db: AsyncSession = Depends(get_db),
) -> List[Dict[str, Any]]:
    """
    Public citizen search endpoint by registered contact number and name.
    """
    return await complaint_service.search_by_contact(phone=phone, name=name, db=db)


@router.get("/{id_or_tracking}")
async def track_complaint(
    id_or_tracking: str,
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """
    Public citizen tracking endpoint.
    Retrieves full progress timeline, AI explanation, SLA clock, and clarification prompts.
    """
    complaint = await complaint_service.get_by_tracking_or_id(id_or_tracking, db)
    if not complaint:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Complaint not found. Please verify tracking number.",
        )
    return complaint


@router.get("/{id_or_tracking}/updates")
async def get_complaint_updates(
    id_or_tracking: str,
    optional_user: Optional[UserModel] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
) -> List[Dict[str, Any]]:
    """
    Retrieves official action timeline. Confidential internal notes are stripped for citizens.
    """
    complaint = await complaint_service.get_by_tracking_or_id(id_or_tracking, db)
    if not complaint:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Complaint not found.",
        )
    is_official = bool(optional_user and optional_user.role in ["MUNICIPAL_ADMIN", "DEPARTMENT_OFFICER", "COLLECTOR"])
    return await complaint_service.get_complaint_updates(complaint["id"], is_official=is_official, db=db)


@router.post("/{id_or_tracking}/clarify")
async def clarify_complaint(
    id_or_tracking: str,
    clarification: ClarificationSubmit,
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """
    Receives citizen response to AI clarification questions,
    updates location details, resumes paused SLA, and moves status to ASSIGNED.
    """
    try:
        result = await complaint_service.submit_clarification(
            identifier=id_or_tracking,
            answer=clarification.answer,
            field=clarification.requested_field or "location",
            db=db,
        )
        return result
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(ve),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to submit clarification: {str(e)}",
        )

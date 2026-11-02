from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.api.deps import current_user
from app.core.otp import generate_otp, send_otp_email
from app.core.security import (
    create_access_token,
    hash_password,
    verify_password,
)
from app.db import get_db
from app.models import User
from app.schemas.schemas import (
    LoginIn,
    MessageOut,
    RegisterIn,
    ResendOtpIn,
    Token,
    UserOut,
    VerifyOtpIn,
)

router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)

OTP_VALID_MINUTES = 10
OTP_MAX_ATTEMPTS = 5
OTP_RESEND_SECONDS = 60

# Roles anyone may self-register as. NEVER add admin/superadmin here.
PUBLIC_ROLES = {"student"}


def _issue_otp(user: User) -> str:
    """Create a new OTP on the user row (not committed) and return the plain code."""
    otp = generate_otp()
    now = datetime.utcnow()
    user.otp_hash = hash_password(otp)
    user.otp_expires_at = now + timedelta(minutes=OTP_VALID_MINUTES)
    user.otp_last_sent_at = now
    user.otp_attempts = 0
    return otp


# =========================================================
# REGISTER  ->  POST /api/auth/register
# =========================================================

@router.post("/register", response_model=MessageOut, status_code=201)
def register(data: RegisterIn, db: Session = Depends(get_db)):
    email = data.email.strip().lower()
    role = data.role.strip().lower()

    if role not in PUBLIC_ROLES:
        raise HTTPException(
            status_code=403,
            detail="This account type cannot be self-registered",
        )

    user = db.query(User).filter(User.email == email).first()

    if user and user.is_verified:
        raise HTTPException(status_code=409, detail="Email already registered")

    if user:
        if (
            user.otp_last_sent_at
            and datetime.utcnow() - user.otp_last_sent_at
            < timedelta(seconds=OTP_RESEND_SECONDS)
        ):
            raise HTTPException(
                status_code=429,
                detail="Please wait a minute before trying again",
            )
        user.name = data.name.strip()
        user.password_hash = hash_password(data.password)
        user.role = role
    else:
        user = User(
            name=data.name.strip(),
            email=email,
            password_hash=hash_password(data.password),
            role=role,
            is_active=True,
            is_verified=False,
        )
        db.add(user)

    otp = _issue_otp(user)

    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        print("Registration error:", exc)
        raise HTTPException(status_code=500, detail="Failed to create user account")

    try:
        send_otp_email(email, otp)
    except Exception as exc:
        print("OTP email error:", exc)
        user.otp_last_sent_at = None      # allow immediate retry
        db.commit()
        raise HTTPException(
            status_code=502,
            detail="Could not send verification email. Please try again.",
        )

    return {"message": "OTP sent to your email"}


# =========================================================
# VERIFY OTP  ->  POST /api/auth/verify-otp
# =========================================================

@router.post("/verify-otp", response_model=MessageOut)
def verify_otp(data: VerifyOtpIn, db: Session = Depends(get_db)):
    email = data.email.strip().lower()
    user = db.query(User).filter(User.email == email).first()

    if not user or user.is_verified or not user.otp_hash:
        raise HTTPException(status_code=400, detail="Invalid request")

    if user.otp_attempts >= OTP_MAX_ATTEMPTS:
        raise HTTPException(
            status_code=429,
            detail="Too many wrong attempts. Please request a new OTP.",
        )

    if not user.otp_expires_at or datetime.utcnow() > user.otp_expires_at:
        raise HTTPException(status_code=400, detail="OTP expired. Request a new one.")

    if not verify_password(data.otp, user.otp_hash):
        user.otp_attempts += 1
        db.commit()
        raise HTTPException(status_code=400, detail="Wrong OTP")

    user.is_verified = True
    user.otp_hash = None
    user.otp_expires_at = None
    user.otp_attempts = 0
    db.commit()

    return {"message": "Email verified. You can now log in."}


# =========================================================
# RESEND OTP  ->  POST /api/auth/resend-otp
# =========================================================

@router.post("/resend-otp", response_model=MessageOut)
def resend_otp(data: ResendOtpIn, db: Session = Depends(get_db)):
    email = data.email.strip().lower()
    user = db.query(User).filter(User.email == email).first()
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
# Add "company" only if companies should be able to sign up on their own.
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
# Creates an UNVERIFIED account and emails an OTP.
# =========================================================

@router.post(
    "/register",
    response_model=MessageOut,
    status_code=201,
)
def register(
    data: RegisterIn,
    db: Session = Depends(get_db),
):
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
        # Unverified leftover from an earlier attempt: respect the resend cooldown
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
        raise HTTPException(
            status_code=502,
            detail="Could not send verification email. Check the address and try again.",
        )

    return {"message": "OTP sent to your email"}


# =========================================================
# VERIFY OTP  ->  POST /api/auth/verify-otp
# =========================================================

@router.post("/verify-otp", response_model=MessageOut)
def verify_otp(
    data: VerifyOtpIn,
    db: Session = Depends(get_db),
):
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
def resend_otp(
    data: ResendOtpIn,
    db: Session = Depends(get_db),
):
    email = data.email.strip().lower()
    user = db.query(User).filter(User.email == email).first()

    if not user or user.is_verified:
        raise HTTPException(status_code=400, detail="Invalid request")

    if (
        user.otp_last_sent_at
        and datetime.utcnow() - user.otp_last_sent_at
        < timedelta(seconds=OTP_RESEND_SECONDS)
    ):
        raise HTTPException(
            status_code=429,
            detail=f"Wait {OTP_RESEND_SECONDS} seconds before resending",
        )

    otp = _issue_otp(user)
    db.commit()

    try:
        send_otp_email(user.email, otp)
    except Exception as exc:
        print("OTP email error:", exc)
        raise HTTPException(status_code=502, detail="Could not send verification email")

    return {"message": "OTP resent"}


# =========================================================
# LOGIN  ->  POST /api/auth/login
# =========================================================

@router.post("/login", response_model=Token)
def login(
    data: LoginIn,
    db: Session = Depends(get_db),
):
    email = data.email.strip().lower()

    user = db.query(User).filter(User.email == email).first()

    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="User account is inactive")

    if not user.is_verified:
        raise HTTPException(
            status_code=403,
            detail="Please verify your email first",
        )

    access_token = create_access_token(
        {"sub": str(user.id), "role": user.role}
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user.role,
    }


# =========================================================
# OAUTH2 TOKEN (Swagger Authorize)  ->  POST /api/auth/token
# =========================================================

@router.post("/token", response_model=Token)
def token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    email = form_data.username.strip().lower()

    user = db.query(User).filter(User.email == email).first()

    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="User account is inactive")

    if not user.is_verified:
        raise HTTPException(status_code=403, detail="Please verify your email first")

    access_token = create_access_token(
        {"sub": str(user.id), "role": user.role}
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user.role,
    }


# =========================================================
# CURRENT USER  ->  GET /api/auth/me
# =========================================================

@router.get("/me", response_model=UserOut)
def me(user: User = Depends(current_user)):
    return user
import os
import secrets
import smtplib
from email.message import EmailMessage

from dotenv import load_dotenv

load_dotenv()


def generate_otp() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def send_otp_email(to_email: str, otp: str) -> None:
    # Dev mode: print the code in the terminal instead of emailing it.
    # Remove DEV_PRINT_OTP from .env before real use.
    if os.getenv("DEV_PRINT_OTP") == "1":
        print(f"[DEV] OTP for {to_email}: {otp}")
        return

    sender = os.getenv("EMAIL_USER")
    password = (os.getenv("EMAIL_APP_PASSWORD") or "").replace(" ", "")

    if not sender or not password:
        raise RuntimeError("EMAIL_USER / EMAIL_APP_PASSWORD not set in .env")

    msg = EmailMessage()
    msg["Subject"] = "Your CollegeJobs verification code"
    msg["From"] = sender
    msg["To"] = to_email
    msg.set_content(
        f"Your CollegeJobs verification code is {otp}.\n"
        "It expires in 10 minutes. If you didn't request it, ignore this email."
    )

    with smtplib.SMTP("smtp.gmail.com", 587, timeout=20) as s:
        s.ehlo()
        s.starttls()
        s.ehlo()
        s.login(sender, password)
        s.send_message(msg)
from app.db import SessionLocal
from app.models import User
from app.core.security import hash_password


ADMIN_PASSWORDS = {
    "superadmin@payroll.com": "Password@123",
    "superadmin@collegejobs.com": "admin@123",
}


def reset_admin_passwords():
    db = SessionLocal()

    try:
        for email, new_password in ADMIN_PASSWORDS.items():

            user = db.query(User).filter(User.email == email).first()

            if not user:
                print(f"NOT FOUND: {email}")
                continue

            user.password_hash = hash_password(new_password)

            print(f"PASSWORD RESET: {email}")
            print(f"ROLE: {user.role}")

        db.commit()
        print("\nAdmin password reset completed.")

    except Exception as e:
        db.rollback()
        print("ERROR:", e)

    finally:
        db.close()


if __name__ == "__main__":
    reset_admin_passwords()
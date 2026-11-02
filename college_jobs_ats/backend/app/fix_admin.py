from app.db import get_db
from app.models import User
from app.core.security import hash_password


EMAIL = "superadmin@collegejobs.com"
PASSWORD = "admin@123"


db = next(get_db())

try:
    user = db.query(User).filter(User.email == EMAIL).first()

    if user:
        print("Admin user found.")
        print("Old role:", user.role)

        user.password_hash = hash_password(PASSWORD)

        # Your project uses admin for administrative access.
        # Do not use "superadmin" because your current registration/auth
        # setup only recognizes the existing application roles.
        user.role = "admin"

        db.commit()
        db.refresh(user)

        print("================================")
        print("ADMIN PASSWORD RESET SUCCESS")
        print("Email:", user.email)
        print("Role:", user.role)
        print("Password: Admin@123")
        print("================================")

    else:
        print("Admin user NOT FOUND.")
        print("Creating admin user...")

        user = User(
            name="Super Admin",
            email=EMAIL,
            password_hash=hash_password(PASSWORD),
            role="admin",
        )

        db.add(user)
        db.commit()
        db.refresh(user)

        print("================================")
        print("ADMIN CREATED SUCCESSFULLY")
        print("Email:", user.email)
        print("Role:", user.role)
        print("Password: Admin@123")
        print("================================")

except Exception as e:
    db.rollback()
    print("================================")
    print("ERROR")
    print(e)
    print("================================")

finally:
    db.close()
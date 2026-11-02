import os
import smtplib
from dotenv import load_dotenv

load_dotenv()

user = os.getenv("EMAIL_USER")
pw = (os.getenv("EMAIL_APP_PASSWORD") or "").replace(" ", "")
print("EMAIL_USER:", user)
print("Password length:", len(pw), "(a Gmail App Password is 16)")

s = smtplib.SMTP("smtp.gmail.com", 587, timeout=20)
s.set_debuglevel(1)          # prints every step of the conversation
s.ehlo()
s.starttls()
s.ehlo()
s.login(user, pw)
print("LOGIN OK")
s.quit()
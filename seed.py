from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Agent, Comment, Ticket, utcnow
from .nlp.classifier import classifier
from .services.assignment import auto_assign
from datetime import timedelta

AGENTS = [
    ("Priya Raman", "priya@company.com", "Login & Access"),
    ("Arjun Mehta", "arjun@company.com", "Network"),
    ("Meera Iyer", "meera@company.com", "Software"),
    ("Karthik Nair", "karthik@company.com", "Hardware"),
    ("Divya Shah", "divya@company.com", "Security"),
    ("Sam Patel", "sam@company.com", "Email"),
    ("Lena Fischer", "lena@company.com", "General"),
]

TICKETS = [
    ("Locked out of my account", "I entered the wrong password too many times and my account is locked. I have a client deadline today, please help.", "Ananya K", "ananya@company.com"),
    ("VPN not connecting from home", "VPN client shows error 809 when I try to connect from my home network.", "Rohit S", "rohit@company.com"),
    ("Entire 2nd floor wifi is down", "All employees on the second floor have no wifi since this morning. This is an outage.", "Neha P", "neha@company.com"),
    ("Excel crashes on large files", "Excel crashes every time I open the quarterly report file, which is about 80 MB.", "Vikram D", "vikram@company.com"),
    ("Need Python installed", "Could you please install Python 3.12 and VS Code on my laptop when you get a chance?", "Isha M", "isha@company.com"),
    ("Suspicious email asking for my password", "I received a phishing email pretending to be from IT asking me to verify my credentials. I did not click it.", "Tarun B", "tarun@company.com"),
    ("Laptop screen flickering", "My laptop screen flickers and shows horizontal lines after a few minutes of use.", "Sana R", "sana@company.com"),
    ("Outlook not receiving emails", "Since yesterday Outlook is not receiving any new emails, the inbox says it is up to date.", "Dev J", "dev@company.com"),
    ("Printer jam on floor 3", "The printer near the pantry has a paper jam error and nobody can print.", "Meena L", "meena@company.com"),
    ("How do I set up MFA on a new phone?", "I got a new phone and need to move my authenticator app. How do I do this?", "Kabir A", "kabir@company.com"),
]


def seed(db: Session) -> None:
    if db.scalar(select(Agent).limit(1)):
        return
    for name, email, spec in AGENTS:
        db.add(Agent(name=name, email=email, specialty=spec))
    db.flush()
    for i, (title, desc, who, email) in enumerate(TICKETS):
        r = classifier.analyze(f"{title}. {desc}")
        t = Ticket(title=title, description=desc, requester_name=who, requester_email=email,
                   category=r.category, priority=r.priority, ai_confidence=r.confidence,
                   ai_priority_reason=r.priority_reason, created_at=utcnow() - timedelta(hours=3 * (len(TICKETS) - i)))
        db.add(t)
        db.flush()
        db.add(Comment(ticket_id=t.id, author="AI Triage", kind="system",
                       body=f"Ticket created. AI triage: {t.category} ({int(r.confidence*100)}% confidence), {t.priority} priority."))
        if i % 3 != 2:
            auto_assign(db, t)
            db.flush()
    # a couple of resolved tickets so the stats have history
    for t in db.scalars(select(Ticket).where(Ticket.id.in_([5, 9]))).all():
        t.status = "Resolved"
        t.resolved_at = t.created_at + timedelta(hours=5)
    db.commit()

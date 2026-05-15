import json
import os
from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String, Text, create_engine
from sqlalchemy.orm import declarative_base, sessionmaker


Base = declarative_base()


def _database_url():
    url = os.getenv("DATABASE_URL")
    if url:
        return url.replace("postgres://", "postgresql+psycopg://", 1)
    return "sqlite:///instance/app.db"


engine = create_engine(_database_url(), future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


class SurgicalPlan(Base):
    __tablename__ = "surgical_plans"

    id = Column(Integer, primary_key=True)
    patient_name = Column(String(200), nullable=False)
    patient_id = Column(String(80), nullable=False)
    surgeon = Column(String(200), nullable=False)
    payload = Column(Text, nullable=False)
    result = Column(Text, nullable=False)
    notes = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "patient_name": self.patient_name,
            "patient_id": self.patient_id,
            "surgeon": self.surgeon,
            "payload": json.loads(self.payload),
            "result": json.loads(self.result),
            "notes": self.notes,
            "created_at": self.created_at.isoformat() + "Z",
        }


def init_db():
    Base.metadata.create_all(bind=engine)


def save_plan(payload, result, notes=""):
    patient = payload.get("patient", {})
    with SessionLocal() as session:
        record = SurgicalPlan(
            patient_name=patient.get("name") or "Chưa nhập",
            patient_id=patient.get("id") or "",
            surgeon=patient.get("surgeon") or "",
            payload=json.dumps(payload, ensure_ascii=False),
            result=json.dumps(result, ensure_ascii=False),
            notes=notes or "",
        )
        session.add(record)
        session.commit()
        session.refresh(record)
        return record.to_dict()


def update_plan(plan_id, payload, result, notes=""):
    patient = payload.get("patient", {})
    with SessionLocal() as session:
        record = session.get(SurgicalPlan, plan_id)
        if not record:
            return None
        record.patient_name = patient.get("name") or "ChÆ°a nháº­p"
        record.patient_id = patient.get("id") or ""
        record.surgeon = patient.get("surgeon") or ""
        record.payload = json.dumps(payload, ensure_ascii=False)
        record.result = json.dumps(result, ensure_ascii=False)
        record.notes = notes or ""
        session.commit()
        session.refresh(record)
        return record.to_dict()


def delete_plan(plan_id):
    with SessionLocal() as session:
        record = session.get(SurgicalPlan, plan_id)
        if not record:
            return False
        session.delete(record)
        session.commit()
        return True


def list_plans(limit=None):
    with SessionLocal() as session:
        query = session.query(SurgicalPlan).order_by(SurgicalPlan.created_at.desc())
        if limit:
            query = query.limit(limit)
        records = query.all()
        return [record.to_dict() for record in records]

import json
from pathlib import Path
from entitlesim.db import SessionLocal, ModelRecord, init_db

def seed_sample_model():
    init_db()
    db = SessionLocal()
    try:
        sample_path = Path(__file__).parent / "saas_upgrade.json"
        if not sample_path.exists():
            print(f"Sample file not found at {sample_path}")
            return
        
        with open(sample_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        existing = db.query(ModelRecord).filter(ModelRecord.name == data["name"]).first()
        if existing:
            print(f"Model '{data['name']}' already seeded (id={existing.id}).")
            return
        
        record = ModelRecord(name=data["name"], definition=data)
        db.add(record)
        db.commit()
        db.refresh(record)
        print(f"Successfully seeded model '{record.name}' with id {record.id}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_sample_model()

import json
from pathlib import Path
from entitlesim.db import SessionLocal, ModelRecord, init_db

def seed_sample_model(overwrite_samples: bool = False, db = None):
    init_db()
    should_close = False
    if db is None:
        db = SessionLocal()
        should_close = True
    try:
        sample_paths = sorted(Path(__file__).parent.glob("*.json"))
        for sample_path in sample_paths:
            if not sample_path.exists():
                continue
            with open(sample_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            matching = db.query(ModelRecord).filter(ModelRecord.name == data["name"]).all()
            if matching:
                if overwrite_samples:
                    primary = matching[0]
                    primary.definition = data
                    for extra in matching[1:]:
                        db.delete(extra)
                    db.commit()
                    print(f"Model '{data['name']}' definition re-seeded (id={primary.id}).")
                else:
                    print(f"Model '{data['name']}' already seeded (id={matching[0].id}).")
                continue
            record = ModelRecord(name=data["name"], definition=data)
            db.add(record)
            db.commit()
            db.refresh(record)
            print(f"Successfully seeded model '{record.name}' with id {record.id}")
    finally:
        if should_close:
            db.close()

if __name__ == "__main__":
    seed_sample_model()

#!/usr/bin/env python3
"""Exercise actual SQLite backup/restore, preserving pre-migration and journal records."""
from pathlib import Path
import sqlite3
import tempfile
import hashlib
import json
ROOT=Path(__file__).resolve().parent.parent
def integrity(db):
    assert db.execute("PRAGMA integrity_check").fetchall()==[("ok",)]
    assert db.execute("PRAGMA foreign_key_check").fetchall()==[]
def snapshot(db,path):
    with sqlite3.connect(path) as target:
        db.backup(target)
        integrity(target)
    return hashlib.sha256(path.read_bytes()).hexdigest()
def logical(db):
    return list(db.iterdump())
with tempfile.TemporaryDirectory(prefix="growth-recovery-") as tmp:
    p=Path(tmp)
    with sqlite3.connect(p/"source.sqlite") as db:
        db.execute("PRAGMA foreign_keys=ON")
        db.execute("CREATE TABLE status(key TEXT PRIMARY KEY,value TEXT NOT NULL,checked_at TEXT NOT NULL)")
        db.execute("INSERT INTO status VALUES('preexisting','preserve','2026-11-27')")
        db.commit()
        before=snapshot(db,p/"before.sqlite")
        for file in sorted((ROOT/"migrations/growth").glob("*.sql")):
            db.executescript(file.read_text())
        assert db.execute("SELECT value FROM status").fetchone()==("preserve",)
        db.execute("INSERT INTO growth_projects(id,name) VALUES('taxpulse','Synthetic project')")
        db.execute("INSERT INTO growth_sources(id,source_url,source_type,observed_at) VALUES('s1','https://github.com/example/tax','public-repository','2026-11-27')")
        db.execute("INSERT INTO growth_opportunities(id,project_id,source_id,title,summary,relevance_score,audience_hypothesis,discovered_at) VALUES('growth-demo','taxpulse','s1','Tax software example','Synthetic public evidence only',60,'Taxpayers','2026-11-27')")
        for old,new in [('unreviewed','approved-for-founder'),('approved-for-founder','founder-executed')]:
            db.execute("INSERT INTO growth_reviews(opportunity_id,from_status,to_status,review_note,reviewed_at) VALUES('growth-demo',?,?, 'Synthetic review','2026-11-27')",(old,new))
        db.execute("INSERT INTO growth_intent_events(opportunity_id,event_key,outcome,occurred_at,recorded_at) VALUES('growth-demo','11111111-1111-4111-8111-111111111111','requested-demo','2026-11-27','2026-11-27')")
        db.commit()
        integrity(db)
        expected=logical(db)
        after=snapshot(db,p/"after.sqlite")
    with sqlite3.connect(p/"after.sqlite") as backup,sqlite3.connect(p/"restored.sqlite") as restored:
        backup.backup(restored)
        restored.execute("PRAGMA foreign_keys=ON")
        integrity(restored)
        assert logical(restored)==expected
        assert restored.execute("SELECT COUNT(*) FROM growth_reviews").fetchone()==(2,)
        assert restored.execute("SELECT COUNT(*) FROM growth_intent_events").fetchone()==(1,)
        try:
            restored.execute("DELETE FROM growth_reviews")
            raise AssertionError("Audit protection lost in restore")
        except sqlite3.IntegrityError:
            pass
    with sqlite3.connect(p/"before.sqlite") as backup,sqlite3.connect(p/"rollback.sqlite") as restored:
        backup.backup(restored)
        integrity(restored)
        assert restored.execute("SELECT value FROM status").fetchone()==("preserve",)
        assert not restored.execute("SELECT 1 FROM sqlite_master WHERE name='growth_projects'").fetchone()
    print("RECOVERY_REPORT "+json.dumps({"environment":"disposable local SQLite","preMigrationBackupSha256":before,"postMigrationBackupSha256":after,"restoreVerified":True,"rollbackVerified":True,"productionD1Verified":False}))

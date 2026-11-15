#!/usr/bin/env python3
"""Consistent private SQLite backups and non-destructive restore rehearsals."""
import argparse, hashlib, json, os, sqlite3, tempfile
from pathlib import Path
from discover import private_storage

def inspect(path):
    db=sqlite3.connect(path.as_uri()+'?mode=ro',uri=True)
    try:
        if db.execute('PRAGMA integrity_check').fetchone()[0]!='ok':raise ValueError('SQLite integrity check failed')
        tables=[r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")]
        return {name:db.execute('SELECT COUNT(*) FROM "'+name.replace('"','""')+'"').fetchone()[0] for name in tables}
    finally:db.close()

def backup(source,destination):
    source=Path(source).expanduser().resolve(strict=True);destination=Path(destination).expanduser().resolve()
    if source==destination or destination.exists():raise ValueError('Backup destination must be a new file')
    folder=private_storage(str(destination.parent));folder.mkdir(parents=True,exist_ok=True,mode=0o700)
    if folder.stat().st_mode&0o077:raise ValueError('Backup directory must be private')
    temporary=folder/('.backup-'+os.urandom(8).hex()+'.sqlite')
    try:
        with sqlite3.connect(source.as_uri()+'?mode=ro',uri=True) as src,sqlite3.connect(temporary) as target:src.backup(target)
        temporary.chmod(0o600);counts=inspect(temporary)
        os.link(temporary,destination)  # exclusive installation, never overwrite
        return {'database':destination.name,'sha256':hashlib.sha256(destination.read_bytes()).hexdigest(),'tables':counts}
    finally:temporary.unlink(missing_ok=True)

def rehearse(backup_file):
    source=Path(backup_file).expanduser().resolve(strict=True)
    original=inspect(source)
    with tempfile.TemporaryDirectory(prefix='hq-restore-rehearsal-') as folder:
        restored=Path(folder)/'restored.sqlite';backup(source,restored)
        if inspect(restored)!=original:raise ValueError('Restore row counts differ')
        return {'status':'restore-rehearsal-passed','tables':original,'liveDatabaseModified':False}

def main():
    os.umask(0o077);p=argparse.ArgumentParser();p.add_argument('action',choices=['backup','rehearse']);p.add_argument('source');p.add_argument('--destination');a=p.parse_args()
    if a.action=='backup' and not a.destination:p.error('--destination is required')
    print(json.dumps(backup(a.source,a.destination) if a.action=='backup' else rehearse(a.source),indent=2))
if __name__=='__main__':main()

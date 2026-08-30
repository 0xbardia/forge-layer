"""SQLite store for the rehearsal registry and optional on-chain cache."""

from __future__ import annotations

import os
import sqlite3
from pathlib import Path

SCHEMA_VERSION = 1

DDL = """
create table if not exists registry_meta (
  id                    integer primary key check (id = 1),
  owner                 text not null,
  paused                integer not null default 0,
  fee_bps               integer not null default 250,
  fee_balance_wei       text not null default '0',
  next_id               integer not null default 1,
  min_stake_wei         text not null default '100000000000000000',
  challenge_window_sec  integer not null default 120,
  seeded                integer not null default 0
);

create table if not exists disputes (
  id                   integer primary key,
  submitter            text not null,
  content_type         text not null,
  content_ref          text not null,
  claim                text not null,
  submitter_stake_wei  text not null,
  status               text not null,
  challenger           text,
  challenger_stake_wei text,
  challenge_deadline   integer not null,
  verdict              text,
  reasoning_summary    text,
  created_at           integer not null,
  resolved_at          integer,
  fee_taken_wei        text not null default '0',
  chain_hash           text
);

create table if not exists schema_meta (
  key   text primary key,
  value text not null
);
"""

MIGRATE_V1_TO_V2 = [
    "alter table disputes add column chain_hash text",
]


def default_db_path() -> Path:
    root = Path(__file__).resolve().parent.parent
    data = root / "data"
    data.mkdir(parents=True, exist_ok=True)
    return data / "forge_layer.sqlite"


def connect(path: str | Path | None = None) -> sqlite3.Connection:
    db_path = Path(path) if path else Path(os.environ.get("FORGE_DB", default_db_path()))
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_path), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("pragma journal_mode=wal")
    conn.execute("pragma foreign_keys=on")
    migrate(conn)
    return conn


def migrate(conn: sqlite3.Connection) -> None:
    conn.executescript(DDL)
    row = conn.execute("select value from schema_meta where key = 'schema_version'").fetchone()
    current = int(row["value"]) if row else 0
    if current < 1:
        conn.execute(
            "insert or replace into schema_meta(key, value) values ('schema_version', ?)",
            (str(SCHEMA_VERSION),),
        )
        current = 1
    # Placeholder for future additive migrations (v1 -> v2 would run MIGRATE_V1_TO_V2).
    if current < SCHEMA_VERSION:
        conn.execute(
            "update schema_meta set value = ? where key = 'schema_version'",
            (str(SCHEMA_VERSION),),
        )
    conn.commit()


def reset(conn: sqlite3.Connection) -> None:
    conn.execute("drop table if exists disputes")
    conn.execute("drop table if exists registry_meta")
    conn.execute("drop table if exists schema_meta")
    conn.commit()
    migrate(conn)

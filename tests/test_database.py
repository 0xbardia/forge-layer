"""Database tests: schema, CRUD, migrations from empty and from v1."""

from __future__ import annotations

import os
import sqlite3
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "server"))

from protocol import Registry  # noqa: E402
from store import SCHEMA_VERSION, connect, migrate, reset  # noqa: E402

A = "0x1111111111111111111111111111111111111111"
STAKE = 10**17


class DatabaseTests(unittest.TestCase):
    def test_migrate_from_empty(self):
        fd, path = tempfile.mkstemp(suffix=".sqlite")
        os.close(fd)
        conn = connect(path)
        ver = conn.execute("select value from schema_meta where key='schema_version'").fetchone()
        self.assertEqual(int(ver["value"]), SCHEMA_VERSION)
        tables = {r[0] for r in conn.execute("select name from sqlite_master where type='table'")}
        self.assertIn("disputes", tables)
        self.assertIn("registry_meta", tables)

    def test_migrate_from_populated_v1(self):
        fd, path = tempfile.mkstemp(suffix=".sqlite")
        os.close(fd)
        conn = sqlite3.connect(path)
        conn.executescript(
            """
            create table registry_meta (
              id integer primary key, owner text, paused integer, fee_bps integer,
              fee_balance_wei text, next_id integer, min_stake_wei text,
              challenge_window_sec integer, seeded integer
            );
            create table disputes (
              id integer primary key, submitter text, content_type text, content_ref text,
              claim text, submitter_stake_wei text, status text, challenger text,
              challenger_stake_wei text, challenge_deadline integer, verdict text,
              reasoning_summary text, created_at integer, resolved_at integer, fee_taken_wei text
            );
            create table schema_meta (key text primary key, value text);
            insert into schema_meta values ('schema_version', '1');
            insert into registry_meta values (1, '0x1', 0, 250, '0', 2, '1', 120, 1);
            insert into disputes values (1,'0x1','text','hi','human_made','1','OPEN',null,null,1,null,null,1,null,'0');
            """
        )
        conn.commit()
        conn.close()
        conn = connect(path)
        row = conn.execute("select count(*) as c from disputes").fetchone()
        self.assertEqual(row["c"], 1)
        self.assertEqual(
            int(conn.execute("select value from schema_meta where key='schema_version'").fetchone()["value"]),
            SCHEMA_VERSION,
        )

    def test_crud_and_integrity(self):
        fd, path = tempfile.mkstemp(suffix=".sqlite")
        os.close(fd)
        conn = connect(path)
        reset(conn)
        r = Registry(conn)
        d = r.submit_dispute(A, "text", "kitchen window kettle", "human_made", STAKE)
        again = r.get_dispute(d["id"])
        self.assertEqual(again["content_ref"], "kitchen window kettle")
        listed = r.list_disputes()
        self.assertTrue(any(x["id"] == d["id"] for x in listed["items"]))

    def test_reset_then_migrate(self):
        fd, path = tempfile.mkstemp(suffix=".sqlite")
        os.close(fd)
        conn = connect(path)
        migrate(conn)
        reset(conn)
        r = Registry(conn)
        self.assertGreaterEqual(r.stats()["total"], 0)


if __name__ == "__main__":
    unittest.main()

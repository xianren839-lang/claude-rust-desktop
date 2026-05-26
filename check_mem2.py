import sqlite3

db_path = r"C:\Users\Administrator\AppData\Roaming\com.claude.desktop\claude_desktop.db"
conn = sqlite3.connect(db_path)
cur = conn.cursor()

cur.execute("SELECT COUNT(*) FROM memories")
count = cur.fetchone()[0]
print(f"Memories count: {count}")

if count > 0:
    cur.execute("SELECT id, workspace_path, conversation_id, substr(summary,1,120), tags, created_at FROM memories ORDER BY created_at DESC LIMIT 10")
    for row in cur.fetchall():
        print(f"  [{row[5][:19]}] ws={row[1]!r}")
        print(f"    conv={row[2][:12]}... tags={row[4]}")
        print(f"    summary={row[3]}")
        print()

conn.close()

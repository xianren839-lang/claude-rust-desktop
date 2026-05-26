import sqlite3

db_path = r"C:\Users\Administrator\AppData\Roaming\com.claude.desktop\claude_desktop.db"
conn = sqlite3.connect(db_path)
cur = conn.cursor()

cur.execute("SELECT COUNT(*) FROM memories")
count = cur.fetchone()[0]
print(f"=== Memories: {count} ===")
if count > 0:
    cur.execute("SELECT id, workspace_path, conversation_id, substr(summary,1,200), tags, created_at FROM memories ORDER BY created_at DESC LIMIT 5")
    for row in cur.fetchall():
        print(f"  [{row[5][:19]}] ws={row[1]!r}")
        print(f"    conv={row[2][:12]}... tags={row[4]}")
        print(f"    summary={row[3]}")
        print()

cur.execute("SELECT COUNT(*) FROM messages")
msg_count = cur.fetchone()[0]
print(f"=== Total messages: {msg_count} ===")

cur.execute("SELECT role, substr(content,1,80), created_at FROM messages ORDER BY created_at DESC LIMIT 4")
for m in cur.fetchall():
    print(f"  [{m[2][:19]}] role={m[0]} content={m[1][:60]}")

conn.close()

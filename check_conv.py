import sqlite3

db_path = r"C:\Users\Administrator\AppData\Roaming\com.claude.desktop\claude_desktop.db"
conn = sqlite3.connect(db_path)
cur = conn.cursor()

cur.execute("SELECT id, workspace_path, title, message_count, updated_at FROM conversations ORDER BY updated_at DESC LIMIT 5")
convs = cur.fetchall()
print(f"Conversations: {len(convs)}")
for c in convs:
    print(f"  [{c[4][:19]}] id={c[0][:12]}... ws={c[1]!r} title={c[2]!r} msgs={c[3]}")
    cur.execute("SELECT COUNT(*) FROM messages WHERE conversation_id=?", (c[0],))
    msg_count = cur.fetchone()[0]
    print(f"    actual messages in DB: {msg_count}")

conn.close()

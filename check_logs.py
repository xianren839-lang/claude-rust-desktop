import sqlite3

db_path = r"C:\Users\Administrator\AppData\Roaming\com.claude.desktop\claude_desktop.db"
conn = sqlite3.connect(db_path)
cur = conn.cursor()

# Check recent messages
cur.execute("SELECT conversation_id, role, substr(content,1,80), created_at FROM messages ORDER BY created_at DESC LIMIT 5")
msgs = cur.fetchall()
print("Recent messages:")
for m in msgs:
    print(f"  [{m[3][:19]}] conv={m[0][:12]}... role={m[1]} content={m[2][:60]}")

# Check conversation message_count vs actual
cur.execute("SELECT id, message_count FROM conversations ORDER BY updated_at DESC LIMIT 3")
for c in cur.fetchall():
    cur.execute("SELECT COUNT(*) FROM messages WHERE conversation_id=?", (c[0],))
    actual = cur.fetchone()[0]
    print(f"  conv={c[0][:12]}... declared_count={c[1]} actual={actual}")

conn.close()

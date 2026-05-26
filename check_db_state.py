import sqlite3

db_path = r"C:\Users\Administrator\AppData\Roaming\com.claude.desktop\claude_desktop.db"
conn = sqlite3.connect(db_path)
cur = conn.cursor()

# Check all tables
cur.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
tables = [r[0] for r in cur.fetchall()]
print(f"Tables: {tables}")

# Check conversations
if 'conversations' in tables:
    cur.execute("SELECT COUNT(*) FROM conversations")
    print(f"Conversations: {cur.fetchone()[0]}")
else:
    print("conversations table MISSING")

# Check messages
if 'messages' in tables:
    cur.execute("SELECT COUNT(*) FROM messages")
    print(f"Messages: {cur.fetchone()[0]}")
else:
    print("messages table MISSING")

# Check memories columns
if 'memories' in tables:
    cur.execute("PRAGMA table_info(memories)")
    cols = [r[1] for r in cur.fetchall()]
    print(f"Memories columns: {cols}")

# Check if FTS5 exists
if 'memories_fts' in tables:
    print("FTS5: EXISTS")
else:
    print("FTS5: MISSING")

# Check providers table or JSON file
print(f"\nAll tables: {tables}")

conn.close()

import sqlite3

db_path = r"C:\Users\Administrator\AppData\Roaming\com.claude.desktop\claude_desktop.db"
conn = sqlite3.connect(db_path)
cur = conn.cursor()

# Show ALL messages in the most recently updated conversation
cur.execute("""SELECT role, substr(content,1,120), created_at 
               FROM messages WHERE conversation_id='e51e14f3-8165-41ed-a7f8-ece8dc943d01' 
               ORDER BY sort_order""")
msgs = cur.fetchall()
print(f"Conversation e51e14f3 messages ({len(msgs)}):")
for m in msgs:
    print(f"  [{m[2][:19]}] role={m[0]} content={m[1][:80]}")

print()
# Also show be821870
cur.execute("""SELECT role, substr(content,1,120), created_at 
               FROM messages WHERE conversation_id='be821870-484a-45c4-b789-9a56f9739685' 
               ORDER BY sort_order""")
msgs = cur.fetchall()
print(f"Conversation be821870 messages ({len(msgs)}):")
for m in msgs:
    print(f"  [{m[2][:19]}] role={m[0]} content={m[1][:80]}")

conn.close()

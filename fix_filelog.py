import pathlib

path = pathlib.Path(r"F:\Projects\claude-code-rust\src-tauri\src\native_engine\engine_core.rs")
content = path.read_text(encoding="utf-8")

# Replace eprintln with file-based logging
old = '''                        eprintln!("[Memory] Spawning memory write-back for conv={}", conv_id_mem);
                        tokio::spawn(async move {
                            let result = tokio::task::spawn_blocking(move || {
                                db_mem.with_conn(|conn| {
                                    let ws_path = crate::db::conversation_repo::get_conversation(conn, &conv_id_mem)
                                        .ok()
                                        .flatten()
                                        .and_then(|c| c.workspace_path)
                                        .unwrap_or_default();
                                    eprintln!("[Memory] ws_path={:?} conv={}", ws_path, conv_id_mem);
                                    let msgs = crate::db::message_repo::get_messages_by_conversation(conn, &conv_id_mem)
                                        .unwrap_or_default();
                                    eprintln!("[Memory] Found {} messages for summary", msgs.len());
                                    let summary: String = msgs.iter().rev().take(20).enumerate()
                                        .map(|(i, m)| format!("{}. {}: {}", i + 1, m.role,
                                            if m.content.len() > 200 { &m.content[..200] } else { &m.content }))
                                        .collect::<Vec<_>>()
                                        .join("\\n");
                                    if !summary.is_empty() {
                                        eprintln!("[Memory] Writing memory, summary_len={}", summary.len());
                                        crate::db::memory_repo::insert_memory(
                                            conn,
                                            &Uuid::new_v4().to_string(),
                                            &ws_path,
                                            &conv_id_mem,
                                            &summary,
                                            "auto",
                                            &Utc::now().to_rfc3339(),
                                        )?;
                                        eprintln!("[Memory] Memory written successfully");
                                    } else {
                                        eprintln!("[Memory] Summary is empty, skipping");
                                    }
                                    Ok::<(), anyhow::Error>(())
                                })
                            }).await;
                            match result {
                                Ok(Ok(Ok(()))) => eprintln!("[Memory] Write-back completed OK"),
                                Ok(Ok(Err(e))) => eprintln!("[Memory] Write-back DB error: {}", e),
                                Ok(Err(e)) => eprintln!("[Memory] Write-back conn error: {}", e),
                                Err(e) => eprintln!("[Memory] Write-back join error: {}", e),
                            }
                        });'''

new = '''                        let log_path = std::path::PathBuf::from(r"C:\Users\Administrator\AppData\Roaming\com.claude.desktop\memory_debug.log");
                        let _ = std::fs::write(&log_path, format!("[{}] Spawning memory write-back for conv={}\n", chrono::Utc::now().to_rfc3339(), conv_id_mem));
                        let log_path2 = log_path.clone();
                        tokio::spawn(async move {
                            let lp = log_path2.clone();
                            let result = tokio::task::spawn_blocking(move || {
                                let log = |msg: &str| {
                                    let _ = std::fs::OpenOptions::new().create(true).append(true).open(&lp)
                                        .and_then(|mut f| { use std::io::Write; writeln!(f, "[{}] {}", chrono::Utc::now().to_rfc3339(), msg) });
                                };
                                log("spawn_blocking started");
                                db_mem.with_conn(|conn| {
                                    log("with_conn entered");
                                    let ws_path = crate::db::conversation_repo::get_conversation(conn, &conv_id_mem)
                                        .ok()
                                        .flatten()
                                        .and_then(|c| c.workspace_path)
                                        .unwrap_or_default();
                                    log(&format!("ws_path={:?} conv={}", ws_path, conv_id_mem));
                                    let msgs = crate::db::message_repo::get_messages_by_conversation(conn, &conv_id_mem)
                                        .unwrap_or_default();
                                    log(&format!("Found {} messages", msgs.len()));
                                    let summary: String = msgs.iter().rev().take(20).enumerate()
                                        .map(|(i, m)| format!("{}. {}: {}", i + 1, m.role,
                                            if m.content.len() > 200 { &m.content[..200] } else { &m.content }))
                                        .collect::<Vec<_>>()
                                        .join("\n");
                                    if !summary.is_empty() {
                                        log(&format!("Writing memory, summary_len={}", summary.len()));
                                        crate::db::memory_repo::insert_memory(
                                            conn,
                                            &Uuid::new_v4().to_string(),
                                            &ws_path,
                                            &conv_id_mem,
                                            &summary,
                                            "auto",
                                            &Utc::now().to_rfc3339(),
                                        )?;
                                        log("Memory written OK");
                                    } else {
                                        log("Summary empty, skipping");
                                    }
                                    Ok::<(), anyhow::Error>(())
                                })
                            }).await;
                            let log = |msg: &str| {
                                let _ = std::fs::OpenOptions::new().create(true).append(true).open(&log_path)
                                    .and_then(|mut f| { use std::io::Write; writeln!(f, "[{}] {}", chrono::Utc::now().to_rfc3339(), msg) });
                            };
                            match result {
                                Ok(Ok(Ok(()))) => log("Write-back completed OK"),
                                Ok(Ok(Err(e))) => log(&format!("Write-back DB error: {}", e)),
                                Ok(Err(e)) => log(&format!("Write-back conn error: {}", e)),
                                Err(e) => log(&format!("Write-back join error: {}", e)),
                            }
                        });'''

if old in content:
    content = content.replace(old, new)
    print("File logging added")
else:
    print("WARN: block not found")

path.write_text(content, encoding="utf-8")
print("Done")

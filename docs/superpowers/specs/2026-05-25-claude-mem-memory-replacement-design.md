# Claude-Mem Memory Replacement Design

## Objective
Replace the current dead/incomplete local memory system with claude-mem as the cross-session memory backend while preserving the existing chat session, message storage, prompt assembly, and frontend interaction architecture.

## Scope
### In Scope
- Disable or bypass the current unused memory_* implementation
- Add a thin adapter layer for claude-mem
- Inject long-term memory at session start
- Write summarized memory back at session end
- Optionally emit lightweight user-message observations

### Out of Scope
- Rewriting the chat runtime
- Replacing session/message storage
- Building full memory UI in v1
- Deep integrating with claude-mem internals such as vector DB or SQLite directly

## Current State
The project already has session-related structures and prompt assembly in place:

- src-tauri/src/native_engine/engine_core.rs
- src-tauri/src/native_engine/session_manager.rs
- src-tauri/src/prompt/mod.rs
- src-tauri/src/commands/memory.rs
- memex-backend/main.py

The existing memory_* surface appears unused/unwired and should be treated as deprecated.

## Target Architecture
### Keep unchanged
- Chat message pipeline
- Conversation/message persistence model
- Tauri bridge core
- Frontend chat flow

### New adapter
Add a small Rust-side adapter module, for example src-tauri/src/memory/mod.rs, exposing three capabilities:

1. search_memory
2. ingest_memory
3. build_memory_prompt

The first version should call claude-mem worker over HTTP, default http://localhost:37777, with timeout and graceful degradation.

### Integration hooks
1. Session start
   - Load relevant long-term memory
   - Compress into a long-term-memory prompt block
   - Append into prompt edges without changing prompt core logic

2. Session end
   - Summarize recent conversation
   - Write summary back to claude-mem
   - Do this asynchronously and fail safely

3. User message observation (optional in v1)
   - Emit compact observation on message send
   - Keep non-blocking and low-volume

## Implementation Strategy
### Phase 1
Disable dead memory code paths and route them to safe placeholders or the new adapter interface.

### Phase 2
Implement claude-mem adapter with HTTP client and stable internal API.

### Phase 3
Wire session-start memory injection into prompt assembly or conversation initialization path.

### Phase 4
Wire session-end memory write-back around conversation completion/close handling.

### Phase 5
If needed, add minimal frontend/API plumbing without expanding scope.

## Key Files Likely Affected
- src-tauri/src/commands/memory.rs
- src-tauri/src/native_engine/engine_core.rs
- src-tauri/src/prompt/mod.rs
- src-tauri/src/bridge/mod.rs (only if required for lifecycle hooks)
- new src-tauri/src/memory/mod.rs

## Risks
- Session lifecycle boundaries may not be fully centralized
- Over-injecting memory could waste tokens or confuse models
- claude-mem worker availability must not block main chat flow

## Mitigations
- Keep injection compact and reviewable
- Use async writes with timeouts and fallback defaults
- Treat claude-mem outage as degraded memory mode, not chat outage

## Success Criteria
- New sessions can receive long-term memory context
- Completed sessions can write memory back to claude-mem
- Search can retrieve relevant prior memory
- Chat still works normally when claude-mem is offline

## Verification
- Unit test adapter HTTP client behavior
- Manual test for session-start injection
- Manual test for session-end write-back
- Regression test normal chat flow without memory service

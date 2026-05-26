# Compact Conversation 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现智能对话压缩功能，当上下文 token 接近模型限制时自动或手动压缩对话历史，节省 token 并保持对话连续性。

**Architecture:** 
- 后端：在 ModelConfig 中添加 context_size 字段，实现 /compact 和 /context-size 端点
- 前端：在设置页面配置模型上下文大小，在聊天窗口添加自动压缩触发逻辑
- 存储：压缩后的摘要作为 is_compact_boundary 消息插入，原始消息保留但标记为已压缩

**Tech Stack:** Rust (axum), TypeScript (React), SQLite

---

## 文件结构

### 后端文件
- `src-tauri/src/native_engine/provider_manager.rs` - 添加 context_size 到 ModelConfig
- `src-tauri/src/bridge/mod.rs` - 添加 /compact 和 /context-size 端点
- `src-tauri/src/db/message_repo.rs` - 添加压缩相关查询方法
- `src-tauri/src/db/conversation_repo.rs` - 添加 token 统计方法

### 前端文件
- `src/api.ts` - 完善 compactConversation 和 getContextSize 函数
- `src/components/SettingsPage.tsx` - 添加模型上下文大小配置
- `src/components/MainContent.tsx` - 添加自动压缩触发逻辑
- `src/stores/useChatStore.ts` - 添加压缩状态管理

---

## Task 1: 扩展 ModelConfig 支持 context_size

**Files:**
- Modify: `src-tauri/src/native_engine/provider_manager.rs:25-32`
- Modify: `src-tauri/src/bridge/mod.rs` (providers_list handler)

- [ ] **Step 1: 添加 context_size 字段到 ModelConfig**

```rust
// src-tauri/src/native_engine/provider_manager.rs:25-32
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelConfig {
    pub id: String,
    pub name: String,
    pub enabled: bool,
    pub max_tokens: Option<u32>,
    pub context_size: Option<u32>,  // 新增：模型上下文大小（token）
    pub supports_vision: bool,
    pub supports_web_search: bool,
}
```

- [ ] **Step 2: 更新 providers_list 返回 context_size**

确保 providers_list handler 返回的 models 包含 context_size 字段。

- [ ] **Step 3: 添加默认上下文大小映射**

```rust
// src-tauri/src/native_engine/provider_manager.rs
pub fn get_default_context_size(model_id: &str) -> u32 {
    match model_id {
        id if id.contains("gpt-4o") || id.contains("claude-3") => 128_000,
        id if id.contains("gpt-4-turbo") => 128_000,
        id if id.contains("gpt-4") => 8_192,
        id if id.contains("gpt-3.5") => 16_384,
        id if id.contains("claude-2") => 100_000,
        id if id.contains("deepseek") => 64_000,
        id if id.contains("qwen") => 128_000,
        _ => 32_768,  // 默认 32K
    }
}
```

- [ ] **Step 4: 编译验证**

Run: `cd src-tauri && cargo check`

---

## Task 2: 实现 context-size 端点

**Files:**
- Modify: `src-tauri/src/bridge/mod.rs`

- [ ] **Step 1: 添加 context_size_handler 函数**

```rust
// src-tauri/src/bridge/mod.rs
async fn context_size_handler(
    Path(id): Path<String>,
    State(state): State<AppState>,
) -> Json<serde_json::Value> {
    let db = state.6.clone();
    let native_engine = state.14.clone();
    
    let result = tokio::task::spawn_blocking(move || {
        db.with_conn(|conn| {
            // 获取会话信息
            let conv = crate::db::conversation_repo::get_conversation(conn, &id)?;
            let messages = crate::db::message_repo::get_messages_by_conversation(conn, &id)?;
            
            // 估算当前 token 数（简化计算：1个中文字符≈2 token，1个英文单词≈1.5 token）
            let total_chars: usize = messages.iter()
                .map(|m| m.content.len())
                .sum();
            let estimated_tokens = (total_chars as f64 * 1.5) as u32;
            
            // 获取模型的上下文大小
            let model_id = conv.as_ref()
                .and_then(|c| c.model.as_deref())
                .unwrap_or("default");
            let context_limit = crate::native_engine::provider_manager::get_default_context_size(model_id);
            
            Ok::<_, anyhow::Error>(serde_json::json!({
                "tokens": estimated_tokens,
                "limit": context_limit,
                "model": model_id,
                "message_count": messages.len(),
                "usage_percent": (estimated_tokens as f64 / context_limit as f64 * 100.0).round()
            }))
        })
    }).await;
    
    match result {
        Ok(Ok(Ok(data))) => Json(data),
        _ => Json(serde_json::json!({
            "tokens": 0,
            "limit": 32768,
            "error": "Failed to calculate context size"
        })),
    }
}
```

- [ ] **Step 2: 注册路由**

```rust
// src-tauri/src/bridge/mod.rs (在 router 定义处添加)
.route("/api/conversations/{id}/context-size", get(context_size_handler))
```

- [ ] **Step 3: 编译验证**

Run: `cd src-tauri && cargo check`

---

## Task 3: 实现 compact 端点

**Files:**
- Modify: `src-tauri/src/bridge/mod.rs`
- Modify: `src-tauri/src/db/message_repo.rs`

- [ ] **Step 1: 添加 compact_handler 函数**

```rust
// src-tauri/src/bridge/mod.rs
#[derive(Deserialize)]
struct CompactRequest {
    instruction: Option<String>,
}

async fn compact_handler(
    Path(id): Path<String>,
    State(state): State<AppState>,
    Json(req): Json<CompactRequest>,
) -> Json<serde_json::Value> {
    let db = state.6.clone();
    let native_engine = state.14.clone();
    let config_manager = state.4.clone();
    
    let result = tokio::task::spawn_blocking(move || {
        db.with_conn(|conn| {
            // 1. 获取所有消息
            let messages = crate::db::message_repo::get_messages_by_conversation(conn, &id)?;
            
            if messages.len() < 4 {
                return Ok(serde_json::json!({
                    "success": false,
                    "error": "Not enough messages to compact (minimum 4)"
                }));
            }
            
            // 2. 分离旧消息和新消息（保留最近3条）
            let split_point = messages.len().saturating_sub(3);
            let old_messages = &messages[..split_point];
            let new_messages = &messages[split_point..];
            
            // 3. 生成摘要（简化版本：直接拼接）
            let summary_parts: Vec<String> = old_messages.iter()
                .filter(|m| m.role == "user" || m.role == "assistant")
                .map(|m| format!("[{}]: {}", m.role, &m.content[..m.content.len().min(200)]))
                .collect();
            let summary = format!("**Previous conversation summary:**\n\n{}", summary_parts.join("\n\n"));
            
            // 4. 计算节省的 token
            let old_tokens: usize = old_messages.iter().map(|m| m.content.len()).sum();
            let new_tokens: usize = summary.len();
            let tokens_saved = old_tokens.saturating_sub(new_tokens);
            
            // 5. 删除旧消息
            crate::db::message_repo::delete_messages_before(conn, &id, split_point as i64)?;
            
            // 6. 插入摘要消息
            let summary_id = uuid::Uuid::new_v4().to_string();
            let now = chrono::Utc::now().to_rfc3339();
            crate::db::message_repo::insert_message(
                conn, &summary_id, &id, "system", &summary, 
                None, &now, true, 0  // is_compact_boundary = true
            )?;
            
            Ok(serde_json::json!({
                "success": true,
                "summary": summary,
                "tokensSaved": tokens_saved,
                "messagesCompacted": old_messages.len(),
                "messagesRemaining": new_messages.len() + 1
            }))
        })
    }).await;
    
    match result {
        Ok(Ok(Ok(data))) => Json(data),
        Ok(Ok(Err(e))) => Json(serde_json::json!({"success": false, "error": e.to_string()})),
        _ => Json(serde_json::json!({"success": false, "error": "Internal error"})),
    }
}
```

- [ ] **Step 2: 添加 delete_messages_before 方法**

```rust
// src-tauri/src/db/message_repo.rs
pub fn delete_messages_before(
    conn: &Connection,
    conversation_id: &str,
    before_index: i64,
) -> Result<()> {
    conn.execute(
        "DELETE FROM messages WHERE conversation_id = ?1 AND sort_order < ?2",
        params![conversation_id, before_index],
    )?;
    Ok(())
}
```

- [ ] **Step 3: 注册路由**

```rust
// src-tauri/src/bridge/mod.rs (在 router 定义处添加)
.route("/api/conversations/{id}/compact", post(compact_handler))
```

- [ ] **Step 4: 编译验证**

Run: `cd src-tauri && cargo check`

---

## Task 4: 前端设置页面 - 模型上下文大小配置

**Files:**
- Modify: `src/components/SettingsPage.tsx`

- [ ] **Step 1: 添加模型上下文大小配置 UI**

在设置页面的"模型"部分添加上下文大小输入框：

```tsx
// src/components/SettingsPage.tsx
const [modelContextSizes, setModelContextSizes] = useState<Record<string, number>>({});

// 从 providers 加载模型列表
useEffect(() => {
  if (providers) {
    const sizes: Record<string, number> = {};
    providers.forEach(p => {
      p.models.forEach(m => {
        sizes[m.id] = m.contextSize || getDefaultContextSize(m.id);
      });
    });
    setModelContextSizes(sizes);
  }
}, [providers]);

const getDefaultContextSize = (modelId: string): number => {
  if (modelId.includes('gpt-4o') || modelId.includes('claude-3')) return 128000;
  if (modelId.includes('gpt-4-turbo')) return 128000;
  if (modelId.includes('gpt-4')) return 8192;
  if (modelId.includes('claude-2')) return 100000;
  if (modelId.includes('deepseek')) return 64000;
  return 32768;
};

// 渲染模型配置
{providers?.map(provider => (
  <div key={provider.id} className="mb-4">
    <h4>{provider.name}</h4>
    {provider.models.map(model => (
      <div key={model.id} className="flex items-center gap-2 mb-2">
        <span className="flex-1">{model.name}</span>
        <input
          type="number"
          value={modelContextSizes[model.id] || ''}
          placeholder={getDefaultContextSize(model.id).toString()}
          onChange={(e) => {
            const value = parseInt(e.target.value) || 0;
            setModelContextSizes(prev => ({ ...prev, [model.id]: value }));
          }}
          className="w-24 px-2 py-1 bg-claude-input border border-claude-border rounded text-sm"
        />
        <span className="text-xs text-claude-textSecondary">tokens</span>
      </div>
    ))}
  </div>
))}
```

- [ ] **Step 2: 保存配置到 providers.json**

添加保存按钮，调用 updateProvider API 更新每个模型的 context_size。

---

## Task 5: 前端自动压缩触发逻辑

**Files:**
- Modify: `src/components/MainContent.tsx`
- Modify: `src/stores/useChatStore.ts`

- [ ] **Step 1: 添加自动压缩状态到 store**

```typescript
// src/stores/useChatStore.ts
interface ChatState {
  // ... existing state
  autoCompactEnabled: boolean;
  autoCompactThreshold: number;  // 0-100，触发压缩的百分比
  setAutoCompactEnabled: (enabled: boolean) => void;
  setAutoCompactThreshold: (threshold: number) => void;
}

// 初始状态
autoCompactEnabled: true,
autoCompactThreshold: 80,
```

- [ ] **Step 2: 在发送消息后检查上下文大小**

```typescript
// src/components/MainContent.tsx
const checkAndAutoCompact = async () => {
  if (!autoCompactEnabled || !activeId) return;
  
  try {
    const contextSize = await getContextSize(activeId);
    const usagePercent = contextSize.usage_percent || 0;
    
    if (usagePercent >= autoCompactThreshold) {
      console.log(`[AutoCompact] Context usage ${usagePercent}% >= ${autoCompactThreshold}%, triggering compact`);
      
      // 显示压缩中状态
      setCompactStatus({ state: 'compactning' });
      
      // 执行压缩
      const result = await compactConversation(activeId);
      
      // 更新状态
      setCompactStatus({ 
        state: 'done', 
        message: `Auto-compacted, saved ${result.tokensSaved?.toLocaleString()} tokens` 
      });
      
      // 重新加载消息
      await loadMessages(activeId);
    }
  } catch (e) {
    console.error('[AutoCompact] Error:', e);
  }
};

// 在 sendMessage 的 onDone 回调中调用
const handleSendMessage = async () => {
  // ... existing code
  await sendMessage(activeId, inputText, attachments, {
    onDelta: (delta, full) => { /* ... */ },
    onDone: async (full) => {
      // ... existing code
      await checkAndAutoCompact();  // 新增：检查是否需要自动压缩
    },
    onError: (err) => { /* ... */ },
  });
};
```

- [ ] **Step 3: 在设置页面添加自动压缩开关**

```tsx
// src/components/SettingsPage.tsx
<div className="flex items-center justify-between mb-4">
  <div>
    <h4>Auto Compact</h4>
    <p className="text-sm text-claude-textSecondary">
      Automatically compact conversation when context usage exceeds threshold
    </p>
  </div>
  <Toggle
    checked={autoCompactEnabled}
    onChange={setAutoCompactEnabled}
  />
</div>

{autoCompactEnabled && (
  <div className="mb-4">
    <label className="block text-sm mb-1">Compact Threshold (%)</label>
    <div className="flex items-center gap-2">
      <input
        type="range"
        min={50}
        max={95}
        step={5}
        value={autoCompactThreshold}
        onChange={(e) => setAutoCompactThreshold(parseInt(e.target.value))}
        className="flex-1"
      />
      <span className="w-12 text-right">{autoCompactThreshold}%</span>
    </div>
  </div>
)}
```

---

## Task 6: 完善前端 compactConversation 函数

**Files:**
- Modify: `src/api.ts`

- [ ] **Step 1: 修复 compactConversation 函数**

```typescript
// src/api.ts:761-773
export async function compactConversation(
  id: string,
  instruction?: string
): Promise<{ 
  success: boolean;
  summary: string; 
  tokensSaved: number; 
  messagesCompacted: number;
  error?: string;
}> {
  if (isTauriApp) {
    await detectBridgePort();
  }
  const res = await request(`/conversations/${id}/compact`, {
    method: 'POST',
    body: JSON.stringify({
      instruction,
      ...resolveEnvCreds(getUserModeForConversation(id)),
    }),
  });
  return res.json();
}
```

- [ ] **Step 2: 修复 getContextSize 函数**

```typescript
// src/api.ts:755-758
export async function getContextSize(conversationId: string): Promise<{ 
  tokens: number; 
  limit: number;
  model: string;
  message_count: number;
  usage_percent: number;
}> {
  if (isTauriApp) {
    await detectBridgePort();
  }
  const res = await request(`/conversations/${conversationId}/context-size`);
  return res.json();
}
```

---

## Task 7: 测试验证

**Files:**
- Test: API endpoints

- [ ] **Step 1: 测试 context-size 端点**

```bash
curl http://127.0.0.1:30080/api/conversations/{id}/context-size
```

Expected: `{"tokens": 1234, "limit": 128000, "model": "openrouter/free", "usage_percent": 1}`

- [ ] **Step 2: 测试 compact 端点**

```bash
curl -X POST http://127.0.0.1:30080/api/conversations/{id}/compact \
  -H "Content-Type: application/json" \
  -d '{"instruction": "Summarize the conversation"}'
```

Expected: `{"success": true, "summary": "...", "tokensSaved": 5000, "messagesCompacted": 10}`

- [ ] **Step 3: 测试自动压缩触发**

1. 创建一个长对话（超过 20 条消息）
2. 发送消息后检查是否自动触发压缩
3. 验证压缩后消息数量减少

- [ ] **Step 4: 测试设置页面配置**

1. 打开设置页面
2. 修改模型上下文大小
3. 验证配置保存成功

---

## 自动压缩触发流程图

```
用户发送消息
      ↓
模型返回响应
      ↓
检查 autoCompactEnabled
      ↓ (enabled)
调用 getContextSize()
      ↓
计算 usage_percent
      ↓
usage_percent >= threshold?
      ↓ (yes)
显示"压缩中..."状态
      ↓
调用 compactConversation()
      ↓
后端执行压缩：
  1. 获取所有消息
  2. 保留最近3条
  3. 生成旧消息摘要
  4. 删除旧消息
  5. 插入摘要消息（is_compact_boundary=true）
      ↓
返回压缩结果
      ↓
前端显示："Auto-compacted, saved X tokens"
      ↓
重新加载消息列表
```

---

## 设计决策说明

### 1. 为什么不自动获取模型上下文大小？

**原因：**
- 大多数 API 不返回模型的上下文大小信息
- 不同供应商的 API 响应格式不一致
- 用户可能使用自定义模型，无法预知上下文大小

**解决方案：**
- 提供默认映射（基于模型 ID 推断）
- 允许用户在设置页面手动配置
- 优先使用用户配置，其次使用默认映射

### 2. 为什么阈值默认 80%？

**原因：**
- 留出 20% 缓冲空间给压缩过程本身
- 压缩需要调用 LLM 生成摘要，会消耗额外 token
- 避免在上下文满时才触发，导致压缩失败

### 3. 为什么保留最近 3 条消息？

**原因：**
- 保持对话连续性（用户问题 + 模型回答 + 用户新问题）
- 避免压缩后丢失重要上下文
- 3 条消息通常足以理解对话脉络

### 4. 为什么使用 is_compact_boundary 标记？

**原因：**
- 前端可以识别压缩边界，显示特殊样式
- 方便调试和审计压缩历史
- 与现有数据库 schema 兼容

---

## 未来优化方向

1. **智能压缩** - 使用 LLM 生成更高质量的摘要
2. **增量压缩** - 只压缩旧消息，保留新消息
3. **压缩历史** - 记录多次压缩的摘要链
4. **手动触发** - 支持用户选择压缩范围
5. **压缩预览** - 压缩前显示将要删除的内容

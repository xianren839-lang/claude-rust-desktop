# Task 1: 扩展 ModelConfig 支持 context_size

## 目标
在 ModelConfig 结构体中添加 context_size 字段，用于存储模型的上下文大小（token 数）。

## 文件
- Modify: F:\Projects\claude-code-rust\src-tauri\src\native_engine\provider_manager.rs:25-32

## 当前代码
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelConfig {
    pub id: String,
    pub name: String,
    pub enabled: bool,
    pub max_tokens: Option<u32>,
    pub supports_vision: bool,
    pub supports_web_search: bool,
}
```

## 需要修改为
```rust
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

## 额外要求
1. 添加一个辅助函数 get_default_context_size，根据模型 ID 返回默认上下文大小
2. 确保所有使用 ModelConfig 的地方都能正常编译

## 辅助函数
```rust
pub fn get_default_context_size(model_id: &str) -> u32 {
    match model_id {
        id if id.contains("gpt-4o") || id.contains("claude-3.5") || id.contains("claude-sonnet-4") => 200_000,
        id if id.contains("gpt-4-turbo") || id.contains("claude-3") => 128_000,
        id if id.contains("gpt-4") => 8_192,
        id if id.contains("gpt-3.5") => 16_384,
        id if id.contains("claude-2") => 100_000,
        id if id.contains("deepseek") => 64_000,
        id if id.contains("qwen") || id.contains("qwq") => 128_000,
        id if id.contains("gemini") => 1_000_000,
        _ => 32_768,
    }
}
```

## 验证
运行 cargo check 确保编译通过

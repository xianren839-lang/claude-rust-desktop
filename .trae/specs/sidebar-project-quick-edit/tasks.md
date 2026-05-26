# Tasks

- [x] Task 1: 修复后端 ProjectUpdateRequest 支持 workspace_path
  - [x] 在 `bridge/mod.rs` 的 `ProjectUpdateRequest` 结构体中添加 `workspace_path: Option<String>` 字段
  - [x] 在 `project_update` 处理函数中将 `workspace_path` 传递给 `project_repo::update_project`

- [x] Task 2: 修复前端 updateProject 类型签名
  - [x] 修改 `api.ts` 中 `updateProject` 函数的 `data` 参数类型，加入 `'workspace_path'`

- [x] Task 3: 统一侧边栏 Project 接口
  - [x] 删除 `Sidebar.tsx` 中局部定义的 `Project` 接口
  - [x] 从 `api.ts` 导入完整版 `Project` 接口

- [x] Task 4: 侧边栏项目卡片增加编辑入口和 Popover
  - [x] 在项目卡片 hover 时显示编辑图标（铅笔图标）
  - [x] 点击编辑图标弹出 Popover，包含：项目名称输入框、项目描述文本域、工作区路径选择器
  - [x] 工作区路径选择器调用 `tauriAPI.selectDirectory()`
  - [x] 保存按钮调用 `updateProject` API 并刷新项目列表
  - [x] 取消按钮和点击外部关闭 Popover
  - [x] Popover 样式与现有 UI 风格一致

# Task Dependencies
- Task 4 depends on Task 1, Task 2, Task 3

# 侧边栏项目快捷编辑功能 Spec

## Why
当前侧边栏项目卡片仅展示项目名称和工作区路径，无法在侧边栏内直接修改项目的工作区或添加/编辑项目描述。用户必须跳转到 ProjectsPage 才能编辑，操作路径过长。

## What Changes
- 在侧边栏项目卡片上增加右键菜单（或 hover 操作菜单），提供「编辑项目」入口
- 点击后弹出轻量级 Popover/Modal，支持修改：项目名称、项目描述、工作区路径
- 工作区路径通过 Tauri 文件夹选择器选取
- 修复后端 `ProjectUpdateRequest` 缺少 `workspace_path` 字段的问题
- 修复前端 `updateProject` 类型签名不包含 `workspace_path` 的问题
- 侧边栏 `Project` 接口与 `api.ts` 中的完整版统一

## Impact
- Affected code: `Sidebar.tsx`、`api.ts`、`bridge/mod.rs`（ProjectUpdateRequest）
- Affected specs: 无

## ADDED Requirements

### Requirement: 侧边栏项目快捷编辑
系统 SHALL 在侧边栏项目卡片上提供快捷编辑入口，允许用户在不离开当前页面的情况下修改项目属性。

#### Scenario: 打开编辑 Popover
- **WHEN** 用户点击项目卡片上的编辑图标（或右键菜单选择「编辑」）
- **THEN** 弹出 Popover，显示当前项目的名称、描述、工作区路径，均可编辑

#### Scenario: 修改工作区路径
- **WHEN** 用户在编辑 Popover 中点击工作区路径旁的「选择文件夹」按钮
- **THEN** 调用 Tauri 文件夹选择器，用户选择后路径更新到输入框中

#### Scenario: 保存编辑
- **WHEN** 用户修改完项目信息后点击「保存」
- **THEN** 调用 `updateProject` API 更新项目，侧边栏项目列表即时刷新

#### Scenario: 取消编辑
- **WHEN** 用户点击「取消」或点击 Popover 外部区域
- **THEN** 关闭 Popover，不做任何修改

### Requirement: 后端 ProjectUpdateRequest 支持 workspace_path
系统 SHALL 在后端 `ProjectUpdateRequest` 结构体中增加 `workspace_path` 字段，使 PATCH `/api/projects/{id}` 接口支持更新工作区路径。

#### Scenario: 通过 API 更新工作区路径
- **WHEN** 前端发送 PATCH 请求包含 `workspace_path` 字段
- **THEN** 后端正确更新项目的工作区路径

### Requirement: 前端 updateProject 类型签名包含 workspace_path
系统 SHALL 修改前端 `updateProject` 函数的类型签名，使其包含 `workspace_path` 字段。

## MODIFIED Requirements

### Requirement: 侧边栏 Project 接口统一
侧边栏 `Sidebar.tsx` 中局部定义的 `Project` 接口 SHALL 替换为从 `api.ts` 导入的完整版 `Project` 接口，确保类型一致性。

## REMOVED Requirements
无

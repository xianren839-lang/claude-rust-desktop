# 项目页面重构计划

## 目标
将项目详情页中的"说明(Instructions)"和"文件(Files)/工作区"区域迁移到"创建个人项目"页面，删除项目详情页的聊天窗口，创建项目后直接跳转到主聊天界面。

## 当前结构分析

### ProjectsPage.tsx 三大视图
1. **项目列表页** (`/projects`): 展示所有项目卡片，点击卡片进入详情页
2. **创建项目页** (`isCreating = true`): 标题"创建个人项目"，只有项目名称和描述输入框
3. **项目详情页** (`currentProject != null`): 包含聊天输入框、会话列表、说明编辑、文件/工作区管理

### Sidebar.tsx 项目导航
- 侧边栏 Projects 列表点击项目 → 导航到 `/projects` 并设置 `currentProject`
- 实际上所有项目相关路由都是 `/projects`，通过 `currentProject` state 区分列表/详情

---

## 修改方案

### 1. 创建项目页 (`isCreating`) 增强

**在现有输入框下方添加：**

#### A. 项目说明 (Instructions) 区域
- 添加 `createInstructionsText` state
- 添加可折叠/可编辑的说明文本区域
- 使用与详情页相同的编辑弹窗组件

#### B. 工作区文件夹选择区域
- 添加 `createWorkspacePath` state
- 添加文件夹选择按钮（与详情页相同的 UI）
- 显示已选路径
- 添加"清除选择"按钮

**创建项目按钮逻辑修改：**
```typescript
const handleCreate = async () => {
  const name = projectName.trim() || 'Untitled Project';
  try {
    const project = await createProject(name, projectDescription.trim(), createWorkspacePath);
    // 如果有说明，更新项目说明
    if (createInstructionsText.trim()) {
      await updateProject(project.id, { instructions: createInstructionsText.trim() });
    }
    setIsCreating(false);
    setProjectName('');
    setProjectDescription('');
    setCreateInstructionsText('');
    setCreateWorkspacePath('');
    
    // 创建会话并跳转到主聊天
    const defaultModel = localStorage.getItem('default_model') || 'claude-sonnet-4-6';
    const conv = await createProjectConversation(
      project.id, 
      name, 
      defaultModel, 
      createWorkspacePath || undefined
    );
    navigate(`/chat/${conv.id}`);
    loadProjects();
  } catch (_) { }
};
```

### 2. 项目详情页 (`currentProject`) 简化

**删除以下部分：**
- 聊天输入框区域（textarea + 发送按钮 + ModelSelector）
- 会话列表区域
- 已保留：说明展示（只读或编辑）、文件/工作区展示

**保留以下部分：**
- 项目名称和描述展示
- 说明(Instructions) 编辑区域（点击可编辑）
- 文件/工作区区域（选择文件夹、展示已选路径）
- "新聊天"按钮（跳转到主界面创建新会话）

### 3. 项目列表页项目卡片点击行为修改

**当前行为：** 点击项目卡片 → `loadProject(id)` → 显示项目详情页

**修改后行为：** 点击项目卡片 → 直接创建新会话并跳转到主聊天界面
```typescript
const handleProjectCardClick = async (project: Project) => {
  const defaultModel = localStorage.getItem('default_model') || 'claude-sonnet-4-6';
  const conv = await createProjectConversation(
    project.id,
    project.name,
    defaultModel,
    project.workspace_path
  );
  navigate(`/chat/${conv.id}`);
};
```

### 4. Sidebar 项目列表点击行为修改

**当前行为：** `navigate(/projects/${project.id})` → 但 App.tsx 没有 `/projects/:id` 路由，实际会到 `/projects`

**修改后行为：** 与项目卡片点击相同，直接创建会话并跳转到 `/chat/:id`

### 5. 删除/清理无用代码

- 删除 `handleChatSubmit` 函数（项目详情页不再发送消息）
- 删除 `handleNewChat` 函数（或保留但修改行为）
- 删除 `message` state 和相关 textarea 逻辑
- 删除 `currentModelString` 和 `handleModelChange`（如果不再使用）
- 删除会话列表渲染代码
- 删除 `showPlusMenu`, `showSkillsSubmenu`, `enabledSkills`, `selectedSkill` 等聊天相关 state（如果不再使用）

---

## 文件修改清单

### 1. `src/components/ProjectsPage.tsx` (主要修改)
- [ ] 添加 `createInstructionsText` 和 `createWorkspacePath` state
- [ ] 在创建项目页面添加说明编辑区域
- [ ] 在创建项目页面添加工作区文件夹选择区域
- [ ] 修改 `handleCreate` 逻辑：保存说明、创建工作区、创建会话、跳转主聊天
- [ ] 修改项目卡片 `onClick`：直接创建会话并跳转
- [ ] 删除项目详情页的聊天输入框和会话列表
- [ ] 保留项目详情页的说明和文件区域
- [ ] 清理无用 state 和函数

### 2. `src/components/Sidebar.tsx` (小修改)
- [ ] 修改项目列表点击行为：直接创建会话并跳转 `/chat/:id`

### 3. `src/App.tsx` (无需修改)
- 路由结构保持不变

---

## UI 设计

### 创建项目页新布局
```
+----------------------------------+
| 创建个人项目                      |
+----------------------------------+
| 项目名称 [________________]       |
| 项目目标 [________________]       |
|                                  |
| +------------------------------+ |
| | 项目说明                      | |
| | [点击添加项目说明...]          | |
| +------------------------------+ |
|                                  |
| +------------------------------+ |
| | 工作区文件夹                   | |
| | [选择文件夹] 或 已选: /path    | |
| +------------------------------+ |
|                                  |
|          [取消] [创建项目]       |
+----------------------------------+
```

### 项目详情页简化后布局
```
+----------------------------------+
| ← 所有项目                        |
| 项目名称                          |
| 项目描述                          |
+----------------------------------+
| +------------------------------+ |
| | 项目说明                      | |
| | [说明内容...]  [编辑]         | |
| +------------------------------+ |
| +------------------------------+ |
| | 工作区文件夹                   | |
| | /path/to/workspace  [更换]    | |
| +------------------------------+ |
+----------------------------------+
```

---

## 注意事项

1. **工作区路径传递**: 创建项目时 `workspace_path` 需要正确传递到后端，会话创建时也要传递
2. **说明保存**: 创建项目时先创建项目，再更新说明（因为 `createProject` API 不支持 instructions 字段）
3. **侧边栏项目列表**: 点击项目后需要刷新侧边栏以显示新创建的会话
4. **向后兼容**: 现有项目数据不受影响，只是 UI 交互方式改变

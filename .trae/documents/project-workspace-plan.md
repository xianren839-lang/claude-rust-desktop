# Project 工作区功能完善计划

## 需求概述
完善左边侧边栏的 Project 功能：
1. 点击"创建项目"按钮后，弹出文件夹资源选择框
2. 选择文件夹确定后，创建一个模型默认的工作区
3. 创建一个新的聊天会话窗口，该会话绑定到这个工作区

## 现状分析

### 已有基础设施
1. **Tauri 文件夹选择 API**: `tauriAPI.selectDirectory()` 已存在，调用 `select_directory` command
2. **Project 数据模型**: 
   - 前端: `Project` 接口已有 `workspace_path` 字段
   - 后端: `Project` struct 在 `src-tauri/src/project/mod.rs`
3. **Project API**: `createProject`, `getProjects`, `updateProject` 等已存在
4. **Project 页面**: `ProjectsPage.tsx` 已有完整的项目列表和详情 UI
5. **Sidebar**: 已有 Projects 导航入口和最近对话列表

### 现有问题
1. `createProject` 只接受 `name` 和 `description`，没有 `workspace_path` 参数
2. ProjectsPage 的创建流程是手动输入名称，没有选择文件夹的步骤
3. 创建项目后不会自动创建绑定的聊天会话
4. Sidebar 中没有显示 Project 列表
5. 后端 `Project` 和 `ProjectMetadata` 没有 `workspace_path` 字段

## 实施步骤

### 阶段一: 后端数据模型扩展

#### 1.1 扩展 Rust Project 模型
**文件**: `src-tauri/src/project/mod.rs`

在 `Project` 和 `ProjectMetadata` struct 中添加 `workspace_path` 字段：
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub instructions: Option<String>,
    pub workspace_path: Option<String>,  // 新增
    pub created_at: String,
    pub updated_at: String,
    pub is_archived: bool,
    pub file_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectMetadata {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub instructions: Option<String>,
    pub workspace_path: Option<String>,  // 新增
    pub created_at: String,
    pub updated_at: String,
    pub is_archived: bool,
    pub files: Vec<ProjectFile>,
}
```

#### 1.2 更新 create_project 方法
修改 `create_project` 方法，接受 `workspace_path` 参数：
```rust
pub async fn create_project(
    &self, 
    name: &str, 
    description: Option<&str>,
    workspace_path: Option<&str>,  // 新增
) -> Result<Project> {
    // ... 创建逻辑，保存 workspace_path
}
```

### 阶段二: Bridge API 扩展

#### 2.1 扩展 Bridge Server 的 Project API
**文件**: `src-tauri/src/bridge/mod.rs` (或相关路由文件)

- 修改 `POST /api/projects` 接口，接受 `workspace_path` 字段
- 确保 `GET /api/projects` 和 `GET /api/projects/:id` 返回 `workspace_path`
- 修改 `POST /api/projects/:id/conversations` 接口，创建会话时绑定 `workspace_path`

#### 2.2 确保 Conversation 模型支持 workspace_path
检查 `Conversation` 表/模型是否已有 `workspace_path` 字段，如果没有需要添加。

### 阶段三: 前端 API 层扩展

#### 3.1 扩展前端 Project 接口
**文件**: `src/api.ts`

```typescript
export async function createProject(
  name: string, 
  description?: string,
  workspacePath?: string  // 新增
): Promise<Project> {
  const res = await request('/projects', {
    method: 'POST',
    body: JSON.stringify({ 
      name, 
      description: description || '',
      workspace_path: workspacePath  // 新增
    }),
  });
  return res.json();
}
```

#### 3.2 扩展 createProjectConversation
确保创建项目会话时可以传递 workspace_path：
```typescript
export async function createProjectConversation(
  projectId: string, 
  title?: string, 
  model?: string,
  workspacePath?: string  // 新增
) {
  const res = await request(`/projects/${projectId}/conversations`, {
    method: 'POST',
    body: JSON.stringify({ title, model, workspace_path: workspacePath }),
  });
  return res.json();
}
```

### 阶段四: ProjectsPage 改造

#### 4.1 修改创建项目流程
**文件**: `src/components/ProjectsPage.tsx`

将原有的创建流程（输入名称+描述）改造为：
1. 点击"创建项目"按钮
2. 调用 `tauriAPI.selectDirectory()` 弹出文件夹选择对话框
3. 用户选择文件夹后，用文件夹名称作为项目名，文件夹路径作为 `workspace_path`
4. 调用 `createProject(name, description, workspacePath)` 创建项目
5. 创建成功后，自动调用 `createProjectConversation` 创建绑定的聊天会话
6. 自动导航到新创建的聊天会话

#### 4.2 实现文件夹选择逻辑
```typescript
const handleCreateProjectWithFolder = async () => {
  try {
    // 1. 弹出文件夹选择对话框
    const selectedPath = await tauriAPI.selectDirectory();
    if (!selectedPath) return; // 用户取消

    // 2. 从路径提取文件夹名称作为项目名
    const folderName = selectedPath.split(/[\\/]/).pop() || 'Untitled Project';

    // 3. 创建项目，绑定工作区路径
    const project = await createProject(folderName, '', selectedPath);

    // 4. 创建绑定的聊天会话
    const defaultModel = localStorage.getItem('default_model') || 'claude-sonnet-4-6';
    const conv = await createProjectConversation(project.id, folderName, defaultModel, selectedPath);

    // 5. 导航到聊天会话
    navigate(`/chat/${conv.id}`);
    
    // 6. 刷新项目列表
    loadProjects();
  } catch (err) {
    console.error('Failed to create project with folder:', err);
    alert('创建项目失败: ' + (err instanceof Error ? err.message : '未知错误'));
  }
};
```

#### 4.3 修改"创建项目"按钮
将项目列表页的"创建项目"按钮的 `onClick` 从 `setIsCreating(true)` 改为 `handleCreateProjectWithFolder`。

### 阶段五: Sidebar 集成 Project 列表

#### 5.1 在 Sidebar 中添加 Project 列表区域
**文件**: `src/components/Sidebar.tsx`

在 Recents 区域上方或下方添加 Projects 列表：
1. 添加 `projects` state
2. 添加 `loadProjects` 函数
3. 在导航区域下方渲染 Project 列表（类似 Recents 的样式）
4. 点击 Project 项时，导航到该 Project 的详情页或绑定的聊天会话

#### 5.2 添加 Project 到 Recents 的显示
在 Recents 列表中，如果聊天会话属于某个 Project，显示 `project_name`（已有 `chat.project_name` 字段支持）。

### 阶段六: 工作区路径持久化

#### 6.1 确保 workspace_path 在会话中持久化
当通过 Project 创建会话时，需要确保：
1. 后端数据库中 conversation 表有 `workspace_path` 字段
2. 创建会话时将 Project 的 `workspace_path` 写入 conversation
3. 聊天界面可以通过 API 获取到 `workspace_path`（已有 `ChatHeader` 中的"打开工作区文件夹"功能依赖此字段）

### 阶段七: 边界情况处理

1. **用户取消选择文件夹**: 不做任何操作
2. **选择的文件夹已被其他项目使用**: 可以允许（多个项目可以指向同一文件夹）或提示警告
3. **创建项目失败**: 显示错误提示，不创建会话
4. **创建会话失败**: 项目已创建，但会话未创建，显示错误提示
5. **非 Tauri 环境**: 回退到手动输入路径或禁用此功能
6. **文件夹不存在**: 后端验证路径有效性

## 文件修改清单

### 后端 (Rust)
1. `src-tauri/src/project/mod.rs` - 扩展 Project 和 ProjectMetadata 模型
2. `src-tauri/src/bridge/mod.rs` - 扩展 Project API 路由
3. `src-tauri/src/db/conversation_repo.rs` - 确保 conversation 支持 workspace_path

### 前端 (TypeScript/React)
1. `src/api.ts` - 扩展 createProject 和 createProjectConversation
2. `src/components/ProjectsPage.tsx` - 改造创建流程，添加文件夹选择
3. `src/components/Sidebar.tsx` - 添加 Project 列表展示
4. `src/utils/tauriAPI.ts` - 确认 selectDirectory API 可用（已存在）

## 验证清单

- [ ] 点击"创建项目"按钮弹出文件夹选择对话框
- [ ] 选择文件夹后正确创建 Project，workspace_path 正确保存
- [ ] 自动创建绑定 Project 的聊天会话
- [ ] 自动导航到新创建的聊天会话
- [ ] Sidebar 中显示 Project 列表
- [ ] 聊天会话中可以看到绑定的 Project 名称
- [ ] 点击"打开工作区文件夹"按钮可以打开对应的文件夹
- [ ] 非 Tauri 环境下功能正常降级

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Brain,
  Users,
  Zap,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  Split,
  GitBranch,
  Activity,
  Target,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Play,
  Pause,
  StopCircle
} from 'lucide-react';

export interface SwarmAgent {
  id: string;
  name: string;
  role: string;
  state: 'idle' | 'planning' | 'executing' | 'synthesizing' | 'completed' | 'failed';
  progress: number;
  assignedTask?: string;
  color: string;
  icon: string;
  durationMs: number;
  tokensUsed: number;
}

export interface SubTask {
  id: string;
  description: string;
  agentId?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  progress: number;
  dependencies: string[];
  output?: string;
}

export interface SwarmSession {
  id: string;
  task: string;
  complexity: number;
  agents: SwarmAgent[];
  subTasks: SubTask[];
  status: 'analyzing' | 'planning' | 'running' | 'paused' | 'completed' | 'failed';
  startTime: number;
  endTime?: number;
  totalDuration: number;
}

const AGENT_ROLES = [
  { role: '规划师', icon: '🎯', color: '#3B82F6' },
  { role: '研究员', icon: '🔍', color: '#8B5CF6' },
  { role: '开发者', icon: '💻', color: '#10B981' },
  { role: '审核员', icon: '🔎', color: '#F59E0B' },
  { role: '写作员', icon: '✍️', color: '#EC4899' },
  { role: '架构师', icon: '🏗️', color: '#06B6D4' },
  { role: '分析师', icon: '📊', color: '#F97316' },
  { role: '设计师', icon: '🎨', color: '#A855F7' },
];

const COMPLEXITY_THRESHOLD = 7;

function generateAgentId(role: string, index: number): string {
  return `${role.toLowerCase()}_${index}`;
}

function analyzeComplexity(task: string): number {
  let score = 0;
  const length = task.length;
  if (length > 100) score += 2;
  else if (length > 50) score += 1;

  const complexKeywords = ['implement', 'build', 'create', 'design', 'architecture', 'refactor', 'optimize', 'integrate', 'deploy', 'migrate', 'system', 'pipeline', 'workflow', 'automation'];
  const lowerTask = task.toLowerCase();
  for (const keyword of complexKeywords) {
    if (lowerTask.includes(keyword)) score += 1;
  }

  const questionMarks = (task.match(/\?/g) || []).length;
  score += Math.min(questionMarks, 3);

  const andCount = (task.match(/\band\b/gi) || []).length;
  const plusCount = (task.match(/\+/g) || []).length;
  score += Math.min(andCount + plusCount, 4);

  return Math.min(score, 10);
}

function splitTask(task: string, complexity: number): SubTask[] {
  const subTasks: SubTask[] = [];
  const baseId = `task_${Date.now()}`;

  subTasks.push({
    id: `${baseId}_plan`,
    description: '分析需求并制定执行计划',
    status: 'pending' as const,
    progress: 0,
    dependencies: [],
  });

  if (complexity >= 5) {
    subTasks.push({
      id: `${baseId}_research`,
      description: '研究并收集任务相关信息',
      status: 'pending' as const,
      progress: 0,
      dependencies: [`${baseId}_plan`],
    });
  }

  subTasks.push({
    id: `${baseId}_implement`,
    description: '根据计划实施核心解决方案',
    status: 'pending' as const,
    progress: 0,
    dependencies: complexity >= 5 ? [`${baseId}_plan`, `${baseId}_research`] : [`${baseId}_plan`],
  });

  if (complexity >= 6) {
    subTasks.push({
      id: `${baseId}_test`,
      description: '测试和验证实施结果',
      status: 'pending' as const,
      progress: 0,
      dependencies: [`${baseId}_implement`],
    });
  }

  subTasks.push({
    id: `${baseId}_review`,
    description: '审查并完善最终输出',
    status: 'pending' as const,
    progress: 0,
    dependencies: complexity >= 6 ? [`${baseId}_test`] : [`${baseId}_implement`],
  });

  if (complexity >= 8) {
    subTasks.push({
      id: `${baseId}_optimize`,
      description: '优化性能和边界情况',
      status: 'pending' as const,
      progress: 0,
      dependencies: [`${baseId}_review`],
    });
  }

  return subTasks;
}

function assignAgents(subTasks: SubTask[], complexity: number): SwarmAgent[] {
  const agentCount = Math.min(Math.max(complexity, 3), AGENT_ROLES.length);
  const agents: SwarmAgent[] = [];

  for (let i = 0; i < agentCount; i++) {
    const roleConfig = AGENT_ROLES[i % AGENT_ROLES.length];
    agents.push({
      id: generateAgentId(roleConfig.role, i),
      name: `${roleConfig.role} #${i + 1}`,
      role: roleConfig.role,
      state: 'idle' as const,
      progress: 0,
      color: roleConfig.color,
      icon: roleConfig.icon,
      durationMs: 0,
      tokensUsed: 0,
    });
  }

  for (let i = 0; i < subTasks.length; i++) {
    const agentIndex = i % agentCount;
    subTasks[i].agentId = agents[agentIndex].id;
  }

  return agents;
}

const AgentNode: React.FC<{ agent: SwarmAgent; isExpanded: boolean }> = ({ agent, isExpanded }) => {
  const stateColors: Record<string, string> = {
    idle: 'bg-gray-500',
    planning: 'bg-blue-500',
    executing: 'bg-green-500',
    synthesizing: 'bg-purple-500',
    completed: 'bg-emerald-500',
    failed: 'bg-red-500',
  };

  const stateLabels: Record<string, string> = {
    idle: '空闲',
    planning: '规划中',
    executing: '执行中',
    synthesizing: '整合中',
    completed: '已完成',
    failed: '失败',
  };

  return (
    <div
      className="relative rounded-xl border transition-all duration-300 overflow-hidden"
      style={{
        borderColor: `${agent.color}40`,
        backgroundColor: `${agent.color}08`,
      }}
    >
      <div className="p-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">{agent.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-medium text-claude-text truncate">
                {agent.name}
              </span>
              <span className={`w-2 h-2 rounded-full ${stateColors[agent.state]} ${agent.state === 'executing' ? 'animate-pulse' : ''}`} />
            </div>
            <div className="text-[11px] text-claude-textSecondary mt-0.5">
              {stateLabels[agent.state]}
            </div>
          </div>
        </div>

        {agent.assignedTask && (
          <div className="mt-2 px-2 py-1 rounded bg-black/10 dark:bg-white/5">
            <div className="text-[11px] text-claude-textSecondary truncate">
              {agent.assignedTask}
            </div>
          </div>
        )}

        {agent.state !== 'idle' && agent.state !== 'completed' && agent.state !== 'failed' && (
          <div className="mt-2">
            <div className="h-1 rounded-full bg-claude-border overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${agent.progress}%`, backgroundColor: agent.color }}
              />
            </div>
            <div className="text-[10px] text-claude-textSecondary mt-1 text-right">
              {Math.round(agent.progress)}%
            </div>
          </div>
        )}

        {isExpanded && (
          <div className="mt-2 pt-2 border-t border-claude-border/50">
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="text-claude-textSecondary">
                <span className="text-claude-text">耗时</span>
                <div>{agent.durationMs > 0 ? `${(agent.durationMs / 1000).toFixed(1)}秒` : '-'}</div>
              </div>
              <div className="text-claude-textSecondary">
                <span className="text-claude-text">令牌</span>
                <div>{agent.tokensUsed > 0 ? agent.tokensUsed.toLocaleString() : '-'}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const TaskNode: React.FC<{ task: SubTask; agents: SwarmAgent[] }> = ({ task, agents }) => {
  const statusIcons: Record<string, React.ReactNode> = {
    pending: <Clock size={12} className="text-gray-400" />,
    in_progress: <Loader2 size={12} className="text-blue-400 animate-spin" />,
    completed: <CheckCircle2 size={12} className="text-emerald-400" />,
    failed: <XCircle size={12} className="text-red-400" />,
  };

  const assignedAgent = task.agentId ? agents.find(a => a.id === task.agentId) : null;

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-claude-hover/50">
      {statusIcons[task.status]}
      <div className="flex-1 min-w-0">
        <div className="text-[12px] text-claude-text truncate">{task.description}</div>
        {assignedAgent && (
          <div className="text-[10px] text-claude-textSecondary mt-0.5 flex items-center gap-1">
            <span>{assignedAgent.icon}</span>
            <span>{assignedAgent.name}</span>
          </div>
        )}
      </div>
      {task.dependencies.length > 0 && (
        <div className="flex items-center gap-1">
          <GitBranch size={10} className="text-claude-textSecondary" />
          <span className="text-[10px] text-claude-textSecondary">{task.dependencies.length}</span>
        </div>
      )}
    </div>
  );
};

const SwarmVisualization: React.FC<{ agents: SwarmAgent[] }> = ({ agents }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | undefined>(undefined);
  const particlesRef = useRef<Array<{ x: number; y: number; vx: number; vy: number; targetX: number; targetY: number; color: string; life: number }>>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (rect) {
        canvas.width = rect.width;
        canvas.height = rect.height;
      }
    };
    resize();
    window.addEventListener('resize', resize);

    const activeAgents = agents.filter(a => a.state === 'executing' || a.state === 'planning' || a.state === 'synthesizing');

    particlesRef.current = activeAgents.map(agent => {
      const angle = Math.random() * Math.PI * 2;
      const radius = 30 + Math.random() * 50;
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      return {
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        targetX: cx + Math.cos(angle) * radius,
        targetY: cy + Math.sin(angle) * radius,
        color: agent.color,
        life: 1,
      };
    });

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;

      for (const p of particlesRef.current) {
        p.x += p.vx + (p.targetX - p.x) * 0.02;
        p.y += p.vy + (p.targetY - p.y) * 0.02;
        p.vx += (Math.random() - 0.5) * 0.1;
        p.vy += (Math.random() - 0.5) * 0.1;
        p.vx *= 0.95;
        p.vy *= 0.95;

        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = p.color + '80';
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(cx, cy);
        ctx.strokeStyle = p.color + '20';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(cx, cy, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#3B82F6';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy, 12, 0, Math.PI * 2);
      ctx.strokeStyle = '#3B82F640';
      ctx.lineWidth = 2;
      ctx.stroke();

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resize);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [agents]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-32 rounded-lg"
      style={{ backgroundColor: 'transparent' }}
    />
  );
};

const SwarmCollaboration: React.FC = () => {
  const [inputTask, setInputTask] = useState('');
  const [session, setSession] = useState<SwarmSession | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set());
  const [showVisualization, setShowVisualization] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const handleAnalyzeTask = useCallback(async () => {
    if (!inputTask.trim()) return;

    console.log('[Swarm] ========== Task Analysis Start ==========');
    console.log('[Swarm] Input task:', inputTask);
    setIsAnalyzing(true);
    await new Promise(resolve => setTimeout(resolve, 1000));

    const complexity = analyzeComplexity(inputTask);
    console.log('[Swarm] Complexity analysis result:', complexity);
    console.log('[Swarm] COMPLEXITY_THRESHOLD:', COMPLEXITY_THRESHOLD);
    console.log('[Swarm] Will use swarm mode:', complexity >= COMPLEXITY_THRESHOLD);
    const isComplex = complexity >= COMPLEXITY_THRESHOLD;

    const subTasks: SubTask[] = isComplex ? splitTask(inputTask, complexity) : [{
      id: `task_${Date.now()}`,
      description: inputTask,
      status: 'pending' as const,
      progress: 0,
      dependencies: [],
    }];

    console.log('[Swarm] Sub-tasks generated:', subTasks.length);
    subTasks.forEach((st, i) => {
      console.log(`[Swarm]   Sub-task [${i}]: ${st.description} (deps: ${st.dependencies.join(', ') || 'none'})`);
    });

    const agents: SwarmAgent[] = isComplex ? assignAgents(subTasks, complexity) : [{
      id: 'single_agent',
      name: '单一智能体',
      role: '通用',
      state: 'idle' as const,
      progress: 0,
      color: '#3B82F6',
      icon: '🤖',
      durationMs: 0,
      tokensUsed: 0,
    }];

    console.log('[Swarm] Agents assigned:', agents.length);
    agents.forEach((agent, i) => {
      console.log(`[Swarm]   Agent [${i}]: ${agent.name} (${agent.role}) - color: ${agent.color}`);
    });

    const newSession: SwarmSession = {
      id: `session_${Date.now()}`,
      task: inputTask,
      complexity,
      agents,
      subTasks,
      status: 'planning',
      startTime: Date.now(),
      totalDuration: 0,
    };

    console.log('[Swarm] Session created:', newSession.id);
    console.log('[Swarm] ========== Task Analysis Complete ==========');
    setSession(newSession);
    setIsAnalyzing(false);
  }, [inputTask]);

  const handleStartSwarm = useCallback(async () => {
    if (!session) return;

    setSession(prev => prev ? { ...prev, status: 'running' } : null);

    const updatedAgents = session.agents.map((agent, i) => {
      const assignedTask = session.subTasks[i]?.description;
      return { ...agent, state: 'planning' as const, assignedTask };
    });

    setSession(prev => prev ? { ...prev, agents: updatedAgents } : null);

    intervalRef.current = setInterval(() => {
      setSession(prev => {
        if (!prev || prev.status !== 'running') return prev;

        let newSubTasks = [...prev.subTasks];
        const newAgents = prev.agents.map((agent) => {
          if (agent.state === 'completed' || agent.state === 'failed') return agent;

          let newState: SwarmAgent['state'] = agent.state;
          let newProgress = agent.progress + Math.random() * 15;

          if (agent.state === 'planning' && newProgress >= 100) {
            newState = 'executing';
            newProgress = 0;
          } else if (agent.state === 'executing' && newProgress >= 100) {
            newState = 'completed';
            newProgress = 100;
          }

          const subTaskIndex = newSubTasks.findIndex(st => st.agentId === agent.id);
          if (subTaskIndex >= 0) {
            const depsMet = newSubTasks[subTaskIndex].dependencies.every(depId =>
              newSubTasks.find(st => st.id === depId)?.status === 'completed'
            );

            if (depsMet || subTaskIndex === 0) {
              if (newState === 'planning' || newState === 'executing') {
                newSubTasks = newSubTasks.map((st, idx) =>
                  idx === subTaskIndex ? { ...st, status: 'in_progress' as const, progress: newProgress } : st
                );
              } else if (newState === 'completed') {
                newSubTasks = newSubTasks.map((st, idx) =>
                  idx === subTaskIndex ? { ...st, status: 'completed' as const, progress: 100 } : st
                );
              }
            }
          }

          return {
            ...agent,
            state: newState,
            progress: Math.min(newProgress, 100),
            durationMs: agent.durationMs + 100,
            tokensUsed: agent.tokensUsed + Math.floor(Math.random() * 50),
          };
        });

        const allCompleted = newAgents.every(a => a.state === 'completed' || a.state === 'failed');
        const newStatus: SwarmSession['status'] = allCompleted ? 'completed' : prev.status;

        return {
          ...prev,
          agents: newAgents,
          subTasks: newSubTasks,
          status: newStatus,
          endTime: allCompleted ? Date.now() : undefined,
          totalDuration: allCompleted ? Date.now() - prev.startTime : prev.totalDuration,
        };
      });
    }, 200);
  }, [session]);

  const handlePauseSwarm = useCallback(() => {
    setIsPaused(prev => !prev);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = undefined;
    }
    if (!isPaused) {
      handleStartSwarm();
    }
  }, [isPaused, handleStartSwarm]);

  const handleStopSwarm = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = undefined;
    }
    setSession(prev => prev ? { ...prev, status: 'completed' as const } : null);
    setIsPaused(false);
  }, []);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const toggleAgentExpand = useCallback((agentId: string) => {
    setExpandedAgents(prev => {
      const next = new Set(prev);
      if (next.has(agentId)) next.delete(agentId);
      else next.add(agentId);
      return next;
    });
  }, []);

  const completedAgents = session?.agents.filter(a => a.state === 'completed').length || 0;
  const totalAgents = session?.agents.length || 0;
  const progressPercent = totalAgents > 0 ? (completedAgents / totalAgents) * 100 : 0;

  return (
    <div className="flex flex-col h-full bg-claude-bg">
      <div className="flex-shrink-0 p-4 border-b border-claude-border">
        <div className="flex items-center gap-2 mb-3">
          <Users size={18} className="text-[#3B82F6]" />
          <h2 className="text-[15px] font-semibold text-claude-text">智能协作</h2>
          <Sparkles size={14} className="text-[#A855F7] ml-auto" />
        </div>

        <div className="relative">
          <textarea
            value={inputTask}
            onChange={(e) => setInputTask(e.target.value)}
            placeholder="输入一个复杂任务，多个AI智能体将协作完成..."
            className="w-full px-3 py-2 text-[13px] bg-claude-input border border-claude-border rounded-lg text-claude-text placeholder:text-claude-textSecondary/50 focus:outline-none focus:border-[#3B82F6] resize-none"
            rows={3}
            disabled={!!session && session.status === 'running'}
          />
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-2">
              <Brain size={14} className="text-claude-textSecondary" />
              <span className="text-[11px] text-claude-textSecondary">
                {isAnalyzing ? '分析中...' : inputTask ? `复杂度: ${analyzeComplexity(inputTask)}/10` : '输入任务进行分析'}
              </span>
            </div>
            {!session || session.status === 'completed' || session.status === 'failed' ? (
              <button
                onClick={handleAnalyzeTask}
                disabled={!inputTask.trim() || isAnalyzing}
                className="px-3 py-1.5 text-[12px] font-medium text-white bg-[#3B82F6] hover:bg-[#2563EB] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {isAnalyzing ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                {isAnalyzing ? '分析中' : '分析规划'}
              </button>
            ) : (
              <div className="flex items-center gap-1.5">
                {session.status === 'running' && (
                  <>
                    <button
                      onClick={handlePauseSwarm}
                      className="p-1.5 text-claude-textSecondary hover:text-claude-text hover:bg-claude-hover rounded-md transition-colors"
                      title={isPaused ? '继续' : '暂停'}
                    >
                      {isPaused ? <Play size={14} /> : <Pause size={14} />}
                    </button>
                    <button
                      onClick={handleStopSwarm}
                      className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-md transition-colors"
                      title="停止"
                    >
                      <StopCircle size={14} />
                    </button>
                  </>
                )}
                {session.status === 'planning' && (
                  <button
                    onClick={handleStartSwarm}
                    className="px-3 py-1.5 text-[12px] font-medium text-white bg-[#10B981] hover:bg-[#059669] rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    <Play size={14} />
                    开始协作
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {session && (
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <Target size={14} className="text-[#3B82F6]" />
                  <span className="text-[12px] text-claude-text">复杂度</span>
                </div>
                <div className="flex items-center gap-1">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div
                      key={i}
                      className="w-2 h-2 rounded-full transition-colors"
                      style={{
                        backgroundColor: i < session.complexity ? '#3B82F6' : 'rgba(107, 114, 128, 0.2)',
                      }}
                    />
                  ))}
                </div>
                <span className="text-[12px] font-medium text-[#3B82F6]">{session.complexity}/10</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Activity size={14} className="text-claude-textSecondary" />
                <span className="text-[12px] text-claude-textSecondary">
                  {completedAgents}/{totalAgents} 智能体已完成
                </span>
              </div>
            </div>

            <div className="h-1 rounded-full bg-claude-border overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#3B82F6] to-[#10B981] transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {showVisualization && session.status === 'running' && (
              <div className="rounded-lg border border-claude-border overflow-hidden">
                <SwarmVisualization agents={session.agents} />
              </div>
            )}

            <div>
              <button
                onClick={() => setShowVisualization(prev => !prev)}
                className="flex items-center gap-1.5 text-[12px] text-claude-textSecondary hover:text-claude-text transition-colors mb-2"
              >
                {showVisualization ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                {showVisualization ? '隐藏' : '显示'} 智能体 ({totalAgents})
              </button>
              {showVisualization && (
                <div className="grid grid-cols-2 gap-2">
                  {session.agents.map(agent => (
                    <div
                      key={agent.id}
                      onClick={() => toggleAgentExpand(agent.id)}
                      className="cursor-pointer"
                    >
                      <AgentNode agent={agent} isExpanded={expandedAgents.has(agent.id)} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {session.subTasks.length > 1 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Split size={14} className="text-[#A855F7]" />
                  <span className="text-[12px] font-medium text-claude-text">任务分解 ({session.subTasks.length})</span>
                </div>
                <div className="space-y-1">
                  {session.subTasks.map((task, index) => (
                    <div key={task.id} className="relative">
                      {index > 0 && (
                        <div className="absolute left-4 -top-1 w-px h-1 bg-claude-border" />
                      )}
                      <TaskNode task={task} agents={session.agents} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {session.status === 'completed' && (
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-400" />
                  <span className="text-[13px] font-medium text-emerald-400">协作完成</span>
                </div>
                <div className="mt-2 text-[12px] text-claude-textSecondary">
                  耗时: {((session.endTime || Date.now()) - session.startTime) / 1000}秒 ·
                  智能体: {totalAgents} ·
                  令牌: {session.agents.reduce((sum, a) => sum + a.tokensUsed, 0).toLocaleString()}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {!session && !isAnalyzing && (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center max-w-xs">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-claude-hover flex items-center justify-center">
              <Users size={28} className="text-[#3B82F6]" />
            </div>
            <h3 className="text-[14px] font-medium text-claude-text mb-2">智能协作</h3>
            <p className="text-[12px] text-claude-textSecondary leading-relaxed">
              输入复杂任务，多个AI智能体将并行协作高效完成。
            </p>
            <div className="mt-4 space-y-2 text-left">
              {[
                '自动复杂度分析',
                '智能任务分解',
                '并行智能体执行',
                '实时进度跟踪',
              ].map((feature, i) => (
                <div key={i} className="flex items-center gap-2 text-[11px] text-claude-textSecondary">
                  <ArrowRight size={12} className="text-[#3B82F6]" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SwarmCollaboration;

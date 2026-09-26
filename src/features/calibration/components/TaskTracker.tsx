/**
 * Calibration feature — actionable task tracker panel.
 * JSX extracted verbatim from src/pages/CalibrationPage.tsx (mechanical refactor).
 */
import React from 'react';
import {
  ListTodo, Filter, ArrowUpDown, Clock, CheckSquare, Square
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import { taskLabel, taskBody } from '../types';
import type { AnalysisHistory, Task, TaskCategoryFilter, TaskFilter, TaskSort } from '../types';

interface TaskTrackerProps {
  analysis: AnalysisHistory;
  filteredTasks: Task[];
  taskSearch: string;
  onTaskSearchChange: (v: string) => void;
  taskFilter: TaskFilter;
  onTaskFilterChange: (v: TaskFilter) => void;
  taskCategory: TaskCategoryFilter;
  onTaskCategoryChange: (v: TaskCategoryFilter) => void;
  taskSort: TaskSort;
  onToggleSort: () => void;
  onToggleTask: (taskId: string) => void;
  onToggleAllTasks: (completed: boolean) => void;
}

export function TaskTracker({
  analysis,
  filteredTasks,
  taskSearch,
  onTaskSearchChange,
  taskFilter,
  onTaskFilterChange,
  taskCategory,
  onTaskCategoryChange,
  taskSort,
  onToggleSort,
  onToggleTask,
  onToggleAllTasks,
}: TaskTrackerProps) {
  return (
    <div className="glass-card p-8 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h4 className="text-xl font-bold flex items-center gap-3">
          <ListTodo className="w-5 h-5 text-accent-primary" />
          Actionable Tasks
        </h4>

        {analysis.tasks && analysis.tasks.length > 0 && (
          <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
            <div
              style={{ width: `${(analysis.tasks.filter(t => t.completed).length / analysis.tasks.length) * 100}%` }}
              className="h-full bg-accent-primary shadow-[0_0_10px_rgba(0,242,255,0.5)]"
            />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500" />
            <input
              type="text"
              value={taskSearch}
              onChange={(e) => onTaskSearchChange(e.target.value)}
              placeholder="Search tasks..."
              className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-accent-primary placeholder:text-slate-600"
            />
          </div>

          <select
            value={taskFilter}
            onChange={(e) => onTaskFilterChange(e.target.value as TaskFilter)}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-accent-primary"
          >
            <option value="all" className="bg-slate-900">All Status</option>
            <option value="pending" className="bg-slate-900">Pending</option>
            <option value="completed" className="bg-slate-900">Completed</option>
          </select>

          <select
            value={taskCategory}
            onChange={(e) => onTaskCategoryChange(e.target.value as TaskCategoryFilter)}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-accent-primary"
          >
            <option value="all" className="bg-slate-900">All Categories</option>
            <option value="communication" className="bg-slate-900">Communication</option>
            <option value="physical" className="bg-slate-900">Physical</option>
            <option value="logistics" className="bg-slate-900">Logistics</option>
            <option value="psychology" className="bg-slate-900">Psychology</option>
          </select>

          <button
            onClick={onToggleSort}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-300 flex items-center gap-2 hover:bg-white/10 transition-colors"
          >
            <ArrowUpDown className="w-3 h-3" />
            {taskSort === 'priority' ? 'Sort: Priority' : taskSort === 'dueDate' ? 'Sort: Due Date' : 'Sort: Category'}
          </button>

          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={() => onToggleAllTasks(true)}
              className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold text-emerald-400 hover:bg-emerald-500/20 transition-all uppercase tracking-widest"
            >
              Mark All Complete
            </button>
            <button
              onClick={() => onToggleAllTasks(false)}
              className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[10px] font-bold text-slate-400 hover:text-accent-primary hover:bg-white/10 transition-all uppercase tracking-widest"
            >
              Reset All
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {filteredTasks.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-sm italic">
            No tasks match your current filters.
          </div>
        ) : (
          filteredTasks.map((task) => (
            <div
              key={task.id}
              onClick={() => onToggleTask(task.id)}
              className={cn(
                "group flex items-start gap-4 p-4 rounded-xl border transition-all cursor-pointer",
                task.completed
                  ? "bg-emerald-500/5 border-emerald-500/10 opacity-60"
                  : "bg-white/5 border-white/10 hover:bg-white/10"
              )}
            >
              <button
                className="mt-0.5 shrink-0 transition-transform active:scale-90"
              >
                {task.completed ? (
                  <CheckSquare className="w-5 h-5 text-emerald-500" />
                ) : (
                  <Square className="w-5 h-5 text-slate-500 group-hover:text-accent-primary" />
                )}
              </button>

              <div className="flex-1 space-y-1">
                <p className={cn(
                  "text-sm font-medium transition-all",
                  task.completed ? "text-slate-500 line-through" : "text-slate-200"
                )}>
                  {taskLabel(task)}
                </p>
                {taskBody(task) && taskBody(task) !== taskLabel(task) && (
                  <p className={cn(
                    "text-xs leading-relaxed transition-all",
                    task.completed ? "text-slate-600 line-through" : "text-slate-400"
                  )}>
                    {taskBody(task)}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-3 text-[10px] uppercase tracking-wider font-bold">
                  <span className={cn(
                    "px-2 py-0.5 rounded-full border",
                    task.priority === 'high' ? "bg-red-500/10 border-red-500/20 text-red-400" :
                    task.priority === 'medium' ? "bg-amber-500/10 border-amber-500/20 text-amber-400" :
                    "bg-blue-500/10 border-blue-500/20 text-blue-400"
                  )}>
                    {task.priority}
                  </span>
                  <span className="text-slate-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {task.dueDate}
                  </span>
                  <span className="text-slate-500 capitalize">
                    {task.category}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

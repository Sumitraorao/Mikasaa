import React, { useState, useEffect } from "react";
import { GitBranch, AlertCircle, ToggleLeft, ToggleRight, Radio, RefreshCw, Layers } from "lucide-react";
import { WorkflowRule } from "../types";

export default function WorkflowBuilder() {
  const [workflows, setWorkflows] = useState<WorkflowRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWorkflows = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/db/workflows");
      const rows = await response.json();
      if (Array.isArray(rows)) {
        setWorkflows(rows);
      }
    } catch (err) {
      console.error("Error loading workflows:", err);
      setError("Failed to stream trigger workflow records.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkflows();
  }, []);

  const handleToggle = async (id: number, currentActive: boolean) => {
    try {
      const targetActive = !currentActive;
      const res = await fetch("/api/db/workflows/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, active: targetActive })
      });
      if (res.ok) {
        // Optimistic UI updates
        setWorkflows(prev => 
          prev.map(item => item.id === id ? { ...item, active: targetActive } : item)
        );
      }
    } catch (err) {
      console.error("Toggle workflow failed:", err);
      setError("Failed to register workflow rule adjustment.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-sm font-bold tracking-wider text-pink-600 uppercase flex items-center gap-2">
            <GitBranch size={16} />
            Smart Automation Builder
          </h2>
          <p className="text-xs text-slate-550 font-sans mt-1">
            Build and audit state-authoritative reactive triggers. Active sequences auto-compile when operations occur.
          </p>
        </div>
        <button 
          onClick={fetchWorkflows}
          className="p-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-all text-slate-700 shadow-xs"
        >
          <RefreshCw size={14} className={loading ? "animate-spin text-pink-500" : ""} />
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2.5 bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-xl text-xs font-mono">
          <AlertCircle size={14} className="text-rose-650" />
          <span>{error}</span>
        </div>
      )}

      {/* Visual Rule Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {workflows.map((wf) => (
          <div 
            key={wf.id}
            id={`workflow-event-${wf.trigger_event}`}
            className={`bg-white border rounded-2xl p-5 space-y-4 hover:border-pink-300 transition-all shadow-xs flex flex-col justify-between ${
              wf.active 
                ? "border-slate-200 shadow-sm" 
                : "border-slate-150 opacity-60 bg-slate-50/60"
            }`}
          >
            <div className="space-y-3">
              {/* Node status */}
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-mono tracking-wider font-extrabold text-pink-700 bg-pink-50 px-2.5 py-0.5 rounded-full border border-pink-200/60 flex items-center gap-1.5">
                  <Radio size={10} className={wf.active ? "animate-pulse" : ""} />
                  WHEN {wf.trigger_event}
                </span>
                
                <button 
                  onClick={() => handleToggle(wf.id, !!wf.active)}
                  className="text-slate-650 hover:text-slate-900 transition-colors"
                  title={wf.active ? "Click to deactivate rule" : "Click to activate rule"}
                >
                  {wf.active ? (
                    <ToggleRight size={28} className="text-pink-500" />
                  ) : (
                    <ToggleLeft size={28} className="text-slate-300" />
                  )}
                </button>
              </div>

              {/* Action summary */}
              <div>
                <span className="block text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1.5 font-mono">
                  THEN ACTIONS PIPELINE:
                </span>
                <p className="text-xs font-bold text-slate-800 font-sans leading-relaxed bg-slate-50 border border-slate-200/80 p-3 rounded-xl">
                  {wf.action}
                </p>
              </div>
            </div>

            {/* Run metrics */}
            <div className="flex items-center justify-between bg-slate-50 border border-slate-200/60 p-3 rounded-xl mt-4">
              <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider flex items-center gap-1">
                <Layers size={11} className="text-slate-400" />
                Trigger Executions:
              </span>
              <span className="text-xs font-bold font-mono text-slate-800 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">
                {wf.trigger_count || 0}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

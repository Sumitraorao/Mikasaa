import React, { useState, useEffect } from "react";
import { 
  Terminal, 
  Settings, 
  Cpu, 
  Users, 
  GitBranch, 
  BarChart2, 
  Layout, 
  Database,
  CheckCircle,
  HelpCircle,
  Play,
  RotateCcw
} from "lucide-react";
import OperatorPanel from "./OperatorPanel";
import CRMConsole from "./CRMConsole";
import DOMIntelligence from "./DOMIntelligence";
import WorkflowBuilder from "./WorkflowBuilder";
import AIAnalyticsView from "./AIAnalyticsView";
import { LiveLog, CommandResponse, BrowserAutomationStep } from "../types";

export default function AIDashboard() {
  const [activeTab, setActiveTab] = useState<"operator" | "console" | "scanner" | "builder" | "analytics">("operator");
  const [executing, setExecuting] = useState(false);
  const [aiResponse, setAiResponse] = useState<CommandResponse | null>(null);
  
  // Computer Use Simulation States
  const [highlightedSelector, setHighlightedSelector] = useState<string | null>(null);
  const [filledValues, setFilledValues] = useState<{ [key: string]: string }>({});

  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [logs, setLogs] = useState<LiveLog[]>([]);

  // Function to append background telemetry lines to terminal logger
  const appendLog = (message: string, type: LiveLog["type"] = "info", agent: string = "System") => {
    const timeStr = new Date().toTimeString().split(' ')[0];
    const newLog: LiveLog = {
      id: Math.random().toString(36).substring(7),
      time: timeStr,
      message,
      type,
      agent
    };
    setLogs(prev => [newLog, ...prev]);
  };

  // Seed default background terminal logs
  useEffect(() => {
    appendLog("System kernel successfully loaded.", "success", "Database Agent");
    appendLog("Express + SQLite transactional database connection: ONLINE", "info", "Database Agent");
    appendLog("AI Operator standy by... Listening for commands.", "success", "Orchestrator Agent");
  }, []);

  const clearLogs = () => {
    setLogs([]);
    appendLog("Transmission logs flushed standard output.", "warning", "System");
  };

  // Speaks response using Google Gemini TTS proxy
  const speakSynthesis = async (text: string) => {
    try {
      appendLog("Requesting audio TTS vocal synthesis stream...", "info", "System");
      const res = await fetch("/api/gemini/audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voiceName: "Puck" })
      });
      const data = await res.json();
      if (data.audio) {
        const audioBytes = data.audio;
        const audioUrl = `data:audio/mp3;base64,${audioBytes}`;
        const audio = new Audio(audioUrl);
        audio.play().catch(e => console.error("Audio playback error:", e));
        appendLog("Voice synthesis played successfully.", "success", "Reporting Agent");
      }
    } catch (e) {
      console.error("Vocal synthesis failed:", e);
    }
  };

  // Run NLP Command processing pipeline
  const handleExecuteCommand = async (commandString: string) => {
    setExecuting(true);
    setAiResponse(null);
    setHighlightedSelector(null);
    setFilledValues({});

    appendLog(`Parsed operator message packet: "${commandString}"`, "info", "Orchestrator Agent");
    appendLog("Deploying natural language intent classification to Gemini-3.5-Flash...", "action", "Orchestrator Agent");

    try {
      const response = await fetch("/api/ai/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: commandString })
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "General processing failure.");
      }

      setAiResponse(result);
      appendLog(`Resolved Action Agent: [${result.agent}]`, "success", "Orchestrator Agent");
      appendLog(`Reasoning: ${result.thought}`, "info", result.agent);

      // Trigger "Computer Use" browser actions simulator loop sequentially!
      const steps: BrowserAutomationStep[] = result.browserSteps || [];
      if (steps.length > 0) {
        appendLog(`Scheduling sequential computer-use instruction stack (${steps.length} motions)...`, "action", "System");
        
        for (let i = 0; i < steps.length; i++) {
          const step = steps[i];
          await new Promise((resolve) => setTimeout(resolve, 1400));

          if (step.type === "navigate") {
            const target = step.payload;
            if (["console", "scanner", "builder", "analytics"].includes(target)) {
              setActiveTab(target as any);
              appendLog(`Simulator: Changing UI Workspace View to tab [${target}]`, "action", result.agent);
            }
          } else if (step.type === "highlight") {
            setHighlightedSelector(step.payload);
            appendLog(`Simulator: Requesting focus radar trigger on focus query: "${step.payload}"`, "info", result.agent);
          } else if (step.type === "fill") {
            const { selector, value } = step.payload;
            setFilledValues(prev => ({ ...prev, [selector]: value }));
            setHighlightedSelector(selector);
            appendLog(`Simulator: Keystroke emulation -> Writing parameter "${value}" inside field query "${selector}"`, "info", result.agent);
          } else if (step.type === "click") {
            setHighlightedSelector(step.payload);
            appendLog(`Simulator: Button emulation -> Clicking active trigger container "${step.payload}"`, "action", result.agent);
          }
        }
      }

      // Final complete animation state clean up
      await new Promise(r => setTimeout(r, 1500));
      setHighlightedSelector(null);

      // Speak verbal report
      if (result.speak) {
        appendLog(`Vocal Synthesis: ${result.speak}`, "info", result.agent);
        speakSynthesis(result.speak);
      }

      // Refresh DB data grids references
      setRefreshTrigger(prev => prev + 1);
      appendLog("Synchronized physical SQLite schema references.", "success", "Database Agent");

    } catch (err: any) {
      console.error("AI operations block failed:", err);
      appendLog(`Operational failure: ${err.message || String(err)}`, "error", "Orchestrator Agent");
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans antialiased overflow-x-hidden selection:bg-purple-150 selection:text-slate-900">
      {/* Space grid background accents */}
      <div className="absolute inset-0 bg-[radial-gradient(#cbc5d5_1px,transparent_1px)] [background-size:16px_16px] opacity-35 pointer-events-none" />

      {/* High-fidelity light header */}
      <header className="sticky top-0 bg-white/90 backdrop-blur-xl border-b border-slate-200/80 shadow-xs z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-purple-600 to-pink-600 rounded-xl shadow-md shadow-purple-500/10">
              <Cpu size={18} className="text-white animate-pulse" />
            </div>
            <div>
              <h1 className="text-xs font-black tracking-widest text-slate-900 uppercase">
                Enterprise Autonomous AI Client
              </h1>
              <span className="text-[9px] uppercase font-bold text-purple-600 font-mono flex items-center gap-1 mt-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" />
                Active Employee: Mikasa-ERP Engine
              </span>
            </div>
          </div>

          {/* Controls tabs bar */}
          <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200/80 p-1 rounded-xl shadow-xs">
            <button
              onClick={() => setActiveTab("operator")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all flex items-center gap-1.5 ${
                activeTab === "operator" 
                  ? "bg-white text-purple-700 shadow-sm border border-slate-200/30" 
                  : "text-slate-500 hover:text-slate-800 hover:bg-white/40"
              }`}
            >
              <Layout size={13} />
              AI Operator Hub
            </button>
            <button
              id="tab-console"
              onClick={() => setActiveTab("console")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all flex items-center gap-1.5 ${
                activeTab === "console" 
                  ? "bg-white text-purple-700 shadow-sm border border-slate-200/30" 
                  : "text-slate-500 hover:text-slate-800 hover:bg-white/40"
              }`}
            >
              <Database size={13} />
              Cloud ERM Console
            </button>
            <button
              onClick={() => setActiveTab("scanner")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all flex items-center gap-1.5 ${
                activeTab === "scanner" 
                  ? "bg-white text-purple-700 shadow-sm border border-slate-200/30" 
                  : "text-slate-500 hover:text-slate-800 hover:bg-white/40"
              }`}
            >
              <Settings size={13} />
              DOM Scanner
            </button>
            <button
              onClick={() => setActiveTab("builder")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all flex items-center gap-1.5 ${
                activeTab === "builder" 
                  ? "bg-white text-purple-700 shadow-sm border border-slate-200/30" 
                  : "text-slate-500 hover:text-slate-800 hover:bg-white/40"
              }`}
            >
              <GitBranch size={13} />
              Flow Rules
            </button>
            <button
              onClick={() => setActiveTab("analytics")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all flex items-center gap-1.5 ${
                activeTab === "analytics" 
                  ? "bg-white text-purple-700 shadow-sm border border-slate-200/30" 
                  : "text-slate-500 hover:text-slate-800 hover:bg-white/40"
              }`}
            >
              <BarChart2 size={13} />
              Metrics Lab
            </button>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="space-y-6">
          {activeTab === "operator" && (
            <OperatorPanel
              onExecuteCommand={handleExecuteCommand}
              aiResponse={aiResponse}
              executing={executing}
              onClearLogs={clearLogs}
              logs={logs}
            />
          )}

          {activeTab === "console" && (
            <CRMConsole
              highlightedSelector={highlightedSelector}
              filledValues={filledValues}
              onRefreshNeeded={() => setRefreshTrigger(p => p + 1)}
              refreshTrigger={refreshTrigger}
            />
          )}

          {activeTab === "scanner" && <DOMIntelligence />}

          {activeTab === "builder" && <WorkflowBuilder />}

          {activeTab === "analytics" && <AIAnalyticsView refreshTrigger={refreshTrigger} />}
        </div>
      </main>
    </div>
  );
}

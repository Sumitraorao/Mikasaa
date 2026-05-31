import React, { useState } from "react";
import { 
  Send, 
  Mic, 
  MicOff, 
  Cpu, 
  CheckCircle, 
  Terminal, 
  Sparkles, 
  RefreshCw, 
  Play, 
  Check, 
  Smartphone,
  Eye,
  Radio,
  Clock
} from "lucide-react";
import { AgentStatus, LiveLog, CommandResponse } from "../types";

interface OperatorPanelProps {
  onExecuteCommand: (commandString: string) => Promise<void>;
  aiResponse: CommandResponse | null;
  executing: boolean;
  onClearLogs: () => void;
  logs: LiveLog[];
}

export default function OperatorPanel({
  onExecuteCommand,
  aiResponse,
  executing,
  onClearLogs,
  logs
}: OperatorPanelProps) {
  const [command, setCommand] = useState("");
  const [listening, setListening] = useState(false);

  // Suggestions for rapid user testing
  const suggestions = [
    "Rahul Sharma ke liye invoice banao with amount 45000",
    "Delete inventory model with sku 'SNY-WH-1000'",
    "Create customer Priya with phone +9198334455 and email priya@gmail.com",
    "Show total collected revenue and invoices count",
    "How many active products exist in warehouse stock?",
  ];

  // Active Multi-Agent grid parameters
  const [agents, setAgents] = useState<AgentStatus[]>([
    { name: "Orchestrator Agent", role: "Decision Engine", status: "idle", lastTask: "Standing by..." },
    { name: "Invoice Agent", role: "Sales & Billings", status: "idle", lastTask: "Standing by..." },
    { name: "Customer Agent", role: "CRM Database Profile", status: "idle", lastTask: "Standing by..." },
    { name: "Automation Agent", role: "Workflow Compiler", status: "idle", lastTask: "Standing by..." },
    { name: "Analytics Agent", role: "Financial Metrics", status: "idle", lastTask: "Standing by..." }
  ]);

  // Handle command submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim() || executing) return;
    onExecuteCommand(command.trim());
    setCommand("");
  };

  const handleSuggestionClick = (text: string) => {
    if (executing) return;
    setCommand(text);
    onExecuteCommand(text);
  };

  const startVoiceDictation = () => {
    if (!("webkitSpeechRecognition" in window)) {
      alert("Speech recognition is only fully supported on Google Chrome by standard frame permissions. Using mock simulator dictation mode!");
      // Mock dictation
      setListening(true);
      setTimeout(() => {
        setCommand("Create invoice for Priya of ₹45,000");
        setListening(false);
      }, 2500);
      return;
    }

    try {
      setListening(true);
      const SpeechRecognition = (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-IN";

      recognition.onresult = (event: any) => {
        const text = event.results[0][0].transcript;
        if (text) {
          setCommand(text);
        }
        setListening(false);
      };

      recognition.onerror = () => {
        setListening(false);
      };

      recognition.onend = () => {
        setListening(false);
      };

      recognition.start();
    } catch (e) {
      setListening(false);
    }
  };  // Compute active agent status class
  const getAgentStatusStyles = (status: AgentStatus["status"]) => {
    switch (status) {
      case "thinking":
        return "bg-amber-50 border-amber-200 text-amber-800 shadow-sm";
      case "executing":
        return "bg-cyan-50 border-cyan-200 text-cyan-800 shadow-sm";
      case "success":
        return "bg-emerald-50 border-emerald-200 text-emerald-800 shadow-sm";
      case "critical":
        return "bg-rose-50 border-rose-200 text-rose-800 shadow-sm";
      default:
        return "bg-white border-slate-200 text-slate-500 hover:bg-slate-50/50";
    }
  };

  const getLogTypeColor = (type: LiveLog["type"]) => {
    switch (type) {
      case "success": return "text-emerald-400";
      case "warning": return "text-amber-400";
      case "error": return "text-rose-450";
      case "action": return "text-cyan-400";
      default: return "text-slate-300";
    }
  };

  return (
    <div className="space-y-6">
      {/* Visual Command Console Box */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 relative overflow-hidden shadow-sm">
        {/* Glow accent */}
        <div className="absolute top-0 right-1/4 w-96 h-40 bg-purple-100/30 rounded-full blur-3xl -z-10" />

        <div className="max-w-3xl mx-auto space-y-4">
          <div className="text-center space-y-1.5 pb-2">
            <h2 className="text-sm font-extrabold tracking-widest text-purple-700 uppercase flex items-center justify-center gap-2">
              <Sparkles size={14} className="text-purple-600 animate-pulse" />
              Autonomous AI Employee Portal
            </h2>
            <p className="text-xs text-slate-550 font-sans font-medium">
              Prompt of anything in English/Hinglish — the agent compiles SQL blocks, triggers routing nodes, and animates click fields directly!
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex gap-2.5">
            <div className="relative flex-1">
              <input
                id="main-ai-search"
                type="text"
                required
                disabled={executing}
                value={command}
                onChange={e => setCommand(e.target.value)}
                placeholder={executing ? "Compiling operations..." : "Operator instruction (e.g. 'Create invoice for Sumit of 11000')..."}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-xs text-slate-900 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all placeholder:text-slate-400 pr-10 shadow-inner"
              />
              
              <button
                type="button"
                onClick={listening ? () => setListening(false) : startVoiceDictation}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                title="Voice Assistant Mode"
              >
                {listening ? (
                  <div className="relative flex items-center justify-center">
                    <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-rose-450 opacity-75" />
                    <Mic size={16} className="text-rose-550" />
                  </div>
                ) : (
                  <Mic size={16} className="text-purple-600 hover:text-purple-700" />
                )}
              </button>
            </div>

            <button
              type="submit"
              disabled={executing}
              className="bg-purple-600 hover:bg-purple-500 disabled:bg-purple-350/50 text-white font-extrabold text-xs uppercase tracking-wide px-5 py-3 rounded-xl flex items-center gap-2 shadow-md hover:shadow-purple-500/10 transition-all border border-purple-500/10 shrink-0"
            >
              {executing ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : (
                <Send size={14} />
              )}
              Run Employee
            </button>
          </form>

          {/* Quick test parameters chip suggestion */}
          <div className="flex flex-wrap items-center gap-2 pt-2 justify-center">
            <span className="text-[10px] uppercase font-bold text-slate-400 font-mono tracking-wider mr-1">
              Quick commands:
            </span>
            {suggestions.map((s, idx) => (
              <button
                key={idx}
                type="button"
                disabled={executing}
                onClick={() => handleSuggestionClick(s)}
                className="text-[10px] font-sans font-semibold bg-white border border-slate-200 hover:border-purple-500/30 hover:bg-purple-50 text-slate-650 hover:text-purple-700 px-3 py-1 rounded-xl shadow-xs transition-all animate-fade-in"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid of Active Multi-Agent instances */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs text-slate-500 font-bold uppercase tracking-wider">
          <Cpu size={14} className="text-purple-600" />
          <span>Active Agent Status Registry</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {agents.map((agent) => {
            // Find if this agent is the active one in last response
            const isActive = aiResponse && aiResponse.agent === agent.name;
            const currentStatus = executing 
              ? (agent.name === "Orchestrator Agent" ? "thinking" : "idle")
              : (isActive ? "success" : "idle");

            return (
              <div 
                key={agent.name}
                className={`border rounded-2xl p-4 space-y-2.5 transition-all shadow-xs flex flex-col justify-between ${getAgentStatusStyles(currentStatus)}`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold font-sans text-slate-800">{agent.name}</h4>
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  </div>
                  <span className="text-[10px] text-slate-500 block leading-tight mt-0.5">{agent.role}</span>
                </div>
                <div className="text-[10px] uppercase font-mono font-bold flex items-center justify-between border-t border-slate-100 pt-2">
                  <span>Status:</span>
                  <span className={`${
                    currentStatus === "thinking" 
                      ? "text-amber-600" 
                      : currentStatus === "success" 
                        ? "text-emerald-600" 
                        : "text-slate-400"
                  }`}>
                    {currentStatus.toUpperCase()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Bottom Frame: Left Engine reply, Right Terminal logging */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Reply Deck */}
        <div className="lg:col-span-5 flex flex-col">
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 flex flex-col justify-between flex-1 space-y-5 shadow-sm">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                  <Smartphone size={14} className="text-purple-600" />
                  Audible Voice Feedback
                </h3>
                {aiResponse && (
                  <span className="text-[9px] font-mono text-cyan-700 uppercase font-bold bg-cyan-100 px-2 py-0.5 rounded">
                    {aiResponse.agent}
                  </span>
                )}
              </div>

              {executing ? (
                <div className="space-y-3 py-4 text-center">
                  <RefreshCw size={24} className="animate-spin mx-auto text-purple-600" />
                  <p className="text-xs font-sans font-medium text-slate-500">
                    Agent analysis compiled. Updating SQLite database...
                  </p>
                </div>
              ) : aiResponse ? (
                <div className="space-y-4 animate-fade-in text-sans">
                  {/* Thought */}
                  <div className="bg-slate-50 border border-slate-150 rounded-xl p-3.5 space-y-1.5 shadow-inner">
                    <span className="block text-[8.5px] uppercase font-mono font-bold tracking-widest text-[#5b21b6]">
                      Cognitive Agent Thinking:
                    </span>
                    <p className="text-[11px] font-mono text-slate-700 leading-relaxed italic">
                      "{aiResponse.thought}"
                    </p>
                  </div>

                  {/* Verbal speak */}
                  <div className="space-y-1.5">
                    <span className="block text-[8.5px] uppercase font-mono font-bold tracking-widest text-emerald-700">
                      Spoken Synthesis response:
                    </span>
                    <p className="text-xs font-semibold text-slate-800 leading-relaxed bg-emerald-50/40 p-3 rounded-xl border border-emerald-100">
                      {aiResponse.speak}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="py-14 text-center text-slate-400 space-y-2">
                  <Radio size={28} className="mx-auto text-slate-300 animate-pulse" />
                  <p className="text-xs font-sans max-w-[200px] mx-auto">
                    Standby. Enter a command in the console above to initialize employee workflow.
                  </p>
                </div>
              )}
            </div>

            {aiResponse && (
              <div className="bg-emerald-50 border border-emerald-250 p-3 rounded-xl flex items-center gap-2.5 text-xs text-emerald-800 font-mono">
                <CheckCircle size={14} className="shrink-0 text-emerald-600" />
                <span>Operation complete. Core integrity safe.</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Log Monitor Terminal */}
        <div className="lg:col-span-7 flex flex-col">
          <div className="bg-[#0c0f16] border border-slate-900 rounded-2xl overflow-hidden flex flex-col flex-1 shadow-md">
            {/* Terminal Header */}
            <div className="bg-[#121824] px-4 py-3 flex items-center justify-between border-b border-white/5">
              <div className="flex items-center gap-2 text-xs font-mono font-semibold text-white/95">
                <Terminal size={14} className="text-amber-400" />
                <span>TRANSMISSION_LOGGER_SANDBOX</span>
              </div>
              <button
                onClick={onClearLogs}
                className="text-[10px] font-semibold text-slate-400 hover:text-rose-450 transition-colors uppercase font-mono tracking-wider"
              >
                Flush Channels
              </button>
            </div>

            {/* Simulated terminal body */}
            <div className="p-4 flex-1 text-xs font-mono font-bold space-y-1.5 h-[300px] overflow-y-auto pr-2">
              {logs.length === 0 ? (
                <div className="text-slate-400 text-center py-20 font-sans font-medium flex flex-col gap-1">
                  <Clock size={20} className="mx-auto text-slate-650 mb-1" />
                  <span>No background processes stored.</span>
                </div>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className="flex items-start gap-1 p-1 hover:bg-white/[0.01] rounded">
                    <span className="text-slate-500 shrink-0 select-none">[{log.time}]</span>
                    <span className="text-pink-400 shrink-0 select-none bg-pink-500/15 text-[8.5px] px-1 py-0.5 rounded border border-pink-500/10 mr-1 uppercase leading-none">
                      {log.agent}
                    </span>
                    <span className={`break-all ${getLogTypeColor(log.type)}`}>
                      {log.message}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

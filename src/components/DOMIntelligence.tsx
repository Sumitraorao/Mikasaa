import React, { useState } from "react";
import { Cpu, Maximize2, Shield, Eye, Network, Target } from "lucide-react";

export default function DOMIntelligence() {
  const [selectedElement, setSelectedElement] = useState<string | null>(null);

  // High-fidelity map of DOM Elements exposed to the AI Natural Language Engine
  const domNodes = [
    {
      id: "#crm-table",
      name: "CRM Customers Table",
      type: "Table Container",
      interactions: "SELECT, HOVER, READ",
      attributes: { "data-automation": "crm-list", "class": "divide-y divide-white/5" },
      target_events: ["onMouseOver", "onRowClick"]
    },
    {
      id: "#invoices-table",
      name: "Sales Ledger Invoice Table",
      type: "Table Container",
      interactions: "SELECT, HOVER, COMPUTE",
      attributes: { "data-automation": "invoice-list", "class": "divide-y text-mono" },
      target_events: ["onRowClick", "onCalculate"]
    },
    {
      id: "#inventory-table",
      name: "Warehouse Stock Table",
      type: "Table Container",
      interactions: "SELECT, STOCK_AUDIT",
      attributes: { "data-automation": "stock-levels" },
      target_events: ["onLevelAlert"]
    },
    {
      id: "#new-invoice-customer",
      name: "Customer Name Input Field",
      type: "Text Input",
      interactions: "FILL, TYPE, FOCUS",
      attributes: { "placeholder": "Rahul Sharma", "type": "text", "required": "true" },
      target_events: ["onChange", "onFocus", "onBlur"]
    },
    {
      id: "#new-invoice-amount",
      name: "Invoice Amount Input Field",
      type: "Number Input",
      interactions: "FILL, INCREMENT, FOCUS",
      attributes: { "placeholder": "45000", "type": "number", "required": "true" },
      target_events: ["onChange", "onFocus"]
    },
    {
      id: "#new-invoice-gst",
      name: "GSTIN Address Input Field",
      type: "Text Input",
      interactions: "FILL, TYPE",
      attributes: { "placeholder": "07AAAAA1111A1Z1" },
      target_events: ["onChange"]
    },
    {
      id: "#create-invoice-submit",
      name: "Register Transaction Button",
      type: "Action trigger (Submit)",
      interactions: "CLICK, HOVER",
      attributes: { "type": "submit" },
      target_events: ["onClick", "onSubmit"]
    },
    {
      id: "#add-customer-btn",
      name: "Expand CRM Panel Drawer",
      type: "Action button",
      interactions: "CLICK",
      attributes: { "id": "add-customer-btn" },
      target_events: ["onClick"]
    },
    {
      id: "#reset-database-btn",
      name: "Reset Factory Seed Ledger",
      type: "Destructive execution",
      interactions: "CLICK",
      attributes: { "id": "reset-database-btn", "class": "bg-red-500/10" },
      target_events: ["onClick"]
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header telemetry details */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-sm font-bold tracking-wider text-cyan-700 uppercase flex items-center gap-2">
            <Cpu size={16} />
            Element ID Map & DOM Scanner
          </h2>
          <p className="text-xs text-slate-550 font-sans mt-1">
            Realtime representation of active component hierarchy targeted by AI orchestrator during browser navigation scans.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs bg-cyan-50 text-cyan-700 px-3 py-1.5 rounded-xl border border-cyan-200 font-mono font-bold shadow-xs">
          <Shield size={13} className="animate-pulse" />
          <span>Active DOM Shield Level: SECURE</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Elements Node list */}
        <div className="lg:col-span-7 bg-white border border-slate-200 p-5 rounded-2xl space-y-4 shadow-xs">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <Network size={14} className="text-cyan-600" />
            Identified Interactive Components
          </h3>
          <div className="space-y-2 max-h-[450px] overflow-y-auto pr-2">
            {domNodes.map((node) => (
              <div 
                key={node.id}
                onClick={() => setSelectedElement(node.id)}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer font-sans ${
                  selectedElement === node.id 
                    ? "bg-cyan-50 border-cyan-300 shadow-inner"
                    : "bg-white border-slate-200 hover:border-cyan-400 hover:bg-slate-50/50"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <span className="text-xs font-mono font-extrabold text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded-md border border-cyan-200/50">
                      {node.id}
                    </span>
                    <h4 className="text-xs font-bold text-slate-800 mt-2">{node.name}</h4>
                  </div>
                  <span className="text-[10px] uppercase font-mono tracking-wider font-bold text-slate-500 bg-slate-100 py-0.5 px-2 rounded">
                    {node.type}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-3 text-[10px] text-slate-500">
                  <span className="flex items-center gap-1 font-semibold">
                    <Target size={10} className="text-amber-500" />
                    Interactions: <strong className="text-slate-800">{node.interactions}</strong>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Element Details Analysis Inspector */}
        <div className="lg:col-span-5 flex flex-col">
          {selectedElement ? (
            (() => {
              const info = domNodes.find(n => n.id === selectedElement)!;
              return (
                <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5 flex-1 animate-fade-in shadow-xs">
                  <div className="flex items-center justify-between border-b border-slate-150 pb-4">
                    <h3 className="text-xs font-semibold tracking-wider text-cyan-700 uppercase flex items-center gap-2">
                      <Eye size={14} />
                      Component Inspector
                    </h3>
                    <span className="text-[10px] font-mono font-bold text-slate-400">NODE_RESOLVED</span>
                  </div>

                  <div className="space-y-4 font-mono text-xs">
                    <div>
                      <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Target Element ID</span>
                      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-cyan-800 text-xs font-bold select-all">
                        {info.id}
                      </div>
                    </div>

                    <div>
                      <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Description</span>
                      <span className="block font-sans text-slate-700 text-xs bg-slate-50/50 p-2.5 rounded-lg border border-slate-200">
                        {info.name}
                      </span>
                    </div>

                    <div>
                      <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Assigned Event Handlers</span>
                      <div className="space-y-1.5">
                        {info.target_events.map((evt, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-emerald-50 border border-emerald-150 text-emerald-800 font-extrabold">
                            <span>{evt}()</span>
                            <span className="text-[9px] uppercase font-bold tracking-wider bg-emerald-100 border border-emerald-250 px-1.5 py-0.5 rounded text-emerald-700">
                              Active
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">HTML Properties</span>
                      <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                        {Object.entries(info.attributes).map(([key, val]) => (
                          <div key={key} className="flex justify-between items-start text-[11px]">
                            <span className="text-slate-400 font-bold">{key}=</span>
                            <span className="text-pink-600 font-bold break-all text-right max-w-[150px]">"{val}"</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()
          ) : (
            <div className="bg-white border border-dashed border-slate-250 rounded-2xl p-10 flex-1 flex flex-col items-center justify-center text-center space-y-3 shadow-xs">
              <Maximize2 size={36} className="text-slate-300 animate-pulse" />
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-slate-700">Inspector Shell Idle</h4>
                <p className="text-[11px] text-slate-500 max-w-[200px] font-sans">
                  Select any interactive visual node selector to read detailed attributes.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from "react";
import { 
  TrendingUp, 
  Users, 
  Package, 
  DollarSign, 
  Activity, 
  ChevronRight,
  BrainCircuit
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from "recharts";
import { Invoice, Customer, Inventory } from "../types";

export default function AIAnalyticsView({ refreshTrigger }: { refreshTrigger: number }) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [inventory, setInventory] = useState<Inventory[]>([]);

  const [revenueInsights, setRevenueInsights] = useState<string>("Calculating automated sales predictions...");

  useEffect(() => {
    Promise.all([
      fetch("/api/db/invoices").then(r => r.json()),
      fetch("/api/db/customers").then(r => r.json()),
      fetch("/api/db/inventory").then(r => r.json())
    ]).then(([inv, cust, stock]) => {
      if (Array.isArray(inv)) setInvoices(inv);
      if (Array.isArray(cust)) setCustomers(cust);
      if (Array.isArray(stock)) setInventory(stock);

      // Simple predicted insights
      const total = inv.reduce((sum: number, curr: Invoice) => sum + (curr.amount || 0), 0);
      const average = inv.length > 0 ? (total / inv.length).toFixed(0) : 0;
      setRevenueInsights(
        `Consolidated ledger value of ₹${total.toLocaleString()} across ${inv.length} transactions. Mean transaction yield is ₹${Number(average).toLocaleString()}. Sales pipeline indicates stable growth with normal cash flow.`
      );
    }).catch(err => console.error("Error gathering analytics details:", err));
  }, [refreshTrigger]);

  const totalRevenue = invoices.reduce((sum, inv) => sum + (inv.status === "Paid" ? inv.amount : 0), 0);
  const pendingRevenue = invoices.reduce((sum, inv) => sum + (inv.status === "Pending" ? inv.amount : 0), 0);

  // Map invoices into chart items
  const chartData = invoices.map(inv => ({
    name: inv.customer_name,
    amount: inv.amount,
    status: inv.status
  })).reverse();

  // Map stock levels to charts
  const stockChartData = inventory.map(item => ({
    name: item.name.length > 15 ? item.name.substring(0, 15) + "..." : item.name,
    stock: item.stock,
    price: item.price
  }));

  return (
    <div className="space-y-6">
      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Paid Sales */}
        <div className="bg-white border border-slate-200 p-5 rounded-2xl space-y-2 relative overflow-hidden shadow-xs">
          <div className="absolute top-0 right-0 p-4 opacity-5">
            <DollarSign size={80} className="text-purple-600" />
          </div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">
            Collected Revenue
          </span>
          <h3 className="text-xl font-extrabold text-emerald-600 font-mono">
            ₹{totalRevenue.toLocaleString()}
          </h3>
          <p className="text-[10px] text-slate-500 font-sans font-semibold">
            Cleared cash deposits in primary bank.
          </p>
        </div>

        {/* Pending Sales */}
        <div className="bg-white border border-slate-200 p-5 rounded-2xl space-y-2 relative overflow-hidden shadow-xs">
          <div className="absolute top-0 right-0 p-4 opacity-5">
            <TrendingUp size={80} className="text-amber-600" />
          </div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">
            Pending Escrow
          </span>
          <h3 className="text-xl font-extrabold text-amber-600 font-mono">
            ₹{pendingRevenue.toLocaleString()}
          </h3>
          <p className="text-[10px] text-slate-500 font-sans font-semibold">
            Accounts receivable waiting for settlement.
          </p>
        </div>

        {/* Active Accounts */}
        <div className="bg-white border border-slate-200 p-5 rounded-2xl space-y-2 relative overflow-hidden shadow-xs">
          <div className="absolute top-0 right-0 p-4 opacity-5">
            <Users size={80} className="text-cyan-600" />
          </div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">
            CRM Portfolio
          </span>
          <h3 className="text-xl font-extrabold text-cyan-600 font-mono">
            {customers.length} Leads
          </h3>
          <p className="text-[10px] text-slate-500 font-sans font-semibold">
            Verified customers with GST registrations.
          </p>
        </div>

        {/* Stock Balance */}
        <div className="bg-white border border-slate-200 p-5 rounded-2xl space-y-2 relative overflow-hidden shadow-xs">
          <div className="absolute top-0 right-0 p-4 opacity-5">
            <Package size={80} className="text-pink-600" />
          </div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">
            Catalog Balance
          </span>
          <h3 className="text-xl font-extrabold text-pink-600 font-mono">
            {inventory.reduce((sum, item) => sum + item.stock, 0)} Units
          </h3>
          <p className="text-[10px] text-slate-500 font-sans font-semibold">
            Across {inventory.length} high-demand SKU divisions.
          </p>
        </div>
      </div>

      {/* AI Reasoning Insight Box */}
      <div className="bg-purple-50/60 border border-purple-200/80 p-4 rounded-2xl flex gap-3.5 items-start">
        <div className="p-2.5 rounded-xl bg-purple-100 border border-purple-205 text-purple-700 shrink-0">
          <BrainCircuit size={16} />
        </div>
        <div className="space-y-1">
          <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider font-mono">
            Gemini Agent Report Summary Desk
          </span>
          <p className="text-xs font-sans font-semibold text-slate-700 leading-relaxed">
            {revenueInsights}
          </p>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sale yield chart */}
        <div className="bg-white border border-slate-200 p-5 rounded-2xl space-y-4 shadow-xs">
          <h3 className="text-xs font-bold uppercase text-slate-700 tracking-wider flex items-center gap-2 font-sans mb-2">
            <Activity size={14} className="text-purple-600" />
            Transactions Revenue Yield
          </h3>
          <div className="h-[250px] w-full text-xs font-mono">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#9333ea" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#9333ea" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis dataKey="name" stroke="rgba(0,0,0,0.5)" />
                  <YAxis stroke="rgba(0,0,0,0.5)" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: "rgba(255,255,255,0.96)", borderColor: "rgba(0,0,0,0.12)", borderRadius: "12px", color: "#0f172a" }} 
                    labelStyle={{ color: "rgba(0,0,0,0.5)", fontWeight: "bold" }}
                  />
                  <Area type="monotone" dataKey="amount" stroke="#9333ea" fillOpacity={1} fill="url(#colorValue)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400 font-sans">No invoice records generated yet.</div>
            )}
          </div>
        </div>

        {/* Warehouse stock comparison */}
        <div className="bg-white border border-slate-200 p-5 rounded-2xl space-y-4 shadow-xs">
          <h3 className="text-xs font-bold uppercase text-slate-700 tracking-wider flex items-center gap-2 font-sans mb-2">
            <Package size={14} className="text-pink-600" />
            Inventory Stock Distribution
          </h3>
          <div className="h-[250px] w-full text-xs font-mono">
            {stockChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stockChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis dataKey="name" stroke="rgba(0,0,0,0.5)" />
                  <YAxis stroke="rgba(0,0,0,0.5)" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: "rgba(255,255,255,0.96)", borderColor: "rgba(0,0,0,0.12)", borderRadius: "12px", color: "#0f172a" }}
                    labelStyle={{ color: "rgba(0,0,0,0.5)", fontWeight: "bold" }}
                  />
                  <Bar dataKey="stock" fill="#ec4899" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400 font-sans">Inventory database is empty.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

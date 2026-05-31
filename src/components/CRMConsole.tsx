import React, { useState, useEffect } from "react";
import { 
  FileText, 
  Users, 
  Package, 
  PlusCircle, 
  RefreshCw, 
  DollarSign, 
  Percent, 
  Trash2, 
  TrendingUp, 
  Check, 
  AlertCircle 
} from "lucide-react";
import { Invoice, Customer, Inventory } from "../types";

interface CRMConsoleProps {
  highlightedSelector: string | null;
  filledValues: { [key: string]: string };
  onRefreshNeeded: () => void;
  refreshTrigger: number;
}

export default function CRMConsole({ 
  highlightedSelector, 
  filledValues, 
  onRefreshNeeded,
  refreshTrigger 
}: CRMConsoleProps) {
  const [activeSubTab, setActiveSubTab] = useState<"invoices" | "customers" | "inventory">("invoices");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [inventory, setInventory] = useState<Inventory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Manual Forms State
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: "", email: "", phone: "", gst: "" });

  const [showAddInvoice, setShowAddInvoice] = useState(false);
  const [newInvoice, setNewInvoice] = useState({ customerName: "", amount: "", status: "Pending", gst: "" });

  const [showAddStock, setShowAddStock] = useState(false);
  const [newStock, setNewStock] = useState({ name: "", sku: "", stock: "", price: "" });

  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [resInvoices, resCustomers, resInventory] = await Promise.all([
        fetch("/api/db/invoices").then(r => r.json()),
        fetch("/api/db/customers").then(r => r.json()),
        fetch("/api/db/inventory").then(r => r.json())
      ]);

      if (Array.isArray(resInvoices)) setInvoices(resInvoices);
      if (Array.isArray(resCustomers)) setCustomers(resCustomers);
      if (Array.isArray(resInventory)) setInventory(resInventory);
    } catch (err: any) {
      console.error("Error loading DB records:", err);
      setError("Failed to stream console data rows.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [refreshTrigger]);

  const handleResetDB = async () => {
    if (!confirm("Are you sure you want to reset all records back to seed values? All custom entries will be lost.")) return;
    try {
      await fetch("/api/db/reset", { method: "POST" });
      setActionMessage("Database records successfully synchronized to root seed.");
      setTimeout(() => setActionMessage(null), 3000);
      fetchData();
      onRefreshNeeded();
    } catch (err) {
      setError("Failed to restore factory presets.");
    }
  };

  const handleAddCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomer.name) return;

    try {
      const sqlCommand = `INSERT INTO customers (name, email, phone, gst_number) VALUES ('${newCustomer.name}', '${newCustomer.email || "n/a"}', '${newCustomer.phone || "n/a"}', '${newCustomer.gst || "n/a"}');`;
      await fetch("/api/ai/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: `Create customer named ${newCustomer.name} with email ${newCustomer.email}` })
      });
      
      setNewCustomer({ name: "", email: "", phone: "", gst: "" });
      setShowAddCustomer(false);
      setActionMessage("Customer synced via Agent Engine!");
      setTimeout(() => setActionMessage(null), 3000);
      fetchData();
      onRefreshNeeded();
    } catch (err) {
      setError("Action pipeline rejected by agent.");
    }
  };

  const handleAddInvoiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInvoice.customerName || !newInvoice.amount) return;

    try {
      await fetch("/api/ai/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: `Create ${newInvoice.status} invoice for ${newInvoice.customerName} of amount ${newInvoice.amount}` })
      });
      
      setNewInvoice({ customerName: "", amount: "", status: "Pending", gst: "" });
      setShowAddInvoice(false);
      setActionMessage("Invoice ledger successfully updated!");
      setTimeout(() => setActionMessage(null), 3000);
      fetchData();
      onRefreshNeeded();
    } catch (err) {
      setError("Invoice validation failed.");
    }
  };

  // Check if current elements are being targeted by AI agent computer-use simulation
  const getHighlightClass = (id: string) => {
    if (highlightedSelector === id) {
      return "ring-4 ring-amber-400 ring-offset-2 ring-offset-white animate-pulse border-amber-400 scale-[1.02] shadow-[0_0_20px_rgba(251,191,36,0.25)] transition-all duration-300";
    }
    return "";
  };

  return (
    <div className="space-y-6">
      {/* Console Top Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white border border-slate-250/75 p-4 rounded-2xl shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveSubTab("invoices")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold tracking-wide uppercase transition-all flex items-center gap-2 ${
              activeSubTab === "invoices" 
                ? "bg-purple-50 text-purple-700 border border-purple-200 shadow-sm" 
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-transparent"
            }`}
          >
            <FileText size={14} />
            Invoices
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-slate-200 text-[9px] text-slate-700 font-bold">
              {invoices.length}
            </span>
          </button>
          <button
            onClick={() => setActiveSubTab("customers")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold tracking-wide uppercase transition-all flex items-center gap-2 ${
              activeSubTab === "customers" 
                ? "bg-cyan-50 text-cyan-700 border border-cyan-200 shadow-sm" 
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-transparent"
            }`}
          >
            <WorkspacePremium size={14} />
            CRM (Customers)
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-slate-200 text-[9px] text-slate-700 font-bold">
              {customers.length}
            </span>
          </button>
          <button
            onClick={() => setActiveSubTab("inventory")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold tracking-wide uppercase transition-all flex items-center gap-2 ${
              activeSubTab === "inventory" 
                ? "bg-pink-50 text-pink-700 border border-pink-200 shadow-sm" 
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-transparent"
            }`}
          >
            <Package size={14} />
            Inventory Stock
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-slate-200 text-[9px] text-slate-700 font-bold">
              {inventory.length}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchData}
            title="Refresh Ledger"
            className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 transition-colors text-slate-750 shadow-xs"
          >
            <RefreshCw size={14} className={loading ? "animate-spin text-purple-600" : ""} />
          </button>
          <button
            id="reset-database-btn"
            onClick={handleResetDB}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[11px] font-extrabold transition-all ${getHighlightClass("#reset-database-btn")} bg-rose-50 hover:bg-rose-100/70 text-rose-700 border-rose-200`}
          >
            <Trash2 size={13} />
            Reset Seed Data
          </button>
        </div>
      </div>

      {actionMessage && (
        <div className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-xs font-mono animate-fade-in shadow-xs">
          <Check size={14} className="shrink-0 text-emerald-600" />
          <span>{actionMessage}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2.5 bg-rose-50 border border-rose-250 text-rose-800 px-4 py-3 rounded-xl text-xs font-mono shadow-xs">
          <AlertCircle size={14} className="shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Tables Container */}
      <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs">
        {/* Invoices Tab */}
        {/* Invoices Tab */}
        {activeSubTab === "invoices" && (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold tracking-wider text-purple-800 uppercase">Sales Ledger</h3>
              <button
                id="add-invoice-btn"
                onClick={() => setShowAddInvoice(!showAddInvoice)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-extrabold transition-all ${getHighlightClass("#add-invoice-btn")} bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200`}
              >
                <PlusCircle size={13} />
                Generate Invoice
              </button>
            </div>

            {/* Simulated Fill Highlight Form */}
            {showAddInvoice && (
              <form onSubmit={handleAddInvoiceSubmit} className="bg-slate-50 border border-slate-205/85 p-4 rounded-xl space-y-3 animate-slide-down shadow-inner">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[10px] text-slate-500 uppercase font-extrabold mb-1">Customer</label>
                    <input
                      id="new-invoice-customer"
                      type="text"
                      required
                      placeholder="Rahul Sharma"
                      value={filledValues["#new-invoice-customer"] !== undefined ? filledValues["#new-invoice-customer"] : newInvoice.customerName}
                      onChange={e => setNewInvoice({...newInvoice, customerName: e.target.value})}
                      className={`w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-purple-500 transition-all ${getHighlightClass("#new-invoice-customer")}`}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 uppercase font-extrabold mb-1">Amount (₹)</label>
                    <input
                      id="new-invoice-amount"
                      type="number"
                      required
                      placeholder="45000"
                      value={filledValues["#new-invoice-amount"] !== undefined ? filledValues["#new-invoice-amount"] : newInvoice.amount}
                      onChange={e => setNewInvoice({...newInvoice, amount: e.target.value})}
                      className={`w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-purple-500 transition-all ${getHighlightClass("#new-invoice-amount")}`}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 uppercase font-extrabold mb-1">GST Registration</label>
                    <input
                      id="new-invoice-gst"
                      type="text"
                      placeholder="07AAAAA1111A1Z1"
                      value={filledValues["#new-invoice-gst"] !== undefined ? filledValues["#new-invoice-gst"] : newInvoice.gst}
                      onChange={e => setNewInvoice({...newInvoice, gst: e.target.value})}
                      className={`w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-purple-500 transition-all ${getHighlightClass("#new-invoice-gst")}`}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 uppercase font-extrabold mb-1">Payment Status</label>
                    <select
                      value={newInvoice.status}
                      onChange={e => setNewInvoice({...newInvoice, status: e.target.value})}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-purple-500"
                    >
                      <option value="Paid">Paid</option>
                      <option value="Pending">Pending</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddInvoice(false)}
                    className="px-3 py-1.5 rounded-lg text-[10px] uppercase font-bold text-slate-500 hover:bg-slate-200/50"
                  >
                    Cancel
                  </button>
                  <button
                    id="create-invoice-submit"
                    type="submit"
                    className={`px-4 py-1.5 rounded-lg text-[10px] uppercase font-extrabold text-white bg-purple-600 hover:bg-purple-500 transition-colors flex items-center gap-1 ${getHighlightClass("#create-invoice-submit")}`}
                  >
                    <Check size={11} />
                    Commit Transaction
                  </button>
                </div>
              </form>
            )}

            {/* Table */}
            <div className="overflow-x-auto">
              <table id="invoices-table" className={`min-w-full divide-y divide-slate-200 select-text ${getHighlightClass("#invoices-table")}`}>
                <thead>
                  <tr className="text-left text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                    <th className="py-3 px-4">TXN ID</th>
                    <th className="py-3 px-4">Customer Name</th>
                    <th className="py-3 px-4">Bill Date</th>
                    <th className="py-3 px-4 text-right">Value (INR)</th>
                    <th className="py-3 px-4">GSTIN Address</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-mono bg-white">
                  {invoices.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-slate-400 font-sans">
                        No transactions registered. Prompt AI to populate or create one.
                      </td>
                    </tr>
                  ) : (
                    invoices.map(inv => (
                      <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4 text-purple-600 font-extrabold">#INV-{1000 + inv.id}</td>
                        <td className="py-3.5 px-4 text-slate-800 font-bold font-sans">{inv.customer_name}</td>
                        <td className="py-3.5 px-4 text-slate-500">{inv.invoice_date}</td>
                        <td className="py-3.5 px-4 text-right pr-6 font-extrabold text-slate-900">₹{inv.amount?.toLocaleString()}</td>
                        <td className="py-3.5 px-4 text-cyan-600 font-semibold text-[10px]">{inv.gst_number || "NOT_PROVIDED"}</td>
                        <td className="py-3.5 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${
                            inv.status === "Paid" 
                              ? "bg-emerald-50 text-emerald-800 border-emerald-250/70" 
                              : "bg-amber-50 text-amber-800 border-amber-255/70"
                          }`}>
                            {inv.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Customers Tab */}
        {activeSubTab === "customers" && (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold tracking-wider text-cyan-800 uppercase">Customer CRM Database</h3>
              <button
                id="add-customer-btn"
                onClick={() => setShowAddCustomer(!showAddCustomer)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-extrabold transition-all ${getHighlightClass("#add-customer-btn")} bg-cyan-50 hover:bg-cyan-100 text-cyan-700 border-cyan-200`}
              >
                <PlusCircle size={13} />
                Add Record
              </button>
            </div>

            {showAddCustomer && (
              <form onSubmit={handleAddCustomerSubmit} className="bg-slate-50 border border-slate-205/85 p-4 rounded-xl space-y-3 animate-slide-down shadow-inner">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[10px] text-slate-500 uppercase font-extrabold mb-1">Full Name</label>
                    <input
                      id="new-customer-name"
                      type="text"
                      required
                      placeholder="Rahul Sharma"
                      value={filledValues["#new-customer-name"] !== undefined ? filledValues["#new-customer-name"] : newCustomer.name}
                      onChange={e => setNewCustomer({...newCustomer, name: e.target.value})}
                      className={`w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-cyan-500 transition-all ${getHighlightClass("#new-customer-name")}`}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 uppercase font-extrabold mb-1">Email</label>
                    <input
                      id="new-customer-email"
                      type="email"
                      placeholder="rahul@domain.com"
                      value={filledValues["#new-customer-email"] !== undefined ? filledValues["#new-customer-email"] : newCustomer.email}
                      onChange={e => setNewCustomer({...newCustomer, email: e.target.value})}
                      className={`w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-cyan-500 transition-all ${getHighlightClass("#new-customer-email")}`}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 uppercase font-extrabold mb-1">Phone</label>
                    <input
                      id="new-customer-phone"
                      type="text"
                      placeholder="+91 99999 99999"
                      value={filledValues["#new-customer-phone"] !== undefined ? filledValues["#new-customer-phone"] : newCustomer.phone}
                      onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})}
                      className={`w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-cyan-500 transition-all ${getHighlightClass("#new-customer-phone")}`}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 uppercase font-extrabold mb-1">GSTIN</label>
                    <input
                      id="new-customer-gst"
                      type="text"
                      placeholder="27AAPCR1234F1Z5"
                      value={filledValues["#new-customer-gst"] !== undefined ? filledValues["#new-customer-gst"] : newCustomer.gst}
                      onChange={e => setNewCustomer({...newCustomer, gst: e.target.value})}
                      className={`w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-cyan-500 transition-all ${getHighlightClass("#new-customer-gst")}`}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddCustomer(false)}
                    className="px-3 py-1.5 rounded-lg text-[10px] uppercase font-bold text-slate-500 hover:bg-slate-200/50"
                  >
                    Cancel
                  </button>
                  <button
                    id="create-customer-submit"
                    type="submit"
                    className={`px-4 py-1.5 rounded-lg text-[10px] uppercase font-extrabold text-white bg-cyan-600 hover:bg-cyan-500 transition-colors flex items-center gap-1 ${getHighlightClass("#create-customer-submit")}`}
                  >
                    <Check size={11} />
                    Commit Record
                  </button>
                </div>
              </form>
            )}

            <div className="overflow-x-auto">
              <table id="crm-table" className={`min-w-full divide-y divide-slate-200 select-text ${getHighlightClass("#crm-table")}`}>
                <thead>
                  <tr className="text-left text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                    <th className="py-3 px-4">UID</th>
                    <th className="py-3 px-4">Customer Name</th>
                    <th className="py-3 px-4">Email Address</th>
                    <th className="py-3 px-4">Phone Number</th>
                    <th className="py-3 px-4">GST Profile</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-750 font-mono bg-white">
                  {customers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-slate-400 font-sans">
                        CRM is completely empty. Tell AI to register a new lead.
                      </td>
                    </tr>
                  ) : (
                    customers.map(cust => (
                      <tr key={cust.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4 text-cyan-600 font-extrabold">#CUST-{100 + cust.id}</td>
                        <td className="py-3.5 px-4 text-slate-800 font-bold font-sans">{cust.name}</td>
                        <td className="py-3.5 px-4 text-slate-500">{cust.email || "n/a"}</td>
                        <td className="py-3.5 px-4 text-slate-500">{cust.phone || "n/a"}</td>
                        <td className="py-3.5 px-4 text-amber-700 font-bold text-[10px]">{cust.gst_number || "NOT_REGISTERED"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Inventory Tab */}
        {activeSubTab === "inventory" && (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold tracking-wider text-pink-800 uppercase">Stock & Dispatch Registry</h3>
              <button
                id="add-inventory-btn"
                onClick={() => setShowAddStock(!showAddStock)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-extrabold transition-all ${getHighlightClass("#add-inventory-btn")} bg-pink-50 hover:bg-pink-100/80 text-pink-700 border-pink-200`}
              >
                <PlusCircle size={13} />
                Load Inventory
              </button>
            </div>

            {showAddStock && (
              <form onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await fetch("/api/ai/control", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ command: `Add modern product ${newStock.name} SKU ${newStock.sku} price ${newStock.price} with ${newStock.stock} items` })
                  });
                  setNewStock({ name: "", sku: "", stock: "", price: "" });
                  setShowAddStock(false);
                  setActionMessage("Inventory catalog synchronized!");
                  setTimeout(() => setActionMessage(null), 3000);
                  fetchData();
                  onRefreshNeeded();
                } catch (err) {
                  setError("Catalog indexing rejected.");
                }
              }} className="bg-slate-50 border border-slate-205/85 p-4 rounded-xl space-y-3 animate-slide-down shadow-inner">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 font-sans">
                  <div>
                    <label className="block text-[10px] text-slate-500 uppercase font-extrabold mb-1">Product Description</label>
                    <input
                      id="new-stock-name"
                      type="text"
                      required
                      placeholder="Sony 4K Monitor"
                      value={filledValues["#new-stock-name"] !== undefined ? filledValues["#new-stock-name"] : newStock.name}
                      onChange={e => setNewStock({...newStock, name: e.target.value})}
                      className={`w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-pink-500 transition-all ${getHighlightClass("#new-stock-name")}`}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 uppercase font-extrabold mb-1">Serial SKU</label>
                    <input
                      id="new-stock-sku"
                      type="text"
                      required
                      placeholder="MON-SNY-4K"
                      value={filledValues["#new-stock-sku"] !== undefined ? filledValues["#new-stock-sku"] : newStock.sku}
                      onChange={e => setNewStock({...newStock, sku: e.target.value})}
                      className={`w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-pink-500 transition-all ${getHighlightClass("#new-stock-sku")}`}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 uppercase font-extrabold mb-1">Unit Price (₹)</label>
                    <input
                      id="new-stock-price"
                      type="number"
                      required
                      placeholder="35000"
                      value={filledValues["#new-stock-price"] !== undefined ? filledValues["#new-stock-price"] : newStock.price}
                      onChange={e => setNewStock({...newStock, price: e.target.value})}
                      className={`w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-pink-500 transition-all ${getHighlightClass("#new-stock-price")}`}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 uppercase font-extrabold mb-1">Stock Count</label>
                    <input
                      id="new-stock-qty"
                      type="number"
                      required
                      placeholder="15"
                      value={filledValues["#new-stock-qty"] !== undefined ? filledValues["#new-stock-qty"] : newStock.stock}
                      onChange={e => setNewStock({...newStock, stock: e.target.value})}
                      className={`w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-pink-500 transition-all ${getHighlightClass("#new-stock-qty")}`}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 text-sans">
                  <button
                    type="button"
                    onClick={() => setShowAddStock(false)}
                    className="px-3 py-1.5 rounded-lg text-[10px] uppercase font-bold text-slate-500 hover:bg-slate-200/50"
                  >
                    Cancel
                  </button>
                  <button
                    id="create-stock-submit"
                    type="submit"
                    className={`px-4 py-1.5 rounded-lg text-[10px] uppercase font-extrabold text-white bg-pink-600 hover:bg-pink-500 transition-colors flex items-center gap-1 ${getHighlightClass("#create-stock-submit")}`}
                  >
                    <Check size={11} />
                    Commit Catalog
                  </button>
                </div>
              </form>
            )}

            <div className="overflow-x-auto">
              <table id="inventory-table" className={`min-w-full divide-y divide-slate-200 select-text ${getHighlightClass("#inventory-table")}`}>
                <thead>
                  <tr className="text-left text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                    <th className="py-3 px-4">SKU Code</th>
                    <th className="py-3 px-4">Inventory Title</th>
                    <th className="py-3 px-4 text-right">In Stock Box</th>
                    <th className="py-3 px-4 text-right">MSRP Unit Price</th>
                    <th className="py-3 px-4">Warehouse Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-mono bg-white">
                  {inventory.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-slate-400 font-sans">
                        No goods loaded. Prompt AI to sync warehouse restock lists.
                      </td>
                    </tr>
                  ) : (
                    inventory.map(item => (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4 text-pink-600 font-extrabold">{item.sku}</td>
                        <td className="py-3.5 px-4 text-slate-800 font-bold font-sans">{item.name}</td>
                        <td className="py-3.5 px-4 text-right pr-6 font-extrabold">{item.stock}</td>
                        <td className="py-3.5 px-4 text-right pr-6">₹{item.price?.toLocaleString()}</td>
                        <td className="py-3.5 px-4">
                          <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase border ${
                            item.stock > 10 
                              ? "bg-emerald-50 text-emerald-800 border-emerald-200" 
                              : item.stock > 0 
                                ? "bg-amber-50 text-amber-800 border-amber-200" 
                                : "bg-rose-50 text-rose-850 border-rose-200"
                          }`}>
                            {item.stock > 10 ? "Satisfied" : item.stock > 0 ? "Underflow" : "Depleted"}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

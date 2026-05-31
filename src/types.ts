export interface Invoice {
  id: number;
  customer_id?: number;
  customer_name: string;
  invoice_date: string;
  amount: number;
  status: string;
  gst_number: string;
  items: string; // JSON string of items
}

export interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string;
  gst_number: string;
}

export interface Inventory {
  id: number;
  name: string;
  sku: string;
  stock: number;
  price: number;
}

export interface AuditLog {
  id: number;
  timestamp: string;
  agent: string;
  action: string;
  status: string;
}

export interface WorkflowRule {
  id: number;
  trigger_event: string;
  action: string;
  active: boolean;
  trigger_count: number;
}

export interface AgentStatus {
  name: string;
  role: string;
  status: "idle" | "thinking" | "executing" | "success" | "critical";
  lastTask: string;
}

export interface LiveLog {
  id: string;
  time: string;
  message: string;
  type: "info" | "success" | "warning" | "error" | "action";
  agent: string;
}

export interface BrowserAutomationStep {
  type: "navigate" | "highlight" | "click" | "fill" | "success";
  payload: any;
}

export interface CommandResponse {
  success: boolean;
  thought: string;
  speak: string;
  agent: string;
  browserSteps: BrowserAutomationStep[];
  warning?: string;
}

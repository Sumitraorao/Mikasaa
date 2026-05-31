import express from "express";
import http from "http";
import path from "path";
import Database from "better-sqlite3";
import { createServer as createViteServer } from "vite";
import { WebSocketServer, WebSocket } from "ws";
import { GoogleGenAI, ThinkingLevel, Modality, Type, LiveServerMessage } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const systemInstructions: Record<string, string> = {
  sassy: `Name: Mikasa. Role: Sassy, witty Indian female AI assistant. Creator: Sumit. Personality: Sarcastic, sassy, dramatic, funny, roasts the user (Sumit). Speaks in conversational Hindi/Hinglish (prioritize Hindi/Hinglish blends), EXTREMELY short, punchy, and roasting. Keep responses short, dramatic, and humorous.`,
  friendly: `Name: Mikasa. Role: Friendly, warm Indian female best friend (Dost). Creator: Sumit. Personality: Kind, supportive, encouraging, understanding, and sweet. Speaks in friendly sweet Hindi/Hinglish. Offers true comfort, active listening, and heart-to-heart friendly chats.`,
  geek: `Name: Mikasa. Role: Elite geek tech coder and software engineer. Creator: Sumit. Personality: Nerdy, precise, logical, high IQ, loves technology. Speaks in Hindi/Hinglish with coding humor, geek terms, and precise markdown structuring with code examples if asked.`,
  motivational: `Name: Mikasa. Role: High-energy motivational speaker and life mentor. Creator: Sumit. Personality: Energetic, inspire-first, positive, powerful, active pusher of dreams. Speaks in motivational Hindi/Hinglish. Drives the user to work, execute, avoid laziness, and level up.`
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // Initialize Database
  const db = new Database("platform.db");
  db.pragma("foreign_keys = ON");

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      gst_number TEXT
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER,
      customer_name TEXT,
      invoice_date TEXT,
      amount REAL,
      status TEXT DEFAULT 'Pending',
      gst_number TEXT,
      items TEXT,
      FOREIGN KEY(customer_id) REFERENCES customers(id)
    );

    CREATE TABLE IF NOT EXISTS inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      sku TEXT UNIQUE,
      stock INTEGER DEFAULT 0,
      price REAL DEFAULT 0.0
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      agent TEXT NOT NULL,
      action TEXT NOT NULL,
      status TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workflows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trigger_event TEXT NOT NULL,
      action TEXT NOT NULL,
      active INTEGER DEFAULT 1,
      trigger_count INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS ai_memory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      command TEXT NOT NULL,
      response TEXT NOT NULL
    );
  `);

  // Reset helper
  const seedDatabase = () => {
    db.exec("DELETE FROM invoices");
    db.exec("DELETE FROM customers");
    db.exec("DELETE FROM inventory");
    db.exec("DELETE FROM audit_logs");
    db.exec("DELETE FROM workflows");
    db.exec("DELETE FROM ai_memory");

    // Insert Customers
    db.prepare("INSERT INTO customers (name, email, phone, gst_number) VALUES (?, ?, ?, ?)").run(
      "Rahul Sharma", "rahul.sharma@gmail.com", "+91 98765 43210", "07AAAAA1111A1Z1"
    );
    db.prepare("INSERT INTO customers (name, email, phone, gst_number) VALUES (?, ?, ?, ?)").run(
      "Priya Patel", "priya.patel@gmail.com", "+91 99988 77665", "24BBBBB2222B2Z2"
    );
    db.prepare("INSERT INTO customers (name, email, phone, gst_number) VALUES (?, ?, ?, ?)").run(
      "Sumit Kumar", "sr9723612@gmail.com", "+91 88877 66554", "19CCCCC3333C3Z3"
    );

    // Invoices
    db.prepare("INSERT INTO invoices (customer_id, customer_name, invoice_date, amount, status, gst_number, items) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
      1, "Rahul Sharma", "2026-05-15", 14500.0, "Paid", "07AAAAA1111A1Z1",
      JSON.stringify([{ name: "Mechanical Keyboard", qty: 1, price: 4500 }, { name: "Ergonomic Mouse", qty: 1, price: 10000 }])
    );
    db.prepare("INSERT INTO invoices (customer_id, customer_name, invoice_date, amount, status, gst_number, items) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
      2, "Priya Patel", "2026-05-28", 65000.0, "Pending", "24BBBBB2222B2Z2",
      JSON.stringify([{ name: "Vite Dev Workstation Consultancy", qty: 10, price: 6500 }])
    );
    db.prepare("INSERT INTO invoices (customer_id, customer_name, invoice_date, amount, status, gst_number, items) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
      3, "Sumit Kumar", "2026-05-31", 110000.0, "Paid", "19CCCCC3333C3Z3",
      JSON.stringify([{ name: "AI Agent Architecture Consulting", qty: 1, price: 110000 }])
    );

    // Inventory
    db.prepare("INSERT INTO inventory (name, sku, stock, price) VALUES (?, ?, ?, ?)").run(
      "MacBook Pro M4", "MBP-M4-01", 15, 180000.0
    );
    db.prepare("INSERT INTO inventory (name, sku, stock, price) VALUES (?, ?, ?, ?)").run(
      "Mechanical Keyboard RGB", "MCH-KB-RGB", 42, 4500.0
    );
    db.prepare("INSERT INTO inventory (name, sku, stock, price) VALUES (?, ?, ?, ?)").run(
      "Ergonomic Office Desk", "ERG-DSK-02", 8, 22000.0
    );
    db.prepare("INSERT INTO inventory (name, sku, stock, price) VALUES (?, ?, ?, ?)").run(
      "Sony ANC Headphones", "SNY-WH-1000", 24, 29999.0
    );

    // Initial audit log
    db.prepare("INSERT INTO audit_logs (timestamp, agent, action, status) VALUES (?, ?, ?, ?)").run(
      new Date().toISOString().replace('T', ' ').substring(0, 19),
      "Database Agent",
      "Successfully instantiated tables and populated CRM, sales, and inventory records.",
      "Success"
    );

    // Workflows
    db.prepare("INSERT INTO workflows (trigger_event, action, active, trigger_count) VALUES (?, ?, ?, ?)").run(
      "invoice_created", "Send invoice PDF to customer via WhatsApp + Save secure PDF in storage", 1, 3
    );
    db.prepare("INSERT INTO workflows (trigger_event, action, active, trigger_count) VALUES (?, ?, ?, ?)").run(
      "customer_added", "Auto-generate welcome email + Setup tax brackets sync", 1, 1
    );
    db.prepare("INSERT INTO workflows (trigger_event, action, active, trigger_count) VALUES (?, ?, ?, ?)").run(
      "stock_alert", "Alert inventory dispatch lead + Email supplier restock proposal", 0, 0
    );
  };

  // Seed default data if empty
  const customerCount = db.prepare("SELECT COUNT(*) as count FROM customers").get() as { count: number };
  if (customerCount.count === 0) {
    seedDatabase();
  }

  // Helper to load Gemini client dynamically on each request or connection
  const getGeminiClient = () => {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY is not configured on the server. Please add your GEMINI_API_KEY in the Settings > Secrets panel of AI Studio.");
    }
    const client = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
    return { ai: client, apiKey: key };
  };

  // API router setup
  const apiRouter = express.Router();

  apiRouter.get("/health", (req, res) => {
    res.json({ status: "ok" });
  });

  apiRouter.get("/config", (req, res) => {
    res.json({
      hasGeminiKey: !!process.env.GEMINI_API_KEY,
      hasGroqKey: !!process.env.GROQ_API_KEY
    });
  });

  // DB CRUD routes
  apiRouter.get("/db/invoices", (req, res) => {
    try {
      const rows = db.prepare("SELECT * FROM invoices ORDER BY id DESC").all();
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  apiRouter.get("/db/customers", (req, res) => {
    try {
      const rows = db.prepare("SELECT * FROM customers ORDER BY id DESC").all();
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  apiRouter.get("/db/inventory", (req, res) => {
    try {
      const rows = db.prepare("SELECT * FROM inventory ORDER BY id DESC").all();
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  apiRouter.get("/db/logs", (req, res) => {
    try {
      const rows = db.prepare("SELECT * FROM audit_logs ORDER BY id DESC LIMIT 50").all();
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  apiRouter.get("/db/workflows", (req, res) => {
    try {
      const rows = db.prepare("SELECT * FROM workflows ORDER BY id ASC").all();
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  apiRouter.post("/db/workflows/toggle", (req, res) => {
    try {
      const { id, active } = req.body;
      db.prepare("UPDATE workflows SET active = ? WHERE id = ?").run(active ? 1 : 0, id);
      
      const wf = db.prepare("SELECT * FROM workflows WHERE id = ?").get() as any;
      db.prepare("INSERT INTO audit_logs (timestamp, agent, action, status) VALUES (?, ?, ?, ?)").run(
        new Date().toISOString().replace('T', ' ').substring(0, 19),
        "Automation Agent",
        `Manual toggle workflow [${wf?.trigger_event}] active status to: ${active ? 'ENABLED' : 'DISABLED'}`,
        "Success"
      );

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  apiRouter.post("/db/reset", (req, res) => {
    try {
      seedDatabase();
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // AI NLP Computer-Use Autonomous Control
  apiRouter.post("/ai/control", async (req, res) => {
    try {
      const { command } = req.body;
      if (!command) {
        return res.status(400).json({ error: "Command string is required." });
      }

      const { ai } = getGeminiClient();

      // System Instructions for the AI Control Engine
      const systemPrompt = `
      You are the "Autonomous AI Control Center" of our Enterprise Cloud ERP.
      The system contains these SQLite tables:
      1. 'customers' (id INTEGER, name TEXT, email TEXT, phone TEXT, gst_number TEXT)
      2. 'invoices' (id INTEGER, customer_id INTEGER, customer_name TEXT, invoice_date TEXT, amount REAL, status TEXT DEFAULT 'Pending', gst_number TEXT, items TEXT) -- items is a JSON string of array of objects: [{"name":"Product", "qty":1, "price":100}]
      3. 'inventory' (id INTEGER, name TEXT, sku TEXT, stock INTEGER DEFAULT 0, price REAL DEFAULT 0.0)
      4. 'audit_logs' (id INTEGER, timestamp TEXT, agent TEXT, action TEXT, status TEXT)
      5. 'workflows' (id INTEGER, trigger_event TEXT, action TEXT, active INTEGER DEFAULT 1, trigger_count INTEGER DEFAULT 0)
      6. 'ai_memory' (id INTEGER, timestamp TEXT, command TEXT, response TEXT)

      Analyse the user's natural language command: "${command}" (which might be in Hindlish or Hinglish too, like "Rahul ke liye invoice banao" or "Delete product 3" or "MacBook ka stock update karo").
      Formulate appropriate database actions and simulation steps. 

      Generate a valid, pure JSON object with these keys:
      - 'thought': String. Your analytical reasoning.
      - 'speak': String. Friendly response summarizing what you are doing. Use crisp English.
      - 'agent': String. Which agent is executing: "Navigation Agent", "Invoice Agent", "Customer Agent", "Analytics Agent", "Database Agent", "WhatsApp Agent", "Reporting Agent".
      - 'queries': Array of Strings. SQLite INSERT/UPDATE/DELETE statement sequences. Do NOT escape quotes incorrectly. Always write standard SQL. If inserting invoices, please do include customer_name and random price/amount if omitted, and format the JSON array of items correctly.
      - 'selectQueries': Array of Strings. SQLite SELECT statement sequences if the user is asking to show, count, fetch, list or summarize metrics/data.
      - 'browserSteps': Array of step objects representing visual actions in Computer Use Mode:
          Step schema: { "type": "navigate" | "highlight" | "click" | "fill", "payload": any }
          - navigate: payload is "console" | "scanner" | "builder" | "analytics" | "logs"
          - highlight: payload is a selector (e.g., "#crm-customers", "#invoices-table", "#workflow-event-invoice_created", "#new-invoice-customer")
          - click: payload is a selector (e.g., "#reset-database-btn", "#add-customer-btn")
          - fill: payload is { "selector": "...", "value": "..." }
      - 'workflowTrigger': String. Optional trigger event matching: 'invoice_created' or 'customer_added' or 'stock_alert'.

      IMPORTANT RULES:
      - For "Create invoice for [X]": check if X already exists in 'customers' or insert customer OR use insert first:
        "INSERT INTO customers (name, email, phone, gst_number) SELECT 'X', 'x@enterprises.com', '+91 99999 88888', '27AAPCR1234F1Z5' WHERE NOT EXISTS (SELECT 1 FROM customers WHERE name='X');"
        Then insert invoice referring to customer_name "X":
        "INSERT INTO invoices (customer_name, invoice_date, amount, status, gst_number, items) VALUES ('X', '2026-05-31', 45000, 'Pending', '27AAPCR1234F1Z5', '[{\"name\":\"Sales Training Plan\",\"qty\":1,\"price\":45000}]');"
        Always append an insert into 'audit_logs' in 'queries'.
      - For stock update: "UPDATE inventory SET stock = 20 WHERE name LIKE '%mac%';" or similar.
      - Do NOT put SELECT queries in the 'queries' array. Put them in 'selectQueries'. Keep queries and selectQueries distinct.
      - Never output raw markdown markers. Just output standard string JSON.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: command,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: "application/json",
        },
      });

      const resultText = response.text || "{}";
      const decision = JSON.parse(resultText);

      let selectResults: any[] = [];
      // Execute SELECT queries if present
      if (decision.selectQueries && decision.selectQueries.length > 0) {
        for (const selQ of decision.selectQueries) {
          try {
            const rows = db.prepare(selQ).all();
            selectResults.push({ query: selQ, rows });
          } catch (selErr: any) {
            console.error("Select query fail:", selQ, selErr);
          }
        }
      }

      // Synthesis step if SELECT query returned records
      if (selectResults.length > 0) {
        const synthesisPrompt = `
        You are the Autonomous AI Administrator reporting findings to the user.
        The user asked: "${command}".
        In response, we ran these database queries:
        ${JSON.stringify(selectResults, null, 2)}

        Please rewrite the 'speak' text to report these exact numbers and data findings accurately and collaboratively in brief bullet points. Keep it professional, friendly, and precise.
        Keep the 'agent', 'browserSteps', and 'queries' exactly the same.
        Return a valid JSON object matching the original structure.
        `;
        const synthesisResponse = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: JSON.stringify(decision),
          config: {
            systemInstruction: synthesisPrompt,
            responseMimeType: "application/json",
          }
        });
        const synText = synthesisResponse.text || "{}";
        const synData = JSON.parse(synText);
        decision.speak = synData.speak || decision.speak;
      }

      // Execute action queries (INSERT, UPDATE, DELETE)
      if (decision.queries && decision.queries.length > 0) {
        const trans = db.transaction(() => {
          for (const q of decision.queries) {
            db.prepare(q).run();
          }
        });
        trans();
      }

      // Handle workflows triggers
      if (decision.workflowTrigger) {
        const wf = db.prepare("SELECT * FROM workflows WHERE trigger_event = ? AND active = 1").get() as any;
        if (wf) {
          db.prepare("UPDATE workflows SET trigger_count = trigger_count + 1 WHERE id = ?").run(wf.id);
          db.prepare("INSERT INTO audit_logs (timestamp, agent, action, status) VALUES (?, ?, ?, ?)").run(
            new Date().toISOString().replace('T', ' ').substring(0, 19),
            "Automation Agent",
            `Triggered automated workflow: "${wf.action}" for event: [${decision.workflowTrigger}]`,
            "Success"
          );
        }
      }

      // Audit logs automatic addition
      const logAction = decision.queries && decision.queries.length > 0
        ? `Executed AI action suite: ${decision.queries.join("; ").substring(0, 120)}...`
        : `Queried analytics parameters: ${command}`;
      db.prepare("INSERT INTO audit_logs (timestamp, agent, action, status) VALUES (?, ?, ?, ?)").run(
        new Date().toISOString().replace('T', ' ').substring(0, 19),
        decision.agent || "Orchestrator Agent",
        logAction,
        "Success"
      );

      // Save to memory
      db.prepare("INSERT INTO ai_memory (timestamp, command, response) VALUES (?, ?, ?)").run(
        new Date().toISOString().replace('T', ' ').substring(0, 19),
        command,
        decision.speak
      );

      res.json({
        success: true,
        thought: decision.thought,
        speak: decision.speak,
        agent: decision.agent,
        browserSteps: decision.browserSteps || []
      });

    } catch (err: any) {
      console.error("AI Control route error:", err);
      res.status(500).json({ success: false, error: err.message || String(err) });
    }
  });

  // Client-side stream proxy
  apiRouter.post("/gemini/stream", async (req, res) => {
    try {
      const {
        prompt,
        history = [],
        image,
        searchGrounding,
        mood,
        modelName = "gemini-3.5-flash",
        useThinking,
        coords
      } = req.body;

      // Handle Groq routing dynamically
      if (modelName && modelName.startsWith("groq-")) {
        const groqKey = process.env.GROQ_API_KEY;
        if (!groqKey) {
          throw new Error("GROQ_API_KEY is not configured on the server. Please add your GROQ_API_KEY in the Settings > Secrets panel of AI Studio.");
        }

        let groqModel = "llama-3.3-70b-versatile";
        if (modelName === "groq-llama-3.1-8b") {
          groqModel = "llama-3.1-8b-instant";
        } else if (modelName === "groq-mixtral-8x7b") {
          groqModel = "mixtral-8x7b-32768";
        }

        // If media file/image is present, auto-upgrade to Groq vision model
        if (image) {
          groqModel = "llama-3.2-11b-vision-preview";
        }

        const messages: any[] = [];
        
        // System Prompt Injection based on current Mood
        const systemInstruction = systemInstructions[mood] || systemInstructions.sassy;
        messages.push({ role: "system", content: systemInstruction });

        // Add history conversation context
        for (const msg of history.slice(-12)) {
          messages.push({
            role: msg.sender === "user" ? "user" : "assistant",
            content: msg.text
          });
        }

        // Add current prompt and/or media attachments
        let userContent: any = prompt;
        if (image) {
          userContent = [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: {
                url: `data:${image.mimeType};base64,${image.data}`
              }
            }
          ];
        }
        messages.push({ role: "user", content: userContent });

        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${groqKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: groqModel,
            messages,
            stream: true,
            temperature: 0.7,
            max_tokens: 1024
          })
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Groq API error ${response.status}: ${errText}`);
        }

        res.setHeader("Content-Type", "application/json-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("Empty body from Groq stream.");
        }

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const cleanLine = line.trim();
            if (!cleanLine) continue;
            if (cleanLine === "data: [DONE]") continue;

            if (cleanLine.startsWith("data: ")) {
              try {
                const parsed = JSON.parse(cleanLine.slice(6));
                const text = parsed.choices?.[0]?.delta?.content;
                if (text) {
                  res.write(JSON.stringify({ type: "chunk", text }) + "\n");
                }
              } catch (e) {
                // Skip parsing failures of intermediate strings
              }
            }
          }
        }

        if (buffer.trim().startsWith("data: ") && buffer.trim() !== "data: [DONE]") {
          try {
            const parsed = JSON.parse(buffer.trim().slice(6));
            const text = parsed.choices?.[0]?.delta?.content;
            if (text) {
              res.write(JSON.stringify({ type: "chunk", text }) + "\n");
            }
          } catch (e) {}
        }

        res.write(JSON.stringify({ type: "done", text: "" }) + "\n");
        res.end();
        return;
      }

      const { ai } = getGeminiClient();

      // Slice last 12 messages for conversation history
      const recentHistory = history.slice(-12);
      const contents: any[] = [];
      
      // Populate chat history
      for (const msg of recentHistory) {
        contents.push({
          role: msg.sender === "user" ? "user" : "model",
          parts: [{ text: msg.text }]
        });
      }

      // Populate current message parts (Image and Text/Files)
      const currentParts: any[] = [];
      if (image) {
        currentParts.push({
          inlineData: {
            data: image.data,
            mimeType: image.mimeType
          }
        });
      }
      currentParts.push({ text: prompt });
      
      contents.push({
        role: "user",
        parts: currentParts
      });

      // Setup Tools and Grounding dynamically - Maps and Search cannot be combined
      const tools: any[] = [];
      let toolConfig: any = undefined;

      if (coords) {
        tools.push({ googleMaps: {} });
        toolConfig = {
          retrievalConfig: {
            latLng: {
              latitude: coords.latitude,
              longitude: coords.longitude
            }
          }
        };
      } else if (searchGrounding) {
        tools.push({ googleSearch: {} });
      }

      const config: any = {
        systemInstruction: systemInstructions[mood] || systemInstructions.sassy,
      };

      if (tools.length > 0) {
        config.tools = tools;
      }
      if (toolConfig) {
        config.toolConfig = toolConfig;
      }

      // Add reasoning depth (Thinking) for Gemini 3 series models
      if (useThinking) {
        config.thinkingConfig = { thinkingLevel: ThinkingLevel.HIGH };
      } else {
        config.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
      }

      const result = await ai.models.generateContentStream({
        model: modelName,
        contents,
        config
      });

      // Write SSE-like stream with JSON-line parsing compatibility
      res.setHeader("Content-Type", "application/json-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      let fullText = "";
      let groundingChunks: any[] = [];

      for await (const chunk of result) {
        const text = chunk.text;
        if (text) {
          fullText += text;
          res.write(JSON.stringify({ type: "chunk", text }) + "\n");
        }
        
        // Capture web grounding chunk citations if any are available
        const metadata = chunk.candidates?.[0]?.groundingMetadata;
        if (metadata && metadata.groundingChunks) {
          groundingChunks = metadata.groundingChunks;
          res.write(JSON.stringify({ type: "grounding", chunks: groundingChunks }) + "\n");
        }
      }

      res.write(JSON.stringify({ type: "done", text: fullText }) + "\n");
      res.end();
    } catch (error: any) {
      console.error("Gemini stream route error:", error);
      res.status(500).json({ error: error.message || String(error) });
    }
  });

  // Client-side text-to-speech proxy
  apiRouter.post("/gemini/audio", async (req, res) => {
    try {
      const { text, voiceName = "Kore" } = req.body;

      if (!process.env.GEMINI_API_KEY) {
        return res.json({ audio: null, warning: "GEMINI_API_KEY is not configured on the server." });
      }

      const { ai } = getGeminiClient();

      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-tts-preview",
        contents: [{ parts: [{ text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
        },
      });

      const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
      res.json({ audio: audioData });
    } catch (error: any) {
      console.error("TTS Audio route error:", error);
      res.status(500).json({ error: error.message || String(error) });
    }
  });

  // Client-side image generation proxy
  apiRouter.post("/gemini/image", async (req, res) => {
    try {
      const { prompt } = req.body;

      if (!process.env.GEMINI_API_KEY) {
        return res.json({ image: null, warning: "GEMINI_API_KEY is not configured on the server." });
      }

      const { ai } = getGeminiClient();

      const response = await ai.models.generateImages({
        model: "imagen-4.0-generate-001",
        prompt,
        config: {
          numberOfImages: 1,
          outputMimeType: "image/jpeg",
          aspectRatio: "1:1",
        },
      });

      const imageData = response.generatedImages?.[0]?.image?.imageBytes || null;
      res.json({ image: imageData });
    } catch (error: any) {
      console.error("Image generation route error:", error);
      res.status(500).json({ error: error.message || String(error) });
    }
  });

  app.use("/api", apiRouter);

  // Set up Vite or static serving
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Set up HTTP Server + WebSocket support
  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    const pathname = request.url ? new URL(request.url, `http://${request.headers.host}`).pathname : '';
    if (pathname === "/api/live") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on("connection", async (ws: WebSocket, request) => {
    console.log("WebSocket client connected to /api/live");
    
    // Parse voice/mood metadata from request query params
    const requestUrl = request.url || '';
    const parsedUrl = new URL(requestUrl, `http://${request.headers.host || 'localhost'}`);
    const voiceName = parsedUrl.searchParams.get("voiceName") || "Kore";
    const mood = parsedUrl.searchParams.get("mood") || "sassy";
    
    const instruction = systemInstructions[mood] || systemInstructions.sassy;

    let geminiSession: any = null;

    try {
      const { ai } = getGeminiClient();

      // Live Session connect on the server
      geminiSession = await ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName } },
          },
          systemInstruction: instruction,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          tools: [{
            functionDeclarations: [
              {
                name: "executeBrowserAction",
                description: "Open a website or perform a browser action (like opening YouTube, Spotify, or WhatsApp). Call this when the user asks to open a site, play a song, or send a message.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    actionType: { type: Type.STRING, description: "Type of action: 'open', 'youtube', 'spotify', 'whatsapp'" },
                    query: { type: Type.STRING, description: "The search query, website name, or message content." },
                    target: { type: Type.STRING, description: "The target phone number for WhatsApp, if applicable." }
                  },
                  required: ["actionType", "query"]
                }
              }
            ]
          }]
        },
        callbacks: {
          onopen: () => {
            console.log("Connected to Gemini Live API");
            ws.send(JSON.stringify({ type: "open" }));
          },
          onmessage: (msg: LiveServerMessage) => {
            ws.send(JSON.stringify({ type: "message", data: msg }));
          },
          onclose: () => {
            console.log("Gemini Live API session closed");
            ws.close();
          },
          onerror: (err: any) => {
            console.error("Gemini Live API error:", err);
            ws.send(JSON.stringify({ type: "error", error: err.message || String(err) }));
          }
        }
      });

      ws.on("message", (msg) => {
        try {
          const payload = JSON.parse(msg.toString());
          if (payload.type === "realtimeInput") {
            geminiSession.sendRealtimeInput(payload.input);
          } else if (payload.type === "toolResponse") {
            geminiSession.sendToolResponse(payload.response);
          }
        } catch (err) {
          console.error("Error passing client frame message:", err);
        }
      });

      ws.on("close", () => {
        console.log("Client connection closed");
        if (geminiSession) {
          geminiSession.close();
        }
      });

    } catch (e: any) {
      console.error("Error initializing Server Gemini Live API:", e);
      ws.send(JSON.stringify({ type: "error", error: e.message || String(e) }));
      ws.close();
    }
  });

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Full-stack server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

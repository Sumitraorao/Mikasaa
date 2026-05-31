import React, { useState, useEffect, useRef, useCallback } from "react";
import { 
  Mic, 
  MicOff, 
  Loader2, 
  Volume2, 
  VolumeX, 
  Keyboard, 
  Send, 
  Trash2, 
  Image, 
  Camera, 
  Check, 
  Copy, 
  Globe, 
  Sparkles, 
  Settings2, 
  Info,
  Smartphone,
  MapPin,
  Brain,
  FileText,
  Paintbrush,
  HelpCircle,
  Layers,
  Clock,
  ScreenShare,
  Square,
  Radio,
  Monitor,
  X
} from "lucide-react";
import { 
  getMikasaResponseStream, 
  getMikasaAudio, 
  resetMikasaSession, 
  generateMikasaImage 
} from "./services/geminiService";
import { processCommand } from "./services/commandService";
import { LiveSessionManager } from "./services/liveService";
import Visualizer from "./components/Visualizer";
import PermissionModal from "./components/PermissionModal";
import AIDashboard from "./components/AIDashboard";
import { playPCM, playBrowserTTS } from "./utils/audioUtils";
import { motion, AnimatePresence } from "motion/react";

type AppState = "idle" | "listening" | "processing" | "speaking";

interface ChatMessage {
  id: string;
  sender: "user" | "mikasa";
  text: string;
  image?: string; // base64 representation of attached image reference or generated art 
  generatedArt?: boolean;
  groundingChunks?: { web?: { uri: string; title: string }; maps?: { uri: string; title: string } }[];
}

interface CodeBlockProps {
  code: string;
  language: string;
}

function CodeBlock({ code, language }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative my-3 border border-white/10 rounded-xl overflow-hidden bg-[#0A0D11] font-mono text-xs select-text">
      <div className="flex items-center justify-between px-4 py-2 bg-white/[0.04] border-b border-white/10 text-[10px] text-white/50 uppercase select-none">
        <span>{language || "code"}</span>
        <button
          onClick={handleCopy}
          type="button"
          className="hover:text-purple-300 transition-colors flex items-center gap-1 cursor-pointer"
        >
          {copied ? (
            <>
              <Check size={10} className="text-green-400" />
              <span className="text-[9px] text-green-400">Copied!</span>
            </>
          ) : (
            <>
              <Copy size={10} />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto text-[#79FFCA]/90 leading-relaxed scrollbar-thin whitespace-pre select-all">
        <code>{code.trim()}</code>
      </pre>
    </div>
  );
}

function formatMarkdown(text: string) {
  if (!text) return null;

  // Split contents by code blocks: ```lang\ncode\n```
  const parts = text.split(/(```[\s\S]*?```)/g);

  return parts.map((part, index) => {
    if (part.startsWith("```") && part.endsWith("```")) {
      const match = part.match(/```(\w*)\n([\s\S]*?)```/);
      const language = match ? match[1] : "code";
      const code = match ? match[2] : part.slice(3, -3);

      return <div key={index}><CodeBlock code={code} language={language} /></div>;
    }

    // Process general inline elements (bold, inline code, list bullets)
    const lines = part.split("\n");
    return (
      <div key={index} className="space-y-1.5 text-[13px] md:text-sm">
        {lines.map((line, lineIdx) => {
          // Check for empty lines to preserve paragraph flow
          if (!line.trim()) {
            return <div key={lineIdx} className="h-2" />;
          }

          // Check if bullet point
          const isBullet = line.trim().startsWith("- ") || line.trim().startsWith("* ");
          let cleanLine = line;
          if (isBullet) {
            cleanLine = line.replace(/^[\s\-\*]+/, "");
          }

          const elements: React.ReactNode[] = [];
          let elementKey = 0;

          // Split for block structures: bold (**) or inline code (`)
          const regex = /(\*\*.*?\*\*|`.*?`)/g;
          const subParts = cleanLine.split(regex);

          subParts.forEach((subPart) => {
            if (subPart.startsWith("**") && subPart.endsWith("**")) {
              elements.push(
                <strong key={elementKey++} className="font-semibold text-purple-200">
                  {subPart.slice(2, -2)}
                </strong>
              );
            } else if (subPart.startsWith("`") && subPart.endsWith("`")) {
              elements.push(
                <code key={elementKey++} className="px-1.5 py-0.5 rounded bg-white/10 text-pink-300 font-mono text-[11px] border border-white/5">
                  {subPart.slice(1, -1)}
                </code>
              );
            } else {
              elements.push(subPart);
            }
          });

          if (isBullet) {
            return (
              <div key={lineIdx} className="flex items-start gap-2 pl-2">
                <span className="text-pink-400 mt-2 h-1.5 w-1.5 rounded-full bg-pink-400 shrink-0" />
                <span className="flex-1 text-[#E0E2E7]">{elements}</span>
              </div>
            );
          }

          return <p key={lineIdx} className="leading-relaxed text-[#D2D4DC]">{elements}</p>;
        })}
      </div>
    );
  });
}

export default function App() {
  const [viewMode, setViewMode] = useState<"dashboard" | "classic">("dashboard");
  const [appState, setAppState] = useState<AppState>("idle");
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem("mikasa_chat_history");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse chat history", e);
      }
    }
    return [];
  });
  const messagesRef = useRef(messages);

  useEffect(() => {
    messagesRef.current = messages;
    localStorage.setItem("mikasa_chat_history", JSON.stringify(messages));
  }, [messages]);

  // Persistent Settings
  const [mood, setMood] = useState<string>(() => localStorage.getItem("mikasa_mood") || "sassy");
  const [modelName, setModelName] = useState<string>(() => localStorage.getItem("mikasa_model") || "gemini-3.5-flash");
  const [useThinking, setUseThinking] = useState<boolean>(() => localStorage.getItem("mikasa_thinking") === "true");
  const [groundingMode, setGroundingMode] = useState<"offline" | "search" | "maps">(() => {
    return (localStorage.getItem("mikasa_grounding") as any) || "offline";
  });
  const [voiceName, setVoiceName] = useState<string>(() => localStorage.getItem("mikasa_voice") || "Kore");
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    const saved = localStorage.getItem("mikasa_is_muted");
    return saved === "true";
  });

  const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);

  // Vercel deployment guide state toggle
  const [showVercelGuide, setShowVercelGuide] = useState(false);
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);

  const [hasGeminiKey, setHasGeminiKey] = useState<boolean | null>(null);
  const [hasGroqKey, setHasGroqKey] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/config")
      .then((res) => res.json())
      .then((data) => {
        setHasGeminiKey(data.hasGeminiKey);
        setHasGroqKey(data.hasGroqKey);
        // Automatically switch default model to Groq Llama if Gemini key is missing and Groq key is present
        const currentModel = localStorage.getItem("mikasa_model") || "gemini-3.5-flash";
        if (!data.hasGeminiKey && data.hasGroqKey && currentModel.startsWith("gemini-")) {
          setModelName("groq-llama-3.3-70b");
        }
      })
      .catch((err) => console.error("Error fetching keys config:", err));
  }, []);

  const [showLogs, setShowLogs] = useState<boolean>(() => {
    const saved = localStorage.getItem("mikasa_show_logs");
    return saved !== "false";
  });

  useEffect(() => {
    localStorage.setItem("mikasa_show_logs", String(showLogs));
  }, [showLogs]);

  useEffect(() => {
    localStorage.setItem("mikasa_mood", mood);
  }, [mood]);

  useEffect(() => {
    localStorage.setItem("mikasa_model", modelName);
  }, [modelName]);

  useEffect(() => {
    localStorage.setItem("mikasa_thinking", String(useThinking));
  }, [useThinking]);

  useEffect(() => {
    localStorage.setItem("mikasa_grounding", groundingMode);
    
    // Automatically trigger Geolocation context if Maps Mode is selected
    if (groundingMode === "maps") {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setCoordinates({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude
            });
          },
          (error) => {
            console.warn("Could not get user geolocation for maps grounding. Defaulting to Delhi context.", error);
            setCoordinates({ latitude: 28.6139, longitude: 77.2090 });
          }
        );
      } else {
        setCoordinates({ latitude: 28.6139, longitude: 77.2090 });
      }
    } else {
      setCoordinates(null);
    }
  }, [groundingMode]);

  useEffect(() => {
    localStorage.setItem("mikasa_voice", voiceName);
  }, [voiceName]);

  useEffect(() => {
    localStorage.setItem("mikasa_is_muted", String(isMuted));
    if (liveSessionRef.current) {
      liveSessionRef.current.isMuted = isMuted;
    }
  }, [isMuted]);

  const [showTextInput, setShowTextInput] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [isSessionActive, setIsSessionActive] = useState(false);

  // Toggleable HUD panels state (Hidden by default as per user request)
  const [showSettingsHUD, setShowSettingsHUD] = useState<boolean>(false);
  const [showControlHUD, setShowControlHUD] = useState<boolean>(false);

  // Attached image or media file state
  const [attachedImage, setAttachedImage] = useState<string | null>(null); // base64
  const [attachedImageMime, setAttachedImageMime] = useState<string | null>(null);
  const [attachedFileName, setAttachedFileName] = useState<string | null>(null);
  
  const [isPaintingMode, setIsPaintingMode] = useState(false); // Imagen Art Generator Command state
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Screen Share Stream state
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const [isScreenAutoSnapping, setIsScreenAutoSnapping] = useState<boolean>(false);
  const autoSnapIntervalRef = useRef<any | null>(null);

  const startScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 15 }
        },
        audio: false
      });
      setScreenStream(stream);

      // Listen for stream stop (e.g. user clicks browser "Stop sharing" statusbar button)
      stream.getVideoTracks()[0].onended = () => {
        stopScreenShare();
      };
      
      const audioBytes = await getMikasaAudio("Screen capture mode activated. Main screen dekh sakti hu Sumit!", voiceName);
      if (audioBytes && !isMuted) {
        await playPCM(audioBytes);
      }
    } catch (e) {
      console.error("Screen Share initiation failed:", e);
    }
  };

  const stopScreenShare = () => {
    if (screenStream) {
      screenStream.getTracks().forEach(t => t.stop());
      setScreenStream(null);
    }
    setIsScreenAutoSnapping(false);
    if (autoSnapIntervalRef.current) {
      clearInterval(autoSnapIntervalRef.current);
      autoSnapIntervalRef.current = null;
    }
  };

  const fallbackCanvasSnap = useCallback(() => {
    if (screenVideoRef.current && screenVideoRef.current.readyState >= 2) {
      const canvas = document.createElement("canvas");
      canvas.width = screenVideoRef.current.videoWidth || 1280;
      canvas.height = screenVideoRef.current.videoHeight || 720;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(screenVideoRef.current, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/png");
        const base64Data = dataUrl.split(",")[1];
        setAttachedImage(base64Data);
        setAttachedImageMime("image/png");
        setAttachedFileName("Screen Frame Capture");
      }
    }
  }, []);

  const snapScreenFrame = useCallback(() => {
    if (!screenStream) return;
    const track = screenStream.getVideoTracks()[0];
    if (track) {
      const imageCapture = (window as any).ImageCapture ? new (window as any).ImageCapture(track) : null;
      if (imageCapture) {
        imageCapture.grabFrame().then((imageBitmap: ImageBitmap) => {
          const canvas = document.createElement("canvas");
          canvas.width = imageBitmap.width;
          canvas.height = imageBitmap.height;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(imageBitmap, 0, 0);
            const dataUrl = canvas.toDataURL("image/png");
            const base64Data = dataUrl.split(",")[1];
            setAttachedImage(base64Data);
            setAttachedImageMime("image/png");
            setAttachedFileName("Screen Frame Capture");
          }
        }).catch((err: any) => {
          fallbackCanvasSnap();
        });
      } else {
        fallbackCanvasSnap();
      }
    }
  }, [screenStream, fallbackCanvasSnap]);

  useEffect(() => {
    if (isScreenAutoSnapping && screenStream) {
      const activeInterval = setInterval(() => {
        snapScreenFrame();
      }, 7000);
      autoSnapIntervalRef.current = activeInterval;
    } else {
      if (autoSnapIntervalRef.current) {
        clearInterval(autoSnapIntervalRef.current);
        autoSnapIntervalRef.current = null;
      }
    }
    return () => {
      if (autoSnapIntervalRef.current) {
        clearInterval(autoSnapIntervalRef.current);
      }
    };
  }, [isScreenAutoSnapping, screenStream, snapScreenFrame]);

  // Camera capture stream state
  const [showCamera, setShowCamera] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const liveSessionRef = useRef<LiveSessionManager | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, appState]);

  const startCamera = async () => {
    try {
      setShowCamera(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      streamRef.current = stream;
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(e => console.error("Video play failed", e));
        }
      }, 100);
    } catch (e) {
      console.error("Camera access failed", e);
      alert("Microphone, sandbox, or camera blocked! Allow permission or try in a new tab.");
      setShowCamera(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/png");
        const base64Data = dataUrl.split(",")[1];
        setAttachedImage(base64Data);
        setAttachedImageMime("image/png");
        setAttachedFileName("Camera Snap");
      }
    }
    stopCamera();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAttachedFileName(file.name);
      
      const reader = new FileReader();
      if (file.type.startsWith("image/") || file.type.startsWith("audio/") || file.type === "application/pdf") {
        reader.onload = () => {
          const result = reader.result as string;
          const base64Data = result.split(",")[1];
          setAttachedImage(base64Data);
          setAttachedImageMime(file.type);
        };
        reader.readAsDataURL(file);
      } else {
        // Fallback for code files / general text documents (read as raw prompt injection string)
        reader.onload = () => {
          const textContent = reader.result as string;
          setTextInput((prev) => 
            `I have selected a document file [${file.name}]:\n\`\`\`\n${textContent}\n\`\`\`\n\n${prev}`
          );
          setAttachedFileName(`Injected Code: ${file.name}`);
        };
        reader.readAsText(file);
      }
    }
  };

  const handleTextCommand = useCallback(async (finalTranscript: string) => {
    if (!finalTranscript.trim()) {
      setAppState("idle");
      return;
    }

    // Auto-open or close HUD panels based on user request keywords
    const lowerTranscript = finalTranscript.toLowerCase();
    if (
      lowerTranscript.includes("screen") || 
      lowerTranscript.includes("share") || 
      lowerTranscript.includes("sight") || 
      lowerTranscript.includes("control") || 
      lowerTranscript.includes("browser") || 
      lowerTranscript.includes("automation") ||
      lowerTranscript.includes("whatsapp") || 
      lowerTranscript.includes("search") || 
      lowerTranscript.includes("google") || 
      lowerTranscript.includes("maps") || 
      lowerTranscript.includes("directions")
    ) {
      if (lowerTranscript.includes("hide") || lowerTranscript.includes("close") || lowerTranscript.includes("band karo")) {
        setShowControlHUD(false);
      } else {
        setShowControlHUD(true);
      }
    }
    if (
      lowerTranscript.includes("setting") || 
      lowerTranscript.includes("voice") || 
      lowerTranscript.includes("model") || 
      lowerTranscript.includes("brain") || 
      lowerTranscript.includes("reasoning") || 
      lowerTranscript.includes("thinking") || 
      lowerTranscript.includes("mood")
    ) {
      if (lowerTranscript.includes("hide") || lowerTranscript.includes("close") || lowerTranscript.includes("band karo")) {
        setShowSettingsHUD(false);
      } else {
        setShowSettingsHUD(true);
      }
    }

    const currentImage = attachedImage;
    const currentMime = attachedImageMime;

    // Clear attachment states
    setAttachedImage(null);
    setAttachedImageMime(null);
    setAttachedFileName(null);

    const userMessageId = Date.now().toString();
    setMessages((prev) => [
      ...prev, 
      { 
        id: userMessageId, 
        sender: "user", 
        text: finalTranscript,
        image: currentImage || undefined
      }
    ]);
    setShowLogs(true);
    
    if (isSessionActive && liveSessionRef.current) {
      liveSessionRef.current.sendText(finalTranscript);
      return;
    }

    setAppState("processing");

    // 1. If Painting mode is toggled, draw the art directly using Gemini Imagen
    if (isPaintingMode) {
      const messageId = Date.now().toString() + "-art";
      setMessages((prev) => [...prev, { id: messageId, sender: "mikasa", text: "Painting your canvas art using Imagen core..." }]);
      
      const artBase64 = await generateMikasaImage(finalTranscript);
      if (artBase64) {
        setMessages((prev) => 
          prev.map(m => m.id === messageId ? { 
            ...m, 
            text: `Aesthetic creation completed for: "${finalTranscript}"`, 
            image: artBase64,
            generatedArt: true 
          } : m)
        );
        
        if (!isMuted) {
          setAppState("speaking");
          const voiceBytes = await getMikasaAudio("Aesthetic creation completed successfully!", voiceName);
          if (voiceBytes) {
            await playPCM(voiceBytes);
          } else {
            await playBrowserTTS("Aesthetic creation completed successfully!");
          }
        }
      } else {
        setMessages((prev) => 
          prev.map(m => m.id === messageId ? { 
            ...m, 
            text: "Imagen engine failed. Kindly ensure your Gemini configuration supports image generation." 
          } : m)
        );
      }
      setIsPaintingMode(false);
      setAppState("idle");
      return;
    }

    // 2. Check for typical navigation/browser commands
    const commandResult = processCommand(finalTranscript);
    let responseText = "";

    if (commandResult.isBrowserAction) {
      responseText = commandResult.action;
      setMessages((prev) => [...prev, { id: Date.now().toString() + "-z", sender: "mikasa", text: responseText }]);
      
      if (!isMuted) {
        setAppState("speaking");
        const audioBase64 = await getMikasaAudio(responseText, voiceName);
        if (audioBase64) {
          await playPCM(audioBase64);
        } else {
          await playBrowserTTS(responseText);
        }
      }

      setAppState("idle");

      setTimeout(() => {
        if (commandResult.url) {
          window.open(commandResult.url, "_blank");
        }
      }, 1500);
    } else {
      // 3. Conversational grounded Chat via user's designated Gemini Brain setup
      setAppState("processing");
      
      const messageId = Date.now().toString() + "-z";
      setMessages((prev) => [...prev, { id: messageId, sender: "mikasa", text: "" }]);
      
      let accumulatedText = "";
      const isSearch = groundingMode === "search";
      const isMaps = groundingMode === "maps";

      const streamResult = await getMikasaResponseStream(
        finalTranscript, 
        messagesRef.current,
        (chunk) => {
          accumulatedText += chunk;
          setMessages((prev) => 
            prev.map(m => m.id === messageId ? { ...m, text: accumulatedText } : m)
          );
        },
        currentImage ? { data: currentImage, mimeType: currentMime || "image/png" } : null,
        isSearch,
        mood,
        modelName,
        useThinking,
        isMaps ? (coordinates || { latitude: 28.6139, longitude: 77.2090 }) : null
      );
      
      // Update citations and coordinates references once streaming finishes
      if (streamResult.groundingChunks) {
        setMessages((prev) => 
          prev.map(m => m.id === messageId ? { 
            ...m, 
            text: streamResult.text, 
            groundingChunks: streamResult.groundingChunks 
          } : m)
        );
      }

      if (!isMuted) {
        setAppState("speaking");
        const audioBase64 = await getMikasaAudio(streamResult.text, voiceName);
        if (audioBase64) {
          await playPCM(audioBase64);
        } else {
          await playBrowserTTS(streamResult.text);
        }
      }
      setAppState("idle");
    }
  }, [
    isMuted, 
    isSessionActive, 
    attachedImage, 
    attachedImageMime, 
    groundingMode, 
    mood, 
    voiceName, 
    modelName, 
    useThinking, 
    coordinates, 
    isPaintingMode
  ]);

  useEffect(() => {
    return () => {
      if (liveSessionRef.current) {
        liveSessionRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const toggleListening = async () => {
    if (isSessionActive) {
      setIsSessionActive(false);
      if (liveSessionRef.current) {
        liveSessionRef.current.stop();
        liveSessionRef.current = null;
      }
      setAppState("idle");
      resetMikasaSession();
    } else {
      if (hasGeminiKey === false) {
        setErrorMessage("Live real-time WebSocket voice mode requires a Gemini Key. However, Groq is fully active and supported!");
        setErrorCode("GEMINI_KEY_MISSING");
        setShowPermissionModal(true);
        return;
      }
      try {
        setErrorMessage(null);
        setIsSessionActive(true);
        resetMikasaSession();
        
        const session = new LiveSessionManager();
        session.isMuted = isMuted;
        liveSessionRef.current = session;
        
        session.onStateChange = (state) => {
          setAppState(state);
        };
        
        session.onMessage = (sender, text) => {
          setMessages((prev) => [...prev, { id: Date.now().toString() + "-" + sender, sender, text }]);
          setShowLogs(true);
        };
        
        session.onCommand = (url) => {
          setTimeout(() => {
            window.open(url, "_blank");
          }, 1000);
        };

        await session.start(voiceName, mood);
      } catch (e: any) {
        console.error("Failed to start session", e);
        const msg = e.message || String(e);
        const code = e.code || 'UNKNOWN_ERROR';
        setErrorMessage(msg);
        setErrorCode(code);
        
        const lowerMsg = msg.toLowerCase();
        if (lowerMsg.includes("permission") || lowerMsg.includes("microphone") || lowerMsg.includes("not found") || lowerMsg.includes("device") || lowerMsg.includes("in use")) {
          setShowPermissionModal(true);
        }
        setIsSessionActive(false);
        setAppState("idle");
      }
    }
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim() && !attachedImage) return;
    
    handleTextCommand(textInput);
    setTextInput("");
    setShowTextInput(false);
  };

  if (viewMode === "dashboard") {
    return (
      <div className="relative min-h-screen bg-slate-50 text-slate-800 font-sans">
        <AIDashboard />
        
        <button
          onClick={() => setViewMode("classic")}
          className="fixed bottom-4.5 right-4.5 z-50 bg-white border border-slate-200 text-purple-600 font-extrabold text-[10px] uppercase font-mono tracking-wider px-3.5 py-2.5 rounded-full shadow-2xl active:scale-95 transition-all select-none hover:bg-slate-50 hover:border-purple-500/30"
        >
          💬 Chat Companion Mode
        </button>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] w-screen bg-[#020508] text-[#E5E9EE] flex flex-col items-center justify-between font-sans relative overflow-hidden m-0 p-0 select-none">
      
      {/* Dynamic Hidden General File Uploader */}
      <input 
        type="file" 
        ref={fileInputRef} 
        accept="image/*,audio/*,application/pdf,text/*" 
        className="hidden" 
        onChange={handleFileSelect}
      />

      {showPermissionModal && (
        <PermissionModal 
          onClose={() => setShowPermissionModal(false)} 
          error={errorMessage}
          errorCode={errorCode}
          onUseTextMode={() => {
            setShowPermissionModal(false);
            setShowTextInput(true);
          }}
        />
      )}

      {/* Camera Capture Overlay */}
      {showCamera && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-lg flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-[#090E14] border border-cyan-500/30 rounded-2xl max-w-sm w-full p-6 text-center space-y-4 shadow-[0_0_50px_rgba(6,182,212,0.15)] pointer-events-auto"
          >
            <div className="font-mono text-xs uppercase tracking-widest text-cyan-400 flex items-center justify-center gap-1.5 leading-none">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping inline-block" />
              <span>Mikasa Visual Capture Core</span>
            </div>
            <div className="relative rounded-xl overflow-hidden bg-black aspect-video border border-white/10 shadow-inner">
              <video ref={videoRef} className="w-full h-full object-cover scale-x-[-1]" playsInline muted />
            </div>
            <div className="flex gap-2 justify-center">
              <button
                onClick={capturePhoto}
                type="button"
                className="px-5 py-2.5 rounded-full bg-cyan-500 text-black font-bold text-xs hover:bg-cyan-400 transition-transform hover:scale-105 cursor-pointer"
              >
                Snap Photo
              </button>
              <button
                onClick={stopCamera}
                type="button"
                className="px-5 py-2.5 rounded-full bg-white/5 hover:bg-white/10 text-white font-medium text-xs border border-white/10 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* VERCEL DEPLOYMENT INFORMATION MODAL (Hinglish Guided Step-by-Step) */}
      <AnimatePresence>
        {showVercelGuide && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 overflow-y-auto">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#091016] border border-purple-500/30 rounded-2xl max-w-lg w-full p-6 text-left space-y-4 shadow-[0_0_50px_rgba(168,85,247,0.15)] pointer-events-auto"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-black text-white flex items-center justify-center font-bold text-[10px] rounded border border-white/20">▲</div>
                  <h3 className="font-bold text-sm tracking-wider uppercase text-purple-300">Vercel Deployment Guide 🚀</h3>
                </div>
                <button 
                  onClick={() => setShowVercelGuide(false)}
                  className="text-xs text-white/50 hover:text-white px-2 py-1 rounded bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>

              <div className="space-y-3.5 text-xs text-slate-300 overflow-y-auto max-h-[400px] pr-1 select-text scrollbar-thin">
                <p className="leading-relaxed">
                  Sumit! Apne is beautiful single-page React app (Mikasa AI) ko Vercel pe global host karna behad easy hai. Niche diye gaye clean steps follow karo:
                </p>

                <div className="space-y-3">
                  <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5 space-y-1">
                    <span className="font-mono text-[10px] uppercase text-purple-400 font-semibold">Step 1: Push code to GitHub</span>
                    <p className="text-slate-400 text-[11px] leading-relaxed">
                      Pehle is workspace ko apne kisi personal GitHub repository me push karein. (Aisa karne se Vercel use automatically continuous-integrate kar payega).
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5 space-y-1">
                    <span className="font-mono text-[10px] uppercase text-purple-400 font-semibold">Step 2: Connect with Vercel</span>
                    <p className="text-slate-400 text-[11px] leading-relaxed">
                      Vercel Dashboard par jaayein, <b>Add New &gt; Project</b> click karein, aur apna wahi GitHub repository select kar ke load karein.
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5 space-y-1">
                    <span className="font-mono text-[10px] uppercase text-purple-400 font-semibold">Step 3: Environment Configuration (CRITICAL 🗝️)</span>
                    <p className="text-slate-400 text-[11px] leading-relaxed">
                      Configure Project screen par <b>Environment Variables</b> dropdown expand karein aur ye variable setup karein:
                    </p>
                    <div className="mt-1.5 p-2 bg-black font-mono text-[10px] text-pink-400 rounded border border-white/10 select-all">
                      KEY: GEMINI_API_KEY <br/>
                      VALUE: [Apki custom Google AI Studio key]
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5 space-y-1">
                    <span className="font-mono text-[10px] uppercase text-purple-400 font-semibold">Step 4: Click Deploy ⚡</span>
                    <p className="text-slate-400 text-[11px] leading-relaxed">
                      Deploy button click karein! Hamari Vite settings default production ready static build folder <code className="text-cyan-400 text-[10px]">dist/</code> banayegi jo Vercel instant publish kar dega.
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-purple-950/20 border border-purple-500/20 rounded-xl space-y-1.5">
                  <span className="font-semibold text-purple-300 text-[11px] flex items-center gap-1">
                    <Info size={12} />
                    SPA Router Fallback Config (Optional):
                  </span>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    Agar router multi-page elements future features me trigger karega, to root folder me ye <code className="text-pink-400 font-mono">vercel.json</code> create kar lena taki clean URL loads ho payenge:
                  </p>
                  <pre className="p-2 bg-black/60 rounded border border-white/5 font-mono text-[9px] text-emerald-400 select-all overflow-x-auto whitespace-pre">
{`{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}`}
                  </pre>
                </div>
              </div>

              <div className="pt-3 border-t border-white/10 flex justify-end gap-2">
                <button
                  onClick={() => setShowVercelGuide(false)}
                  className="px-4 py-2.5 rounded-xl bg-purple-600 text-white font-bold text-xs hover:bg-purple-500 transition-colors cursor-pointer"
                >
                  Awesome, got it! 👍
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Intelligent Ambient Gradients */}
      <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-25%] left-[-15%] w-[60%] h-[60%] bg-violet-600/10 blur-[130px] rounded-full" />
        <div className="absolute bottom-[-25%] right-[-15%] w-[60%] h-[60%] bg-pink-600/10 blur-[130px] rounded-full" />
        <div className="absolute top-[30%] left-[35%] w-[30%] h-[30%] bg-cyan-500/[0.04] blur-[150px] rounded-full" />
      </div>

      {/* Navigation Header */}
      <header className="absolute top-0 left-0 w-full flex justify-between items-center z-20 shrink-0 px-6 py-4 md:px-12 md:py-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-violet-500 via-pink-500 to-cyan-500 flex items-center justify-center font-bold text-base shadow-[0_0_15px_rgba(236,72,153,0.3)] text-white">
            M
          </div>
          <div className="flex flex-col">
            <h1 className="text-md md:text-lg font-bold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-slate-400 flex items-center gap-1.5">
              MIKASA 
              <span className="text-[9px] font-mono tracking-widest text-[#AF4FFF] px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/20">3.5 PRO</span>
            </h1>
            <span className="text-[8px] md:text-[9px] font-mono uppercase tracking-widest opacity-40">Intelligence Network Assistant</span>
          </div>
        </div>

        <div className="flex items-center gap-2 select-none">
          {/* Back to ERP Dashboard mode */}
          <button
            onClick={() => setViewMode("dashboard")}
            type="button"
            className="p-2 py-1.5 px-3.5 rounded-full border border-purple-500/30 text-purple-300 bg-purple-500/15 hover:bg-purple-500/25 transition-all text-[11px] font-mono uppercase tracking-wider font-bold cursor-pointer"
          >
            🤖 AI ERP Dashboard
          </button>
          {/* Settings panel toggle (Left side HUD) */}
          <button
            onClick={() => setShowSettingsHUD(!showSettingsHUD)}
            type="button"
            className={`p-2 py-1.5 px-3 rounded-full border text-[10px] font-mono uppercase tracking-wider flex items-center gap-1.5 transition-all duration-300 cursor-pointer ${
              showSettingsHUD 
                ? "bg-cyan-500/10 text-cyan-300 border-cyan-500/30 font-semibold" 
                : "bg-[#0E1520] border-white/5 text-slate-400 hover:text-white hover:bg-white/5"
            }`}
            title={showSettingsHUD ? "Hide Settings" : "Configure Settings"}
          >
            <Settings2 size={12} className={showSettingsHUD ? "animate-spin" : "opacity-80"} style={{ animationDuration: '6s' }} />
            <span className="hidden sm:inline">Settings</span>
          </button>

          {/* Screen capture & browser control panel toggle (Right side HUD) */}
          <button
            onClick={() => setShowControlHUD(!showControlHUD)}
            type="button"
            className={`p-2 py-1.5 px-3 rounded-full border text-[10px] font-mono uppercase tracking-wider flex items-center gap-1.5 transition-all duration-300 cursor-pointer ${
              showControlHUD 
                ? "bg-pink-500/10 text-[#E879F9] border-pink-500/30 font-semibold" 
                : "bg-[#0E1520] border-white/5 text-slate-400 hover:text-white hover:bg-white/5"
            }`}
            title={showControlHUD ? "Hide Screen Sight" : "Enable Screen Sight"}
          >
            <ScreenShare size={12} className={showControlHUD ? "animate-pulse" : "opacity-80"} />
            <span className="hidden sm:inline">Screen Sight</span>
          </button>

          {/* Quick Trigger Vercel deploy instructions */}
          <button
            onClick={() => setShowVercelGuide(true)}
            type="button"
            className="px-2.5 py-1.5 rounded-full bg-[#0E1520] hover:bg-purple-600/20 text-purple-300 hover:text-white border border-purple-500/20 text-[10px] font-mono uppercase tracking-wider flex items-center gap-1 transition-all duration-300 md:mr-2 cursor-pointer"
            title="Deploy Mikasa to Vercel"
          >
            <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-ping shrink-0" />
            <span>Deploy</span>
          </button>

          {messages.length > 0 && (
            <button
              onClick={() => setShowLogs(!showLogs)}
              type="button"
              className={`p-2 py-1.5 px-3 rounded-full border text-[10px] font-mono uppercase tracking-wider flex items-center gap-1.5 transition-all duration-300 cursor-pointer ${
                showLogs 
                  ? "bg-violet-500/10 text-violet-300 border-violet-500/30 font-semibold" 
                  : "bg-[#0E1520] border-white/5 text-slate-400 hover:text-white hover:bg-white/5"
              }`}
              title={showLogs ? "Hide Logs" : "Show Logs"}
            >
              <FileText size={12} className={showLogs ? "text-violet-400" : "opacity-80"} />
              <span className="hidden sm:inline">Logs</span>
            </button>
          )}

          {messages.length > 0 && (
            <button
              onClick={() => {
                if (isConfirmingClear) {
                  setMessages([]);
                  resetMikasaSession();
                  setIsConfirmingClear(false);
                } else {
                  setIsConfirmingClear(true);
                  // Auto-reset after 3 seconds if not clicked again
                  setTimeout(() => {
                    setIsConfirmingClear(false);
                  }, 3000);
                }
              }}
              type="button"
              className={
                isConfirmingClear 
                  ? "py-1.5 px-3 rounded-full bg-red-600/35 text-red-100 hover:bg-red-600/40 border border-red-500/40 flex items-center gap-1.5 transition-all scale-105 cursor-pointer font-mono text-[10px] uppercase font-bold tracking-wider"
                  : "p-2.5 rounded-full bg-white/[0.02] hover:bg-red-500/15 hover:text-red-400 hover:border-red-500/20 transition-all border border-white/5 active:scale-95 cursor-pointer"
              }
              title={isConfirmingClear ? "Click again to confirm clear" : "Clear Transmission Logs"}
            >
              {isConfirmingClear ? (
                <>
                  <Trash2 size={13} className="text-red-200 animate-pulse" />
                  <span>Confirm?</span>
                </>
              ) : (
                <Trash2 size={16} className="opacity-80" />
              )}
            </button>
          )}

          <button
            onClick={() => setIsMuted(!isMuted)}
            type="button"
            className="p-2.5 rounded-full bg-white/[0.02] hover:bg-white/5 transition-all border border-white/5 active:scale-95 cursor-pointer"
            title={isMuted ? "Unmute Voice" : "Mute Voice"}
          >
            {isMuted ? (
              <VolumeX size={16} className="opacity-80 text-red-400" />
            ) : (
              <Volume2 size={16} className="opacity-80 text-green-400 animate-pulse" />
            )}
          </button>
        </div>
      </header>

      {/* Sidebar Controls and Visualizer Centering */}
      <main className="absolute inset-0 flex flex-row items-center justify-between w-full h-full z-10 overflow-hidden pt-20 pb-28 px-4 md:px-12 pointer-events-none">
        
        {/* LEFT COLUMN: ADVANCED GLASS CONTROLS HUD */}
        <AnimatePresence>
          {showSettingsHUD && (
            <div className="hidden md:flex w-[28%] lg:w-[24%] h-full flex-col justify-center gap-4 z-20 pointer-events-auto select-none">
              <motion.div 
                initial={{ opacity: 0, x: -50, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -50, scale: 0.95 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="bg-black/60 border border-white/10 rounded-2xl p-4.5 backdrop-blur-md shadow-2xl flex flex-col space-y-3.5 w-full"
              >
                <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                  <Settings2 size={14} className="text-cyan-400" />
                  <span className="font-mono text-[9px] uppercase tracking-wider text-slate-300">Advanced Gemini Core</span>
                </div>

                {/* Model Grade Select */}
                <div className="flex flex-col space-y-1">
                  <label className="text-[9px] font-mono text-white/50 uppercase tracking-widest flex items-center justify-between">
                    <span>Core Engine Brain</span>
                    <Layers size={10} className="text-cyan-400" />
                  </label>
                  <select
                    value={modelName}
                    onChange={(e) => setModelName(e.target.value)}
                    className="w-full text-[11px] bg-[#090D11] border border-white/10 rounded-lg p-2 text-slate-300 outline-none hover:border-cyan-500/30 transition-all cursor-pointer"
                  >
                    <option value="gemini-3.5-flash">Flash 3.5 Engine (Fast Mode)</option>
                    <option value="gemini-3.1-pro-preview">Pro Advanced Brain (Deep Reasoning)</option>
                    <option value="groq-llama-3.3-70b">⚡ Groq Llama 3.3 70B (Blazing Fast)</option>
                    <option value="groq-llama-3.1-8b">⚡ Groq Llama 3.1 8B (Instant Roast)</option>
                    <option value="groq-mixtral-8x7b">⚡ Groq Mixtral 8x7B (Ultra Fast)</option>
                  </select>
                </div>

                {/* High Reasoning / Thinking configuration */}
                <div className="flex flex-col space-y-1.5 pt-1.5 border-t border-white/5">
                  <div className="flex items-center justify-between">
                    <label className="text-[9px] font-mono text-white/50 uppercase tracking-widest flex items-center gap-1.5">
                      <Brain size={11} className="text-purple-400 shrink-0" />
                      <span>Deep Reasoning Mode</span>
                    </label>
                    <button
                      onClick={() => setUseThinking(!useThinking)}
                      type="button"
                      className={`
                        relative w-9 h-5 rounded-full transition-colors duration-300 flex items-center cursor-pointer p-0.5
                        ${useThinking ? "bg-purple-500" : "bg-white/10"}
                      `}
                    >
                      <motion.div 
                        layout
                        className="w-4 h-4 bg-black rounded-full"
                        animate={{ x: useThinking ? 16 : 0 }}
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      />
                    </button>
                  </div>
                  <p className="text-[8px] text-[#A2A9B5] leading-relaxed">
                    Empowers Mikasa with rigorous multi-step analytical logical thinking before answering.
                  </p>
                </div>

                {/* Multi-Grounding Strategy Toggle */}
                <div className="flex flex-col space-y-1.5 pt-1.5 border-t border-white/5">
                  <label className="text-[9px] font-mono text-white/50 uppercase tracking-widest flex items-center gap-1">
                    <Globe size={11} className="text-emerald-400" />
                    <span>Grounding context</span>
                  </label>
                  <div className="grid grid-cols-3 gap-1 bg-[#060A0D]/50 border border-white/5 p-1 rounded-lg">
                    {[
                      { id: "offline", label: "Classic", icon: Clock },
                      { id: "search", label: "Search", icon: Globe },
                      { id: "maps", label: "Places", icon: MapPin }
                    ].map((g) => {
                      const Icon = g.icon;
                      return (
                        <button
                          key={g.id}
                          onClick={() => setGroundingMode(g.id as any)}
                          type="button"
                          className={`
                            text-[9px] py-1.5 px-0.5 rounded flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer
                            ${groundingMode === g.id ? "bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30" : "text-white/40 hover:text-white/70"}
                          `}
                        >
                          <Icon size={10} />
                          <span>{g.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  
                  <p className="text-[8.5px] text-[#A2A9B5] leading-normal pt-0.5">
                    {groundingMode === "offline" && "Speeds response time, relying on offline local models."}
                    {groundingMode === "search" && "Scans live Google Search core for dynamic matches/news inputs."}
                    {groundingMode === "maps" && "Pins Geolocation telemetry, connecting Mikasa to real local place maps."}
                  </p>
                </div>

                {/* Voice select configs */}
                <div className="flex flex-col space-y-1 pt-1.5 border-t border-white/5">
                  <label className="text-[9px] font-mono text-white/50 uppercase tracking-widest leading-none">Voice Outputs</label>
                  <select
                    value={voiceName}
                    onChange={(e) => setVoiceName(e.target.value)}
                    className="w-full text-[11px] bg-[#090D11] border border-white/10 rounded-lg p-2 text-slate-300 outline-none hover:border-white/20 transition-all cursor-pointer"
                  >
                    <option value="Kore">Kore - Hindi/Sassy (Female)</option>
                    <option value="Zephyr">Zephyr - Clear/Sleek (Male)</option>
                    <option value="Puck">Puck - Enthusiastic (Male)</option>
                    <option value="Charon">Charon - Deep (Male)</option>
                    <option value="Fenrir">Fenrir - Bold (Male)</option>
                  </select>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Center Canvas Audio Visualizer */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
          <Visualizer state={appState} />
        </div>

        {/* RIGHT COLUMN: SCREEN SIGHT & WEB COMMANDS HUD */}
        <AnimatePresence>
          {showControlHUD && (
            <div className="hidden md:flex w-[28%] lg:w-[24%] h-full flex-col justify-center gap-4 z-20 pointer-events-auto select-none">
              <motion.div 
                initial={{ opacity: 0, x: 50, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 50, scale: 0.95 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="bg-black/60 border border-white/10 rounded-2xl p-4.5 backdrop-blur-md shadow-2xl flex flex-col space-y-3.5 w-full"
              >
                <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                  <ScreenShare size={14} className="text-[#E879F9]" />
                  <span className="font-mono text-[9px] uppercase tracking-wider text-slate-300">Screen Sight & Controls</span>
                </div>

                {/* Screen Share Connection State */}
                <div className="flex flex-col space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400">Screen Feed Mode</span>
                    <span className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded ${screenStream ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-white/5 text-white/40'}`}>
                      {screenStream ? "● Connected" : "Disconnected"}
                    </span>
                  </div>

                  {!screenStream ? (
                    <button
                      onClick={startScreenShare}
                      type="button"
                      className="w-full py-2.5 rounded-xl bg-purple-600/20 text-purple-200 border border-purple-500/30 font-semibold text-xs hover:bg-purple-600/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <ScreenShare size={14} />
                      <span>Connect Screen Share</span>
                    </button>
                  ) : (
                    <div className="space-y-2">
                      {/* Dynamic Stream preview video slot */}
                      <div className="relative aspect-video rounded-lg overflow-hidden bg-black border border-white/10 flex items-center justify-center">
                        <video 
                          ref={(el) => {
                            screenVideoRef.current = el;
                            if (el && screenStream) {
                              el.srcObject = screenStream;
                              el.play().catch(e => console.error("Screen video preview failed", e));
                            }
                          }}
                          muted 
                          playsInline 
                          autoPlay 
                          className="w-full h-full object-cover scale-x-[1]" 
                        />
                        <div className="absolute top-2 left-2 flex items-center gap-1.5 px-1.5 py-0.5 bg-black/60 backdrop-blur rounded border border-white/10">
                          <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping" />
                          <span className="text-[8px] font-mono text-white/80 uppercase">Rec feed</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          onClick={snapScreenFrame}
                          type="button"
                          className="py-2.5 rounded-lg bg-pink-600/20 text-pink-300 border border-pink-500/30 hover:bg-pink-600/30 text-[10px] font-mono uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1"
                        >
                          <Camera size={11} />
                          <span>Snap Frame</span>
                        </button>
                        <button
                          onClick={stopScreenShare}
                          type="button"
                          className="py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/80 text-[10px] font-mono uppercase tracking-wider transition-all cursor-pointer border border-white/10 flex items-center justify-center gap-1"
                        >
                          <Square size={10} />
                          <span>Stop Feed</span>
                        </button>
                      </div>

                      {/* Auto Snap Control */}
                      <div className="flex items-center justify-between pt-1.5 border-t border-white/5">
                        <label className="text-[9px] font-mono text-white/50 uppercase tracking-widest flex items-center gap-1.5">
                          <Radio size={11} className="text-cyan-400 animate-pulse" />
                          <span>Continuous Eye (Auto-Sync)</span>
                        </label>
                        <button
                          onClick={() => setIsScreenAutoSnapping(!isScreenAutoSnapping)}
                          type="button"
                          className={`
                            relative w-9 h-5 rounded-full transition-colors duration-300 flex items-center cursor-pointer p-0.5
                            ${isScreenAutoSnapping ? "bg-cyan-500" : "bg-white/10"}
                          `}
                        >
                          <motion.div 
                            layout
                            className="w-4 h-4 bg-black rounded-full"
                            animate={{ x: isScreenAutoSnapping ? 16 : 0 }}
                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                          />
                        </button>
                      </div>
                      <p className="text-[8px] text-[#A2A9B5] leading-normal font-sans">
                        Snaps your active screen frame every 7 seconds, passing physical content automatically to Mikasa!
                      </p>
                    </div>
                  )}
                </div>

                {/* Browser Control Operator Console */}
                <div className="flex flex-col space-y-2 pt-2 border-t border-white/5">
                  <div className="flex items-center gap-1.5">
                    <Globe size={13} className="text-pink-400" />
                    <span className="font-mono text-[9px] uppercase tracking-wider text-slate-300">Live Browser Commander</span>
                  </div>
                  <p className="text-[8px] text-slate-400 leading-normal">
                    Command Mikasa to automate browsing actions: "Open WhatsApp/YouTube", "Google [query]", "Locate [place]", or "Search StackOverflow".
                  </p>

                  <div className="text-[10px] bg-[#0A0D11] border border-white/5 p-2 rounded-xl flex flex-col space-y-1.5">
                    <span className="font-mono text-[8px] uppercase tracking-wider text-cyan-400/80">Dispatched Tasks:</span>
                    <div className="flex flex-col gap-1 select-text scrollbar-thin max-h-[85px] overflow-y-auto">
                      {messages.filter(m => m.sender === 'mikasa' && (m.text.includes("Opening") || m.text.includes("Searching") || m.text.includes("Navigating"))).length === 0 ? (
                        <span className="text-[8.5px] italic text-white/30">No web automation triggered yet. Just say "Open GitHub" or "Search for cats".</span>
                      ) : (
                        messages
                          .filter(m => m.sender === 'mikasa' && (m.text.includes("Opening") || m.text.includes("Searching") || m.text.includes("Navigating")))
                          .slice(-3)
                          .map((task, idx) => (
                            <div key={idx} className="flex items-start gap-1 text-[9px] text-[#79FFCA]/90 font-mono">
                              <span className="text-cyan-400">⚡</span>
                              <span className="truncate">{task.text}</span>
                            </div>
                          ))
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </main>

      {/* Scrollable Transparent Logs Panel */}
      <AnimatePresence>
        {messages.length > 0 && showLogs && (
          <motion.div 
            initial={{ opacity: 0, x: 30, scale: 0.98 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 30 }}
            className="absolute left-4 right-4 md:left-auto md:right-12 top-[13%] bottom-[25%] md:w-[410px] bg-[#030609]/75 border border-white-[0.08] rounded-2xl p-4.5 backdrop-blur-xl shadow-[0_30px_70px_rgba(0,0,0,0.8)] flex flex-col z-20 pointer-events-auto overflow-hidden text-left"
            style={{
              borderColor: appState === "listening" ? "rgba(139, 92, 246, 0.15)" : 
                           appState === "processing" ? "rgba(56, 189, 248, 0.15)" : 
                           appState === "speaking" ? "rgba(236, 72, 153, 0.15)" : "rgba(255, 255, 255, 0.08)"
            }}
          >
            <div className="text-xs font-mono text-white/50 border-b border-white/10 pb-2 mb-3 flex justify-between items-center select-none shrink-0">
              <span className="tracking-widest uppercase text-[9px] flex items-center gap-1.5 font-semibold text-cyan-400">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
                Transmission Logs ({mood.toUpperCase()})
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[8px] font-mono text-purple-400 hover:text-purple-300 cursor-pointer select-none" onClick={() => setShowVercelGuide(true)}>
                  VERCEL ACTIVE
                </span>
                <button
                  onClick={() => setShowLogs(false)}
                  type="button"
                  className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white transition-colors cursor-pointer"
                  title="Hide Logs"
                >
                  <X size={12} />
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-hide">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm select-text ${
                      msg.sender === "user"
                        ? "bg-violet-600/15 border border-violet-500/20 text-white rounded-tr-none shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]"
                        : "bg-[#090D14]/90 border border-white-[0.07] text-[#DCE0E6] rounded-tl-none shadow-md"
                    }`}
                  >
                    <div className="font-mono text-[8px] uppercase tracking-widest text-[#B4B6C3]/50 mb-1.5 select-none flex items-center gap-1">
                      {msg.sender === "user" ? (
                        <>
                          <div className="w-1 h-1 bg-violet-400 rounded-full" />
                          <span>Sumit (Owner)</span>
                        </>
                      ) : (
                        <>
                          <div className={`w-1 h-1 rounded-full ${mood === 'sassy' ? 'bg-pink-400' : 'bg-emerald-400'}`} />
                          <span>Mikasa Pro Engine</span>
                        </>
                      )}
                    </div>

                    {/* Multimodal Photo/Attachment Visuals */}
                    {msg.image && (
                      <div className="my-2 max-w-xs rounded-xl overflow-hidden border border-white/10 shadow-lg bg-black/40">
                        <img 
                          src={`data:image/png;base64,${msg.image}`} 
                          alt="Grounded Multimodal Input" 
                          className="w-full h-auto object-cover max-h-[180px] hover:scale-105 transition-transform duration-300" 
                          referrerPolicy="no-referrer"
                        />
                        {msg.generatedArt && (
                          <div className="p-1 px-2.5 font-mono text-[8px] text-center uppercase tracking-widest text-pink-400 bg-pink-950/20 border-t border-white/5 select-none font-semibold">
                            Generated via Imagen 4 Core Art Engine
                          </div>
                        )}
                      </div>
                    )}

                    <div className="whitespace-pre-wrap select-text selection:bg-purple-500/40">
                      {msg.text ? (
                        formatMarkdown(msg.text)
                      ) : (
                        <div className="flex items-center gap-1.5 py-1 text-slate-400 font-mono text-xs italic animate-pulse select-none">
                          <Loader2 size={12} className="animate-spin" />
                          Mikasa dimaag laga rahi hai...
                        </div>
                      )}
                    </div>

                    {/* Custom citations grounded URLs (Search and Maps) */}
                    {msg.groundingChunks && msg.groundingChunks.length > 0 && (
                      <div className="mt-3.5 pt-2.5 border-t border-white/5 flex flex-col space-y-1.5 select-none">
                        <div className="font-mono text-[8px] uppercase tracking-wider text-slate-400/50 flex items-center gap-1">
                          <Globe size={10} className="text-cyan-400" />
                          <span>Sources & dynamic references found:</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {msg.groundingChunks.map((chunk, chunkIdx) => {
                            const isMapSource = chunk.maps !== undefined;
                            const title = isMapSource ? (chunk.maps?.title || "Local Maps recommendation") : (chunk.web?.title || "Web Source");
                            const uri = isMapSource ? chunk.maps?.uri : chunk.web?.uri;
                            
                            if (!uri) return null;
                            return (
                              <a
                                key={chunkIdx}
                                href={uri}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`
                                  inline-flex items-center gap-1 px-2 py-0.5 rounded border transition-all text-[9px]
                                  ${isMapSource 
                                    ? "bg-purple-950/20 text-purple-300 border-purple-500/20 hover:bg-purple-500/20" 
                                    : "bg-cyan-900/20 text-cyan-300 border-cyan-500/20 hover:bg-cyan-500/20"}
                                `}
                              >
                                {isMapSource ? <MapPin size={9} /> : <Globe size={9} />}
                                <span className="max-w-[125px] truncate">{title}</span>
                              </a>
                            );
                          })}
                        </div>
                      </div>
                    )}

                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Foot Controls Interface bar */}
      <footer className="absolute bottom-0 left-0 w-full flex flex-col items-center justify-center pb-6 md:pb-8 z-20 shrink-0 gap-4">
        
        {/* Attachment Preview ribbon */}
        {attachedFileName && (
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 bg-black/80 p-2 px-3 border border-pink-500/30 rounded-xl shadow-xl pointer-events-auto select-none"
          >
            {attachedImage ? (
              <div className="relative w-12 h-10 rounded-lg overflow-hidden border border-white/10">
                <img src={`data:image/png;base64,${attachedImage}`} alt="Capture thumb" className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="p-2 bg-pink-500/10 text-pink-400 rounded-lg border border-white/10">
                <FileText size={16} />
              </div>
            )}
            <div className="flex flex-col">
              <span className="text-[9px] font-mono uppercase text-pink-300">Ready for Multimodal processing</span>
              <span className="text-[8px] text-slate-400 uppercase max-w-[120px] truncate">{attachedFileName}</span>
            </div>
            <button
              onClick={() => { 
                setAttachedImage(null); 
                setAttachedImageMime(null); 
                setAttachedFileName(null); 
              }}
              type="button"
              className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 hover:text-red-400 text-[9px] transition-colors font-mono uppercase shrink-0 cursor-pointer"
            >
              remove
            </button>
          </motion.div>
        )}

        {/* Form panel triggers */}
        <AnimatePresence>
          {showTextInput && (
            <motion.form 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              onSubmit={handleTextSubmit}
              className="w-full max-w-sm md:max-w-md flex items-center gap-2 bg-[#04080B]/90 border border-white/[0.12] rounded-full p-1 pl-4.5 backdrop-blur-md shadow-2xl pointer-events-auto"
            >
              <input 
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder={
                  isPaintingMode 
                    ? "Paint custom details! Write art ideas..." 
                    : attachedImage 
                      ? "Analyzing media file attachment..." 
                      : "Mikasa se kuch dukaal sawaal puchein..."
                }
                className="flex-1 bg-transparent border-none outline-none text-[#F1F3F5] placeholder:text-white/25 text-xs md:text-sm py-1.5"
                autoFocus
              />
              
              {/* Camera snap, Imagen toggle and Local uploader triggers */}
              <div className="flex items-center gap-1 text-slate-400">
                
                {/* Paint Mode Toggle */}
                <button
                  onClick={() => setIsPaintingMode(!isPaintingMode)}
                  type="button"
                  className={`p-2 rounded-full transition-colors cursor-pointer ${isPaintingMode ? "bg-pink-500/20 text-pink-300" : "hover:text-pink-400"}`}
                  title="Toggle Imagen Art Paint Mode"
                >
                  <Paintbrush size={14} />
                </button>

                {/* Webcam capture */}
                <button
                  onClick={startCamera}
                  type="button"
                  className="p-2 rounded-full hover:bg-white/5 hover:text-cyan-400 transition-colors cursor-pointer"
                  title="Snap visual photograph input"
                >
                  <Camera size={14} />
                </button>

                {/* Local files attachment */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  type="button"
                  className="p-2 rounded-full hover:bg-white/5 hover:text-violet-400 transition-colors cursor-pointer"
                  title="Attach images, audios, text documents"
                >
                  <Image size={14} />
                </button>

              </div>

              <button 
                type="submit"
                disabled={!textInput.trim() && !attachedImage}
                className="p-2.5 rounded-full bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-20 transition-all cursor-pointer active:scale-95 shrink-0"
              >
                <Send size={14} />
              </button>
            </motion.form>
          )}
        </AnimatePresence>

        {/* Interactive primary round triggers */}
        <div className="flex items-center gap-4 pointer-events-auto select-none">
          
          {/* Quick HUD access toggle (on mobile instead of persistent side layout) */}
          <span className="md:hidden">
            <button
              onClick={() => {
                const nextMood = mood === "sassy" ? "friendly" : mood === "friendly" ? "geek" : mood === "geek" ? "motivational" : "sassy";
                setMood(nextMood);
                alert(`Mikasa mood is now: ${nextMood.toUpperCase()}`);
              }}
              type="button"
              className="p-4 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-white transition-all shadow-2xl active:scale-90 cursor-pointer"
              title="Change Mood"
            >
              <Sparkles size={20} className="text-pink-400" />
            </button>
          </span>

          <button
            onClick={toggleListening}
            type="button"
            className={`
              group relative flex items-center justify-center gap-3 px-8 py-4.5 rounded-full font-semibold tracking-widest text-[10px] md:text-xs uppercase transition-all duration-300 shadow-2xl select-none cursor-pointer
              ${
                isSessionActive
                  ? "bg-red-500/20 text-red-300 border border-red-500/40 hover:bg-red-500/30"
                  : "bg-white/10 text-white border border-white/10 hover:bg-white/15 hover:scale-[1.03] hover:border-pink-500/30 active:scale-95"
              }
            `}
            style={{
              boxShadow: isSessionActive 
                ? "0 0 35px rgba(239, 68, 68, 0.2), inset 0 1px 1px rgba(255, 255, 255, 0.1)"
                : "0 15px 35px rgba(0, 0, 0, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.05)"
            }}
          >
            {isSessionActive ? (
              <>
                <MicOff size={16} />
                <span>Disconnect Mic</span>
              </>
            ) : (
              <>
                <Mic size={16} className="group-hover:animate-bounce text-violet-400" />
                <span>Interact Live Voice</span>
              </>
            )}
          </button>
          
          <button
            onClick={() => setShowTextInput(!showTextInput)}
            type="button"
            className={`
              p-4 rounded-full transition-all shadow-2xl active:scale-90 cursor-pointer
              ${showTextInput ? "bg-violet-500/20 text-violet-300 border border-violet-500/30 font-bold" : "bg-white/5 border border-white/10 hover:bg-white/10 text-white"}
            `}
            title="Toggle Typing Console"
          >
            <Keyboard size={20} className="opacity-80" />
          </button>
        </div>
      </footer>
    </div>
  );
}

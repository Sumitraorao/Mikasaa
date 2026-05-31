import { processCommand } from "./commandService";

interface LiveServerMessage {
  serverContent?: {
    modelTurn?: {
      parts?: {
        inlineData?: {
          data?: string;
        };
        text?: string;
      }[];
    };
    interrupted?: boolean;
  };
  toolCall?: {
    functionCalls?: {
      name: string;
      id: string;
      args: any;
    }[];
  };
}

const systemInstructions: Record<string, string> = {
  sassy: `Name: Mikasa. Role: Sassy, witty Indian female AI assistant. Creator: Sumit. Personality: Sarcastic, sassy, dramatic, funny, roasts the user (Sumit) in a sister/friend way. Speaks in Hinglish (Hinglish/Hindi blend). Extremely punchy, roasting and witty. Keep answers short and sassy.`,
  friendly: `Name: Mikasa. Role: Friendly, warm Indian female best friend (Dost). Creator: Sumit. Personality: Kind, supportive, encouraging, understanding, and sweet. Speaks in friendly sweet Hindi/Hinglish. Offers true comfort, active listening, and heart-to-heart friendly chats.`,
  geek: `Name: Mikasa. Role: Elite geek tech coder and software engineer. Creator: Sumit. Personality: Nerdy, precise, logical, high IQ, loves technology. Speaks in Hindi/Hinglish with coding humor, geek terms, and precise markdown structuring.`,
  motivational: `Name: Mikasa. Role: High-energy motivational speaker and life mentor. Creator: Sumit. Personality: Energetic, inspire-first, positive, powerful, active pusher of dreams. Speaks in motivational Hindi/Hinglish. Drives the user to work, execute, and level up.`
};

export class LiveSessionManager {
  private static globalAudioContext: AudioContext | null = null;
  private static globalPlaybackContext: AudioContext | null = null;

  private socket: WebSocket | null = null;
  private sessionPromise: Promise<any> | null = null;
  private session: any = null;
  private audioContext: AudioContext | null = null;
  private playbackContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private nextPlayTime: number = 0;
  private isPlaying: boolean = false;
  public isMuted: boolean = false;
  
  public onStateChange: (state: "idle" | "listening" | "processing" | "speaking") => void = () => {};
  public onMessage: (sender: "user" | "mikasa", text: string) => void = () => {};
  public onCommand: (url: string) => void = () => {};

  constructor() {}

  async start(voiceName: string = "Kore", mood: string = "sassy") {
    if (this.session || this.sessionPromise) {
      this.stop();
    }

    try {
      this.onStateChange("processing");

      // 1. Get Microphone FIRST (closest to user gesture)
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("Your browser does not support microphone access. Please use a modern browser like Chrome or Edge.");
        }

        // Tiered constraints fallback
        const constraintTiers = [
          { audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } },
          { audio: { echoCancellation: true } },
          { audio: true }
        ];

        let stream: MediaStream | null = null;
        let lastError: any = null;

        for (const constraints of constraintTiers) {
          try {
            // Small delay between fallback attempts to allow hardware to reset
            if (constraints === constraintTiers[constraintTiers.length - 1]) {
              await new Promise(resolve => setTimeout(resolve, 300));
            }
            stream = await navigator.mediaDevices.getUserMedia(constraints);
            if (stream) {
              console.log("Microphone access granted with constraints:", constraints);
              break;
            }
          } catch (e: any) {
            lastError = e;
            // If it's a permission error, don't keep trying simpler constraints, just fail
            if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
              break;
            }
            console.warn(`Constraint tier failed:`, constraints, e.name);
          }
        }

        if (!stream) {
          // Diagnostic as hint, not hard block
          let mics: MediaDeviceInfo[] = [];
          try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            mics = devices.filter(d => d.kind === 'audioinput');
            console.log("Diagnostic - audioinput count:", mics.length);
          } catch (e) {
            console.warn("Could not enumerate devices for diagnostic", e);
          }

          const errName = lastError?.name || '';
          
          if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
            const hwError = new Error("No hardware found: Mikasa can't find a microphone. Please connect one or check system settings.");
            (hwError as any).code = 'DEVICE_NOT_FOUND';
            throw hwError;
          }
          
          if (mics.length === 0) {
             const sandboxError = new Error("Hardware detection failed. This usually happens in the browser preview. Please open in a new tab to bypass sandbox restrictions.");
             (sandboxError as any).code = 'DEVICE_NOT_FOUND';
             throw sandboxError;
          }

          throw lastError || new Error("Failed to initialize microphone.");
        }
        
        this.mediaStream = stream;
      } catch (micError: any) {
        if (micError.code) throw micError; // Re-throw specialized errors

        console.error("Microphone Access Error:", micError);
        const errName = micError.name || '';
        const errMsg = (micError.message || '').toLowerCase();
        
        let customError: Error;
        
        if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError' || errMsg.includes('permission denied')) {
          customError = new Error("Permission denied: Please allow microphone access in your browser settings. If you're in a preview, try opening the app in a new tab.");
          (customError as any).code = 'PERMISSION_DENIED';
        } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError' || errMsg.includes('not found') || errMsg.includes('no device')) {
          customError = new Error("No microphone found: Mikasa can't find a microphone. Please connect one, check system settings, or try opening this in a new tab.");
          (customError as any).code = 'DEVICE_NOT_FOUND';
        } else if (errName === 'NotReadableError' || errName === 'TrackStartError' || errMsg.includes('could not start') || errMsg.includes('in use')) {
          customError = new Error("Microphone in use: Your microphone is being used by another application (like Zoom or Teams) or is blocked at the system level.");
          (customError as any).code = 'DEVICE_IN_USE';
        } else if (errName === 'OverconstrainedError' || errMsg.includes('constraints')) {
          customError = new Error("Constraint error: Your browser could not satisfy the microphone quality requirements. Try a different device.");
          (customError as any).code = 'CONSTRAINT_ERROR';
        } else {
          customError = new Error(micError.message || 'Unknown microphone error');
          (customError as any).code = 'UNKNOWN_MIC_ERROR';
        }
        throw customError;
      }

      // Initialize Audio Contexts (Reuse if possible)
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      
      if (!LiveSessionManager.globalAudioContext) {
        LiveSessionManager.globalAudioContext = new AudioContextClass({ sampleRate: 16000 });
      }
      this.audioContext = LiveSessionManager.globalAudioContext;

      if (!LiveSessionManager.globalPlaybackContext) {
        LiveSessionManager.globalPlaybackContext = new AudioContextClass({ sampleRate: 24000 });
      }
      this.playbackContext = LiveSessionManager.globalPlaybackContext;
      
      this.nextPlayTime = this.playbackContext.currentTime;

      if (this.audioContext && this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      if (this.playbackContext && this.playbackContext.state === 'suspended') {
        await this.playbackContext.resume();
      }

      this.source = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

      this.processor.onaudioprocess = (e) => {
        if (!this.sessionPromise) return;
        const inputData = e.inputBuffer.getChannelData(0);
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          let s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        
        // Convert to base64
        const buffer = new ArrayBuffer(pcm16.length * 2);
        const view = new DataView(buffer);
        for (let i = 0; i < pcm16.length; i++) {
          view.setInt16(i * 2, pcm16[i], true);
        }
        
        let binary = '';
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64Data = btoa(binary);

        this.sessionPromise.then(session => {
          if (!this.session) return;
          session.sendRealtimeInput({
            audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
          });
        }).catch(err => {
          if (this.session) {
            console.error("Error sending audio", err);
          }
        });
      };

      this.source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);

      // Connect to our server-side WebSocket proxy
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/api/live?voiceName=${encodeURIComponent(voiceName)}&mood=${encodeURIComponent(mood)}`;
      
      const socket = new WebSocket(wsUrl);
      this.socket = socket;

      this.sessionPromise = new Promise((resolve, reject) => {
        socket.onopen = () => {
          console.log("WebSocket client connected to server-side Live proxy");
          resolve({
            sendRealtimeInput: (input: any) => {
              if (socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({ type: "realtimeInput", input }));
              }
            },
            sendToolResponse: (response: any) => {
              if (socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({ type: "toolResponse", response }));
              }
            },
            close: () => {
              socket.close();
            }
          });
        };
        socket.onerror = (err) => {
          reject(err);
        };
      });

      socket.onmessage = async (event) => {
        try {
          const payload = JSON.parse(event.data);
          
          if (payload.type === "open") {
            console.log("Live API Connected via backend server");
            this.sessionPromise?.then(s => {
              this.session = s;
              this.onStateChange("listening");
            });
          } else if (payload.type === "message" && payload.data) {
            const message: LiveServerMessage = payload.data;

            // Handle Audio Output
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
              this.onStateChange("speaking");
              this.playAudioChunk(base64Audio);
            }

            // Handle Interruption
            if (message.serverContent?.interrupted) {
              this.stopPlayback();
              this.onStateChange("listening");
            }

            // Handle Transcriptions
            const userText = message.serverContent?.modelTurn?.parts?.[0]?.text;
            if (userText) {
               this.onMessage("mikasa", userText);
            }

            // Handle Function Calls
            const functionCalls = message.toolCall?.functionCalls;
            if (functionCalls && functionCalls.length > 0) {
              for (const call of functionCalls) {
                if (call.name === "executeBrowserAction") {
                  const args = call.args as any;
                  let url = "";
                  if (args.actionType === "youtube") {
                    url = `https://www.youtube.com/results?search_query=${encodeURIComponent(args.query)}`;
                  } else if (args.actionType === "spotify") {
                    url = `https://open.spotify.com/search/${encodeURIComponent(args.query)}`;
                  } else if (args.actionType === "whatsapp") {
                    url = `https://web.whatsapp.com/send?phone=${args.target || ''}&text=${encodeURIComponent(args.query)}`;
                  } else {
                    let website = args.query.replace(/\s+/g, "");
                    if (!website.includes(".")) website += ".com";
                    url = `https://www.${website}`;
                  }
                  
                  this.onCommand(url);
                  
                  // Send tool response
                  this.sessionPromise?.then(session => {
                     session.sendToolResponse({
                       functionResponses: [{
                         name: call.name,
                         id: call.id,
                         response: { result: "Action executed successfully in the browser." }
                       }]
                     });
                  });
                }
              }
            }
          } else if (payload.type === "error") {
            console.error("Server Live API error details:", payload.error);
            this.onMessage("mikasa", "Uff, key ya connection issue ho gaya. Please check your connection or try again, Sumit!");
            this.stop();
          }
        } catch (err) {
          console.error("Error parsing WebSocket message from server:", err);
        }
      };

      socket.onclose = () => {
        console.log("Server Live API session closed");
        this.stop();
      };

    } catch (error) {
      console.error("Failed to start Live Session:", error);
      this.stop();
      throw error;
    }
  }

  private playAudioChunk(base64Data: string) {
    if (!this.playbackContext || this.isMuted) return;
    
    try {
      const binaryString = atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const buffer = new Int16Array(bytes.buffer);
      const audioBuffer = this.playbackContext.createBuffer(1, buffer.length, 24000);
      const channelData = audioBuffer.getChannelData(0);
      for (let i = 0; i < buffer.length; i++) {
        channelData[i] = buffer[i] / 32768.0;
      }
      
      const source = this.playbackContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.playbackContext.destination);
      
      const currentTime = this.playbackContext.currentTime;
      if (this.nextPlayTime < currentTime) {
        this.nextPlayTime = currentTime;
      }
      
      source.start(this.nextPlayTime);
      this.nextPlayTime += audioBuffer.duration;
      this.isPlaying = true;
      
      source.onended = () => {
        if (this.playbackContext && this.playbackContext.currentTime >= this.nextPlayTime - 0.1) {
          this.isPlaying = false;
          this.onStateChange("listening");
        }
      };
    } catch (e) {
      console.error("Error playing chunk", e);
    }
  }

  private stopPlayback() {
    if (this.playbackContext) {
      if (this.playbackContext.state !== 'closed') {
        try {
          this.playbackContext.close().catch(() => {});
        } catch (e) {
          console.error("Error closing playback context:", e);
        }
      }
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.playbackContext = new AudioContextClass({ sampleRate: 24000 });
      LiveSessionManager.globalPlaybackContext = this.playbackContext;
      this.nextPlayTime = this.playbackContext.currentTime;
      this.isPlaying = false;
    }
  }

  stop() {
    if (this.processor) {
      try { this.processor.disconnect(); } catch (e) {}
      this.processor = null;
    }
    if (this.source) {
      try { this.source.disconnect(); } catch (e) {}
      this.source = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => {
        try { t.stop(); } catch (e) {}
      });
      this.mediaStream = null;
    }
    
    this.stopPlayback();
    
    if (this.sessionPromise) {
      this.sessionPromise.then(session => {
        this.session = null;
        session.close();
      }).catch(() => {});
      this.sessionPromise = null;
    }
    
    if (this.socket) {
      try { this.socket.close(); } catch (e) {}
      this.socket = null;
    }

    this.session = null;
    this.onStateChange("idle");
  }

  sendText(text: string) {
    if (this.sessionPromise) {
      this.sessionPromise.then(session => {
        session.sendRealtimeInput({ text });
      });
    }
  }
}

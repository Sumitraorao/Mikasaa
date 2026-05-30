import { GoogleGenAI, LiveServerMessage, Modality, Type } from "@google/genai";
import { processCommand } from "./commandService";

const systemInstruction = `Name: Mikasa. Role: Sassy, witty Indian female AI assistant. Creator: Sumit. Personality: Intelligent, dramatic, funny, roasts Sumit. Style: Hinglish, EXTREMELY short, punchy responses.`;

export class LiveSessionManager {
  private static globalAudioContext: AudioContext | null = null;
  private static globalPlaybackContext: AudioContext | null = null;

  private ai: GoogleGenAI | null = null;
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

  async start() {
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
          
          // Only throw DEVICE_NOT_FOUND if the browser explicitly says NotFoundError 
          // OR it's a legacy browser 'DevicesNotFoundError'.
          if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
            const hwError = new Error("No hardware found: Mikasa can't find a microphone. Please connect one or check system settings.");
            (hwError as any).code = 'DEVICE_NOT_FOUND';
            throw hwError;
          }
          
          // If we have no stream AND no hardware list, it's likely a sandbox issue
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

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not defined in the environment.");
      }
      this.ai = new GoogleGenAI({ apiKey });

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
          // Only log if it's not a "session closed" error
          if (this.session) {
            console.error("Error sending audio", err);
          }
        });
      };

      this.source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);

      // Connect to Live API
      this.sessionPromise = this.ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          systemInstruction,
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
            console.log("Live API Connected");
            this.sessionPromise?.then(s => {
              this.session = s;
              this.onStateChange("listening");
            });
          },
          onmessage: async (message: LiveServerMessage) => {
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
               // Output transcription
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
          },
          onclose: () => {
            console.log("Live API Closed");
            this.stop();
          },
          onerror: (err) => {
            console.error("Live API Error Details:", JSON.stringify(err, Object.getOwnPropertyNames(err)));
            this.onMessage("mikasa", "Uff, network issue ho gaya. Please check your connection or try again.");
            this.stop();
          }
        }
      });

    } catch (error) {
      console.error("Failed to start Live Session:", error);
      this.stop();
      throw error; // Re-throw to allow caller to handle
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
      // Update global reference so next session doesn't use a closed context
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
    
    // Don't close global contexts, just suspend them if needed
    // But for now we keep them open for faster restart
    
    this.stopPlayback();
    
    if (this.sessionPromise) {
      this.sessionPromise.then(session => {
        this.session = null;
        session.close();
      }).catch(() => {});
      this.sessionPromise = null;
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

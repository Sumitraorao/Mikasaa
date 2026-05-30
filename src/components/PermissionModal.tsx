import React from 'react';
import { motion } from 'motion/react';
import { MicOff } from 'lucide-react';

interface Props {
  onClose: () => void;
  error?: string | null;
  errorCode?: string | null;
  onUseTextMode?: () => void;
}

export default function PermissionModal({ onClose, error, errorCode, onUseTextMode }: Props) {
  const getHeader = () => {
    switch (errorCode) {
      case 'PERMISSION_DENIED':
        return {
          title: "Interface Blocked",
          code: "Access_Denial_Protocol",
          desc: "Chrome_Sandboxed_Iframe_Policy prevents audio capture until permission is explicitly granted."
        };
      case 'DEVICE_NOT_FOUND':
        return {
          title: "Hardware Not Detected",
          code: "Audio_Input_Null",
          desc: "Peripheral connection failed. No active audio input detected on current system bus."
        };
      case 'DEVICE_IN_USE':
        return {
          title: "Resource Conflict",
          code: "Hardware_Lock_Detected",
          desc: "Target peripheral is currently reserved by another process. System unable to hijack stream."
        };
      case 'CONSTRAINT_ERROR':
        return {
          title: "Specification Mismatch",
          code: "IO_Constraint_Failure",
          desc: "Hardware unable to satisfy requested Mikasa core audio specifications (16kHz PCM)."
        };
      default:
        return {
          title: "System Alert",
          code: "Unknown_Peripheral_Error",
          desc: "An unexpected error occurred during audio initialization protocol."
        };
    }
  };

  const header = getHeader();

  const renderSteps = () => {
    const commonTabStep = (
      <li className="flex gap-3 bg-blue-500/10 p-3 rounded-lg border border-blue-500/20">
        <span className="text-blue-400 font-mono font-bold text-lg">01</span>
        <div className="flex flex-col">
          <span className="font-bold text-white">FIX: Open in New Tab</span>
          <span className="text-[11px] opacity-80">The browser preview sandbox often blocks access to physical hardware. Clicking the arrow icon in the top right of this preview usually fixes it instantly.</span>
        </div>
      </li>
    );

    if (errorCode === 'PERMISSION_DENIED') {
      return (
        <ol className="text-xs text-white/80 space-y-3 font-sans">
          {commonTabStep}
          <li className="flex gap-3">
            <span className="text-blue-400 font-mono">02</span>
            <span><b>Enable Microphone:</b> Click the Lock (🔒) icon in the URL bar and toggle the Microphone switch to "Allow".</span>
          </li>
          <li className="flex gap-3">
            <span className="text-blue-400 font-mono">03</span>
            <span><b>Refresh Session:</b> Reload the page once permissions are granted.</span>
          </li>
        </ol>
      );
    }

    if (errorCode === 'DEVICE_NOT_FOUND') {
      return (
        <ol className="text-xs text-white/80 space-y-3 font-sans">
          {commonTabStep}
          <li className="flex gap-3">
            <span className="text-blue-400 font-mono0">02</span>
            <span><b>Check Connection:</b> Ensure your headset or mic is fully plugged in. Try unplugging and replugging.</span>
          </li>
          <li className="flex gap-3">
            <span className="text-blue-400 font-mono">03</span>
            <span><b>OS Settings:</b> Check System Settings &gt; Sound &gt; Input and verify the device is selected and active.</span>
          </li>
        </ol>
      );
    }

    if (errorCode === 'DEVICE_IN_USE') {
      return (
        <ol className="text-xs text-white/80 space-y-3 font-sans">
          <li className="flex gap-3">
            <span className="text-blue-400 font-mono">01</span>
            <span><b>Close Conflicts:</b> Termination of Zoom, Teams, or Meet sessions is required. Only one app can sample the microphone at once.</span>
          </li>
          <li className="flex gap-3">
            <span className="text-blue-400 font-mono">02</span>
            <span><b>Browser Restart:</b> If the error persists, the browser might be hanging onto the hardware. Restarting often clears the lock.</span>
          </li>
          {commonTabStep}
        </ol>
      );
    }

    return (
      <ol className="text-xs text-white/80 space-y-3 font-sans">
        {commonTabStep}
        <li className="flex gap-3">
          <span className="text-blue-400 font-mono">02</span>
          <span><b>Toggle Settings:</b> Verify browser permissions and hardware state in your system settings.</span>
        </li>
      </ol>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a0a0a]/80 backdrop-blur-xl p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-md bg-[#151619] border border-white/10 rounded-2xl p-0 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] flex flex-col items-center text-center relative overflow-hidden"
      >
        {/* Top Hardware Accent */}
        <div className="w-full h-1 bg-gradient-to-r from-red-600 via-orange-500 to-red-600" />
        
        <div className="p-8 w-full flex flex-col items-center">
          <div className="w-16 h-16 rounded-full border border-red-500/30 flex items-center justify-center mb-6 relative">
            <div className="absolute inset-0 rounded-full bg-red-500/10 animate-pulse" />
            <MicOff size={32} className="text-red-500 relative z-10" />
          </div>
          
          <div className="font-mono text-[10px] uppercase tracking-widest text-red-500/70 mb-2">System Alert // Peripheral Error</div>
          <h2 className="text-2xl font-sans font-bold text-white mb-2 tracking-tight">
            {header.title}
          </h2>
          <p className="text-white/50 text-xs font-mono mb-8 uppercase tracking-tighter leading-relaxed">
            &gt; Error code structure: {header.code}. {header.desc}
          </p>
          
          <div className="space-y-4 w-full">
            <div className="bg-black/40 border border-white/5 rounded-xl p-5 text-left w-full">
              <p className="font-mono text-[10px] text-white/40 uppercase tracking-widest mb-3 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                Recommended Resolution
              </p>
              
              {renderSteps()}
            </div>
            
            <div className="flex flex-col gap-2 pt-2">
              {onUseTextMode && (
                <button 
                  onClick={onUseTextMode}
                  className="w-full py-4 px-6 bg-gradient-to-r from-violet-600 to-pink-500 hover:from-violet-500 hover:to-pink-400 text-white font-bold text-sm uppercase tracking-tighter rounded-xl transition-all active:scale-[0.98] shadow-lg shadow-violet-500/20 mb-1"
                >
                  Type Mode me chat karein ⌨️
                </button>
              )}
              <button 
                onClick={() => window.location.reload()}
                className="w-full py-3.5 px-6 bg-white text-black font-bold text-xs uppercase tracking-tighter rounded-xl hover:bg-gray-200 transition-all active:scale-[0.98]"
              >
                Execute Page Refresh
              </button>
              <button 
                onClick={onClose}
                className="w-full py-2.5 px-6 bg-white/5 text-white/40 font-mono text-[9px] uppercase tracking-widest rounded-xl hover:bg-white/10 transition-colors"
              >
                Dismiss Modal
              </button>
            </div>
          </div>
        </div>
        
        {/* Footer Technical Detail */}
        <div className="w-full py-2 bg-black/60 border-t border-white/5 px-6 flex justify-between items-center">
          <div className="font-mono text-[9px] text-white/20 uppercase tracking-[0.2em]">Session_ID: {Math.random().toString(36).substring(7).toUpperCase()}</div>
          <div className="font-mono text-[9px] text-white/20 uppercase tracking-[0.2em]">{errorCode || 'ERR_UNKNOWN'}</div>
        </div>
      </motion.div>
    </div>
  );
}

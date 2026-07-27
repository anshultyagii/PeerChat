import { useState, useEffect } from "react";
import { 
  Shield, 
  Zap, 
  Lock, 
  ServerOff, 
  Activity, 
  ArrowRight, 
  MessageSquare, 
  Users,
  CheckCircle2,
  Terminal,
  Volume2
} from "lucide-react";

interface LandingPageProps {
  onStart: () => void;
}

export default function LandingPage({ onStart }: LandingPageProps) {
  // Motion simulation state
  const [activeStep, setActiveStep] = useState(0);
  const [latencyHistory, setLatencyHistory] = useState<number[]>([12, 15, 8, 10, 6, 7, 5]);
  const [messages, setMessages] = useState<Array<{ sender: string; text: string }>>([
    { sender: "Alice", text: "Hey! Is this connection secure?" },
    { sender: "Bob", text: "Completely. It's direct peer-to-peer over WebRTC." },
  ]);
  const [newMsg, setNewMsg] = useState("");

  // Connection steps for the simulation
  const connectionSteps = [
    { text: "Initializing Local Peer Instance...", status: "success" },
    { text: "Exchanging signaling payload via Firebase...", status: "success" },
    { text: "Performing STUN/ICE candidate verification...", status: "success" },
    { text: "Establishing Direct WebRTC Channel...", status: "success" },
    { text: "Direct P2P Link Established (AES-256 Enabled)", status: "success" }
  ];

  // Rotate connection step animation
  useEffect(() => {
    const stepInterval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % (connectionSteps.length + 1));
    }, 3000);
    return () => clearInterval(stepInterval);
  }, []);

  // Update mock latency chart
  useEffect(() => {
    const latencyInterval = setInterval(() => {
      setLatencyHistory((prev) => {
        const next = [...prev.slice(1)];
        // Generate random realistic P2P latency between 3ms and 11ms
        const randomLatency = Math.floor(Math.random() * 8) + 3;
        next.push(randomLatency);
        return next;
      });
    }, 2000);
    return () => clearInterval(latencyInterval);
  }, []);

  const handleSendMockMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMsg.trim()) return;
    setMessages((prev) => [...prev, { sender: "You", text: newMsg }]);
    setNewMsg("");
    
    // Auto reply
    setTimeout(() => {
      setMessages((prev) => [...prev, { sender: "Alice", text: "Awesome! Super fast latency!" }]);
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans overflow-x-hidden selection:bg-emerald-500/30 selection:text-emerald-300">
      
      {/* Background Decorative Gradients */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none -z-10 animate-pulse" />
      <div className="absolute top-1/3 right-10 w-[600px] h-[600px] bg-cyan-500/5 rounded-full blur-[160px] pointer-events-none -z-10" />
      <div className="absolute bottom-10 left-10 w-[400px] h-[400px] bg-emerald-600/5 rounded-full blur-[140px] pointer-events-none -z-10" />

      {/* Header/Navbar */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-[#050505]/75 border-b border-white/5 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 group cursor-pointer">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-cyan-400 p-[1.5px] shadow-[0_0_20px_rgba(16,185,129,0.3)] group-hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] transition-all duration-300">
              <div className="w-full h-full bg-[#0d0d0d] rounded-[10px] flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-emerald-400 group-hover:scale-110 transition-transform" />
              </div>
            </div>
            <span className="font-bold text-xl tracking-tight bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-transparent">
              PeerChat
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-neutral-400">
            <a href="#features" className="hover:text-emerald-400 transition-colors">Features</a>
            <a href="#tech" className="hover:text-emerald-400 transition-colors">Tech Stack</a>
            <a href="#security" className="hover:text-emerald-400 transition-colors">Security</a>
            <a href="#metrics" className="hover:text-emerald-400 transition-colors">Architecture</a>
          </nav>

          <button 
            onClick={onStart}
            className="relative px-6 py-2.5 rounded-full text-sm font-semibold overflow-hidden group cursor-pointer"
          >
            <span className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all duration-300 group-hover:opacity-90" />
            <span className="absolute inset-[1.5px] bg-[#0c0c0c] rounded-full group-hover:bg-[#0c0c0c]/80 transition-colors" />
            <span className="relative flex items-center gap-2 text-white group-hover:text-emerald-300 transition-colors">
              Launch App <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </span>
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-6 pt-12 pb-24 grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
        {/* Left Column - Pitch */}
        <div className="lg:col-span-6 space-y-8 text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-emerald-400 tracking-wide">
            <Zap className="w-3.5 h-3.5" /> 100% Serverless Messaging
          </div>
          
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-[1.1] bg-gradient-to-r from-white via-neutral-100 to-neutral-500 bg-clip-text text-transparent">
            Direct Peer-to-Peer.<br />
            <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              No Servers, No Logs.
            </span>
          </h1>

          <p className="text-neutral-400 text-lg md:text-xl font-light leading-relaxed max-w-xl">
            Establish secure, high-speed, direct WebRTC connections. Your authentication is secured by Firebase, and your messages are dispatched directly between browsers. Once you close the tab, it's gone forever.
          </p>

          <div className="flex flex-col sm:flex-row gap-4">
            <button 
              onClick={onStart}
              className="px-8 py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-black font-bold text-base hover:shadow-[0_0_30px_rgba(16,185,129,0.4)] hover:scale-[1.02] transition-all duration-300 cursor-pointer text-center font-sans"
            >
              Start Direct Chat
            </button>
            <a 
              href="#features"
              className="px-8 py-4 rounded-2xl bg-white/5 border border-white/10 text-white hover:bg-white/10 font-semibold text-base transition-all duration-300 text-center flex items-center justify-center gap-2 group"
            >
              Explore Tech <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </a>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-3 gap-6 pt-6 border-t border-white/5">
            <div>
              <div className="text-2xl md:text-3xl font-extrabold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">0ms</div>
              <div className="text-xs text-neutral-500 font-medium uppercase mt-1 tracking-wider">Log Retention</div>
            </div>
            <div>
              <div className="text-2xl md:text-3xl font-extrabold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">100%</div>
              <div className="text-xs text-neutral-500 font-medium uppercase mt-1 tracking-wider">WebRTC P2P</div>
            </div>
            <div>
              <div className="text-2xl md:text-3xl font-extrabold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">&lt; 10ms</div>
              <div className="text-xs text-neutral-500 font-medium uppercase mt-1 tracking-wider">Direct Latency</div>
            </div>
          </div>
        </div>

        {/* Right Column - Engaging Live Motion Board */}
        <div className="lg:col-span-6 flex flex-col gap-6">
          <div className="relative bg-[#0d0d0d] border border-white/10 rounded-[32px] p-6 shadow-2xl overflow-hidden backdrop-blur-xl">
            {/* Glossy overlay effect */}
            <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/[0.02] to-white/0 pointer-events-none" />
            
            {/* Visualizer Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                <span className="font-mono text-xs text-neutral-400 font-bold uppercase tracking-wider">Active Peer Connection Simulator</span>
              </div>
              <div className="flex items-center gap-2 bg-neutral-900 px-3 py-1 rounded-full border border-white/5">
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                <span className="font-mono text-xs text-emerald-400 font-semibold">{latencyHistory[latencyHistory.length - 1]}ms P2P</span>
              </div>
            </div>

            {/* Visual Simulation Grid */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 my-6 items-center">
              {/* Peer A Node */}
              <div className="md:col-span-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5 text-center flex flex-col items-center justify-center relative overflow-hidden group">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-2 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                  <Users className="w-6 h-6 text-emerald-400" />
                </div>
                <div className="text-xs font-bold font-mono">Peer A (You)</div>
                <div className="text-[10px] text-neutral-500 font-mono mt-1 select-none">ID: peer_8f2a9d</div>
                <span className="absolute top-1 right-1 px-1.5 py-0.5 rounded text-[8px] bg-emerald-500/10 text-emerald-400 font-mono">LOCAL</span>
              </div>

              {/* Connecting WebRTC Line */}
              <div className="md:col-span-4 flex flex-col items-center justify-center py-2 md:py-0">
                <div className="w-full relative flex items-center justify-center my-1">
                  {/* Glowing Connection Link Line */}
                  <div className="w-full h-[2px] bg-gradient-to-r from-emerald-500 via-cyan-400 to-emerald-500 rounded-full" />
                  {/* Moving Packet Dot */}
                  <div className="absolute w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_10px_#22d3ee] animate-[ping_1.5s_infinite]" />
                </div>
                <span className="text-[10px] text-neutral-500 font-mono mt-1 text-center font-bold tracking-wide">WEBRTC DATA CHANNEL</span>
                <span className="text-[9px] text-emerald-400 font-mono bg-emerald-500/5 px-2 py-0.5 rounded-full border border-emerald-500/10 mt-1">E2EE ACTIVE</span>
              </div>

              {/* Peer B Node */}
              <div className="md:col-span-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5 text-center flex flex-col items-center justify-center relative overflow-hidden group">
                <div className="w-12 h-12 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mb-2 shadow-[0_0_15px_rgba(6,182,212,0.1)]">
                  <Users className="w-6 h-6 text-cyan-400" />
                </div>
                <div className="text-xs font-bold font-mono">Peer B (Alice)</div>
                <div className="text-[10px] text-neutral-500 font-mono mt-1 select-none">ID: peer_3d5f1c</div>
                <span className="absolute top-1 right-1 px-1.5 py-0.5 rounded text-[8px] bg-cyan-500/10 text-cyan-400 font-mono">REMOTE</span>
              </div>
            </div>

            {/* Live Signaling Console / Terminal Logs */}
            <div className="bg-black/60 rounded-2xl p-4 border border-white/5 font-mono text-left mb-6">
              <div className="flex items-center gap-2 mb-2 pb-1 border-b border-white/5">
                <Terminal className="w-3.5 h-3.5 text-neutral-500" />
                <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">WebRTC Signals</span>
              </div>
              <div className="space-y-1.5 text-[11px] overflow-y-auto max-h-[100px] [&::-webkit-scrollbar]:hidden">
                {connectionSteps.map((step, idx) => (
                  <div key={idx} className={`flex items-start gap-2 transition-all duration-300 ${idx <= activeStep ? "opacity-100" : "opacity-25"}`}>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span className={idx === activeStep ? "text-emerald-300 font-bold" : "text-neutral-400"}>{step.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Micro Live Chat Box */}
            <div className="bg-neutral-950/80 rounded-2xl p-4 border border-white/5 text-left flex flex-col h-[200px]">
              <div className="flex items-center justify-between pb-2 border-b border-white/5 mb-3">
                <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">Encrypted Chat Preview</span>
                <span className="text-[9px] bg-neutral-900 px-2 py-0.5 rounded text-neutral-400 font-mono">Channel: DirectData</span>
              </div>
              
              <div className="flex-1 overflow-y-auto space-y-2.5 mb-3 pr-1 text-xs [&::-webkit-scrollbar]:hidden">
                {messages.map((m, idx) => (
                  <div key={idx} className={`flex flex-col ${m.sender === "You" ? "items-end" : "items-start"}`}>
                    <span className="text-[9px] text-neutral-500 mb-0.5">{m.sender}</span>
                    <div className={`px-3 py-1.5 rounded-xl max-w-[85%] break-words leading-relaxed ${m.sender === "You" ? "bg-emerald-500 text-black font-semibold rounded-tr-none" : "bg-neutral-800 text-neutral-200 rounded-tl-none"}`}>
                      {m.text}
                    </div>
                  </div>
                ))}
              </div>

              <form onSubmit={handleSendMockMessage} className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="Type message directly to Peer..."
                  value={newMsg}
                  onChange={(e) => setNewMsg(e.target.value)}
                  className="flex-1 bg-neutral-900 border border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 text-white placeholder-neutral-600 font-sans"
                />
                <button type="submit" className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer font-sans">
                  Send
                </button>
              </form>
            </div>

            {/* Real-time WebRTC Live Latency Line Chart */}
            <div>
              <div className="flex items-center justify-between pb-2">
                <span className="text-[10px] text-neutral-500 uppercase font-mono tracking-wider font-bold">Latency Timeline (Realtime P2P)</span>
                <span className="text-[10px] text-emerald-400 font-mono font-bold">Avg: 7.2ms</span>
              </div>
              <div className="h-10 flex items-end gap-1.5 bg-neutral-950/60 rounded-xl p-2 border border-white/5 relative overflow-hidden">
                {latencyHistory.map((val, idx) => {
                  const heightPercentage = Math.min((val / 20) * 100, 100);
                  return (
                    <div key={idx} className="flex-1 flex flex-col justify-end h-full group relative">
                      <div 
                        style={{ height: `${heightPercentage}%` }} 
                        className="bg-gradient-to-t from-emerald-500 to-cyan-400 rounded-t w-full transition-all duration-300"
                      />
                      <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-neutral-900 border border-white/10 text-[9px] font-mono px-1 py-0.5 rounded text-emerald-400 z-10 whitespace-nowrap transition-opacity">
                        {val}ms
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Core Features Grid */}
      <section id="features" className="max-w-7xl mx-auto px-6 py-24 border-t border-white/5 text-center">
        <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-4">
          Architected for <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">Complete Privacy</span>
        </h2>
        <p className="text-neutral-400 text-base md:text-lg max-w-2xl mx-auto mb-16 font-light">
          Unlike standard chat apps that cache your logs, profile documents, and chats on remote server instances, PeerChat is built around decentralization.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Card 1 */}
          <div className="bg-[#0b0b0b] border border-white/5 hover:border-emerald-500/30 p-8 rounded-3xl transition-all duration-300 hover:scale-[1.01] hover:shadow-[0_15px_30px_rgba(16,185,129,0.03)] text-left flex flex-col">
            <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-6">
              <Lock className="w-6 h-6 text-emerald-400" />
            </div>
            <h3 className="text-xl font-bold mb-3">End-to-End Cryptography</h3>
            <p className="text-neutral-400 text-sm leading-relaxed flex-grow font-light">
              WebRTC utilizes SRTP (Secure Real-time Transport Protocol) to encrypt all messages and files. Your text, file attachments, and media signals cannot be read by anyone in transit.
            </p>
          </div>

          {/* Card 2 */}
          <div className="bg-[#0b0b0b] border border-white/5 hover:border-cyan-500/30 p-8 rounded-3xl transition-all duration-300 hover:scale-[1.01] hover:shadow-[0_15px_30px_rgba(34,211,238,0.03)] text-left flex flex-col">
            <div className="w-12 h-12 bg-cyan-500/10 rounded-2xl flex items-center justify-center mb-6">
              <ServerOff className="w-6 h-6 text-cyan-400" />
            </div>
            <h3 className="text-xl font-bold mb-3">True Serverless Protocol</h3>
            <p className="text-neutral-400 text-sm leading-relaxed flex-grow font-light">
              We leverage Firebase exclusively for authentication and exchanging connection payloads (signaling). The actual chat messaging and media tracks happen directly between browsers.
            </p>
          </div>

          {/* Card 3 */}
          <div className="bg-[#0b0b0b] border border-white/5 hover:border-emerald-500/30 p-8 rounded-3xl transition-all duration-300 hover:scale-[1.01] hover:shadow-[0_15px_30px_rgba(16,185,129,0.03)] text-left flex flex-col">
            <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-6">
              <Shield className="w-6 h-6 text-emerald-400" />
            </div>
            <h3 className="text-xl font-bold mb-3">Zero Database Footprint</h3>
            <p className="text-neutral-400 text-sm leading-relaxed flex-grow font-light">
              Your message database lives exclusively in your browser tab's RAM. Once you close the browser window or terminate the session, all messages are instantly wiped. No history remains anywhere.
            </p>
          </div>
        </div>
      </section>

      {/* Media Capabilties Showcase */}
      <section className="max-w-7xl mx-auto px-6 py-12 text-center">
        <div className="bg-gradient-to-tr from-emerald-500/5 to-cyan-500/5 border border-white/10 rounded-[36px] p-8 md:p-16 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 space-y-6 text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-400/10 border border-emerald-400/20 text-xs font-semibold text-emerald-400">
              <Volume2 className="w-3.5 h-3.5" /> High-Fidelity Streaming
            </div>
            <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight leading-tight">
              Direct Audio & Video Calls
            </h2>
            <p className="text-neutral-400 text-base md:text-lg font-light leading-relaxed">
              Skip the middleman servers. Establish direct media pipelines to enjoy HD voice calls, face-to-face video conferencing, and instantaneous file transmission directly to your peers.
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <span className="text-sm font-semibold text-neutral-300">OPUS Audio Codec Support</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <span className="text-sm font-semibold text-neutral-300">VP8/H.264 Video Coding</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <span className="text-sm font-semibold text-neutral-300">Direct Binary File Transfer</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <span className="text-sm font-semibold text-neutral-300">Signaling Server Redundancy</span>
              </div>
            </div>
          </div>
          
          <div className="lg:col-span-5 relative">
            <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-[80px] pointer-events-none -z-10" />
            <div className="bg-[#0c0c0c] border border-white/10 rounded-3xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <span className="text-xs font-mono text-neutral-400">Media negotiation</span>
                <span className="px-2 py-0.5 text-[9px] bg-emerald-500/10 text-emerald-400 rounded-full font-mono">STUN Verified</span>
              </div>
              
              <div className="aspect-[4/3] rounded-2xl bg-neutral-900 border border-white/5 flex flex-col items-center justify-center relative overflow-hidden group">
                <Users className="w-12 h-12 text-neutral-600 group-hover:scale-110 transition-transform duration-500" />
                <span className="text-xs text-neutral-500 mt-2 font-mono">Awaiting Peer Media Track...</span>
                <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between bg-black/60 backdrop-blur-md px-3 py-2 rounded-xl border border-white/5">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[10px] font-bold font-mono">WebRTC Session</span>
                  </div>
                  <span className="text-[9px] text-neutral-400">Direct Feed</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tech Stack Details */}
      <section id="tech" className="max-w-7xl mx-auto px-6 py-24 border-t border-white/5 text-center">
        <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-4">
          Built with <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">Robust Technologies</span>
        </h2>
        <p className="text-neutral-400 text-base md:text-lg max-w-xl mx-auto mb-16 font-light">
          We leverage state-of-the-art technologies to ensure top performance, high availability, and ultimate security.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="bg-[#0b0b0b] border border-white/5 p-6 rounded-2xl text-center">
            <div className="text-emerald-400 font-extrabold text-lg mb-1">PeerJS</div>
            <div className="text-xs text-neutral-500 uppercase tracking-wider font-mono">P2P Connections</div>
          </div>
          <div className="bg-[#0b0b0b] border border-white/5 p-6 rounded-2xl text-center">
            <div className="text-emerald-400 font-extrabold text-lg mb-1">Firebase</div>
            <div className="text-xs text-neutral-500 uppercase tracking-wider font-mono">Auth & Signaling</div>
          </div>
          <div className="bg-[#0b0b0b] border border-white/5 p-6 rounded-2xl text-center">
            <div className="text-emerald-400 font-extrabold text-lg mb-1">React 19</div>
            <div className="text-xs text-neutral-500 uppercase tracking-wider font-mono">UI Components</div>
          </div>
          <div className="bg-[#0b0b0b] border border-white/5 p-6 rounded-2xl text-center">
            <div className="text-emerald-400 font-extrabold text-lg mb-1">WebRTC</div>
            <div className="text-xs text-neutral-500 uppercase tracking-wider font-mono">Direct Communication</div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-5xl mx-auto px-6 py-24 text-center">
        <div className="bg-gradient-to-tr from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20 rounded-[40px] p-12 md:p-20 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-cyan-400/10 rounded-full blur-[100px] pointer-events-none" />
          <h2 className="text-3xl md:text-6xl font-extrabold mb-6 tracking-tight">
            Ready to Connect?
          </h2>
          <p className="text-neutral-400 text-lg md:text-xl max-w-xl mx-auto mb-10 font-light leading-relaxed">
            Create an account or login to discover local peer matches, establish real-time links, and chat in private.
          </p>
          <button 
            onClick={onStart}
            className="px-10 py-5 bg-gradient-to-r from-emerald-500 to-cyan-500 text-black font-bold rounded-2xl hover:shadow-[0_0_40px_rgba(16,185,129,0.5)] hover:scale-[1.02] transition-all duration-300 cursor-pointer text-lg inline-flex items-center gap-2 font-sans"
          >
            Launch PeerChat App <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-12 bg-[#050505] text-neutral-600 text-sm">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-emerald-400" />
            <span className="font-bold text-white tracking-tight">PeerChat</span>
          </div>
          <p className="font-light">
            © {new Date().getFullYear()} PeerChat. All rights reserved. Peer-to-peer data transport is hosted inside browser instances.
          </p>
          <div className="flex items-center gap-6">
            <a href="https://github.com/anshultyagii/PeerChat" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400 transition-colors">
              GitHub
            </a>
          </div>
        </div>
      </footer>

    </div>
  );
}

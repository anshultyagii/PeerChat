import { useEffect, useState, useRef } from 'react';
import { rtdb } from '@/lib/firebase';
import { ref, push, onValue, set, remove, onDisconnect } from 'firebase/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  SidebarProvider, Sidebar, SidebarContent, SidebarHeader, SidebarGroup,
  SidebarGroupContent, SidebarFooter, SidebarMenu, SidebarMenuItem,
  SidebarTrigger, SidebarMenuButton,
} from "@/components/ui/sidebar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Send, Plus, MessageSquare, Shield, Copy, Check, User, LogIn, Home, ChevronsUpDown } from 'lucide-react';
import { toast } from 'sonner';

const DEFAULT_MAN_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%232a2a2e'/%3E%3Ccircle cx='50' cy='38' r='18' fill='%238e8e93'/%3E%3Cpath d='M20 88 c0 -18 14 -28 30 -28 s30 10 30 28 z' fill='%238e8e93'/%3E%3C/svg%3E";

interface PrivateMessage {
  id: string;
  senderPeerId: string;
  text: string;
  timestamp: number;
}

export default function PrivateChatApp() {
  // Unique Peer Session ID generated for this tab
  const [myPeerId] = useState<string>(() => 'peer_' + Math.random().toString(36).substring(2, 10));
  const [connectedPeerId, setConnectedPeerId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [messages, setMessages] = useState<PrivateMessage[]>([]);
  const [messageInput, setMessageInput] = useState<string>('');

  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [peerIdInput, setPeerIdInput] = useState('');
  const [peerIdModalOpen, setPeerIdModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Register presence & cleanup on tab close safely
  useEffect(() => {
    try {
      const peerPresenceRef = ref(rtdb, `privatePeers/${myPeerId}`);
      set(peerPresenceRef, { active: true, connectedRoomId: null }).catch((e) => console.warn("Presence set warning:", e));
      onDisconnect(peerPresenceRef).remove().catch((e) => console.warn("onDisconnect warning:", e));

      return () => {
        remove(peerPresenceRef).catch(() => {});
      };
    } catch (e) {
      console.warn("RTDB presence setup error:", e);
    }
  }, [myPeerId]);

  // Listen to peer presence updates (if someone connects to us)
  useEffect(() => {
    try {
      const peerRef = ref(rtdb, `privatePeers/${myPeerId}`);
      const unsubscribe = onValue(peerRef, (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val();
          if (data.connectedRoomId && data.connectedRoomId !== activeRoomId) {
            setActiveRoomId(data.connectedRoomId);
          }
        }
      }, (error) => {
        console.warn("Peer listener error:", error);
      });
      return unsubscribe;
    } catch (e) {
      console.warn("Peer listener setup error:", e);
    }
  }, [myPeerId, activeRoomId]);

  // Real-time room listener (messages & disconnect detection)
  useEffect(() => {
    if (!activeRoomId) {
      setIsConnected(false);
      setMessages([]);
      return;
    }

    try {
      const roomRef = ref(rtdb, `privateRooms/${activeRoomId}`);
      onDisconnect(roomRef).remove().catch(() => {});

      const unsubscribe = onValue(roomRef, (snapshot) => {
        if (!snapshot.exists()) {
          // Clear DB state first to prevent infinite loop
          set(ref(rtdb, `privatePeers/${myPeerId}/connectedRoomId`), null).catch(() => {});

          // Only toast if we were actively connected
          if (isConnected) {
            toast.error("Peer disconnected", { description: "Session ended. All messages have been wiped." });
          }

          setIsConnected(false);
          setMessages([]);
          setActiveRoomId(null);
          setConnectedPeerId(null);
          return;
        }

        const roomData = snapshot.val();
        if (roomData.status === 'connected') {
          setIsConnected(true);
          const peers = Object.keys(roomData.peers || {});
          const otherPeer = peers.find(p => p !== myPeerId);
          if (otherPeer) setConnectedPeerId(otherPeer);

          if (roomData.messages) {
            const loadedMsgs: PrivateMessage[] = Object.entries(roomData.messages).map(([id, m]: [string, any]) => ({
              id,
              senderPeerId: m.senderPeerId,
              text: m.text,
              timestamp: m.timestamp,
            }));
            loadedMsgs.sort((a, b) => a.timestamp - b.timestamp);
            setMessages(loadedMsgs);
          } else {
            setMessages([]);
          }
        } else {
          setIsConnected(false);
          setMessages([]);
        }
      }, (error) => {
        console.warn("Room listener error:", error);
      });

      return unsubscribe;
    } catch (e) {
      console.warn("Room listener setup error:", e);
    }
  }, [activeRoomId, myPeerId]);

  // Auto-scroll messages
  useEffect(() => {
    if (scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }
  }, [messages]);

  const copyPeerId = () => {
    try {
      navigator.clipboard.writeText(myPeerId);
      setCopied(true);
      toast.success("Session ID copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setPeerIdModalOpen(true);
    }
  };

  const handleConnectToPeer = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = peerIdInput.trim();
    if (!target) return;
    if (target === myPeerId) {
      toast.error("Cannot connect to your own Session ID");
      return;
    }

    try {
      const roomId = `room_${[myPeerId, target].sort().join('_')}`;
      const roomRef = ref(rtdb, `privateRooms/${roomId}`);

      await set(roomRef, {
        status: 'connected',
        peers: { [myPeerId]: true, [target]: true },
        created: Date.now(),
      });

      // Update both peers' connectedRoomId in RTDB
      await set(ref(rtdb, `privatePeers/${myPeerId}/connectedRoomId`), roomId);
      await set(ref(rtdb, `privatePeers/${target}/connectedRoomId`), roomId).catch(() => {});

      setActiveRoomId(roomId);
      setConnectedPeerId(target);
      setIsConnected(true);
      setConnectDialogOpen(false);
      setPeerIdInput('');
      toast.success("Connected to peer!");
    } catch (err) {
      console.error("Failed to connect:", err);
      toast.error("Couldn't connect to peer", { description: "Verify the Session ID and try again." });
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || !activeRoomId || !isConnected) return;

    const text = messageInput.trim();
    setMessageInput('');

    try {
      await push(ref(rtdb, `privateRooms/${activeRoomId}/messages`), {
        senderPeerId: myPeerId,
        text,
        timestamp: Date.now(),
      });
    } catch (err) {
      console.error("Message send error:", err);
      setMessageInput(text);
      toast.error("Couldn't send message");
    }
  };

  return (
    <SidebarProvider className="h-screen w-screen bg-[#050505] text-white overflow-hidden">
      <div className="flex h-screen w-full overflow-hidden bg-[#1e1e1e]/40 backdrop-blur-[24px]">
        <Sidebar collapsible="icon" className="border-r border-white/10 bg-black/40">
          <SidebarHeader className="h-16 px-4 border-b border-white/10 flex items-center justify-between shrink-0">
            <div className="flex items-center justify-between gap-2 w-full">
              <div className="flex items-center gap-2 font-bold text-lg group-data-[collapsible=icon]:hidden">
                <MessageSquare className="w-5 h-5 text-emerald-400 shrink-0" />
                PeerChat
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 shrink-0 group-data-[collapsible=icon]:mx-auto text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 cursor-pointer"
                onClick={() => setConnectDialogOpen(true)}
                title="Connect to Peer"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </SidebarHeader>

          <SidebarContent className="flex flex-col items-center justify-center p-4">
            <SidebarGroup className="w-full text-center">
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem className="flex flex-col items-center justify-center py-12 space-y-3">
                    <Shield className="w-10 h-10 text-emerald-400/80 group-data-[collapsible=icon]:w-6 group-data-[collapsible=icon]:h-6" />
                    <span className="text-sm font-semibold text-muted-foreground group-data-[collapsible=icon]:hidden">
                      Private Session
                    </span>
                    <p className="text-[11px] text-muted-foreground/70 px-2 group-data-[collapsible=icon]:hidden max-w-[180px]">
                      End-to-end encrypted session. Closing the tab wipes all data.
                    </p>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="p-3 border-t border-white/10 flex flex-col gap-2">
            {/* User info: Anonymous Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton className="h-14 w-full flex items-center gap-3 px-3 rounded-xl hover:bg-white/10 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0 cursor-pointer">
                  <Avatar className="h-9 w-9 shrink-0 border border-white/10">
                    <AvatarImage src={DEFAULT_MAN_AVATAR} />
                    <AvatarFallback className="bg-white/10 text-white"><User className="w-4 h-4" /></AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col min-w-0 text-left group-data-[collapsible=icon]:hidden">
                    <span className="text-sm font-bold text-white leading-tight">Anonymous</span>
                    <span className="text-[11px] text-emerald-400 font-mono leading-none">Private Peer</span>
                  </div>
                  <ChevronsUpDown className="ml-auto w-4 h-4 shrink-0 group-data-[collapsible=icon]:hidden text-muted-foreground" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-56 bg-[#1e1e1e]/95 text-white border-white/10 backdrop-blur-xl">
                <DropdownMenuLabel className="font-mono text-xs text-muted-foreground">Session Profile</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => { window.location.hash = ''; }}>
                  <Home className="w-4 h-4 mr-2 text-cyan-400" /> Home Page
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { window.location.hash = '/auth'; }}>
                  <LogIn className="w-4 h-4 mr-2 text-emerald-400" /> Login / Sign Up
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Session ID / Peer ID box */}
            <div
              onClick={copyPeerId}
              onContextMenu={(e) => {
                e.preventDefault();
                setPeerIdModalOpen(true);
              }}
              title="Click to copy Session ID, Right-click to view modal"
              className="w-full bg-black/40 border border-white/10 hover:border-emerald-500/40 rounded-xl p-2.5 flex items-center justify-between gap-2 cursor-pointer transition-colors group-data-[collapsible=icon]:justify-center"
            >
              <div className="flex flex-col min-w-0 group-data-[collapsible=icon]:hidden">
                <span className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider">Your Session ID</span>
                <span className="text-xs font-mono font-bold text-white truncate">{myPeerId}</span>
              </div>
              {copied ? (
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <Copy className="w-4 h-4 text-muted-foreground group-hover:text-white shrink-0" />
              )}
            </div>
          </SidebarFooter>
        </Sidebar>

        <main className="flex-1 flex flex-col min-w-0 h-full bg-black/20">
          <header className="h-16 px-4 border-b border-white/10 flex items-center justify-between bg-black/20 shrink-0 z-10">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-emerald-400" />
                <div>
                  <h2 className="text-base font-bold text-white">Private Chat Room</h2>
                  <p className="text-xs text-muted-foreground font-mono">
                    {connectedPeerId ? `Peer: ${connectedPeerId}` : 'No peer connected'}
                  </p>
                </div>
              </div>
            </div>

            {/* Connection Status Box in Header Top Right */}
            <div>
              {isConnected ? (
                <div className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3.5 py-1 rounded-full text-xs font-bold flex items-center gap-2 shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  Connected
                </div>
              ) : (
                <div className="bg-red-500/20 text-red-400 border border-red-500/30 px-3.5 py-1 rounded-full text-xs font-bold flex items-center gap-2 shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-red-400"></span>
                  Disconnected
                </div>
              )}
            </div>
          </header>

          <ScrollArea
            ref={scrollRef}
            onContextMenu={(e) => e.preventDefault()}
            className="flex-1 p-6 bg-black/10 select-none"
          >
            {!isConnected ? (
              <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-muted-foreground space-y-4 opacity-70">
                <Shield className="w-12 h-12 text-emerald-400/50" />
                <p className="text-sm max-w-sm text-center">
                  You are not connected to a peer. Tap the <span className="font-bold text-white">+</span> icon in the sidebar to enter a Session ID.
                </p>
              </div>
            ) : messages.length === 0 ? (
              <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-muted-foreground space-y-4 opacity-70">
                <MessageSquare className="w-12 h-12 text-emerald-400/50" />
                <p className="text-sm max-w-sm text-center">Private connection established. Say hello!</p>
              </div>
            ) : (
              <div className="space-y-4 flex flex-col pb-4">
                {messages.map((msg) => {
                  const isMe = msg.senderPeerId === myPeerId;
                  return (
                    <div key={msg.id} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`flex flex-col gap-1 max-w-[75%] ${isMe ? 'items-end' : 'items-start'}`}>
                        <div className={`px-4 py-2.5 rounded-2xl text-[16px] md:text-[17px] font-semibold leading-relaxed shadow-sm select-text ${isMe ? 'bg-[#0084ff] text-white rounded-br-xs' : 'bg-[#2a2a2e] border border-white/10 text-white rounded-bl-xs'}`}>
                          {msg.text}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          <footer className="p-4 border-t border-white/10 bg-black/20 shrink-0">
            <form onSubmit={sendMessage} className="flex gap-2 max-w-4xl mx-auto">
              <Input
                placeholder={isConnected ? "Type a private message..." : "Connect to a peer to start messaging..."}
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                disabled={!isConnected}
                className="flex-1 rounded-full px-6 bg-black/30 border-white/10 text-white text-[15px] font-medium placeholder:text-[#888] focus-visible:bg-white/5 h-11"
              />
              <Button
                type="submit"
                size="icon"
                className="rounded-full h-10 w-10 shrink-0 shadow-md bg-emerald-500 hover:bg-emerald-600 text-black cursor-pointer"
                disabled={!messageInput.trim() || !isConnected}
              >
                <Send className="w-4 h-4 ml-0.5" />
              </Button>
            </form>
          </footer>
        </main>
      </div>

      {/* Connect to Peer Dialog */}
      <Dialog open={connectDialogOpen} onOpenChange={setConnectDialogOpen}>
        <DialogContent className="max-w-md bg-[#1e1e1e]/95 text-white border-white/10">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-emerald-400" /> Connect to Peer
            </DialogTitle>
            <DialogDescription className="text-[#a3a3a3] pt-1">
              Enter the unique Session ID of the peer you wish to connect with.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleConnectToPeer} className="space-y-4 mt-2">
            <Input
              placeholder="e.g. peer_x8f9a2b"
              value={peerIdInput}
              onChange={(e) => setPeerIdInput(e.target.value)}
              className="bg-black/40 border-white/10 text-white font-mono placeholder:text-[#666]"
            />
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setConnectDialogOpen(false)} className="border-white/10 text-white hover:bg-white/10">
                Cancel
              </Button>
              <Button type="submit" disabled={!peerIdInput.trim()} className="bg-emerald-500 hover:bg-emerald-600 text-black font-bold">
                Connect
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Session ID Right-Click Modal */}
      <Dialog open={peerIdModalOpen} onOpenChange={setPeerIdModalOpen}>
        <DialogContent className="max-w-md bg-[#1e1e1e]/95 text-white border-white/10">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
              <Copy className="w-5 h-5 text-emerald-400" /> Your Session ID
            </DialogTitle>
            <DialogDescription className="text-[#a3a3a3] pt-1">
              Share this Session ID with another user so they can connect with you.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-black/50 border border-white/10 rounded-xl p-4 text-center my-2">
            <span className="text-lg font-mono font-bold text-emerald-400 select-all">{myPeerId}</span>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              onClick={() => {
                copyPeerId();
                setPeerIdModalOpen(false);
              }}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-bold flex items-center justify-center gap-2"
            >
              <Copy className="w-4 h-4" /> Copy Session ID
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}

import { useEffect, useState, useRef, useMemo } from 'react';
import { auth, rtdb } from '@/lib/firebase';
import { ref, push, onValue, set, remove, update, get } from 'firebase/database';
import { signOut } from 'firebase/auth';
import { UserProfile, Message, Contact } from '@/types';
import { getChatRoomId } from '@/lib/utils/chat';
import { syncUserProfileRTDB } from '@/lib/utils/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  SidebarProvider, Sidebar, SidebarContent, SidebarHeader, SidebarGroup,
  SidebarGroupLabel, SidebarGroupContent, SidebarFooter, SidebarMenu,
  SidebarMenuItem, SidebarMenuButton, SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger, ContextMenuSeparator,
} from "@/components/ui/context-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Send, Plus, MessageSquare, Settings, LogOut, ChevronsUpDown, Trash2, UserMinus, Smile, Clock, Shield, Home, Phone, PhoneOff, Video } from 'lucide-react';
import AddContactDialog from './AddContactDialog';
import ProfileModal from './ProfileModal';
import EmojiPicker from './EmojiPicker';
import CallModal from './CallModal';
import { toast } from 'sonner';

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

export default function ChatApp({ currentUser: initialUser }: { currentUser: UserProfile }) {
  const [currentUser, setCurrentUser] = useState<UserProfile>(initialUser);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [activeContact, setActiveContact] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState<string>('');
  const [addContactOpen, setAddContactOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [deleteModalMsg, setDeleteModalMsg] = useState<Message | null>(null);
  const [confirmClearChatContact, setConfirmClearChatContact] = useState<Contact | null>(null);
  const [confirmRemoveContact, setConfirmRemoveContact] = useState<Contact | null>(null);
  const [activeEmojiPickerMsgId, setActiveEmojiPickerMsgId] = useState<string | null>(null);
  const [showInputEmojiPicker, setShowInputEmojiPicker] = useState(false);
  const [liveProfiles, setLiveProfiles] = useState<Record<string, { firstName?: string; lastName?: string; profilePic?: string | null }>>({});
  const [incomingCall, setIncomingCall] = useState<{
    callerId: string;
    callerName: string;
    callerUsername: string;
    type: 'voice' | 'video';
    roomId: string;
  } | null>(null);
  const [activeCall, setActiveCall] = useState<{
    targetUserId: string;
    targetUsername: string;
    isCaller: boolean;
    type: 'voice' | 'video';
    roomId: string;
  } | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Sync current user's profile to RTDB userProfiles node on app mount
  useEffect(() => {
    syncUserProfileRTDB(currentUser);
  }, [currentUser]);

  // Listen to live user profiles in RTDB so name & photo updates sync in real time across all contacts
  useEffect(() => {
    const profilesRef = ref(rtdb, 'userProfiles');
    const unsubscribe = onValue(profilesRef, (snapshot) => {
      if (snapshot.exists()) {
        setLiveProfiles(snapshot.val() || {});
      }
    });
    return unsubscribe;
  }, []);

  // Helper to resolve live profile info (or fallback to cached contact data)
  const getContactDisplay = (contact: Contact | UserProfile) => {
    const live = liveProfiles[contact.uid];
    const firstName = live?.firstName || contact.firstName;
    const lastName = live?.lastName !== undefined ? live.lastName : contact.lastName;
    const profilePic = live?.profilePic !== undefined ? live.profilePic : contact.profilePic;
    return { firstName, lastName, profilePic };
  };

  // Live contacts list from Realtime DB
  useEffect(() => {
    const contactsRef = ref(rtdb, `contacts/${currentUser.uid}`);
    const unsubscribe = onValue(contactsRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) return setContacts([]);
      const list: Contact[] = Object.values(data);
      list.sort((a, b) => (b.lastMessageTime || b.addedAt) - (a.lastMessageTime || a.addedAt));
      setContacts(list);
    }, (error) => {
      console.error('Contacts load error:', error);
      toast.error("Couldn't load chats", { description: "Check your connection and try again." });
    });
    return unsubscribe;
  }, [currentUser.uid]);

  // Listen for incoming calls
  useEffect(() => {
    const userCallRef = ref(rtdb, `userCalls/${currentUser.uid}`);
    const unsubscribe = onValue(userCallRef, (snapshot) => {
      if (snapshot.exists()) {
        const call = snapshot.val();
        if (call.status === 'ringing') {
          setIncomingCall(call);
        } else {
          setIncomingCall(null);
        }
      } else {
        setIncomingCall(null);
      }
    });

    return unsubscribe;
  }, [currentUser.uid]);

  // Load messages for the active conversation
  useEffect(() => {
    if (!activeContact) {
      setMessages([]);
      return;
    }
    const chatRoomId = getChatRoomId(currentUser.username, activeContact.username);
    const chatRef = ref(rtdb, `chats/${chatRoomId}`);

    const unsubscribe = onValue(chatRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const loaded: Message[] = Object.entries(data)
          .map(([id, msg]: [string, any]) => ({
            id,
            text: msg.text,
            sender: (msg.senderUsername === currentUser.username ? 'me' : 'them') as 'me' | 'them',
            senderUsername: msg.senderUsername,
            receiverUsername: msg.receiverUsername,
            timestamp: msg.timestamp,
            deletedFor: msg.deletedFor || {},
            reactions: msg.reactions || {},
          }))
          .filter((msg) => !msg.deletedFor?.[currentUser.uid]);

        loaded.sort((a, b) => a.timestamp - b.timestamp);

        // Notification trigger on incoming messages
        if (loaded.length > 0) {
          const lastMsg = loaded[loaded.length - 1];
          if (lastMsg.sender === 'them' && lastMsg.timestamp > Date.now() - 3000) {
            if (localStorage.getItem('notificationsEnabled') === 'true' && Notification.permission === 'granted' && document.hidden) {
              const display = getContactDisplay(activeContact);
              new Notification(`${display.firstName} ${display.lastName}`, {
                body: lastMsg.text,
                icon: display.profilePic || undefined,
              });
            }
          }
        }

        setMessages(loaded);
      } else {
        setMessages([]);
      }
    }, (error) => {
      console.error('Messages load error:', error);
      toast.error("Couldn't load messages", { description: "Check your connection and try again." });
    });

    return unsubscribe;
  }, [activeContact, currentUser.username, currentUser.uid]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }
  }, [messages]);

  const existingContactUids = useMemo(() => new Set(contacts.map((c) => c.uid)), [contacts]);

  const handleAddContact = async (user: { uid: string; username: string; firstName: string; lastName: string; profilePic: string | null }) => {
    const now = Date.now();
    const newContact: Contact = {
      uid: user.uid,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      profilePic: user.profilePic,
      addedAt: now,
    };

    try {
      // Add contact entry for current user
      await set(ref(rtdb, `contacts/${currentUser.uid}/${user.uid}`), newContact);

      // Add mutual contact entry for recipient user if valid UID
      if (!user.uid.startsWith('username:')) {
        await set(ref(rtdb, `contacts/${user.uid}/${currentUser.uid}`), {
          uid: currentUser.uid,
          username: currentUser.username,
          firstName: currentUser.firstName,
          lastName: currentUser.lastName,
          profilePic: currentUser.profilePic,
          addedAt: now,
        }).catch((error) => console.warn('Recipient contact sync error:', error));
      }

      setActiveContact(newContact);
      setAddContactOpen(false);
    } catch {
      toast.error("Couldn't start that chat", { description: "Please try again." });
    }
  };

  const handleRemoveContact = async (contact: Contact) => {
    try {
      await remove(ref(rtdb, `contacts/${currentUser.uid}/${contact.uid}`));
      if (activeContact?.uid === contact.uid) setActiveContact(null);
      toast.success(`Removed @${contact.username} from your contacts`);
    } catch {
      toast.error("Couldn't remove contact");
    }
  };

  const startCall = (type: 'voice' | 'video') => {
    if (!activeContact) return;
    const chatRoomId = getChatRoomId(currentUser.username, activeContact.username);
    
    setActiveCall({
      targetUserId: activeContact.uid,
      targetUsername: activeContact.username,
      isCaller: true,
      type,
      roomId: chatRoomId,
    });

    set(ref(rtdb, `userCalls/${activeContact.uid}`), {
      callerId: currentUser.uid,
      callerName: `${currentUser.firstName} ${currentUser.lastName}`,
      callerUsername: currentUser.username,
      type,
      roomId: chatRoomId,
      status: 'ringing',
    }).catch(err => console.error("Error setting caller notification:", err));
  };

  const acceptCall = () => {
    if (!incomingCall) return;
    const call = incomingCall;
    
    set(ref(rtdb, `userCalls/${currentUser.uid}`), null);
    setIncomingCall(null);

    setActiveCall({
      targetUserId: call.callerId,
      targetUsername: call.callerUsername,
      isCaller: false,
      type: call.type,
      roomId: call.roomId,
    });
  };

  const rejectCall = () => {
    if (!incomingCall) return;
    const call = incomingCall;
    
    update(ref(rtdb, `calls/${call.roomId}`), { status: 'rejected' });
    set(ref(rtdb, `userCalls/${currentUser.uid}`), null);
    setIncomingCall(null);
  };

  const handleDeleteChat = async (contact: Contact) => {
    try {
      const chatRoomId = getChatRoomId(currentUser.username, contact.username);
      const chatRef = ref(rtdb, `chats/${chatRoomId}`);
      
      // Fetch messages snapshot for this chat room
      const snapshot = await get(chatRef);
      if (snapshot.exists()) {
        const updates: Record<string, any> = {};
        const data = snapshot.val();
        Object.keys(data).forEach((msgId) => {
          updates[`chats/${chatRoomId}/${msgId}/deletedFor/${currentUser.uid}`] = true;
        });
        await update(ref(rtdb), updates);
      }

      // Clear lastMessage preview for current user's contact record
      await update(ref(rtdb, `contacts/${currentUser.uid}/${contact.uid}`), {
        lastMessage: '',
        lastMessageTime: Date.now(),
      });

      if (activeContact?.uid === contact.uid) {
        setMessages([]);
      }
      toast.success("Chat history cleared for you");
    } catch (err) {
      console.error("Clear chat history error:", err);
      toast.error("Couldn't clear this chat");
    }
  };

  const handleToggleReaction = async (messageId: string, emoji: string) => {
    if (!activeContact) return;
    const targetMsg = messages.find(m => m.id === messageId);
    if (!targetMsg) return;

    // Disallow self-reaction
    if (targetMsg.senderUsername === currentUser.username) {
      toast.info("You cannot react to your own message");
      return;
    }

    const chatRoomId = getChatRoomId(currentUser.username, activeContact.username);
    const currentReactions = targetMsg.reactions || {};
    const hasCurrentEmoji = !!currentReactions[emoji]?.[currentUser.uid];

    // Single reaction per user: clear previous emoji reactions for currentUser
    const updates: Record<string, any> = {};
    Object.entries(currentReactions).forEach(([existingEmoji, usersMap]) => {
      if (usersMap?.[currentUser.uid]) {
        updates[`chats/${chatRoomId}/${messageId}/reactions/${existingEmoji}/${currentUser.uid}`] = null;
      }
    });

    if (!hasCurrentEmoji) {
      // Set the new reaction
      updates[`chats/${chatRoomId}/${messageId}/reactions/${emoji}/${currentUser.uid}`] = true;
    }

    try {
      await update(ref(rtdb), updates);
    } catch (err) {
      console.error("Failed to toggle reaction:", err);
      toast.error("Couldn't update reaction");
    }
  };

  const confirmDeleteMessage = async () => {
    if (!deleteModalMsg || !activeContact) return;

    const messageId = deleteModalMsg.id;
    const chatRoomId = getChatRoomId(currentUser.username, activeContact.username);

    try {
      // Delete message only for the current user in Realtime Database
      await set(ref(rtdb, `chats/${chatRoomId}/${messageId}/deletedFor/${currentUser.uid}`), true);
      toast.success("Message deleted for you");

      // Update sidebar lastMessage preview for current user
      const remaining = messages.filter((m) => m.id !== messageId);
      const lastMsg = remaining.length > 0 ? remaining[remaining.length - 1] : null;

      await update(ref(rtdb, `contacts/${currentUser.uid}/${activeContact.uid}`), {
        lastMessage: lastMsg ? lastMsg.text : '',
        lastMessageTime: lastMsg ? lastMsg.timestamp : Date.now(),
      });
    } catch (error) {
      console.error("Delete message error:", error);
      toast.error("Couldn't delete message");
    } finally {
      setDeleteModalMsg(null);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeContact || !messageInput.trim()) return;

    const messageText = messageInput.trim();
    setMessageInput('');

    try {
      const chatRoomId = getChatRoomId(currentUser.username, activeContact.username);
      const chatRef = ref(rtdb, `chats/${chatRoomId}`);
      const now = Date.now();

      // Push message to chat room
      await push(chatRef, {
        senderUsername: currentUser.username,
        receiverUsername: activeContact.username,
        text: messageText,
        timestamp: now,
      });

      // Ensure active contact is added to current user's sidebar contacts with lastMessage
      await update(ref(rtdb, `contacts/${currentUser.uid}/${activeContact.uid}`), {
        uid: activeContact.uid,
        username: activeContact.username,
        firstName: activeContact.firstName,
        lastName: activeContact.lastName,
        profilePic: activeContact.profilePic,
        lastMessage: messageText,
        lastMessageTime: now,
        addedAt: activeContact.addedAt || now,
      });

      // Ensure sender is added to recipient's sidebar contacts with lastMessage
      if (!activeContact.uid.startsWith('username:')) {
        await update(ref(rtdb, `contacts/${activeContact.uid}/${currentUser.uid}`), {
          uid: currentUser.uid,
          username: currentUser.username,
          firstName: currentUser.firstName,
          lastName: currentUser.lastName,
          profilePic: currentUser.profilePic,
          lastMessage: messageText,
          lastMessageTime: now,
          addedAt: now,
        }).catch((err) => console.warn('Recipient contact update warning:', err));
      }
    } catch (error) {
      console.error('Message send error:', error);
      setMessageInput(messageText);
      toast.error("Message couldn't be sent", { description: "Check your connection and try again." });
    }
  };

  const activeDisplay = activeContact ? getContactDisplay(activeContact) : null;
  const userDisplay = getContactDisplay(currentUser);

  return (
    <SidebarProvider className="h-svh min-h-svh bg-[#050505] text-white">
      <div className="flex h-svh w-full overflow-hidden bg-[#1e1e1e]/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-[24px]">
        <Sidebar collapsible="icon" className="border-r border-white/10 bg-black/20" onClick={(e) => e.stopPropagation()}>
          {/* Header height set to h-16 (64px) to align divider with main chat header */}
          <SidebarHeader className="h-16 px-4 border-b border-white/10 flex items-center justify-between shrink-0">
            <div className="flex items-center justify-between gap-2 w-full">
              <div className="flex items-center gap-2 font-bold text-lg group-data-[collapsible=icon]:hidden">
                <MessageSquare className="w-5 h-5 text-primary shrink-0" />
                PeerChat
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 shrink-0 group-data-[collapsible=icon]:mx-auto"
                onClick={() => setAddContactOpen(true)}
                title="New chat"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </SidebarHeader>

          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Chats</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {contacts.length === 0 && (
                    <p className="text-xs text-muted-foreground px-3 py-4 group-data-[collapsible=icon]:hidden">
                      No chats yet. Tap + to find someone.
                    </p>
                  )}
                  {contacts.map((contact) => {
                    const display = getContactDisplay(contact);
                    return (
                      <SidebarMenuItem key={contact.uid}>
                        <ContextMenu>
                          <ContextMenuTrigger asChild>
                            <SidebarMenuButton
                              isActive={activeContact?.uid === contact.uid}
                              onClick={() => setActiveContact(contact)}
                              className="h-auto py-2"
                            >
                              <Avatar className="h-8 w-8 shrink-0">
                                <AvatarImage src={display.profilePic || undefined} />
                                <AvatarFallback className="text-xs">{display.firstName[0]}{display.lastName?.[0]}</AvatarFallback>
                              </Avatar>
                              <div className="flex flex-col min-w-0 group-data-[collapsible=icon]:hidden">
                                <span className="text-sm font-medium truncate">{display.firstName} {display.lastName}</span>
                                <span className="text-xs text-muted-foreground truncate">
                                  {contact.lastMessage || `@${contact.username}`}
                                </span>
                              </div>
                            </SidebarMenuButton>
                          </ContextMenuTrigger>
                          <ContextMenuContent className="w-52 bg-[#1e1e1e]/95 text-white border-white/10 backdrop-blur-xl">
                            <ContextMenuItem onClick={() => setConfirmClearChatContact(contact)} variant="destructive">
                              <Trash2 className="w-4 h-4 mr-2" /> Clear chat history
                            </ContextMenuItem>
                            <ContextMenuItem onClick={() => setConfirmRemoveContact(contact)} variant="destructive">
                              <UserMinus className="w-4 h-4 mr-2" /> Remove contact
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="p-2 border-t border-white/10">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton className="h-12 w-full flex items-center gap-3 px-3 rounded-xl hover:bg-white/10 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarImage src={userDisplay.profilePic || undefined} />
                    <AvatarFallback className="text-xs bg-white/10">{userDisplay.firstName[0]}{userDisplay.lastName?.[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col min-w-0 group-data-[collapsible=icon]:hidden">
                    <span className="text-sm font-medium truncate">{userDisplay.firstName} {userDisplay.lastName}</span>
                    <span className="text-xs text-muted-foreground font-mono truncate">@{currentUser.username}</span>
                  </div>
                  <ChevronsUpDown className="ml-auto w-4 h-4 shrink-0 group-data-[collapsible=icon]:hidden text-muted-foreground" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-56 bg-[#1e1e1e]/95 text-white border-white/10 backdrop-blur-xl">
                <DropdownMenuLabel className="font-mono text-xs text-muted-foreground">@{currentUser.username}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => { window.location.hash = ''; }}>
                  <Home className="w-4 h-4 mr-2 text-cyan-400" /> Home Page
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => window.open(window.location.origin + window.location.pathname + '#/private', '_blank')}>
                  <Shield className="w-4 h-4 mr-2 text-emerald-400" /> Start Private Chat
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setProfileOpen(true)}>
                  <Settings className="w-4 h-4 mr-2" /> Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => signOut(auth)} variant="destructive">
                  <LogOut className="w-4 h-4 mr-2 text-[#ff4d4d]" /> Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>

        <main className="flex-1 flex flex-col min-w-0 bg-black/20">
          {/* Main header height set to h-16 (64px) to align divider perfectly with sidebar header */}
          <header className="h-16 px-4 border-b border-white/10 flex items-center justify-between bg-black/20 shrink-0 z-10">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              {activeContact && activeDisplay ? (
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={activeDisplay.profilePic || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary font-mono">
                      {activeDisplay.firstName[0]}{activeDisplay.lastName?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h2 className="text-base font-bold">{activeDisplay.firstName} {activeDisplay.lastName}</h2>
                    <p className="text-xs text-muted-foreground font-mono font-medium">@{activeContact.username}</p>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">Select a chat to get started</div>
              )}
            </div>
            {activeContact && activeDisplay && (
              <div className="flex items-center gap-2">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => startCall('voice')}
                  className="rounded-full text-muted-foreground hover:text-white hover:bg-white/10 cursor-pointer"
                  title="Voice Call"
                >
                  <Phone className="w-[18px] h-[18px]" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => startCall('video')}
                  className="rounded-full text-muted-foreground hover:text-white hover:bg-white/10 cursor-pointer"
                  title="Video Call"
                >
                  <Video className="w-[18px] h-[18px]" />
                </Button>
              </div>
            )}
          </header>

          {/* Chat scroll container with right-click disabled on empty area */}
          <ScrollArea
            ref={scrollRef}
            onContextMenu={(e) => e.preventDefault()}
            className="flex-1 p-6 bg-black/10 select-none"
          >
            {!activeContact ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground space-y-4 opacity-70 mt-32">
                <MessageSquare className="w-12 h-12" />
                <p className="text-sm max-w-sm text-center">Pick a contact from the sidebar, or tap + to start a new chat.</p>
              </div>
            ) : messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground space-y-4 opacity-70 mt-32">
                <MessageSquare className="w-12 h-12" />
                <p className="text-sm max-w-sm text-center">Say hello to @{activeContact.username}!</p>
              </div>
            ) : (
              <div className="space-y-4 flex flex-col pb-4">
                {messages.map((msg) => {
                  const isMe = msg.sender === 'me';
                  return (
                    <div key={msg.id} className={`flex w-full group ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <ContextMenu>
                        <ContextMenuTrigger asChild>
                          <div className={`flex flex-col gap-1 max-w-[75%] ${isMe ? 'items-end' : 'items-start'}`}>
                            <div className="relative group/msg flex items-center gap-2">
                              <div className={`px-4 py-2.5 rounded-2xl text-[16px] md:text-[17px] font-semibold leading-relaxed shadow-sm select-text ${isMe ? 'bg-[#0084ff] text-white rounded-br-xs' : 'bg-[#2a2a2e] border border-white/10 text-white rounded-bl-xs'}`}>
                                {msg.text}
                              </div>

                              {/* Reaction button ONLY shown on received messages (!isMe) */}
                              {!isMe && (
                                <button
                                  onClick={() => setActiveEmojiPickerMsgId(activeEmojiPickerMsgId === msg.id ? null : msg.id)}
                                  title="React to message"
                                  className="opacity-0 group-hover/msg:opacity-100 transition-opacity text-muted-foreground hover:text-white p-1.5 rounded-full hover:bg-white/10 cursor-pointer"
                                >
                                  <Smile className="w-4 h-4" />
                                </button>
                              )}
                            </div>

                            {/* Reactions list without blue/gray background boxes */}
                            {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                              <div className={`flex items-center gap-1.5 px-1 py-0.5 text-sm select-none mt-1 ${isMe ? 'self-end' : 'self-start'}`}>
                                {Object.entries(msg.reactions).map(([emoji, usersMap]) => {
                                  const uids = Object.keys(usersMap || {});
                                  if (uids.length === 0) return null;
                                  const myReacted = !!usersMap[currentUser.uid];
                                  return (
                                    <button
                                      key={emoji}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleToggleReaction(msg.id, emoji);
                                      }}
                                      className={`flex items-center gap-1 transition-transform hover:scale-115 cursor-pointer ${
                                        myReacted ? 'opacity-100 scale-105 font-bold' : 'opacity-75 hover:opacity-100'
                                      }`}
                                      title={myReacted ? `You reacted ${emoji}` : `React with ${emoji}`}
                                    >
                                      <span className="text-base leading-none">{emoji}</span>
                                      {uids.length > 1 && <span className="text-xs font-mono font-bold text-white">{uids.length}</span>}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </ContextMenuTrigger>
                        <ContextMenuContent className="w-64 bg-[#1e1e1e]/95 text-white border-white/10 backdrop-blur-xl">
                          {/* Timestamp info in context menu */}
                          <div className="px-3 py-2 text-xs font-semibold text-muted-foreground border-b border-white/10 flex items-center gap-2 select-none">
                            <Clock className="w-3.5 h-3.5 text-white/70 shrink-0" />
                            <span>
                              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(msg.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                            </span>
                          </div>

                          {/* Quick reaction bar at top of context menu ONLY for received messages */}
                          {!isMe && (
                            <>
                              <div className="flex items-center justify-between p-2 border-b border-white/10">
                                {QUICK_REACTIONS.map((emoji) => (
                                  <button
                                    key={emoji}
                                    onClick={() => handleToggleReaction(msg.id, emoji)}
                                    className="text-lg hover:bg-white/20 p-1.5 rounded-lg transition-transform hover:scale-125 cursor-pointer"
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </div>
                              <ContextMenuItem onClick={() => setActiveEmojiPickerMsgId(msg.id)}>
                                <Smile className="w-4 h-4 mr-2" /> Add reaction...
                              </ContextMenuItem>
                              <ContextMenuSeparator />
                            </>
                          )}
                          <ContextMenuItem onClick={() => setDeleteModalMsg(msg)} variant="destructive">
                            <Trash2 className="w-4 h-4 mr-2 text-[#ff4d4d]" /> Delete for me
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          <footer className="p-4 border-t border-white/10 bg-black/20 shrink-0">
            <form onSubmit={sendMessage} className="flex gap-2 max-w-4xl mx-auto items-center relative">
              <div className="relative flex items-center">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  disabled={!activeContact}
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowInputEmojiPicker(!showInputEmojiPicker);
                  }}
                  className="rounded-full h-10 w-10 shrink-0 text-muted-foreground hover:text-white hover:bg-white/10 cursor-pointer"
                >
                  <Smile className="w-5 h-5" />
                </Button>
                {showInputEmojiPicker && (
                  <div
                    className="absolute bottom-12 left-0 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <EmojiPicker
                      onSelect={(emoji) => {
                        setMessageInput((prev) => prev + emoji);
                      }}
                      onClose={() => setShowInputEmojiPicker(false)}
                    />
                  </div>
                )}
              </div>
              <Input
                placeholder={activeContact ? "Type your message..." : "Select a chat to start typing..."}
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                disabled={!activeContact}
                className="flex-1 rounded-full px-6 bg-black/30 border-white/10 text-white text-[15px] font-medium placeholder:text-[#888] focus-visible:bg-white/5 h-11"
              />
              <Button type="submit" size="icon" className="rounded-full h-10 w-10 shrink-0 shadow-md" disabled={!messageInput.trim() || !activeContact}>
                <Send className="w-4 h-4 ml-0.5" />
              </Button>
            </form>
          </footer>
        </main>
      </div>

      {/* Floating Unclipped Emoji Picker Overlay Modal */}
      {activeEmojiPickerMsgId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
          onClick={() => setActiveEmojiPickerMsgId(null)}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <EmojiPicker
              onSelect={(emoji) => {
                const targetMsgId = activeEmojiPickerMsgId;
                setActiveEmojiPickerMsgId(null);
                if (targetMsgId) handleToggleReaction(targetMsgId, emoji);
              }}
              onClose={() => setActiveEmojiPickerMsgId(null)}
            />
          </div>
        </div>
      )}

      {/* Confirm Delete Message Dialog */}
      <Dialog open={!!deleteModalMsg} onOpenChange={(open) => { if (!open) setDeleteModalMsg(null); }}>
        <DialogContent className="max-w-md bg-[#1e1e1e]/95 text-white border-white/10">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-white">Delete Message</DialogTitle>
            <DialogDescription className="text-[#a3a3a3] pt-2">
              Are you sure you want to delete this message? It will be deleted only for you and will remain visible to other participants.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button variant="outline" onClick={() => setDeleteModalMsg(null)} className="border-white/10 text-white hover:bg-white/10">
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDeleteMessage} className="bg-[#ff4d4d] hover:bg-[#ff3333] text-white font-semibold">
              Delete for me
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Clear Chat History Dialog */}
      <Dialog open={!!confirmClearChatContact} onOpenChange={(open) => { if (!open) setConfirmClearChatContact(null); }}>
        <DialogContent className="max-w-md bg-[#1e1e1e]/95 text-white border-white/10">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-white">Clear Chat History</DialogTitle>
            <DialogDescription className="text-[#a3a3a3] pt-2">
              Are you sure you want to clear all chat history with <span className="font-semibold text-white">@{confirmClearChatContact?.username}</span>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button variant="outline" onClick={() => setConfirmClearChatContact(null)} className="border-white/10 text-white hover:bg-white/10">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (confirmClearChatContact) {
                  handleDeleteChat(confirmClearChatContact);
                  setConfirmClearChatContact(null);
                }
              }}
              className="bg-[#ff4d4d] hover:bg-[#ff3333] text-white font-semibold"
            >
              Clear Chat History
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Remove Contact Dialog */}
      <Dialog open={!!confirmRemoveContact} onOpenChange={(open) => { if (!open) setConfirmRemoveContact(null); }}>
        <DialogContent className="max-w-md bg-[#1e1e1e]/95 text-white border-white/10">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-white">Remove Contact</DialogTitle>
            <DialogDescription className="text-[#a3a3a3] pt-2">
              Are you sure you want to remove <span className="font-semibold text-white">@{confirmRemoveContact?.username}</span> from your contacts list?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button variant="outline" onClick={() => setConfirmRemoveContact(null)} className="border-white/10 text-white hover:bg-white/10">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (confirmRemoveContact) {
                  handleRemoveContact(confirmRemoveContact);
                  setConfirmRemoveContact(null);
                }
              }}
              className="bg-[#ff4d4d] hover:bg-[#ff3333] text-white font-semibold"
            >
              Remove Contact
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AddContactDialog
        open={addContactOpen}
        onOpenChange={setAddContactOpen}
        currentUser={currentUser}
        existingContactUids={existingContactUids}
        onSelect={handleAddContact}
      />
      <ProfileModal
        currentUser={currentUser}
        open={profileOpen}
        onOpenChange={setProfileOpen}
        onProfileUpdated={(updated) => setCurrentUser(updated)}
      />
      {/* Incoming Call Ringing Overlay */}
      {incomingCall && (
        <div className="fixed inset-0 z-[110] flex flex-col items-center justify-center bg-black/90 text-white p-6 font-sans">
          <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/5 via-[#0c0c0e] to-cyan-500/5 pointer-events-none" />
          <div className="flex flex-col items-center justify-center gap-6 my-12 animate-bounce">
            <Avatar className="h-32 w-32 ring-8 ring-emerald-500/20">
              <AvatarFallback className="text-4xl bg-white/10">{incomingCall.callerName[0]}</AvatarFallback>
            </Avatar>
            <div className="text-center space-y-1">
              <h2 className="text-2xl font-extrabold">{incomingCall.callerName}</h2>
              <p className="text-sm text-muted-foreground font-mono">@{incomingCall.callerUsername}</p>
              <span className="inline-block mt-3 text-xs bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full font-bold uppercase tracking-wider animate-pulse">
                Incoming {incomingCall.type} Call...
              </span>
            </div>
          </div>

          <div className="flex items-center gap-6 z-30">
            <Button
              onClick={acceptCall}
              className="h-14 px-8 rounded-full bg-emerald-500 hover:bg-emerald-600 text-black font-bold flex items-center gap-2 cursor-pointer shadow-lg"
            >
              <Phone className="w-5 h-5 animate-pulse" /> Accept
            </Button>
            <Button
              onClick={rejectCall}
              variant="destructive"
              className="h-14 px-8 rounded-full bg-[#ff4d4d] hover:bg-[#ff3333] text-white font-bold flex items-center gap-2 cursor-pointer shadow-lg"
            >
              <PhoneOff className="w-5 h-5" /> Reject
            </Button>
          </div>
        </div>
      )}

      {/* Active Call Modal */}
      {activeCall && (
        <CallModal
          currentUserId={currentUser.uid}
          currentUsername={currentUser.username}
          currentUserDisplay={getContactDisplay(currentUser)}
          targetUserId={activeCall.targetUserId}
          targetUsername={activeCall.targetUsername}
          targetUserDisplay={
            activeCall.isCaller
              ? getContactDisplay(activeContact!)
              : {
                  firstName: incomingCall?.callerName.split(' ')[0] || 'User',
                  lastName: incomingCall?.callerName.split(' ').slice(1).join(' ') || '',
                  profilePic: null,
                }
          }
          roomId={activeCall.roomId}
          isCaller={activeCall.isCaller}
          callType={activeCall.type}
          onClose={() => setActiveCall(null)}
        />
      )}
    </SidebarProvider>
  );
}

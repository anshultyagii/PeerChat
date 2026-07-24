export type UserProfile = {
  uid: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  username: string;
  usernameLower: string;
  profilePic: string | null;
};

export type Message = {
  id: string;
  text: string;
  sender: 'me' | 'them';
  senderUsername: string;
  receiverUsername: string;
  timestamp: number;
  deletedFor?: Record<string, boolean>;
  reactions?: Record<string, Record<string, boolean>>;
};

export type Contact = {
  uid: string;
  username: string;
  firstName: string;
  lastName: string;
  profilePic: string | null;
  lastMessage?: string;
  lastMessageTime?: number;
  addedAt: number;
};
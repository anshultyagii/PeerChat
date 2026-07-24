import { useState } from 'react';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, UserPlus } from 'lucide-react';
import { Contact, UserProfile } from '@/types';
import { toast } from 'sonner';

type DirectoryUser = Omit<Contact, 'addedAt'>;

export default function AddContactDialog({
  open,
  onOpenChange,
  currentUser,
  existingContactUids,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUser: UserProfile;
  existingContactUids: Set<string>;
  onSelect: (contact: DirectoryUser) => Promise<void> | void;
}) {
  const [username, setUsername] = useState('');
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

  const close = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setUsername('');
      setError('');
    }
  };

  const handleStartChat = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalizedUsername = username.trim().replace(/^@/, '').toLowerCase();
    if (!normalizedUsername) {
      setError('Enter a username to start a chat.');
      return;
    }

    setError('');
    if (!/^[a-zA-Z0-9_]{3,15}$/.test(normalizedUsername)) {
      setError('Use a 3–15 character username with letters, numbers, or underscores.');
      return;
    }

    if (normalizedUsername === currentUser.username.toLowerCase()) {
      setError('You cannot start a chat with yourself.');
      return;
    }

    const fallbackId = `username:${normalizedUsername}`;
    if (existingContactUids.has(fallbackId)) {
      setError(`You're already chatting with @${normalizedUsername}.`);
      return;
    }

    setStarting(true);
    try {
      const usersQuery = query(
        collection(db, 'users'),
        where('usernameLower', '==', normalizedUsername),
        limit(1),
      );
      const snapshot = await getDocs(usersQuery);

      if (snapshot.empty) {
        // Fallback for user not yet registered in Firestore directory
        const contactId = `username:${normalizedUsername}`;
        await onSelect({
          uid: contactId,
          username: normalizedUsername,
          firstName: normalizedUsername,
          lastName: '',
          profilePic: null,
        });
        toast.info(`Chat started with @${normalizedUsername}.`);
        return;
      }

      const targetProfile = snapshot.docs[0].data() as UserProfile;
      if (targetProfile.uid === currentUser.uid) {
        setError('You cannot start a chat with yourself.');
        return;
      }

      await onSelect({
        uid: targetProfile.uid,
        username: targetProfile.username,
        firstName: targetProfile.firstName,
        lastName: targetProfile.lastName,
        profilePic: targetProfile.profilePic,
      });

      toast.success(`Chat started with ${targetProfile.firstName}!`);
    } catch (cause) {
      console.error('Username lookup error:', cause);
      const fallbackId = `username:${normalizedUsername}`;
      await onSelect({
        uid: fallbackId,
        username: normalizedUsername,
        firstName: normalizedUsername,
        lastName: '',
        profilePic: null,
      });
    } finally {
      setStarting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-md bg-[#1e1e1e]/95 text-white border-white/10">
        <DialogHeader>
          <DialogTitle>Start a new chat</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleStartChat} className="space-y-3">
          <p className="text-sm text-[#a3a3a3]">
            Enter a username to find a user and open a chat immediately.
          </p>
          <Input
            autoFocus
            placeholder="Username"
            value={username}
            onChange={(event) => { setUsername(event.target.value); setError(''); }}
            className="bg-black/30 border-white/10 text-white placeholder:text-[#666]"
          />
          {error && <p className="text-sm text-[#ff4d4d]">{error}</p>}
          <Button type="submit" className="w-full" disabled={starting}>
            {starting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><UserPlus className="w-4 h-4 mr-2" /> Start chat</>}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

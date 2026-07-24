import { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { UserProfile } from '@/types';
import { cacheUserProfile, syncUserProfileRTDB } from '@/lib/utils/auth';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Upload, X, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

const inputStyles = "w-full bg-black/30 border text-white rounded-[14px] px-[18px] py-[16px] text-[16px] outline-none focus:bg-white/5 focus:shadow-[inset_2px_0px_15px_-5px_rgba(255,255,255,0.3)] transition-all placeholder:text-[#666]";
const inputOk = "border-white/5 focus:border-white/20";
const primaryBtnStyles = "w-full bg-[#ffffff] text-[#000000] font-semibold p-[16px] rounded-[14px] text-[16px] hover:bg-[#e0e0e0] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";
const secondaryBtnStyles = "w-full bg-white/10 text-white p-[16px] rounded-[14px] text-[16px] hover:bg-white/20 transition-all cursor-pointer";

export default function ProfileModal({
  currentUser,
  open,
  onOpenChange,
  onProfileUpdated,
}: {
  currentUser: UserProfile;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProfileUpdated?: (updated: UserProfile) => void;
}) {
  const [firstName, setFirstName] = useState(currentUser.firstName);
  const [lastName, setLastName] = useState(currentUser.lastName);
  const [phone, setPhone] = useState(currentUser.phone);
  const [profilePic, setProfilePic] = useState<string | null>(currentUser.profilePic);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setProfilePic(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updatedProfile: UserProfile = {
        ...currentUser,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        profilePic,
      };

      // 1. Update Firestore
      await updateDoc(doc(db, 'users', currentUser.uid), {
        firstName: updatedProfile.firstName,
        lastName: updatedProfile.lastName,
        phone: updatedProfile.phone,
        profilePic: updatedProfile.profilePic,
      });

      // 2. Cache locally
      cacheUserProfile(updatedProfile);

      // 3. Sync to Realtime DB userProfiles so all contacts see updated photo in real time
      await syncUserProfileRTDB(updatedProfile);

      // 4. Notify parent component
      onProfileUpdated?.(updatedProfile);

      setSaved(true);
      toast.success("Profile updated successfully");
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error("Error updating profile:", err);
      toast.error("Couldn't update profile", { description: "Please try again." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="p-0 border-none bg-transparent shadow-none max-w-[480px]">
        <div className="relative bg-[#1e1e1e]/95 backdrop-blur-[24px] border border-white/10 rounded-[28px] p-[40px] w-full max-h-[95vh] overflow-y-auto shadow-[0_30px_60px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.1)] text-white [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <button
            onClick={() => onOpenChange(false)}
            className="absolute top-5 right-5 bg-white/10 border-none text-white w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <h2 className="text-[20px] font-semibold mb-[28px] text-center font-mono text-[#a3a3a3]">@{currentUser.username}</h2>

          <div className="space-y-[20px] flex flex-col items-center">
            <Avatar className="w-28 h-28 border border-white/10 bg-black/50">
              <AvatarImage src={profilePic || undefined} />
              <AvatarFallback className="text-3xl text-[#666] bg-transparent">{firstName[0] || '?'}</AvatarFallback>
            </Avatar>
            <div className="w-full">
              <label htmlFor="profile-picture" className={`cursor-pointer flex items-center justify-center ${secondaryBtnStyles}`}>
                <Upload className="w-5 h-5 mr-2" />
                Change photo
                <input id="profile-picture" type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              </label>
            </div>

            <div className="flex gap-[16px] w-full">
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" className={`${inputStyles} ${inputOk}`} />
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name" className={`${inputStyles} ${inputOk}`} />
            </div>

            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number" className={`${inputStyles} ${inputOk} w-full`} />

            <button type="button" onClick={handleSave} disabled={saving} className={`${primaryBtnStyles} flex items-center justify-center gap-2`}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <><CheckCircle2 className="w-4 h-4" /> Saved</> : "Save changes"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
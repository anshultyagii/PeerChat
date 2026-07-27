import { useEffect, useState, useRef } from 'react';
import { ref, set, onValue, update, remove, push, onChildAdded } from 'firebase/database';
import { rtdb } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PhoneOff, Video, VideoOff, Mic, MicOff } from 'lucide-react';
import { toast } from 'sonner';

interface CallModalProps {
  currentUserId: string;
  currentUsername: string;
  currentUserDisplay: { firstName: string; lastName: string; profilePic: string | null };
  targetUserId: string;
  targetUsername: string;
  targetUserDisplay: { firstName: string; lastName: string; profilePic: string | null };
  roomId: string; // chatRoomId or privateRoomId
  isCaller: boolean;
  callType: 'voice' | 'video';
  onClose: () => void;
}

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export default function CallModal({
  currentUserId,
  currentUsername,
  currentUserDisplay,
  targetUserId,
  targetUsername,
  targetUserDisplay,
  roomId,
  isCaller,
  callType,
  onClose,
}: CallModalProps) {
  const [callStatus, setCallStatus] = useState<'ringing' | 'connecting' | 'connected' | 'ended' | 'rejected'>('ringing');
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const callDbRef = ref(rtdb, `calls/${roomId}`);

  // 1. Initialize media stream
  useEffect(() => {
    let isMounted = true;


    function createMockStream(withVideo: boolean): MediaStream {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const destination = audioContext.createMediaStreamDestination();
      
      const gainNode = audioContext.createGain();
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      const osc = audioContext.createOscillator();
      osc.connect(gainNode);
      gainNode.connect(destination);
      osc.start();
      
      const stream = destination.stream;
      
      if (withVideo) {
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#0f0f11';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          
          // Draw text indicator
          ctx.fillStyle = '#ffffff';
          ctx.font = '24px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('Localhost Mock Stream', canvas.width / 2, canvas.height / 2);
        }
        
        const canvasStream = (canvas as any).captureStream ? (canvas as any).captureStream(10) : null;
        if (canvasStream) {
          const videoTrack = canvasStream.getVideoTracks()[0];
          if (videoTrack) {
            stream.addTrack(videoTrack);
          }
        }
      }
      
      return stream;
    }

    async function initMedia() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast.warning("Using simulated media tracks (browser media devices API unavailable)");
        const mockStream = createMockStream(callType === 'video');
        localStreamRef.current = mockStream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = mockStream;
        }
        setupWebRTC();
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: callType === 'video',
        });

        if (!isMounted) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // Start WebRTC connection setup
        setupWebRTC();
      } catch (err) {
        console.error("Media access error:", err);
        toast.warning("Using simulated media tracks (hardware access failed or blocked)");
        const mockStream = createMockStream(callType === 'video');
        localStreamRef.current = mockStream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = mockStream;
        }
        setupWebRTC();
      }
    }

    initMedia();

    return () => {
      isMounted = false;
      cleanup();
    };
  }, []);

  // 2. Listen to call state changes in RTDB
  useEffect(() => {
    const unsubscribe = onValue(callDbRef, (snapshot) => {
      if (!snapshot.exists()) {
        // If DB call node is removed, end call locally
        setCallStatus('ended');
        setTimeout(onClose, 1500);
        return;
      }

      const data = snapshot.val();

      if (data.status === 'rejected') {
        setCallStatus('rejected');
        toast.error("Call rejected");
        setTimeout(onClose, 1500);
      } else if (data.status === 'ended') {
        setCallStatus('ended');
        setTimeout(onClose, 1500);
      } else if (data.status === 'accepted' && callStatus === 'ringing') {
        setCallStatus('connecting');
      }
    });

    return unsubscribe;
  }, [callStatus]);

  // 3. WebRTC signaling logic
  async function setupWebRTC() {
    try {
      const pc = new RTCPeerConnection(ICE_SERVERS);
      peerConnectionRef.current = pc;

      // Add local stream tracks to RTCPeerConnection
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current!);
        });
      }

      // Handle remote track stream
      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          remoteStreamRef.current = event.streams[0];
          setRemoteStream(event.streams[0]);
          setCallStatus('connected');
        }
      };

      // Handle ICE Candidates generated locally
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          const candidatePath = isCaller
            ? `calls/${roomId}/callerCandidates`
            : `calls/${roomId}/receiverCandidates`;
          
          // Push candidate to RTDB
          const candidatesRef = ref(rtdb, candidatePath);
          push(candidatesRef, event.candidate.toJSON());
        }
      };

      if (isCaller) {
        // Caller creates offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        await set(callDbRef, {
          callerId: currentUserId,
          callerName: `${currentUserDisplay.firstName} ${currentUserDisplay.lastName}`,
          callerUsername: currentUsername,
          receiverId: targetUserId,
          receiverName: `${targetUserDisplay.firstName} ${targetUserDisplay.lastName}`,
          receiverUsername: targetUsername,
          type: callType,
          status: 'ringing',
          offer: {
            sdp: offer.sdp,
            type: offer.type,
          },
        });

        // Listen for receiver's answer
        onValue(ref(rtdb, `calls/${roomId}/answer`), async (snapshot) => {
          if (snapshot.exists()) {
            const answer = snapshot.val();
            if (pc.signalingState !== 'stable') {
              await pc.setRemoteDescription(new RTCSessionDescription(answer));
            }
          }
        });

        // Listen for receiver's ICE candidates
        onChildAdded(ref(rtdb, `calls/${roomId}/receiverCandidates`), (snapshot) => {
          if (snapshot.exists()) {
            const candidate = snapshot.val();
            pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(err => 
              console.warn("Error adding receiver candidate:", err)
            );
          }
        });
      } else {
        // Receiver accepts call: listen for caller's offer
        await set(ref(rtdb, `calls/${roomId}/status`), 'accepted');
        
        onValue(callDbRef, async (snapshot) => {
          const data = snapshot.val();
          if (data && data.offer && pc.signalingState === 'stable') {
            await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            await update(callDbRef, {
              answer: {
                sdp: answer.sdp,
                type: answer.type,
              },
            });
          }
        });

        // Listen for caller's ICE candidates
        onChildAdded(ref(rtdb, `calls/${roomId}/callerCandidates`), (snapshot) => {
          if (snapshot.exists()) {
            const candidate = snapshot.val();
            pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(err => 
              console.warn("Error adding caller candidate:", err)
            );
          }
        });
      }
    } catch (err) {
      console.error("WebRTC Setup Error:", err);
      endCall();
    }
  }

  function toggleMute() {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  }

  function toggleCamera() {
    if (localStreamRef.current && callType === 'video') {
      localStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsCameraOff(!isCameraOff);
    }
  }

  async function endCall() {
    try {
      await update(callDbRef, { status: 'ended' });
      cleanup();
      setCallStatus('ended');
      setTimeout(onClose, 1000);
    } catch {
      cleanup();
      onClose();
    }
  }

  function cleanup() {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    remove(callDbRef).catch(() => {});
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/95 text-white p-6 font-sans">
      <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/5 via-[#0c0c0e] to-cyan-500/5 pointer-events-none" />
      
      {/* Video Container (for video call) */}
      {callType === 'video' && (
        <div className="relative w-full max-w-4xl flex-1 h-full md:aspect-video rounded-2xl md:rounded-3xl overflow-hidden bg-neutral-900 border border-white/10 shadow-2xl flex items-center justify-center my-4 md:my-6">
          {/* Remote Video Stream */}
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
          
          {/* Self view Video Stream (Picture-in-Picture) */}
          <div className="absolute bottom-4 right-4 w-28 md:w-44 aspect-video rounded-lg md:rounded-xl overflow-hidden bg-neutral-950 border border-white/20 shadow-xl z-20">
            {isCameraOff ? (
              <div className="w-full h-full flex items-center justify-center bg-neutral-900 text-muted-foreground">
                <VideoOff className="w-6 h-6" />
              </div>
            ) : (
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            )}
          </div>

          {callStatus !== 'connected' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-950/80 backdrop-blur-md gap-4 z-10">
              <Avatar className="h-24 w-24 ring-4 ring-emerald-500/30">
                <AvatarImage src={targetUserDisplay.profilePic || undefined} />
                <AvatarFallback className="text-2xl bg-white/10">{targetUserDisplay.firstName[0]}{targetUserDisplay.lastName?.[0]}</AvatarFallback>
              </Avatar>
              <div className="text-center">
                <h3 className="text-xl font-bold">{targetUserDisplay.firstName} {targetUserDisplay.lastName}</h3>
                <p className="text-xs text-muted-foreground font-mono">@{targetUsername}</p>
                <p className="text-sm text-emerald-400 font-medium animate-pulse mt-2 capitalize">{callStatus}...</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Voice Call UI */}
      {callType === 'voice' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 my-12">
          <div className="relative">
            <Avatar className="h-32 w-32 ring-8 ring-emerald-500/10">
              <AvatarImage src={targetUserDisplay.profilePic || undefined} />
              <AvatarFallback className="text-4xl bg-white/10">{targetUserDisplay.firstName[0]}{targetUserDisplay.lastName?.[0]}</AvatarFallback>
            </Avatar>
            {callStatus === 'connected' && (
              <div className="absolute -inset-2 rounded-full border border-emerald-400/30 animate-ping pointer-events-none" />
            )}
          </div>
          
          <div className="text-center space-y-1">
            <h2 className="text-2xl font-extrabold">{targetUserDisplay.firstName} {targetUserDisplay.lastName}</h2>
            <p className="text-sm text-muted-foreground font-mono">@{targetUsername}</p>
            <span className="inline-block mt-3 text-xs bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full font-bold uppercase tracking-wider animate-pulse">
              {callStatus === 'connected' ? 'Voice Call Connected' : `${callStatus}...`}
            </span>
          </div>
        </div>
      )}

      {/* Audio Element for Voice Call Stream */}
      {callType === 'voice' && (
        <audio ref={remoteVideoRef as any} autoPlay playsInline className="hidden" />
      )}

      {/* Control Buttons */}
      <div className="flex items-center gap-4 md:gap-6 bg-neutral-900/60 border border-white/10 px-6 md:px-8 py-3 md:py-4 rounded-full backdrop-blur-md shadow-lg z-30 mb-2">
        <Button
          onClick={toggleMute}
          variant="ghost"
          size="icon"
          className={`h-12 w-12 rounded-full cursor-pointer transition-all ${
            isMuted ? 'bg-[#ff4d4d] text-white hover:bg-[#ff3333]' : 'bg-white/10 text-white hover:bg-white/20'
          }`}
        >
          {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </Button>

        {callType === 'video' && (
          <Button
            onClick={toggleCamera}
            variant="ghost"
            size="icon"
            className={`h-12 w-12 rounded-full cursor-pointer transition-all ${
              isCameraOff ? 'bg-[#ff4d4d] text-white hover:bg-[#ff3333]' : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            {isCameraOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
          </Button>
        )}

        <Button
          onClick={endCall}
          variant="destructive"
          size="icon"
          className="h-12 w-12 rounded-full bg-[#ff4d4d] hover:bg-[#ff3333] cursor-pointer"
        >
          <PhoneOff className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
}

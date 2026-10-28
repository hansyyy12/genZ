import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { LiveMeeting } from '../types';
import {
  WebRTCClassroomManager,
  RemoteParticipant,
  PeerInfo,
} from '../services/webrtcService';
import {
  MeetingMessage,
  subscribeMeetingMessages,
} from '../services/firebaseService';
import {
  Video,
  Mic,
  MicOff,
  VideoOff,
  Monitor,
  Hand,
  PhoneOff,
  Send,
  Plus,
  Users,
  Copy,
  Check,
  Radio,
  BookOpen,
  LayoutGrid,
  Maximize2,
  MessageSquare,
  Sparkles,
  Signal,
  Smile,
} from 'lucide-react';

export const LiveMeetingView: React.FC = () => {
  const { user } = useAuth();
  const { courses, meetings, createMeeting, sendMeetingMessage, isEnrolledInCourse } = useData();

  const isLecturer = user?.role === 'lecturer' || user?.role === 'admin';
  const [activeRoom, setActiveRoom] = useState<LiveMeeting | null>(null);

  // Call States
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [layoutMode, setLayoutMode] = useState<'gallery' | 'speaker'>('gallery');
  const [activeTab, setActiveTab] = useState<'chat' | 'participants'>('chat');
  const [chatOpen, setChatOpen] = useState(true);
  const [chatMessages, setChatMessages] = useState<MeetingMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [callDuration, setCallDuration] = useState(0);
  const [copiedCode, setCopiedCode] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string>('idle');

  // Remote WebRTC Participants
  const [remoteParticipants, setRemoteParticipants] = useState<RemoteParticipant[]>([]);

  // Join by Code State
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [joinStatusMsg, setJoinStatusMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  // New Meeting modal state (Lecturer)
  const [newMeetingModalOpen, setNewMeetingModalOpen] = useState(false);
  const [meetTitle, setMeetTitle] = useState('');
  const [meetCourseCode, setMeetCourseCode] = useState('');

  // Media & WebRTC Refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const webrtcManagerRef = useRef<WebRTCClassroomManager | null>(null);

  // Resolved user's courses
  const myCourses = isLecturer
    ? courses.filter(
        (c) =>
          c.ownerId === user?.uid ||
          c.ownerName === user?.name ||
          (!c.ownerId || c.ownerId === 'demo_lecturer_ama_mensah')
      )
    : courses.filter((c) => isEnrolledInCourse(c));

  // Catalog of rooms
  const myNormCodes = new Set(myCourses.map((c) => (c.code || '').replace(/[^A-Z0-9]/g, '').toUpperCase()));
  const realMeetings = meetings.filter((m) => {
    const mNorm = (m.courseCode || '').replace(/[^A-Z0-9]/g, '').toUpperCase();
    return myNormCodes.has(mNorm);
  });
  const coveredNorms = new Set(realMeetings.map((m) => (m.courseCode || '').replace(/[^A-Z0-9]/g, '').toUpperCase()));
  const permanentRooms: LiveMeeting[] = myCourses
    .filter((c) => !coveredNorms.has((c.code || '').replace(/[^A-Z0-9]/g, '').toUpperCase()))
    .map((c) => ({
      id: `meet_${c.code.replace(/[^a-zA-Z0-9_]/g, '_')}`,
      ownerId: c.ownerId || 'instructor',
      courseCode: c.code,
      title: `${c.name} - Live Class`,
      active: true,
      createdAt: c.createdAt || new Date().toISOString(),
    }));
  const allAvailableMeetings = [...realMeetings, ...permanentRooms];

  // Subscribe to real-time chat messages when active in a room
  useEffect(() => {
    if (!activeRoom) {
      setChatMessages([]);
      return;
    }
    const unsub = subscribeMeetingMessages(activeRoom.id, (msgs) => {
      setChatMessages(msgs);
    });
    return () => unsub();
  }, [activeRoom?.id]);

  // Session timer
  useEffect(() => {
    let interval: any;
    if (activeRoom) {
      interval = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      setCallDuration(0);
    }
    return () => clearInterval(interval);
  }, [activeRoom]);

  // Start local media (Camera + Mic) with iOS Safari compatibility
  const startLocalMedia = async (): Promise<MediaStream | null> => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: { echoCancellation: true, noiseSuppression: true },
        });
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.play().catch(() => {});
        }
        setCamOn(true);
        setMicOn(true);
        return stream;
      }
    } catch (err) {
      console.warn('Camera/mic access unavailable; attempting audio-only:', err);
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        localStreamRef.current = audioStream;
        setCamOn(false);
        setMicOn(true);
        return audioStream;
      } catch {
        console.warn('Running without hardware media devices.');
        setCamOn(false);
        setMicOn(false);
      }
    }
    return null;
  };

  const handleJoinCall = async (meeting: LiveMeeting) => {
    setActiveRoom(meeting);
    setJoinStatusMsg(null);
    setHandRaised(false);
    setScreenSharing(false);
    setConnectionStatus('connecting');

    // 1. Get real camera & audio stream
    const stream = await startLocalMedia();

    // 2. Initialize WebRTC Manager
    const myPeerId = `${user?.uid || 'user'}_${Date.now().toString(36)}`;
    const myInfo: PeerInfo = {
      peerId: myPeerId,
      name: user?.name || (isLecturer ? 'Lecturer' : 'Student'),
      role: isLecturer ? 'lecturer' : 'student',
      micOn: true,
      camOn: stream ? stream.getVideoTracks().some((t) => t.enabled) : false,
      handRaised: false,
      isSharingScreen: false,
      joinedAt: new Date().toISOString(),
    };

    const manager = new WebRTCClassroomManager(
      meeting.id,
      myInfo,
      stream,
      (participants) => {
        setRemoteParticipants(participants);
        if (participants.length > 0) {
          setConnectionStatus('connected');
        } else {
          setConnectionStatus('waiting');
        }
      },
      (state) => {
        setConnectionStatus(state);
      }
    );

    webrtcManagerRef.current = manager;
    await manager.join();
  };

  const handleLeaveCall = async () => {
    if (webrtcManagerRef.current) {
      await webrtcManagerRef.current.leave();
      webrtcManagerRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    setActiveRoom(null);
    setRemoteParticipants([]);
    setScreenSharing(false);
    setHandRaised(false);
    setConnectionStatus('idle');
  };

  const toggleMic = () => {
    const nextState = !micOn;
    setMicOn(nextState);
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = nextState;
      });
    }
    if (webrtcManagerRef.current) {
      webrtcManagerRef.current.updateStatus({ micOn: nextState });
    }
  };

  const toggleCam = () => {
    const nextState = !camOn;
    setCamOn(nextState);
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = nextState;
      });
    }
    if (webrtcManagerRef.current) {
      webrtcManagerRef.current.updateStatus({ camOn: nextState });
    }
  };

  const toggleScreenShare = async () => {
    if (screenSharing) {
      // Revert back to camera
      setScreenSharing(false);
      const stream = await startLocalMedia();
      if (webrtcManagerRef.current) {
        webrtcManagerRef.current.setLocalStream(stream);
        webrtcManagerRef.current.updateStatus({ isSharingScreen: false });
      }
      return;
    }
    try {
      if (navigator.mediaDevices && (navigator.mediaDevices as any).getDisplayMedia) {
        const screenStream = await (navigator.mediaDevices as any).getDisplayMedia({ video: true, audio: true });
        localStreamRef.current = screenStream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }
        setScreenSharing(true);

        if (webrtcManagerRef.current) {
          webrtcManagerRef.current.setLocalStream(screenStream);
          webrtcManagerRef.current.updateStatus({ isSharingScreen: true });
        }

        // When user stops screen sharing via browser native UI
        screenStream.getVideoTracks()[0].onended = async () => {
          setScreenSharing(false);
          const camStream = await startLocalMedia();
          if (webrtcManagerRef.current) {
            webrtcManagerRef.current.setLocalStream(camStream);
            webrtcManagerRef.current.updateStatus({ isSharingScreen: false });
          }
        };
      }
    } catch {
      setScreenSharing(false);
    }
  };

  const toggleHandRaise = () => {
    const nextState = !handRaised;
    setHandRaised(nextState);
    if (webrtcManagerRef.current) {
      webrtcManagerRef.current.updateStatus({ handRaised: nextState });
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !activeRoom) return;
    const text = inputMessage.trim();
    setInputMessage('');
    await sendMeetingMessage(activeRoom.id, text);
  };

  const handleJoinByCode = async (codeToJoin?: string) => {
    const raw = (codeToJoin || joinCodeInput).trim().toUpperCase();
    if (!raw) {
      setJoinStatusMsg({ type: 'error', text: 'Please enter a course code (e.g. CRS-366) or meeting code.' });
      return;
    }
    const cleanAlpha = raw.replace(/[^A-Z0-9]/g, '');

    // 1. Look for existing room in active meetings
    let targetMeeting = allAvailableMeetings.find((m) => {
      const mId = m.id.toUpperCase();
      const mNorm = (m.courseCode || '').replace(/[^A-Z0-9]/g, '').toUpperCase();
      return mId === raw || (cleanAlpha.length > 0 && mNorm === cleanAlpha);
    });

    // 2. Look for matching course
    if (!targetMeeting) {
      const matchCourse = courses.find((c) => {
        const cNorm = (c.code || '').replace(/[^A-Z0-9]/g, '').toUpperCase();
        return cleanAlpha.length > 0 && cNorm === cleanAlpha;
      });

      if (matchCourse) {
        const meetId = `meet_${matchCourse.code.replace(/[^a-zA-Z0-9_]/g, '_')}`;
        targetMeeting = {
          id: meetId,
          ownerId: matchCourse.ownerId || user?.uid || 'instructor',
          courseCode: matchCourse.code,
          title: `${matchCourse.name} - Live Class`,
          active: true,
          createdAt: new Date().toISOString(),
        };
        try {
          await createMeeting(targetMeeting);
        } catch {}
      }
    }

    // 3. Fallback: custom room for that code
    if (!targetMeeting) {
      const meetId = `meet_${cleanAlpha || 'class'}_${Date.now()}`;
      targetMeeting = {
        id: meetId,
        ownerId: user?.uid || 'user',
        courseCode: raw,
        title: `Live Class Session (${raw})`,
        active: true,
        createdAt: new Date().toISOString(),
      };
      try {
        await createMeeting(targetMeeting);
      } catch {}
    }

    handleJoinCall(targetMeeting);
  };

  const handleCreateMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!meetTitle.trim()) return;
    const code = meetCourseCode || myCourses[0]?.code || 'CRS-366';
    const id = `meet_${code.replace(/[^a-zA-Z0-9_]/g, '_')}_${Date.now()}`;
    await createMeeting({
      ownerId: user?.uid || 'instructor',
      courseCode: code,
      title: meetTitle.trim(),
      active: true,
    });
    setNewMeetingModalOpen(false);
    setMeetTitle('');
  };

  const handleCopyMeetingCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const formatCallTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">
              Live Video Classroom (Zoom-Style VC)
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 flex items-center gap-1">
              <Signal className="w-3 h-3 text-blue-600 animate-pulse" />
              Live WebRTC Audio & Video
            </span>
          </div>
          <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Real interactive video call with live peer cameras, audio, screen presentation, and synchronized class chat.
          </p>
        </div>

        {isLecturer && !activeRoom && (
          <button
            onClick={() => {
              setMeetCourseCode(myCourses[0]?.code || '');
              setNewMeetingModalOpen(true);
            }}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-2 shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Schedule New Session
          </button>
        )}
      </div>

      {!activeRoom && (
        /* Top: Join Classroom by Code Bar */
        <div className="p-5 md:p-6 rounded-2xl bg-gradient-to-r from-blue-900 via-indigo-900 to-[#081229] text-white shadow-xl space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-900 flex items-center justify-center font-bold shadow-md shadow-amber-400/20">
                <Video className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-white">Join Live Video Call with Code</h3>
                <p className="text-xs text-blue-200/80">
                  Enter your course code (e.g. <b>CRS-366</b>, <b>GIS100-X7K</b>) to connect live:
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-emerald-300 font-mono bg-emerald-950/60 px-2.5 py-1 rounded-lg border border-emerald-500/30">
              <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
              Direct P2P Ready
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5">
            <input
              type="text"
              placeholder="Enter Course Code e.g. CRS-366 or Room Code..."
              value={joinCodeInput}
              onChange={(e) => setJoinCodeInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleJoinByCode()}
              className="flex-1 px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-sm font-mono uppercase text-white placeholder-blue-300/60 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            <button
              onClick={() => handleJoinByCode()}
              className="px-6 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-900 text-xs font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-amber-400/20 transition cursor-pointer"
            >
              <Video className="w-4 h-4" /> Start / Join Call
            </button>
          </div>

          {joinStatusMsg && (
            <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-400/40 text-xs text-rose-200">
              {joinStatusMsg.text}
            </div>
          )}

          {/* Quick Click Chips for User's Courses */}
          {myCourses.length > 0 && (
            <div className="pt-2 border-t border-white/10 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-blue-200 text-[11px] font-bold">1-Click Join Your Courses:</span>
              {myCourses.map((c) => (
                <button
                  key={c.id}
                  onClick={() => handleJoinByCode(c.code)}
                  className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 text-white font-mono text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  {c.name} ({c.code})
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {activeRoom ? (
        /* =========================================================
         * ZOOM-STYLE LIVE VIDEO CLASSROOM INTERFACE
         * =======================================================*/
        <div className="rounded-2xl bg-[#0b101b] border border-blue-900/40 overflow-hidden text-white shadow-2xl flex flex-col min-h-[640px]">
          {/* Top Bar (Call Info & Actions) */}
          <div className="p-3.5 md:p-4 bg-[#080d17] border-b border-white/10 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <span className="px-2.5 py-1 rounded-md text-[10px] font-extrabold uppercase tracking-wider bg-amber-400 text-slate-900">
                {activeRoom.courseCode}
              </span>
              <div>
                <h3 className="text-sm md:text-base font-extrabold text-white leading-tight">
                  {activeRoom.title}
                </h3>
                <span className="text-[11px] text-slate-400">
                  {remoteParticipants.length + 1} participant(s) in call
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Call Timer */}
              <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                {formatCallTime(callDuration)}
              </span>

              {/* Connection Status Badge */}
              <span
                className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold flex items-center gap-1 ${
                  remoteParticipants.length > 0
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                }`}
              >
                <Signal className="w-3 h-3" />
                {remoteParticipants.length > 0 ? 'Live Connected' : 'Waiting for peers'}
              </span>

              {/* Share Code Button */}
              <button
                onClick={() => handleCopyMeetingCode(activeRoom.courseCode || activeRoom.id)}
                className="px-3 py-1 rounded-full text-xs font-bold bg-white/10 hover:bg-white/20 text-slate-200 flex items-center gap-1.5 transition cursor-pointer"
                title="Copy Room Code"
              >
                {copiedCode ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedCode ? 'Copied!' : activeRoom.courseCode}</span>
              </button>

              {/* View Layout Switcher */}
              <button
                onClick={() => setLayoutMode(layoutMode === 'gallery' ? 'speaker' : 'gallery')}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 cursor-pointer"
                title={`Switch to ${layoutMode === 'gallery' ? 'Speaker' : 'Gallery'} view`}
              >
                {layoutMode === 'gallery' ? <Maximize2 className="w-4 h-4" /> : <LayoutGrid className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Main Stage & Side Panel */}
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            {/* Video Stage Area */}
            <div className="flex-1 p-4 flex flex-col justify-between overflow-y-auto">
              {/* Waiting notice if alone */}
              {remoteParticipants.length === 0 && (
                <div className="p-3 mb-3 rounded-xl bg-blue-900/30 border border-blue-500/30 flex items-center justify-between text-xs text-blue-200 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Radio className="w-4 h-4 text-amber-400 animate-pulse" />
                    <span>
                      You are in the room. Classmates can join now from their phone or laptop using code <b>{activeRoom.courseCode}</b>!
                    </span>
                  </div>
                  <button
                    onClick={() => handleCopyMeetingCode(activeRoom.courseCode || activeRoom.id)}
                    className="px-2.5 py-1 rounded bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold text-[11px] cursor-pointer"
                  >
                    Copy Code
                  </button>
                </div>
              )}

              {/* Video Grid (Zoom Gallery Layout) */}
              <div
                className={`grid gap-3 flex-1 items-center justify-center ${
                  remoteParticipants.length === 0
                    ? 'grid-cols-1 max-w-2xl mx-auto w-full'
                    : remoteParticipants.length === 1
                    ? 'grid-cols-1 md:grid-cols-2 w-full'
                    : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 w-full'
                }`}
              >
                {/* 1. LOCAL PARTICIPANT TILE (YOU) */}
                <div className="relative aspect-video rounded-2xl bg-[#040813] border-2 border-blue-500/40 overflow-hidden flex items-center justify-center shadow-lg">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover -scale-x-100 ${camOn ? 'block' : 'hidden'}`}
                  />

                  {!camOn && (
                    <div className="flex flex-col items-center justify-center gap-2 text-slate-400 p-4 text-center">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 border-2 border-amber-400/60 flex items-center justify-center text-xl font-extrabold text-white shadow-md">
                        {user?.name?.slice(0, 2).toUpperCase() || 'YOU'}
                      </div>
                      <span className="text-xs font-bold text-white">{user?.name} (You)</span>
                      <span className="text-[10px] text-slate-400">Camera Off</span>
                    </div>
                  )}

                  {/* Badges on Local Tile */}
                  <div className="absolute bottom-2.5 left-2.5 px-2.5 py-1 rounded-lg bg-black/75 backdrop-blur-xs text-xs font-bold flex items-center gap-1.5 border border-white/10">
                    {handRaised && <span className="text-amber-300">✋</span>}
                    <span>{user?.name} (You)</span>
                    {!micOn ? (
                      <span className="text-rose-400">🔇</span>
                    ) : (
                      <span className="text-emerald-400">🎙️</span>
                    )}
                  </div>

                  {screenSharing && (
                    <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md bg-blue-600 text-[10px] font-bold flex items-center gap-1">
                      <Monitor className="w-3 h-3" /> Presenting
                    </div>
                  )}
                </div>

                {/* 2. REMOTE PARTICIPANTS TILES (LIVE WEBRTC FEEDS) */}
                {remoteParticipants.map((p) => (
                  <RemoteParticipantTile key={p.info.peerId} participant={p} />
                ))}
              </div>
            </div>

            {/* In-Call Side Panel: Live Chat & Participants Drawer */}
            {chatOpen && (
              <div className="w-full lg:w-80 bg-[#080d17] border-t lg:border-t-0 lg:border-l border-white/10 flex flex-col h-[340px] lg:h-auto">
                {/* Panel Tabs */}
                <div className="flex items-center border-b border-white/10">
                  <button
                    onClick={() => setActiveTab('chat')}
                    className={`flex-1 py-2.5 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      activeTab === 'chat'
                        ? 'text-amber-400 border-b-2 border-amber-400 bg-white/5'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    Class Chat ({chatMessages.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('participants')}
                    className={`flex-1 py-2.5 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      activeTab === 'participants'
                        ? 'text-amber-400 border-b-2 border-amber-400 bg-white/5'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    People ({remoteParticipants.length + 1})
                  </button>
                </div>

                {/* Tab: Chat */}
                {activeTab === 'chat' ? (
                  <div className="flex-1 flex flex-col justify-between p-3 overflow-hidden">
                    <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-xs">
                      {chatMessages.length === 0 ? (
                        <div className="p-4 text-center text-slate-400 text-xs">
                          No messages yet. Send a message or question to the class!
                        </div>
                      ) : (
                        chatMessages.map((msg, idx) => (
                          <div
                            key={msg.id || idx}
                            className={`p-2 rounded-xl border ${
                              msg.senderId === user?.uid
                                ? 'bg-blue-600/20 border-blue-500/30 ml-3'
                                : 'bg-white/5 border-white/10 mr-3'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="font-extrabold text-amber-300 text-[11px]">
                                {msg.sender} {msg.role === 'lecturer' && '· (Lecturer)'}
                              </span>
                              <span className="text-[9px] text-slate-400 font-mono">
                                {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                              </span>
                            </div>
                            <p className="text-slate-200 text-xs break-words">{msg.text}</p>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-white/10 mt-2">
                      <input
                        type="text"
                        placeholder="Type message..."
                        value={inputMessage}
                        onChange={(e) => setInputMessage(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                        className="flex-1 px-3 py-2 rounded-xl bg-white/10 border border-white/15 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                      />
                      <button
                        onClick={handleSendMessage}
                        className="p-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white cursor-pointer transition shadow-xs"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Tab: Participants List */
                  <div className="p-3 overflow-y-auto flex-1 space-y-2 text-xs">
                    {/* You */}
                    <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center font-extrabold text-white text-[11px]">
                          {user?.name?.slice(0, 2).toUpperCase() || 'U'}
                        </div>
                        <div>
                          <span className="font-bold text-white block">{user?.name} (You)</span>
                          <span className="text-[10px] text-slate-400">
                            {isLecturer ? 'Host · Lecturer' : 'Student'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs">
                        {handRaised && <span title="Hand Raised">✋</span>}
                        {micOn ? <span className="text-emerald-400">🎙️</span> : <span className="text-rose-400">🔇</span>}
                      </div>
                    </div>

                    {/* Remote Participants */}
                    {remoteParticipants.map((p) => (
                      <div
                        key={p.info.peerId}
                        className="p-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center font-extrabold text-white text-[11px]">
                            {p.info.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-bold text-white block">{p.info.name}</span>
                            <span className="text-[10px] text-slate-400 capitalize">
                              {p.info.role}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs">
                          {p.info.handRaised && <span title="Hand Raised">✋</span>}
                          {p.info.micOn ? <span className="text-emerald-400">🎙️</span> : <span className="text-rose-400">🔇</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Bottom Zoom-Style Control Bar */}
          <div className="p-3 bg-[#080d17] border-t border-white/10 flex items-center justify-between flex-wrap gap-2">
            {/* Audio & Video Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={toggleMic}
                className={`px-3 py-2 rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs font-bold ${
                  micOn ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-rose-600 text-white shadow-xs'
                }`}
                title={micOn ? 'Mute Microphone' : 'Unmute Microphone'}
              >
                {micOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                <span className="hidden sm:inline">{micOn ? 'Mute' : 'Unmuted'}</span>
              </button>

              <button
                onClick={toggleCam}
                className={`px-3 py-2 rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs font-bold ${
                  camOn ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-rose-600 text-white shadow-xs'
                }`}
                title={camOn ? 'Stop Camera' : 'Start Camera'}
              >
                {camOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                <span className="hidden sm:inline">{camOn ? 'Stop Video' : 'Start Video'}</span>
              </button>
            </div>

            {/* Interactive Session Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={toggleScreenShare}
                className={`px-3 py-2 rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs font-bold ${
                  screenSharing ? 'bg-blue-600 text-white' : 'bg-white/10 hover:bg-white/20 text-white'
                }`}
                title="Share Screen"
              >
                <Monitor className="w-4 h-4" />
                <span className="hidden sm:inline">{screenSharing ? 'Sharing Screen' : 'Share Screen'}</span>
              </button>

              <button
                onClick={toggleHandRaise}
                className={`px-3 py-2 rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs font-bold ${
                  handRaised ? 'bg-amber-400 text-slate-900 font-extrabold' : 'bg-white/10 hover:bg-white/20 text-white'
                }`}
                title="Raise or Lower Hand"
              >
                <Hand className="w-4 h-4" />
                <span className="hidden sm:inline">{handRaised ? 'Lower Hand' : 'Raise Hand'}</span>
              </button>

              <button
                onClick={() => setChatOpen(!chatOpen)}
                className={`px-3 py-2 rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs font-bold ${
                  chatOpen ? 'bg-blue-600 text-white' : 'bg-white/10 hover:bg-white/20 text-white'
                }`}
                title="Toggle Class Chat Panel"
              >
                <MessageSquare className="w-4 h-4" />
                <span className="hidden sm:inline">Chat</span>
              </button>
            </div>

            {/* Leave / End Call */}
            <div>
              <button
                onClick={handleLeaveCall}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-lg shadow-rose-600/30 transition cursor-pointer"
              >
                <PhoneOff className="w-4 h-4" /> Leave Call
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Sessions Catalog for Registered Courses */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              Available Classrooms ({allAvailableMeetings.length})
            </h2>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              1-click to start or join live session
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {allAvailableMeetings.map((meeting) => (
              <div
                key={meeting.id}
                className="p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Live P2P Room
                    </span>
                    <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded">
                      {meeting.courseCode}
                    </span>
                  </div>

                  <h3 className="font-bold text-base text-slate-900 dark:text-white mb-2">
                    {meeting.title}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                    Live interactive Zoom-like video class. Connects camera, microphone, screen sharing, and real-time class chat.
                  </p>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                  <button
                    onClick={() => handleJoinCall(meeting)}
                    className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                  >
                    <Video className="w-4 h-4" /> {isLecturer ? 'Start Live Class' : 'Join Classroom'}
                  </button>
                  <button
                    onClick={() => handleCopyMeetingCode(meeting.courseCode || meeting.id)}
                    className="w-full py-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Copy className="w-3 h-3" /> Share Code ({meeting.courseCode})
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* New Meeting Modal (for Lecturers) */}
      {newMeetingModalOpen && (
        <div
          onClick={() => setNewMeetingModalOpen(false)}
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6"
          >
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
              Create Virtual Classroom Session
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Launch a live lecture session for any of your courses.
            </p>

            <form onSubmit={handleCreateMeeting} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Course Code
                </label>
                <select
                  value={meetCourseCode}
                  onChange={(e) => setMeetCourseCode(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold"
                >
                  {myCourses.map((c) => (
                    <option key={c.id} value={c.code}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Session Topic / Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Live Q&A and Problem Solving Session"
                  value={meetTitle}
                  onChange={(e) => setMeetTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setNewMeetingModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm"
                >
                  Start Session
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Separate component for each remote peer video tile
 * to cleanly bind their RTCPeerConnection MediaStream.
 */
const RemoteParticipantTile: React.FC<{ participant: RemoteParticipant }> = ({ participant }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { info, stream } = participant;

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
  }, [stream]);

  const hasVideoStream = stream && stream.getVideoTracks().some((t) => t.enabled && t.readyState === 'live');

  return (
    <div className="relative aspect-video rounded-2xl bg-[#040813] border-2 border-emerald-500/30 overflow-hidden flex items-center justify-center shadow-lg">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className={`w-full h-full object-cover ${hasVideoStream && info.camOn ? 'block' : 'hidden'}`}
      />

      {(!hasVideoStream || !info.camOn) && (
        <div className="flex flex-col items-center justify-center gap-2 text-slate-400 p-4 text-center">
          <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 border-2 border-emerald-400/60 flex items-center justify-center text-xl font-extrabold text-white shadow-md">
            {info.name.slice(0, 2).toUpperCase()}
          </div>
          <span className="text-xs font-bold text-white">{info.name}</span>
          <span className="text-[10px] text-slate-400 capitalize">{info.role}</span>
        </div>
      )}

      {/* Badges on Remote Tile */}
      <div className="absolute bottom-2.5 left-2.5 px-2.5 py-1 rounded-lg bg-black/75 backdrop-blur-xs text-xs font-bold flex items-center gap-1.5 border border-white/10">
        {info.handRaised && <span className="text-amber-300">✋</span>}
        <span>{info.name}</span>
        <span className="text-[10px] text-slate-400">({info.role})</span>
        {!info.micOn ? (
          <span className="text-rose-400">🔇</span>
        ) : (
          <span className="text-emerald-400">🎙️</span>
        )}
      </div>

      {info.isSharingScreen && (
        <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md bg-blue-600 text-[10px] font-bold flex items-center gap-1">
          <Monitor className="w-3 h-3" /> Screen Shared
        </div>
      )}
    </div>
  );
};

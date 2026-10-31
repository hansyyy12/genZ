/**
 * Production-grade WebRTC Peer-to-Peer Video & Audio service
 * Powered by Google STUN servers and Firebase Firestore signaling.
 * Enables live multi-device interactive video classes (Zoom / Google Meet style).
 */
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  addDoc,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface PeerInfo {
  peerId: string;
  name: string;
  role: 'lecturer' | 'student' | 'admin';
  avatar?: string;
  micOn: boolean;
  camOn: boolean;
  handRaised: boolean;
  isSharingScreen: boolean;
  joinedAt: string;
}

export interface RemoteParticipant {
  info: PeerInfo;
  stream?: MediaStream;
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ],
  iceCandidatePoolSize: 10,
};

export class WebRTCClassroomManager {
  private meetingId: string;
  private myPeerId: string;
  private myInfo: PeerInfo;
  private localStream: MediaStream | null = null;
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private unsubs: Unsubscribe[] = [];
  private onRemoteParticipantUpdate: (participants: RemoteParticipant[]) => void;
  private remoteParticipants: Map<string, RemoteParticipant> = new Map();
  private onConnectionStateChange?: (state: string) => void;
  // Queue ICE candidates that arrive before remote description is processed
  private pendingCandidates: Map<string, RTCIceCandidateInit[]> = new Map();

  constructor(
    meetingId: string,
    myInfo: PeerInfo,
    localStream: MediaStream | null,
    onRemoteParticipantUpdate: (participants: RemoteParticipant[]) => void,
    onConnectionStateChange?: (state: string) => void
  ) {
    this.meetingId = meetingId.replace(/[^a-zA-Z0-9_-]/g, '_');
    this.myPeerId = myInfo.peerId;
    this.myInfo = myInfo;
    this.localStream = localStream;
    this.onRemoteParticipantUpdate = onRemoteParticipantUpdate;
    this.onConnectionStateChange = onConnectionStateChange;
  }

  public setLocalStream(stream: MediaStream | null) {
    this.localStream = stream;
    if (stream) {
      this.peerConnections.forEach((pc) => {
        const senders = pc.getSenders();
        stream.getTracks().forEach((track) => {
          const sender = senders.find((s) => s.track && s.track.kind === track.kind);
          if (sender) {
            sender.replaceTrack(track).catch(() => {});
          } else {
            pc.addTrack(track, stream);
          }
        });
      });
    }
  }

  private getCallId(peerA: string, peerB: string): string {
    return peerA < peerB ? `${peerA}_to_${peerB}` : `${peerB}_to_${peerA}`;
  }

  /**
   * Join Room: registers presence in Firestore, listens for other peers,
   * and negotiates WebRTC connection with bi-directional audio/video.
   */
  public async join(): Promise<void> {
    const peersCol = collection(db, 'meetings', this.meetingId, 'peers');
    const myDocRef = doc(peersCol, this.myPeerId);

    // 1. Announce presence with active microphone/camera status
    try {
      await setDoc(myDocRef, {
        ...this.myInfo,
        updatedAt: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('Presence write notice:', e);
    }

    // 2. Listen to peers presence
    const unsubPeers = onSnapshot(peersCol, (snap) => {
      const activePeerIds = new Set<string>();

      snap.docs.forEach((d) => {
        const raw = d.data();
        if (!raw) return;
        const peerId = raw.peerId || d.id;
        if (!peerId || peerId === this.myPeerId) return;

        const data: PeerInfo = {
          peerId,
          name: raw.name || 'Participant',
          role: raw.role || 'student',
          avatar: raw.avatar,
          micOn: raw.micOn ?? true,
          camOn: raw.camOn ?? true,
          handRaised: raw.handRaised ?? false,
          isSharingScreen: raw.isSharingScreen ?? false,
          joinedAt: raw.joinedAt || new Date().toISOString(),
        };

        activePeerIds.add(peerId);
        const existing = this.remoteParticipants.get(peerId);
        if (existing) {
          existing.info = data;
        } else {
          this.remoteParticipants.set(peerId, { info: data });
          // Deterministic single initiator: lexicographically lower peer initiates the offer
          if (this.myPeerId < peerId) {
            this.initiateCallToPeer(peerId);
          }
        }
      });

      // Cleanup peers who left
      this.remoteParticipants.forEach((_, peerId) => {
        if (!activePeerIds.has(peerId)) {
          this.closePeer(peerId);
          this.remoteParticipants.delete(peerId);
        }
      });

      this.notifyParticipants();
    });
    this.unsubs.push(unsubPeers);

    // 3. Listen for incoming call offers directed to me
    const callsCol = collection(db, 'meetings', this.meetingId, 'calls');
    const unsubCalls = onSnapshot(callsCol, (snap) => {
      snap.docChanges().forEach(async (change) => {
        const callId = change.doc.id;
        if (!callId.endsWith(`_to_${this.myPeerId}`)) return;

        const data = change.doc.data();
        const offererId = data.offererId;
        if (!offererId || offererId === this.myPeerId) return;

        if (change.type === 'added' || change.type === 'modified') {
          if (data.offer && !data.answer) {
            await this.handleIncomingOffer(callId, offererId, data.offer);
          }
        }
      });
    });
    this.unsubs.push(unsubCalls);
  }

  /**
   * Helper to create RTCPeerConnection with audio transceivers and event handlers
   */
  private setupPeerConnection(remotePeerId: string, isInitiator: boolean, callId: string): RTCPeerConnection {
    let pc = this.peerConnections.get(remotePeerId);
    if (pc) {
      return pc;
    }

    pc = new RTCPeerConnection(ICE_SERVERS);
    this.peerConnections.set(remotePeerId, pc);
    this.pendingCandidates.set(remotePeerId, []);

    // Crucial for bidirectional audio & video: add transceivers so SDP has sendrecv m-lines
    try {
      pc.addTransceiver('audio', { direction: 'sendrecv' });
      pc.addTransceiver('video', { direction: 'sendrecv' });
    } catch {
      // Fallback if browser does not support Unified Plan transceivers
    }

    // Attach local audio and video tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        pc!.addTrack(track, this.localStream!);
      });
    }

    // Handle receiving remote audio and video tracks
    pc.ontrack = (event) => {
      let stream = event.streams && event.streams[0];
      const participant = this.remoteParticipants.get(remotePeerId);

      if (!stream) {
        if (participant?.stream) {
          stream = participant.stream;
          if (!stream.getTracks().some((t) => t.id === event.track.id)) {
            stream.addTrack(event.track);
          }
        } else {
          stream = new MediaStream([event.track]);
        }
      } else {
        if (participant?.stream && participant.stream !== stream) {
          event.streams[0].getTracks().forEach((t) => {
            if (!participant.stream!.getTracks().some((ex) => ex.id === t.id)) {
              participant.stream!.addTrack(t);
            }
          });
          stream = participant.stream;
        }
      }

      if (participant) {
        participant.stream = stream;
        this.notifyParticipants();
      }
    };

    pc.onconnectionstatechange = () => {
      if (this.onConnectionStateChange) {
        this.onConnectionStateChange(pc!.connectionState);
      }
    };

    // Send local ICE candidates to the specific candidate sub-collection
    const callDocRef = doc(db, 'meetings', this.meetingId, 'calls', callId);
    pc.onicecandidate = async (event) => {
      if (event.candidate) {
        const candidateCol = collection(
          callDocRef,
          isInitiator ? 'callerCandidates' : 'calleeCandidates'
        );
        try {
          await addDoc(candidateCol, event.candidate.toJSON());
        } catch (err) {
          console.warn('ICE candidate dispatch handled:', err);
        }
      }
    };

    return pc;
  }

  /**
   * Initiator creates Offer and sends to Firestore
   */
  private async initiateCallToPeer(remotePeerId: string): Promise<void> {
    const callId = this.getCallId(this.myPeerId, remotePeerId);
    const pc = this.setupPeerConnection(remotePeerId, true, callId);

    const callDocRef = doc(db, 'meetings', this.meetingId, 'calls', callId);

    // Create and set local Offer
    const offerDescription = await pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    });
    await pc.setLocalDescription(offerDescription);

    const offer = {
      sdp: offerDescription.sdp,
      type: offerDescription.type,
    };

    await setDoc(callDocRef, {
      offererId: this.myPeerId,
      answererId: remotePeerId,
      offer,
      createdAt: new Date().toISOString(),
    });

    // Listen for remote Answer
    const unsubAnswer = onSnapshot(callDocRef, async (snapshot) => {
      const data = snapshot.data();
      if (data?.answer && !pc.currentRemoteDescription) {
        try {
          const answerDescription = new RTCSessionDescription(data.answer);
          await pc.setRemoteDescription(answerDescription);
          await this.drainPendingCandidates(remotePeerId, pc);
        } catch (err) {
          console.warn('Set remote answer error:', err);
        }
      }
    });
    this.unsubs.push(unsubAnswer);

    // Listen for Callee ICE candidates
    const calleeCandidatesCol = collection(callDocRef, 'calleeCandidates');
    const unsubCalleeCandidates = onSnapshot(calleeCandidatesCol, (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === 'added') {
          const candidateData = change.doc.data();
          await this.addOrQueueIceCandidate(remotePeerId, pc, candidateData);
        }
      });
    });
    this.unsubs.push(unsubCalleeCandidates);
  }

  /**
   * Responder handles incoming offer, sets remote description, and creates Answer
   */
  private async handleIncomingOffer(
    callId: string,
    offererId: string,
    offer: RTCSessionDescriptionInit
  ): Promise<void> {
    const pc = this.setupPeerConnection(offererId, false, callId);
    const callDocRef = doc(db, 'meetings', this.meetingId, 'calls', callId);

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      await this.drainPendingCandidates(offererId, pc);

      const answerDescription = await pc.createAnswer();
      await pc.setLocalDescription(answerDescription);

      const answer = {
        type: answerDescription.type,
        sdp: answerDescription.sdp,
      };

      await setDoc(callDocRef, { answer }, { merge: true });

      // Listen for Caller ICE candidates
      const callerCandidatesCol = collection(callDocRef, 'callerCandidates');
      const unsubCallerCandidates = onSnapshot(callerCandidatesCol, (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
          if (change.type === 'added') {
            const candidateData = change.doc.data();
            await this.addOrQueueIceCandidate(offererId, pc, candidateData);
          }
        });
      });
      this.unsubs.push(unsubCallerCandidates);
    } catch (err) {
      console.warn('Error handling incoming offer:', err);
    }
  }

  /**
   * Safely adds or queues ICE candidate depending on remote description state
   */
  private async addOrQueueIceCandidate(
    peerId: string,
    pc: RTCPeerConnection,
    candidateData: any
  ): Promise<void> {
    if (pc.remoteDescription && pc.remoteDescription.type) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidateData));
      } catch (e) {
        console.warn('addIceCandidate notice:', e);
      }
    } else {
      const queue = this.pendingCandidates.get(peerId) || [];
      queue.push(candidateData);
      this.pendingCandidates.set(peerId, queue);
    }
  }

  private async drainPendingCandidates(peerId: string, pc: RTCPeerConnection): Promise<void> {
    const queue = this.pendingCandidates.get(peerId) || [];
    for (const cand of queue) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(cand));
      } catch (e) {
        console.warn('drain candidate notice:', e);
      }
    }
    this.pendingCandidates.set(peerId, []);
  }

  /**
   * Update local status (mic, camera, hand raised) to all peers in Firestore
   */
  public async updateStatus(updates: Partial<PeerInfo>): Promise<void> {
    this.myInfo = { ...this.myInfo, ...updates };
    const myDocRef = doc(db, 'meetings', this.meetingId, 'peers', this.myPeerId);
    try {
      await setDoc(myDocRef, updates, { merge: true });
    } catch {}
  }

  private notifyParticipants(): void {
    const list = Array.from(this.remoteParticipants.values());
    this.onRemoteParticipantUpdate(list);
  }

  private closePeer(peerId: string): void {
    const pc = this.peerConnections.get(peerId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(peerId);
    }
    this.pendingCandidates.delete(peerId);
  }

  /**
   * Leave classroom and cleanup all resources
   */
  public async leave(): Promise<void> {
    // 1. Unsubscribe Firestore listeners
    this.unsubs.forEach((unsub) => unsub());
    this.unsubs = [];

    // 2. Remove presence from Firestore
    try {
      const myDocRef = doc(db, 'meetings', this.meetingId, 'peers', this.myPeerId);
      await deleteDoc(myDocRef);
    } catch {}

    // 3. Close all peer connections
    this.peerConnections.forEach((pc) => pc.close());
    this.peerConnections.clear();
    this.remoteParticipants.clear();
    this.pendingCandidates.clear();

    // 4. Stop local tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }
  }
}

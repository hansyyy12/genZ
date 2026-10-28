/**
 * Production-grade WebRTC Peer-to-Peer Video & Audio service
 * Powered by Google STUN servers and Firebase Firestore signaling.
 * Enables live multi-device interactive video classes (Zoom / Google Meet style).
 */
import {
  collection,
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  addDoc,
  serverTimestamp,
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
    // Replace track on all existing connections
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

  /**
   * Join Room: registers presence in Firestore, listens for other peers,
   * and initiates/answers WebRTC signaling calls.
   */
  public async join(): Promise<void> {
    const peersCol = collection(db, 'meetings', this.meetingId, 'peers');
    const myDocRef = doc(peersCol, this.myPeerId);

    // 1. Announce presence
    try {
      await setDoc(myDocRef, {
        ...this.myInfo,
        updatedAt: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('Presence write error:', e);
    }

    // 2. Listen to peers presence
    const unsubPeers = onSnapshot(peersCol, (snap) => {
      const activePeerIds = new Set<string>();

      snap.docs.forEach((d) => {
        const data = d.data() as PeerInfo;
        if (data.peerId === this.myPeerId) return;

        activePeerIds.add(data.peerId);
        const existing = this.remoteParticipants.get(data.peerId);
        if (existing) {
          existing.info = data;
        } else {
          this.remoteParticipants.set(data.peerId, { info: data });
          // Negotiate WebRTC connection if not yet connected
          this.connectToPeer(data.peerId);
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
    const unsubCalls = onSnapshot(callsCol, async (snap) => {
      snap.docChanges().forEach(async (change) => {
        const callId = change.doc.id;
        // Call ID is formatted as `${offererId}_to_${answererId}`
        if (!callId.includes(`_to_${this.myPeerId}`)) return;

        const data = change.doc.data();
        const offererId = data.offererId;

        if (change.type === 'added' || change.type === 'modified') {
          if (data.offer && !data.answer) {
            // Received an offer, answer it
            await this.handleIncomingOffer(callId, offererId, data.offer);
          }
        }
      });
    });
    this.unsubs.push(unsubCalls);
  }

  /**
   * Connect to peer: deterministic offerer strategy (lexicographical smaller peerId makes the offer).
   */
  private async connectToPeer(remotePeerId: string): Promise<void> {
    if (this.peerConnections.has(remotePeerId)) return;

    const isOfferer = this.myPeerId < remotePeerId;
    const pc = new RTCPeerConnection(ICE_SERVERS);
    this.peerConnections.set(remotePeerId, pc);

    // Add local tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        pc.addTrack(track, this.localStream!);
      });
    }

    // Handle remote track
    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        const stream = event.streams[0];
        const participant = this.remoteParticipants.get(remotePeerId);
        if (participant) {
          participant.stream = stream;
          this.notifyParticipants();
        }
      }
    };

    pc.onconnectionstatechange = () => {
      if (this.onConnectionStateChange) {
        this.onConnectionStateChange(pc.connectionState);
      }
    };

    const callId = `${this.myPeerId}_to_${remotePeerId}`;
    const callDocRef = doc(db, 'meetings', this.meetingId, 'calls', callId);

    // Send ICE candidates
    pc.onicecandidate = async (event) => {
      if (event.candidate) {
        const candidateCol = collection(callDocRef, isOfferer ? 'callerCandidates' : 'calleeCandidates');
        try {
          await addDoc(candidateCol, event.candidate.toJSON());
        } catch {}
      }
    };

    if (isOfferer) {
      // Offerer creates Offer
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

      // Listen for Answer
      const unsubCallDoc = onSnapshot(callDocRef, async (snapshot) => {
        const data = snapshot.data();
        if (!pc.currentRemoteDescription && data?.answer) {
          const answerDescription = new RTCSessionDescription(data.answer);
          await pc.setRemoteDescription(answerDescription);
        }
      });
      this.unsubs.push(unsubCallDoc);

      // Listen for remote ICE candidates
      const calleeCandidatesCol = collection(callDocRef, 'calleeCandidates');
      const unsubCandidates = onSnapshot(calleeCandidatesCol, (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
          if (change.type === 'added') {
            const candidateData = change.doc.data();
            try {
              await pc.addIceCandidate(new RTCIceCandidate(candidateData));
            } catch {}
          }
        });
      });
      this.unsubs.push(unsubCandidates);
    }
  }

  /**
   * Handle incoming offer from a peer
   */
  private async handleIncomingOffer(callId: string, offererId: string, offer: RTCSessionDescriptionInit): Promise<void> {
    let pc = this.peerConnections.get(offererId);
    if (!pc) {
      pc = new RTCPeerConnection(ICE_SERVERS);
      this.peerConnections.set(offererId, pc);

      if (this.localStream) {
        this.localStream.getTracks().forEach((track) => {
          pc!.addTrack(track, this.localStream!);
        });
      }

      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          const stream = event.streams[0];
          const participant = this.remoteParticipants.get(offererId);
          if (participant) {
            participant.stream = stream;
            this.notifyParticipants();
          }
        }
      };

      pc.onconnectionstatechange = () => {
        if (this.onConnectionStateChange) {
          this.onConnectionStateChange(pc!.connectionState);
        }
      };
    }

    const callDocRef = doc(db, 'meetings', this.meetingId, 'calls', callId);

    // Send callee ICE candidates
    pc.onicecandidate = async (event) => {
      if (event.candidate) {
        const candidateCol = collection(callDocRef, 'calleeCandidates');
        try {
          await addDoc(candidateCol, event.candidate.toJSON());
        } catch {}
      }
    };

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answerDescription = await pc.createAnswer();
    await pc.setLocalDescription(answerDescription);

    const answer = {
      type: answerDescription.type,
      sdp: answerDescription.sdp,
    };

    await setDoc(callDocRef, { answer }, { merge: true });

    // Listen for caller ICE candidates
    const callerCandidatesCol = collection(callDocRef, 'callerCandidates');
    const unsubCandidates = onSnapshot(callerCandidatesCol, (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === 'added') {
          const candidateData = change.doc.data();
          try {
            await pc!.addIceCandidate(new RTCIceCandidate(candidateData));
          } catch {}
        }
      });
    });
    this.unsubs.push(unsubCandidates);
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

    // 4. Stop local tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }
  }
}

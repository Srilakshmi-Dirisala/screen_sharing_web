class VideoViewer {
  constructor() {
    this.viewVideo = document.getElementById('screenVideo');
    this.statusText = document.getElementById('status');
    this.videoPlaceholder = document.getElementById('videoPlaceholder');
    this.peerConnection = null;
    this.db = null;
    this.roomId = 'default-room';
    this.peerId = 'viewer_' + Math.random().toString(36).substr(2, 9);
    this.broadcasterId = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;

    // ✅ Fixed STUN + TURN configuration for multi-network
    this.peerConnectionConfig = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        {
          urls: [
            'turn:numb.viagenie.ca:3478?transport=udp',
            'turn:numb.viagenie.ca:3478?transport=tcp'
          ],
          username: 'webrtc@live.com',
          credential: 'muazkh'
        }
      ],
      iceTransportPolicy: 'all'
    };

    console.log('🌍 WebRTC Configuration:', this.peerConnectionConfig);
    this.initFirebase();
  }

  initFirebase() {
    try {
      if (typeof firebase !== 'undefined' && typeof FIREBASE_CONFIG !== 'undefined') {
        if (!firebase.apps || firebase.apps.length === 0) {
          firebase.initializeApp(FIREBASE_CONFIG);
        }
        this.db = firebase.database();
        console.log('✅ Firebase initialized for viewer');
        this.init();
      } else {
        this.showError('Firebase not configured. Please check FIREBASE_CONFIG.');
      }
    } catch (error) {
      console.error('❌ Firebase initialization failed:', error);
      this.showError('Failed to connect to streaming service.');
    }
  }

  async init() {
    this.updateStatus('waiting', 'Connecting to room...');
    console.log('👤 Viewer ID:', this.peerId);

    try {
      await this.db.ref(`rooms/${this.roomId}/viewers/${this.peerId}`).set({
        id: this.peerId,
        timestamp: firebase.database.ServerValue.TIMESTAMP
      });
      this.db.ref(`rooms/${this.roomId}/viewers/${this.peerId}`).onDisconnect().remove();
      this.listenForBroadcaster();
    } catch (error) {
      this.showError('Failed to initialize viewer.');
    }
  }

  listenForBroadcaster() {
    console.log('🔍 Waiting for broadcaster...');
    const broadcasterRef = this.db.ref(`rooms/${this.roomId}/broadcaster`);

    broadcasterRef.on('value', async (snapshot) => {
      const broadcaster = snapshot.val();
      if (broadcaster && broadcaster.id) {
        console.log('📡 Broadcaster active:', broadcaster.id);
        this.broadcasterId = broadcaster.id;
        this.listenForOffers();
      } else {
        this.updateStatus('waiting', 'Waiting for broadcaster to start...');
      }
    });
  }

  listenForOffers() {
    const offersRef = this.db.ref(`rooms/${this.roomId}/offers`);

    if (this.offersListener)
      offersRef.off('child_added', this.offersListener);

    this.offersListener = offersRef.on('child_added', async (snapshot) => {
      const data = snapshot.val();
      if (data && data.to === this.peerId) {
        console.log('🎬 Offer received for this viewer.');
        await this.handleOffer(data);
        snapshot.ref.remove();
      }
    });

    const candidatesRef = this.db.ref(`rooms/${this.roomId}/iceCandidates`);
    if (this.candidatesListener)
      candidatesRef.off('child_added', this.candidatesListener);

    this.candidatesListener = candidatesRef.on('child_added', async (snapshot) => {
      const data = snapshot.val();
      if (data && data.to === this.peerId && data.from === this.broadcasterId) {
        await this.handleCandidate(data);
      }
    });
  }

  async handleOffer(data) {
    console.log('🧩 Setting up connection...');
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.peerConnection = new RTCPeerConnection(this.peerConnectionConfig);

    this.peerConnection.ontrack = (event) => {
      console.log('🎥 Track received:', event.track.kind);
      this.viewVideo.srcObject = event.streams[0];
      this.viewVideo.playsInline = true;
      this.viewVideo.autoplay = true;
      this.playVideo();
    };

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.db.ref(`rooms/${this.roomId}/iceCandidates`).push({
          candidate: event.candidate.toJSON(),
          from: this.peerId,
          to: this.broadcasterId
        });
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection.connectionState;
      console.log('🔄 Connection state:', state);
      if (state === 'connected') {
        this.updateStatus('connected', 'Connected to stream.');
      } else if (['disconnected', 'failed'].includes(state)) {
        this.updateStatus('warning', 'Reconnecting...');
        this.handleDisconnection();
      }
    };

    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);

    await this.db.ref(`rooms/${this.roomId}/answers/${this.peerId}`).set({
      type: 'answer',
      from: this.peerId,
      to: this.broadcasterId,
      sdp: answer.sdp
    });

    console.log('✅ Answer sent to broadcaster.');
  }

  async handleCandidate(data) {
    if (this.peerConnection && data.candidate) {
      try {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
        console.log('🧊 ICE candidate added');
      } catch (error) {
        console.error('❌ ICE candidate error:', error);
      }
    }
  }

  async playVideo() {
    try {
      await this.viewVideo.play();
      this.updateStatus('connected', 'Live Stream - Click to unmute');
      this.viewVideo.muted = true;
      this.viewVideo.addEventListener('click', () => {
        this.viewVideo.muted = false;
        this.updateStatus('connected', 'Live Stream');
      });
    } catch (e) {
      console.warn('Autoplay blocked. Waiting for user gesture.');
      this.showPlayButton();
    }
  }

  showPlayButton() {
    if (!this.videoPlaceholder) return;
    this.videoPlaceholder.innerHTML = `
      <button id="playButton" style="
        padding: 12px 24px;
        background: #28a745;
        color: #fff;
        border: none;
        border-radius: 6px;
        font-size: 16px;
        cursor: pointer;
      ">Play Video</button>
    `;
    document.getElementById('playButton').onclick = () => this.playVideo();
  }

  handleDisconnection() {
    if (this.reconnectAttempts >= 5) {
      this.showError('Connection lost. Please refresh.');
      return;
    }
    this.reconnectAttempts++;
    setTimeout(() => {
      this.init();
    }, 2000 * this.reconnectAttempts);
  }

  updateStatus(status, message) {
    console.log(`[${status.toUpperCase()}] ${message}`);
    if (this.statusText) {
      this.statusText.textContent = message;
      this.statusText.className = `status-${status}`;
    }
  }

  showError(message) {
    console.error('❌', message);
    if (this.statusText) {
      this.statusText.textContent = message;
      this.statusText.className = 'status-error';
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new VideoViewer();
  console.log('🚀 Viewer initialized');
});

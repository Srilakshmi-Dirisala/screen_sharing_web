class ScreenShareApp {
    constructor() {
        this.mediaStream = null;
        this.peerConnections = new Map();
        this.isSharing = false;
        this.viewerCount = 0;
        this.db = null;
        this.roomId = 'live-stream-room';
        this.peerId = 'broadcaster_' + Math.random().toString(36).substr(2, 9);
        this.isPaused = false;

        // this.peerConnectionConfig = {
        //     iceServers: [
        //         { urls: 'stun:stun.l.google.com:19302' },
        //         { urls: 'stun:stun1.l.google.com:19302' },
        //         { urls: 'stun:stun2.l.google.com:19302' },
        //         { urls: 'stun:stun3.l.google.com:19302' }
        //     ]
        // };

        // // Enhanced WebRTC configuration with TURN servers
        // this.peerConnectionConfig = {
        //     iceServers: [
        //         { urls: 'stun:stun.l.google.com:19302' },
        //         { urls: 'stun:stun1.l.google.com:19302' },
        //         { urls: 'stun:stun2.l.google.com:19302' },
        //         { urls: 'stun:stun3.l.google.com:19302' },
        //         // ✅ ADD TURN SERVERS (same as viewer.js)
        //         {
        //             urls: [
        //                 'turn:openrelay.metered.ca:80',
        //                 'turn:openrelay.metered.ca:443',
        //                 'turn:openrelay.metered.ca:443?transport=tcp',
        //                 'turns:openrelay.metered.ca:443?transport=tcp'
        //             ],
        //             username: 'openrelayproject',
        //             credential: 'openrelayproject'
        //         },
        //         {
        //             urls: [
        //                 'turn:numb.viagenie.ca:3478?transport=udp',
        //                 'turn:numb.viagenie.ca:3478?transport=tcp'
        //             ],
        //             username: 'webrtc@live.com',
        //             credential: 'muazkh'
        //         }
        //     ],
        //     iceTransportPolicy: 'all',
        //     bundlePolicy: 'max-bundle',
        //     rtcpMuxPolicy: 'require',
        //     iceCandidatePoolSize: 10
        // };

        this.peerConnectionConfig = {
            iceServers: [
                { urls: "stun:stun.l.google.com:19302" },
                {
                    urls: "turn:relay1.expressturn.com:3478",
                    username: "efree",
                    credential: "free"
                }
            ]
        };

        this.initializeElements();
        this.bindEvents();
        this.updateUI();
        this.initFirebase();
    }

    initializeElements() {
        this.screenVideo = document.getElementById('screenVideo');
        this.placeholder = document.getElementById('placeholder');
        this.startBtn = document.getElementById('startBtn');
        this.pauseBtn = document.getElementById('pauseBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.fullscreenBtn = document.getElementById('fullscreenBtn');
        this.status = document.getElementById('status');
        this.viewerCountEl = document.getElementById('viewerCount');
        this.notification = document.getElementById('notification');
    }

    bindEvents() {
        this.startBtn.addEventListener('click', () => this.startScreenShare());
        this.pauseBtn.addEventListener('click', () => this.togglePause());
        this.stopBtn.addEventListener('click', () => this.stopScreenShare());
        this.fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());

        document.addEventListener('fullscreenchange', () => this.handleFullscreenChange());
        document.addEventListener('webkitfullscreenchange', () => this.handleFullscreenChange());
    }

    initFirebase() {
        try {
            if (typeof firebase !== 'undefined' && typeof FIREBASE_CONFIG !== 'undefined' && isFirebaseConfigured()) {
                if (!firebase.apps || firebase.apps.length === 0) {
                    firebase.initializeApp(FIREBASE_CONFIG);
                }
                this.db = firebase.database();
                console.log('✅ Firebase initialized for broadcaster');
            } else {
                console.error('❌ Firebase not configured');
                this.showNotification('Firebase not configured', 'error');
            }
        } catch (error) {
            console.error('❌ Firebase initialization error:', error);
            this.showNotification('Firebase error', 'error');
        }
    }

    async startScreenShare() {
        try {
            this.showNotification('Starting screen share...', 'info');
            this.updateStatus('Starting...');

            this.mediaStream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    cursor: 'always',
                    frameRate: { ideal: 30, max: 60 },
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                },
                audio: true
            });

            console.log('📹 Screen capture started');

            this.screenVideo.srcObject = this.mediaStream;
            this.screenVideo.style.display = 'block';
            this.placeholder.style.display = 'none';

            await this.setupBroadcaster();

            this.mediaStream.getVideoTracks()[0].addEventListener('ended', () => {
                console.log('Screen sharing ended by user');
                this.stopScreenShare();
            });

            this.isSharing = true;
            this.updateUI();
            this.updateStatus('Sharing');
            this.showNotification('Screen sharing started!', 'success');

        } catch (error) {
            console.error('❌ Error starting screen share:', error);
            this.handleError(error);
        }
    }

    async setupBroadcaster() {
        if (!this.db) {
            throw new Error('Firebase not initialized');
        }

        console.log('📡 Setting up broadcaster:', this.peerId);

        // Register broadcaster
        await this.db.ref(`rooms/${this.roomId}/broadcaster`).set({
            id: this.peerId,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });

        // Clean up on disconnect
        this.db.ref(`rooms/${this.roomId}/broadcaster`).onDisconnect().remove();

        // Listen for new viewers
        // const viewersRef = this.db.ref(`rooms/${this.roomId}/viewers`);
        // viewersRef.on('child_added', async (snapshot) => {
        //     const viewer = snapshot.val();
        //     if (viewer.id !== this.peerId && !this.peerConnections.has(viewer.id)) {
        //         console.log('👀 New viewer detected:', viewer.id);
        //         await this.connectToViewer(viewer.id);
        //     }
        // });

        // Listen for viewers
       // Listen for viewers
const viewersRef = this.db.ref(`rooms/${this.roomId}/viewers`);

// 1️⃣ Connect to existing viewers
viewersRef.once('value', snapshot => {
  snapshot.forEach(child => {
    const viewer = child.val();
    if (viewer.id !== this.peerId && !this.peerConnections.has(viewer.id)) {
      console.log('👀 Existing viewer detected:', viewer.id);
      this.connectToViewer(viewer.id);
    }
  });
});

// 2️⃣ Listen for new viewers
viewersRef.on('child_added', snapshot => {
  const viewer = snapshot.val();
  if (viewer.id !== this.peerId && !this.peerConnections.has(viewer.id)) {
    console.log('👀 New viewer detected:', viewer.id);
    this.connectToViewer(viewer.id);
  }
});


        // Listen for answers
        const answersRef = this.db.ref(`rooms/${this.roomId}/answers`);
        answersRef.on('child_added', async (snapshot) => {
            const data = snapshot.val();
            if (data && data.to === this.peerId) {
                console.log('📨 Received answer from:', data.from);
                await this.handleAnswer(data);
            }
        });

        // Listen for ICE candidates
        const candidatesRef = this.db.ref(`rooms/${this.roomId}/iceCandidates`);
        candidatesRef.on('child_added', async (snapshot) => {
            const data = snapshot.val();
            if (data && data.to === this.peerId && data.from !== this.peerId) {
                console.log('🧊 Received ICE candidate from:', data.from);
                await this.handleCandidate(data);
            }
        });

        console.log('✅ Broadcaster setup complete');
    }

    async connectToViewer(viewerId) {
        try {
            console.log('🔗 Connecting to viewer:', viewerId);

            const pc = new RTCPeerConnection(this.peerConnectionConfig);
            this.peerConnections.set(viewerId, pc);

            // Add all tracks
            this.mediaStream.getTracks().forEach(track => {
                console.log('➕ Adding track:', track.kind);
                pc.addTrack(track, this.mediaStream);
            });

            // Handle ICE candidates
            pc.onicecandidate = (event) => {
                if (event.candidate) {
                    console.log('🧊 Sending ICE candidate to:', viewerId);
                    //this.db.ref(`rooms/${this.roomId}/iceCandidates`).push({
                    // this.db.ref(`rooms/${this.roomId}/candidates/${viewerId}`).push({
                    //     candidate: event.candidate.toJSON(),
                    //     from: this.peerId,
                    //     to: viewerId,
                    //     timestamp: Date.now()
                    // });
                    this.db.ref(`rooms/${this.roomId}/candidates/${this.peerId}`).push({
                        candidate: event.candidate.toJSON(),
                        from: this.peerId,
                        to: viewerId
                    });

                }
            };

            // Monitor connection state
            pc.onconnectionstatechange = () => {
                console.log(`🔗 Connection to ${viewerId}:`, pc.connectionState);
                if (pc.connectionState === 'connected') {
                    this.viewerCount++;
                    this.updateViewerCount();
                    this.showNotification('Viewer connected!', 'success');
                } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
                    this.peerConnections.delete(viewerId);
                    this.viewerCount = Math.max(0, this.viewerCount - 1);
                    this.updateViewerCount();
                }
            };

            // Create offer
            // const offer = await pc.createOffer();
            // await pc.setLocalDescription(offer);

            // // Send offer
            // await this.db.ref(`rooms/${this.roomId}/offers`).push({
            //     offer: {
            //         type: offer.type,
            //         sdp: offer.sdp
            //     },
            //     from: this.peerId,
            //     to: viewerId,
            //     timestamp: Date.now()
            // });

            // console.log('📤 Offer sent to:', viewerId);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            console.log("🟡 About to write offer to Firebase...");
            await this.db.ref(`rooms/${this.roomId}/broadcaster`).set({
                offer: { type: offer.type, sdp: offer.sdp },
                from: this.peerId,
                timestamp: Date.now()
            });
            console.log("🟢 Offer successfully written (or attempted)!");


            console.log('📤 Offer stored in Firebase for room:', this.roomId);

        } catch (error) {
            console.error('❌ Error connecting to viewer:', error);
        }
    }

    async handleAnswer(data) {
        try {
            const pc = this.peerConnections.get(data.from);
            if (pc && data.answer) {
                await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
                console.log('✅ Answer processed from:', data.from);
            }
        } catch (error) {
            console.error('❌ Error handling answer:', error);
        }
    }

    async handleCandidate(data) {
        try {
            const pc = this.peerConnections.get(data.from);
            if (pc && data.candidate) {
                await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
                console.log('✅ ICE candidate added from:', data.from);
            }
        } catch (error) {
            console.error('❌ Error handling ICE candidate:', error);
        }
    }

    stopScreenShare() {
        console.log('🛑 Stopping screen share');

        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => {
                track.stop();
                console.log('⏹️ Stopped track:', track.kind);
            });
            this.mediaStream = null;
        }

        this.peerConnections.forEach((pc, viewerId) => {
            console.log('🔌 Closing connection to:', viewerId);
            pc.close();
        });
        this.peerConnections.clear();

        if (this.db && this.roomId) {
            this.db.ref(`rooms/${this.roomId}/broadcaster`).remove();
            this.db.ref(`rooms/${this.roomId}/offers`).remove();
            this.db.ref(`rooms/${this.roomId}/answers`).remove();
            this.db.ref(`rooms/${this.roomId}/iceCandidates`).remove();
        }

        this.screenVideo.srcObject = null;
        this.screenVideo.style.display = 'none';
        this.placeholder.style.display = 'block';

        this.isSharing = false;
        this.isPaused = false;
        this.viewerCount = 0;
        this.updateUI();
        this.updateStatus('Ready');
        this.showNotification('Screen sharing stopped', 'info');
    }

    togglePause() {
        if (!this.isSharing) return;

        this.isPaused = !this.isPaused;

        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => {
                track.enabled = !this.isPaused;
            });
        }

        this.updateUI();
        this.updateStatus(this.isPaused ? 'Paused' : 'Sharing');
        this.showNotification(this.isPaused ? 'Paused' : 'Resumed', 'info');
    }

    toggleFullscreen() {
        const container = document.querySelector('.video-container');

        if (!document.fullscreenElement && !document.webkitFullscreenElement) {
            if (container.requestFullscreen) {
                container.requestFullscreen();
            } else if (container.webkitRequestFullscreen) {
                container.webkitRequestFullscreen();
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            }
        }
    }

    handleFullscreenChange() {
        const container = document.querySelector('.video-container');
        const isFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement);

        if (isFullscreen) {
            container.classList.add('fullscreen');
        } else {
            container.classList.remove('fullscreen');
        }
    }

    updateUI() {
        this.startBtn.disabled = this.isSharing;
        this.pauseBtn.disabled = !this.isSharing;
        this.stopBtn.disabled = !this.isSharing;
        this.fullscreenBtn.disabled = !this.isSharing;

        if (this.isPaused) {
            this.pauseBtn.innerHTML = '<i class="fas fa-play"></i> Resume';
            this.pauseBtn.classList.add('paused');
        } else {
            this.pauseBtn.innerHTML = '<i class="fas fa-pause"></i> Pause';
            this.pauseBtn.classList.remove('paused');
        }
    }

    updateStatus(status) {
        this.status.textContent = status;
    }

    updateViewerCount() {
        this.viewerCountEl.textContent = this.viewerCount;
    }

    showNotification(message, type = 'info') {
        this.notification.textContent = message;
        this.notification.className = `notification ${type} show`;
        setTimeout(() => this.notification.classList.remove('show'), 3000);
    }

    handleError(error) {
        let errorMessage = 'Failed to start screen share';

        if (error.name === 'NotAllowedError') {
            errorMessage = 'Permission denied. Please allow screen sharing.';
        } else if (error.name === 'NotFoundError') {
            errorMessage = 'No screen sharing source found.';
        } else if (error.name === 'NotSupportedError') {
            errorMessage = 'Screen sharing not supported.';
        }

        this.showNotification(errorMessage, 'error');
        this.updateStatus('Error');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.screenShareApp = new ScreenShareApp();
    console.log('🚀 Screen Share App initialized');
});
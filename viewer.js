class VideoViewer {
    constructor() {
        this.viewVideo = document.getElementById('screenVideo');
        this.statusText = document.getElementById('status');
        this.peerConnection = null;
        this.db = null;
        this.roomId = 'default-room';
        this.peerId = 'viewer_' + Math.random().toString(36).substr(2, 9);
        this.broadcasterId = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        
        this.peerConnectionConfig = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
                { 
                    urls: 'turn:numb.viagenie.ca',
                    username: 'webrtc@live.com',
                    credential: 'muazkh'
                }
            ],
            iceTransportPolicy: 'all',
            bundlePolicy: 'max-bundle',
            rtcpMuxPolicy: 'require',
            iceCandidatePoolSize: 10
        };
        
        this.initFirebase();
    }

    initFirebase() {
        try {
            if (typeof firebase !== 'undefined' && typeof FIREBASE_CONFIG !== 'undefined' && isFirebaseConfigured()) {
                if (!firebase.apps || firebase.apps.length === 0) {
                    firebase.initializeApp(FIREBASE_CONFIG);
                }
                this.db = firebase.database();
                console.log('✅ Firebase initialized for viewer');
                this.init();
            } else {
                console.error('❌ Firebase not configured');
                this.showError('Firebase not configured. Please configure Firebase.');
            }
        } catch (error) {
            console.error('❌ Firebase initialization failed:', error);
            this.showError('Failed to connect to streaming service.');
        }
    }

    async init() {
        this.updateStatus('waiting', 'Connecting to room...');
        console.log('👤 Viewer ID:', this.peerId);
        
        // Register as viewer
        await this.db.ref(`rooms/${this.roomId}/viewers/${this.peerId}`).set({
            id: this.peerId,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });

        // Remove viewer on disconnect
        this.db.ref(`rooms/${this.roomId}/viewers/${this.peerId}`).onDisconnect().remove();

        // Listen for broadcaster
        const broadcasterRef = this.db.ref(`rooms/${this.roomId}/broadcaster`);
        broadcasterRef.on('value', async (snapshot) => {
            const broadcaster = snapshot.val();
            if (broadcaster && broadcaster.id) {
                console.log('📡 Broadcaster found:', broadcaster.id);
                this.broadcasterId = broadcaster.id;
                this.updateStatus('waiting', 'Waiting for stream...');
                this.listenForOffers();
            } else {
                console.log('⏳ No broadcaster in room');
                this.updateStatus('waiting', 'Waiting for broadcaster to start sharing...');
            }
        });

        console.log('✅ Viewer initialized');
    }

    listenForOffers() {
        // Listen for offers
        const offersRef = this.db.ref(`rooms/${this.roomId}/offers`);
        offersRef.on('child_added', async (snapshot) => {
            const data = snapshot.val();
            if (data && data.to === this.peerId) {
                console.log('📨 Received offer from broadcaster');
                await this.handleOffer(data);
                // Remove the offer after handling to prevent reuse
                snapshot.ref.remove().catch(console.error);
            }
        });

        // Listen for ICE candidates
        const candidatesRef = this.db.ref(`rooms/${this.roomId}/iceCandidates`);
        candidatesRef.on('child_added', async (snapshot) => {
            const data = snapshot.val();
            if (data && data.to === this.peerId && data.from === this.broadcasterId) {
                console.log('🧊 Received ICE candidate from broadcaster');
                await this.handleCandidate(data);
            }
        });
    }

    async handleOffer(data) {
        try {
            console.log('🔄 Handling offer for viewer:', this.peerId);
            
            // Close existing connection if any
            if (this.peerConnection) {
                this.peerConnection.close();
            }

            // Create new connection with enhanced config
            this.peerConnection = new RTCPeerConnection({
                ...this.peerConnectionConfig,
                sdpSemantics: 'unified-plan'  // Better for multiple streams
            });
            
            // Enhanced ICE candidate handling
            this.peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    console.log('ICE Candidate:', event.candidate.candidate);
                    this.db.ref(`rooms/${this.roomId}/iceCandidates`).push({
                        candidate: event.candidate.toJSON(),
                        from: this.peerId,
                        to: this.broadcasterId,
                        timestamp: Date.now()
                    });
                } else {
                    console.log('All ICE candidates have been sent');
                }
            };

            // Monitor ICE connection state
            this.peerConnection.oniceconnectionstatechange = () => {
                const iceState = this.peerConnection.iceConnectionState;
                console.log('🧊 ICE Connection State:', iceState);
                
                if (iceState === 'failed' || iceState === 'disconnected') {
                    this.updateStatus('warning', 'Connection issue. Reconnecting...');
                    this.handleDisconnection();
                }
            };

            this.peerConnection.ontrack = (event) => {
                console.log('Received track:', event.track.kind);
                if (event.track.kind === 'video' || event.track.kind === 'audio') {
                    // Add track to the stream
                    if (!this.viewVideo.srcObject) {
                        this.viewVideo.srcObject = new MediaStream();
                    }
                    this.viewVideo.srcObject.addTrack(event.track);
                    
                    // Update status
                    if (this.statusText) {
                        this.statusText.textContent = 'Live Stream - Connected';
                    }
                    
                    // Try to play the video with audio
                    this.playVideoWithAudio();
                }
            };

            // Set remote description
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
            
            // Create and send answer
            const answer = await this.peerConnection.createAnswer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true
            });
            
            await this.peerConnection.setLocalDescription(answer);
            
            // Send answer to broadcaster
            this.db.ref(`rooms/${this.roomId}/answers/${this.peerId}`).set({
                type: 'answer',
                from: this.peerId,
                to: this.broadcasterId,
                sdp: answer.sdp
            });

            // Listen for ICE candidates from broadcaster
            this.db.ref(`rooms/${this.roomId}/offers/${this.broadcasterId}/ice`).on('child_added', (snapshot) => {
                const candidate = snapshot.val();
                if (candidate && candidate.candidate) {
                    this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate.candidate));
                }
            });

            console.log('Answer created and sent');
            
        } catch (error) {
            console.error('Error handling offer:', error);
            if (this.statusText) {
                this.statusText.textContent = 'Connection Error';
            }
        }
    }
    
    async playVideoWithAudio() {
        if (!this.viewVideo) return;
        
        try {
            // First try to play with audio
            this.viewVideo.muted = false;
            await this.viewVideo.play();
            console.log('Playing video with audio');
        } catch (err) {
            console.warn('Autoplay with audio failed, trying muted:', err);
            try {
                // If that fails, try with muted audio
                this.viewVideo.muted = true;
                await this.viewVideo.play();
                console.log('Playing video with muted audio');
                
                // Show a message that the user needs to interact to unmute
                if (this.statusText) {
                    this.statusText.textContent = 'Live Stream - Click to unmute';
                    this.viewVideo.onclick = () => {
                        this.viewVideo.muted = false;
                        this.statusText.textContent = 'Live Stream - Connected';
                    };
                }
            } catch (err2) {
                console.error('Failed to play video:', err2);
            }
        }
    }

    async handleCandidate(data) {
        try {
            if (this.peerConnection && data.candidate) {
                await this.peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
                console.log('✅ ICE candidate added');
            }
        } catch (error) {
            console.error('❌ Error adding ICE candidate:', error);
        }
    }

    handleDisconnection() {
        if (this.reconnectAttempts === 0) {
            console.log('🔌 Connection lost, attempting to reconnect...');
        }
        
        this.reconnectAttempts++;
        
        if (this.reconnectAttempts <= 5) {
            const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000); // Max 30s delay
            console.log(`⏳ Next reconnection attempt in ${delay/1000} seconds...`);
            
            setTimeout(() => {
                if (this.peerConnection) {
                    this.peerConnection.close();
                    this.peerConnection = null;
                }
                this.init();
            }, delay);
        } else {
            this.showError('Failed to reconnect after multiple attempts. Please refresh the page.');
        }
    }

    updateStatus(status, message) {
        const timestamp = new Date().toLocaleTimeString();
        const statusMessage = `[${timestamp}] ${message}`;
        console.log(`[${status.toUpperCase()}] ${statusMessage}`);
        
        if (this.statusText) {
            this.statusText.textContent = statusMessage;
            this.statusText.className = `status-${status}`;
        }
        
        if (this.videoStatus) {
            this.videoStatus.className = `video-status ${status}`;
        }
    }

    showError(message) {
        console.error('Error:', message);
        const placeholderTitle = document.getElementById('placeholderTitle');
        const placeholderMessage = document.getElementById('placeholderMessage');
        
        if (this.videoPlaceholder) {
            this.videoPlaceholder.style.display = 'flex';
            this.videoPlaceholder.innerHTML = `
                <i class="fas fa-exclamation-triangle" style="font-size: 48px; margin-bottom: 20px; color: #ff4444;"></i>
                <h2>Connection Error</h2>
                <p>${message}</p>
                <button id="retryButton" style="margin-top: 20px; padding: 10px 20px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">
                    Retry Connection
                </button>
            `;
            
            const retryButton = document.getElementById('retryButton');
            if (retryButton) {
                retryButton.addEventListener('click', () => window.location.reload());
            }
        }
        
        this.updateStatus('error', message);
    }
    
    setupVideoElement(stream) {
        if (!this.viewVideo) return;
        
        console.log('Setting up video element with stream:', stream.id);
        
        // Log all available tracks
        const audioTracks = stream.getAudioTracks();
        const videoTracks = stream.getVideoTracks();
        
        // Apply video optimizations
        videoTracks.forEach(track => {
            // Request lower resolution for better performance
            const settings = track.getSettings();
            console.log('Video track settings:', {
                width: settings.width,
                height: settings.height,
                frameRate: settings.frameRate,
                aspectRatio: settings.aspectRatio
            });
            
            // Try to apply constraints for better performance
            track.applyConstraints({
                width: { ideal: 1280, max: 1920 },
                height: { ideal: 720, max: 1080 },
                frameRate: { ideal: 30, max: 30 },
                latency: 0.1
            }).catch(console.warn);
        });
        
        console.log('Available tracks:', {
            audio: audioTracks.map(t => `${t.kind} (${t.label}, ${t.enabled ? 'enabled' : 'disabled'})`),
            video: videoTracks.map(t => `${t.kind} (${t.label}, ${t.enabled ? 'enabled' : 'disabled'})`)
        });
        
        // Set video element properties
        this.viewVideo.srcObject = stream;
        this.viewVideo.playsInline = true;
        this.viewVideo.muted = false; // Allow audio to play
        this.viewVideo.volume = 1.0; // Set to max volume
        this.viewVideo.autoplay = true;
        
        // Make sure video is visible
        this.viewVideo.classList.add('visible');
        
        // Hide placeholder
        if (this.videoPlaceholder) {
            this.videoPlaceholder.classList.add('hidden');
        }
        
        // Add audio context for better audio handling
        if (audioTracks.length > 0 && !this.audioContext) {
            try {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                this.audioContext = new AudioContext();
                const source = this.audioContext.createMediaStreamSource(stream);
                source.connect(this.audioContext.destination);
                console.log('Audio context created and connected');
            } catch (e) {
                console.warn('Could not create audio context:', e);
            }
        }
        
        // Log video element state
        console.log('Video element state:', {
            readyState: this.viewVideo.readyState,
            paused: this.viewVideo.paused,
            ended: this.viewVideo.ended,
            currentTime: this.viewVideo.currentTime,
            muted: this.viewVideo.muted,
            volume: this.viewVideo.volume
        });
        
        // Add event listeners for debugging
        this.viewVideo.onplay = () => console.log('Video started playing');
        this.viewVideo.onplaying = () => console.log('Video is playing');
        this.viewVideo.onwaiting = () => console.log('Video waiting for data');
        this.viewVideo.onstalled = () => console.log('Video stalled');
        this.viewVideo.onerror = (e) => console.error('Video error:', e);
        
        // Add audio track event listeners
        audioTracks.forEach(track => {
            console.log(`Audio track added: ${track.id} (${track.label})`);
            track.onmute = () => console.log('Audio track muted');
            track.onunmute = () => console.log('Audio track unmuted');
            track.onended = () => console.log('Audio track ended');
        });
    }
    
    ensureVideoPlaying() {
        if (!this.viewVideo || !this.viewVideo.srcObject) return;
        
        // If video is already playing, do nothing
        if (!this.viewVideo.paused) {
            console.log('Video is already playing');
            return;
        }
        
        console.log('Attempting to play video...');
        const playPromise = this.viewVideo.play();
        
        if (playPromise !== undefined) {
            playPromise
                .then(() => {
                    console.log('Video playback started successfully');
                    if (this.videoPlaceholder) {
                        this.videoPlaceholder.classList.add('hidden');
                    }
                })
                .catch(error => {
                    console.error('Error playing video:', error);
                    this.showPlayButton();
                });
        }
    }
    
    showPlayButton() {
        if (!this.videoPlaceholder) return;
        
        console.log('Showing play button');
        
        this.videoPlaceholder.style.display = 'flex';
        this.videoPlaceholder.classList.remove('hidden');
        this.videoPlaceholder.innerHTML = `
            <div style="text-align: center; padding: 20px;">
                <i class="fas fa-play-circle" style="font-size: 64px; margin-bottom: 20px; cursor: pointer;" id="playButton"></i>
                <h3>Click to play video</h3>
                <p style="font-size: 0.9em; opacity: 0.8; margin-top: 10px;">
                    If the video doesn't play automatically, click the play button above.
                </p>
            </div>
        `;
        
        const playButton = document.getElementById('playButton');
        if (playButton) {
            playButton.addEventListener('click', () => {
                console.log('Play button clicked');
                if (this.viewVideo) {
                    this.ensureVideoPlaying();
                }
            });
        }
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    const viewer = new VideoViewer();
    console.log('🚀 Video Viewer initialized');
});
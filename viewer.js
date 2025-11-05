class VideoViewer {
    constructor() {
        this.viewVideo = document.getElementById('screenVideo');
        this.videoPlaceholder = document.getElementById('placeholder');
        this.statusText = document.getElementById('status');
        this.viewerCountEl = document.getElementById('viewerCount');
        
        this.peerConnection = null;
        this.audioContext = null;
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
                { urls: 'stun:stun3.l.google.com:19302' }
            ]
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
            if (data && data.to === this.peerId && data.from === this.broadcasterId) {
                console.log('📨 Received offer from broadcaster');
                await this.handleOffer(data);
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
            console.log('🔄 Processing offer...');
            this.updateStatus('connecting', 'Processing stream...');

            // Close existing connection if any
            if (this.peerConnection) {
                this.peerConnection.close();
            }

            // Create new peer connection with optimized settings
            this.peerConnection = new RTCPeerConnection({
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { urls: 'stun:stun2.l.google.com:19302' },
                    { urls: 'stun:stun3.l.google.com:19302' }
                    // Add TURN servers if available for NAT traversal
                    // { urls: 'turn:your-turn-server.com', username: 'user', credential: 'pass' }
                ],
                iceTransportPolicy: 'all',
                bundlePolicy: 'max-bundle',
                rtcpMuxPolicy: 'require',
                iceCandidatePoolSize: 10
            });
            
            // Optimize for video streaming
            this.peerConnection.addTransceiver('video', { direction: 'recvonly' });
            this.peerConnection.addTransceiver('audio', { direction: 'recvonly' });
            
            // Set bandwidth constraints
            const senders = this.peerConnection.getSenders();
            senders.forEach(sender => {
                if (sender.track && sender.track.kind === 'video') {
                    const parameters = sender.getParameters();
                    if (!parameters.encodings) {
                        parameters.encodings = [{}];
                    }
                    // Lower resolution for better performance
                    parameters.encodings[0].maxBitrate = 2500000; // 2.5 Mbps
                    parameters.encodings[0].scaleResolutionDownBy = 1.0; // Adjust as needed
                    sender.setParameters(parameters).catch(console.error);
                }
            });

            // Handle incoming tracks (THE VIDEO!)
            this.peerConnection.ontrack = (event) => {
                console.log('📺 Received track:', event.track.kind, event.track);
                
                // For debugging
                event.track.onmute = () => console.log('Track muted');
                event.track.onunmute = () => {
                    console.log('Track unmuted, readyState:', event.track.readyState);
                    this.ensureVideoPlaying();
                };
                event.track.onended = () => console.log('Track ended');
                
                if (event.streams && event.streams[0]) {
                    const stream = event.streams[0];
                    console.log('🎬 Setting video stream. Active tracks:', 
                        stream.getTracks().map(t => `${t.kind} (${t.readyState})`).join(', '));
                    
                    // Store the stream for later use
                    this.currentStream = stream;
                    
                    // Setup video element
                    this.setupVideoElement(stream);
                    
                    // Try to play the video
                    this.ensureVideoPlaying();
                    
                    this.isConnected = true;
                    this.updateStatus('connected', 'Live Streaming');
                }
            };

            // Handle ICE candidates
            this.peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    console.log('🧊 Sending ICE candidate to broadcaster');
                    this.db.ref(`rooms/${this.roomId}/iceCandidates`).push({
                        candidate: event.candidate.toJSON(),
                        from: this.peerId,
                        to: this.broadcasterId,
                        timestamp: Date.now()
                    });
                }
            };

            // Monitor connection state
            this.peerConnection.onconnectionstatechange = () => {
                console.log('🔗 Connection state:', this.peerConnection.connectionState);
                
                const state = this.peerConnection.connectionState;
                if (state === 'connected') {
                    this.updateStatus('connected', 'Live Streaming');
                } else if (state === 'disconnected') {
                    this.updateStatus('waiting', 'Connection lost. Reconnecting...');
                    this.handleDisconnection();
                } else if (state === 'failed') {
                    this.updateStatus('waiting', 'Connection failed. Retrying...');
                    this.handleDisconnection();
                } else if (state === 'connecting') {
                    this.updateStatus('waiting', 'Connecting to stream...');
                }
            };

            // Set remote description (offer)
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
            console.log('✅ Remote description set');

            // Create answer
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            console.log('✅ Local description set');

            // Send answer
            await this.db.ref(`rooms/${this.roomId}/answers`).push({
                answer: {
                    type: answer.type,
                    sdp: answer.sdp
                },
                from: this.peerId,
                to: this.broadcasterId,
                timestamp: Date.now()
            });

            console.log('📤 Answer sent to broadcaster');

        } catch (error) {
            console.error('❌ Error handling offer:', error);
            this.updateStatus('waiting', 'Connection error. Retrying...');
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
        this.isConnected = false;
        if (this.viewVideo) {
            this.viewVideo.style.display = 'none';
        }
        if (this.videoPlaceholder) {
            this.videoPlaceholder.style.display = 'flex';
        }
        
        if (this.peerConnection) {
            try {
                this.peerConnection.close();
            } catch (e) {
                console.error('Error closing peer connection:', e);
            }
            this.peerConnection = null;
        }
        
        // Try to reconnect after a delay
        if (this.reconnectAttempts < 5) {
            this.reconnectAttempts++;
            const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000); // Exponential backoff, max 30s
            console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
            setTimeout(() => this.setupPeerConnection(), delay);
        } else {
            this.updateStatus('error', 'Failed to connect. Please refresh the page.');
        }
    }

    updateStatus(status, text) {
        console.log(`Status update [${status}]: ${text}`);
        if (this.statusText) {
            this.statusText.textContent = text;
            this.statusText.className = `status-${status}`;
        }
        if (this.statusText) {
            if (status === 'connected') {
                this.statusText.innerHTML = text + '<span class="live-badge">LIVE</span>';
            } else {
                this.statusText.innerHTML = text;
            }
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
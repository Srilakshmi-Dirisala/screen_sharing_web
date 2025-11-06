class VideoViewer {
    constructor() {
        this.viewVideo = document.getElementById('screenVideo');
        this.statusText = document.getElementById('status');
        this.peerConnection = null;
        this.db = null;
        this.roomId = 'live-stream-room';
        this.peerId = 'viewer_' + Math.random().toString(36).substr(2, 9);
        this.broadcasterId = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000; // Start with 1 second delay
        
        // Initialize connection settings
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000; // Start with 1 second
        this.iceServers = [];
        
        // Enhanced WebRTC configuration for cross-device compatibility
        // this.peerConnectionConfig = {
        //     iceServers: [
        //         // Public STUN servers
        //         { urls: 'stun:stun.l.google.com:19302' },
        //         { urls: 'stun:stun1.l.google.com:19302' },
        //         { urls: 'stun:stun2.l.google.com:19302' },
        //         { urls: 'stun:stun3.l.google.com:19302' },
        //         { urls: 'stun:stun4.l.google.com:19302' },
        //         { urls: 'stun:stun.stunprotocol.org:3478' },
        //         { urls: 'stun:stun.voipstunt.com:3478' },
        //         { urls: 'stun:stun.ekiga.net' },
        //         { urls: 'stun:stun.ideasip.com' }
        //     ],
        //     // Try both relay and non-relay candidates
        //     iceTransportPolicy: 'all',
        //     // Optimize bundle size
        //     bundlePolicy: 'max-bundle',
        //     // Reduce number of candidates
        //     rtcpMuxPolicy: 'require',
        //     // Modern SDP format
        //     sdpSemantics: 'unified-plan',
        //     // Increased pool size for better connectivity
        //     iceCandidatePoolSize: 10,
        //     // Additional reliability settings
        //     iceCandidatePooling: true,
        this.peerConnectionConfig = {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            {
              urls: [
                'turn:openrelay.metered.ca:80',
                'turn:openrelay.metered.ca:443',
                'turn:openrelay.metered.ca:443?transport=tcp',
                'turns:openrelay.metered.ca:443?transport=tcp'
              ],
              username: 'openrelayproject',
              credential: 'openrelayproject'
            }
          ],
          iceTransportPolicy: 'all',
          bundlePolicy: 'max-bundle',
          iceCandidatePoolSize: 10
        };
        
        this.initFirebase();
    }
    
    async checkConnectionHealth() {
        console.log('🔍 Checking connection health...');
        
        // Check if peerConnection exists
        if (!this.peerConnection) {
            console.log('ℹ️ No active peer connection, attempting to reconnect...');
            await this.attemptReconnect();
            return;
        }
        
        if (!this.isConnected) {
            console.log('⚠️ Connection health check: Not connected, checking state...');
            if (this.peerConnection.connectionState === 'connected') {
                this.isConnected = true;
                console.log('✅ Connection is now active');
                return;
            } else {
                console.log('🔄 Attempting to reconnect...');
                await this.handleDisconnection();
                return;
            }
        }

        try {
            const connectionState = this.peerConnection?.connectionState || 'no-connection';
            const iceState = this.peerConnection?.iceConnectionState || 'no-ice';

            // Avoid premature reconnects while connection is still being established
            if (connectionState === 'connecting' || iceState === 'checking' || iceState === 'new' || iceState === 'gathering') {
                console.log('⏳ Connection still establishing, skipping reconnect check');
                return;
            }

            // Check if we need to restart the connection
            if (iceState === 'disconnected' || iceState === 'failed' || iceState === 'closed') {
                console.log('🔌 Connection issue detected, attempting to recover...');
                await this.handleDisconnection();
            }
        } catch (error) {
            console.error('❌ Error checking connection health:', error);
        }
    }

    async initFirebase() {
        try {
            if (typeof firebase !== 'undefined' && typeof FIREBASE_CONFIG !== 'undefined') {
                if (!firebase.apps || firebase.apps.length === 0) {
                    firebase.initializeApp(FIREBASE_CONFIG);
                    // Enable offline persistence for Firebase
                    await firebase.database().goOnline();
                }
                this.db = firebase.database();
                console.log('✅ Firebase initialized for viewer');
                
                // Set security rules for public read access
                this.db.ref('.info/connected').on('value', (snapshot) => {
                    if (snapshot.val() === true) {
                        console.log('🌐 Connected to Firebase');
                        this.updateStatus('connecting', 'Connecting to stream...');
                        
                        // Add a small delay to ensure everything is ready
                        setTimeout(async () => {
                            try {
                                await this.init();
                            } catch (error) {
                                console.error('❌ Error initializing viewer:', error);
                                this.updateStatus('error', 'Failed to initialize. Please refresh the page.');
                            }
                        }, 500);
                        
                        // Set up periodic connection health check
                        this.connectionCheckInterval = setInterval(() => {
                            this.checkConnectionHealth();
                        }, 5000);
                    } else {
                        console.log('⚠️ Firebase disconnected');
                        this.updateStatus('error', 'Disconnected from server. Reconnecting...');
                        this.handleDisconnection();
                    }
                });
                
                // Monitor network status
                window.addEventListener('online', this.handleNetworkChange.bind(this));
                window.addEventListener('offline', this.handleNetworkChange.bind(this));
                
            } else {
                throw new Error('Firebase configuration not found');
            }
        } catch (error) {
            console.error('❌ Firebase initialization failed:', error);
            this.showError('Failed to connect to streaming service. Please check your internet connection.');
            this.attemptReconnect();
        }
    }

    async init() {
        try {
            this.updateStatus('waiting', 'Connecting to room...');
            console.log('👤 Viewer ID:', this.peerId);
            console.log('🔧 Initializing peer connection...');
            // Clean up any existing connection
            if (this.peerConnection) {
                console.log('♻️ Cleaning up existing peer connection');
                this.peerConnection.close();
                this.peerConnection = null;
            }
            
            // Create new peer connection
            this.peerConnection = new RTCPeerConnection(this.peerConnectionConfig);
            console.log('✅ Peer connection created');
            
            // Set up connection state change handler
            this.peerConnection.onconnectionstatechange = () => {
                console.log('🔌 Peer connection state changed:', this.peerConnection.connectionState);
                
                switch(this.peerConnection.connectionState) {
                    case 'connected':
                        this.updateStatus('connected', 'Connected to stream');
                        this.isConnected = true;
                        break;
                    case 'disconnected':
                    case 'failed':
                        this.updateStatus('error', 'Connection lost, reconnecting...');
                        this.isConnected = false;
                        this.handleDisconnection();
                        break;
                    case 'closed':
                        this.isConnected = false;
                        break;
                }
            };
            
            // Set up ICE connection state change handler
            this.peerConnection.oniceconnectionstatechange = () => {
                console.log('🧊 ICE connection state:', this.peerConnection.iceConnectionState);
                
                switch(this.peerConnection.iceConnectionState) {
                    case 'connected':
                        this.updateStatus('connected', 'Stream connected');
                        break;
                    case 'disconnected':
                    case 'failed':
                        this.updateStatus('reconnecting', 'Reconnecting to stream...');
                        this.handleDisconnection();
                        break;
                }
            };
            
            // Set up track handler for incoming media
            this.peerConnection.ontrack = (event) => {
                console.log('🎥 Received track:', event.track.kind);
                if (event.streams && event.streams[0]) {
                    this.handleStream(event.streams[0]);
                }
            };
        }
        catch (error) {
            console.error('❌ Error initializing viewer:', error);
            this.updateStatus('error', 'Failed to initialize. Please refresh the page.');
        }
        try {
            // Register as viewer
            const viewerRef = this.db.ref(`rooms/${this.roomId}/viewers/${this.peerId}`);
            
            // Set viewer data
            await viewerRef.set({
                id: this.peerId,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            });
            
            console.log('✅ Successfully registered as viewer');
            
            // Set up cleanup on disconnect
            await viewerRef.onDisconnect().remove()
                .then(() => console.log('✅ Cleanup on disconnect configured'))
                .catch(err => console.error('❌ Failed to set up cleanup on disconnect:', err));
                
            // Listen for broadcaster
            console.log('👂 Listening for broadcaster in room:', this.roomId);
            const broadcasterRef = this.db.ref(`rooms/${this.roomId}/broadcaster`);
            broadcasterRef.on('value', async (snapshot) => {
                console.log('📡 Broadcaster ref update:', snapshot.val());
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
        } catch (error) {
            console.error('❌ Error initializing viewer:', error);
            this.updateStatus('error', 'Failed to initialize. Please refresh the page.');
        }
        
    }

    listenForOffers() {
        // Listen for offers
        const offersRef = this.db.ref(`rooms/${this.roomId}/offers/${this.peerId}`);

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
            console.log('Received offer, creating peer connection');
            
            // Reuse existing RTCPeerConnection if present; otherwise create
            if (!this.peerConnection) {
                this.peerConnection = new RTCPeerConnection(this.peerConnectionConfig);
            }
            
            // Set up ICE connection state change handler
            this.peerConnection.oniceconnectionstatechange = () => {
                const iceState = this.peerConnection.iceConnectionState;
                console.log('🧊 ICE Connection State:', iceState);
                
                if (iceState === 'failed' || iceState === 'disconnected') {
                    this.updateStatus('warning', 'Connection issue. Reconnecting...');
                    this.handleDisconnection();
                }
            };

            // Ensure connection state handler sets isConnected when established
            this.peerConnection.onconnectionstatechange = () => {
                const state = this.peerConnection.connectionState;
                console.log('🔌 Peer connection state changed:', state);
                if (state === 'connected') {
                    this.isConnected = true;
                    this.updateStatus('connected', 'Connected to stream');
                } else if (state === 'failed' || state === 'disconnected') {
                    this.isConnected = false;
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

    async handleDisconnection() {
        console.log('🔌 Handling disconnection...');
        
        // Clean up existing connection
        if (this.peerConnection) {
            try {
                // Clear all event handlers first
                const pc = this.peerConnection;
                pc.ontrack = null;
                pc.onicecandidate = null;
                pc.oniceconnectionstatechange = null;
                pc.onicegatheringstatechange = null;
                pc.onsignalingstatechange = null;
                pc.onconnectionstatechange = null;
                pc.onnegotiationneeded = null;
                
                // Close all transceivers
                if (pc.getTransceivers) {
                    pc.getTransceivers().forEach(transceiver => {
                        try {
                            transceiver.stop && transceiver.stop();
                        } catch (e) {
                            console.warn('Error stopping transceiver:', e);
                        }
                    });
                }
                
                // Close the connection
                pc.close();
                console.log('✅ Peer connection closed cleanly');
            } catch (e) {
                console.error('Error closing peer connection:', e);
            } finally {
                this.peerConnection = null;
            }
        }
        
        // Update status
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts), 30000); // Max 30s delay
            this.reconnectAttempts++;
            
            console.log(`♻️ Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            this.updateStatus('reconnecting', `Reconnecting in ${Math.ceil(delay/1000)} seconds...`);
            
            // Clear any existing reconnection timeout
            if (this.reconnectTimeout) {
                clearTimeout(this.reconnectTimeout);
            }
            
            this.reconnectTimeout = setTimeout(async () => {
                try {
                    await this.init();
                    this.reconnectAttempts = 0; // Reset on successful reconnect
                } catch (error) {
                    console.error('Reconnection failed:', error);
                    this.handleDisconnection(); // Try again
                }
            }, delay);
        } else {
            console.error('Max reconnection attempts reached');
            this.showError('Connection lost. Please check your internet connection and refresh the page.');
            
            // Show retry button
            const retryButton = document.createElement('button');
            retryButton.textContent = 'Retry Connection';
            retryButton.className = 'retry-button';
            retryButton.onclick = () => {
                this.reconnectAttempts = 0;
                this.handleDisconnection();
            };
            
            const errorContainer = document.querySelector('.error-container') || document.createElement('div');
            errorContainer.className = 'error-container';
            errorContainer.innerHTML = '';
            errorContainer.appendChild(document.createTextNode('Failed to reconnect. '));
            errorContainer.appendChild(retryButton);
            
            const statusBar = document.querySelector('.status-bar');
            if (statusBar) {
                statusBar.appendChild(errorContainer);
            }
        }
    }

    updateStatus(status, message) {
        const timestamp = new Date().toISOString().substr(11, 8);
        console.log(`[${timestamp}] Status: ${status} - ${message}`);
        if (this.statusText) {
            this.statusText.textContent = `[${timestamp}] ${message}`;
            this.statusText.className = `status-${status}`;
        }
        if (this.statusText) {
            if (status === 'connected') {
                this.statusText.innerHTML = message + '<span class="live-badge">LIVE</span>';
            } else {
                this.statusText.innerHTML = message;
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
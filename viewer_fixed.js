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
        this.reconnectDelay = 1000;
        
        this.peerConnectionConfig = {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
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
    
    async initFirebase() {
        try {
            if (typeof firebase !== 'undefined' && typeof FIREBASE_CONFIG !== 'undefined') {
                if (!firebase.apps || firebase.apps.length === 0) {
                    firebase.initializeApp(FIREBASE_CONFIG);
                    await firebase.database().goOnline();
                }
                this.db = firebase.database();
                console.log('✅ Firebase initialized for viewer');
                
                this.db.ref('.info/connected').on('value', (snapshot) => {
                    if (snapshot.val() === true) {
                        console.log('🌐 Connected to Firebase');
                        this.updateStatus('connecting', 'Connecting to stream...');
                        
                        setTimeout(async () => {
                            try {
                                await this.init();
                            } catch (error) {
                                console.error('❌ Error initializing viewer:', error);
                                this.updateStatus('error', 'Failed to initialize. Please refresh the page.');
                            }
                        }, 500);
                        
                        this.connectionCheckInterval = setInterval(() => {
                            this.checkConnectionHealth();
                        }, 5000);
                    } else {
                        console.log('⚠️ Firebase disconnected');
                        this.updateStatus('error', 'Disconnected from server. Reconnecting...');
                        this.handleDisconnection();
                    }
                });
                
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
            
            if (this.peerConnection) {
                console.log('♻️ Cleaning up existing peer connection');
                this.peerConnection.close();
                this.peerConnection = null;
            }
            
            this.peerConnection = new RTCPeerConnection(this.peerConnectionConfig);
            console.log('✅ Peer connection created');
            
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
            
            this.peerConnection.oniceconnectionstatechange = () => {
                console.log('🧊 ICE connection state:', this.peerConnection.iceConnectionState);
                
                switch(this.peerConnection.iceConnectionState) {
                    case 'connected':
                        this.isConnected = true;
                        this.updateStatus('connected', 'Stream connected');
                        break;
                    case 'disconnected':
                    case 'failed':
                        this.updateStatus('reconnecting', 'Reconnecting to stream...');
                        this.handleDisconnection();
                        break;
                }
            };
            
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
            const viewerRef = this.db.ref(`rooms/${this.roomId}/viewers/${this.peerId}`);
            
            await viewerRef.set({
                id: this.peerId,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            });
            
            console.log('✅ Successfully registered as viewer');
            
            await viewerRef.onDisconnect().remove()
                .then(() => console.log('✅ Cleanup on disconnect configured'))
                .catch(err => console.error('❌ Failed to set up cleanup on disconnect:', err));
                
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
        const offersRef = this.db.ref(`rooms/${this.roomId}/offers/${this.peerId}`);

        offersRef.on('child_added', async (snapshot) => {
            const data = snapshot.val();
            if (data && data.to === this.peerId && data.from === this.broadcasterId) {
                console.log('📨 Received offer from broadcaster');
                await this.handleOffer(data);
            }
        });

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
            
            if (!this.peerConnection) {
                this.peerConnection = new RTCPeerConnection(this.peerConnectionConfig);
            }
            
            this.peerConnection.oniceconnectionstatechange = () => {
                const iceState = this.peerConnection.iceConnectionState;
                console.log('🧊 ICE Connection State:', iceState);
                
                if (iceState === 'failed' || iceState === 'disconnected') {
                    this.updateStatus('warning', 'Connection issue. Reconnecting...');
                    this.handleDisconnection();
                }
            };

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

            this.peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    this.db.ref(`rooms/${this.roomId}/iceCandidates`).push({
                        candidate: event.candidate.toJSON(),
                        from: this.peerId,
                        to: this.broadcasterId,
                        timestamp: Date.now()
                    });
                }
            };

            this.peerConnection.ontrack = (event) => {
                console.log('Received track:', event.track.kind);
                if (event.track.kind === 'video' || event.track.kind === 'audio') {
                    if (!this.viewVideo.srcObject) {
                        this.viewVideo.srcObject = new MediaStream();
                    }
                    this.viewVideo.srcObject.addTrack(event.track);
                    this.isConnected = true;
                    this.viewVideo.classList.add('visible');
                    
                    if (this.statusText) {
                        this.statusText.textContent = 'Live Stream - Connected';
                    }
                    
                    this.playVideoWithAudio();
                }
            };

            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
            
            const answer = await this.peerConnection.createAnswer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true
            });
            
            await this.peerConnection.setLocalDescription(answer);
            
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
            this.viewVideo.muted = false;
            await this.viewVideo.play();
            console.log('Playing video with audio');
        } catch (err) {
            console.warn('Autoplay with audio failed, trying muted:', err);
            try {
                this.viewVideo.muted = true;
                await this.viewVideo.play();
                console.log('Playing video with muted audio');
                
                if (this.statusText) {
                    this.statusText.textContent = 'Live Stream - Click to unmute';
                    this.viewVideo.onclick = () => {
                        this.viewVideo.muted = false;
                        this.statusText.textContent = 'Live Stream - Connected';
                    };
                }
            } catch (err2) {
                console.error('Failed to play video:', err2);
                this.showPlayButton();
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

    handleStream(stream) {
        if (!stream) return;
        
        console.log('🎥 Received stream:', stream.id);
        
        const placeholder = document.getElementById('placeholder');
        if (placeholder) {
            placeholder.style.display = 'none';
        }
        
        this.viewVideo.srcObject = stream;
        this.viewVideo.classList.add('visible');
        this.viewVideo.style.display = 'block';
        
        this.playVideoWithAudio();
    }

    ensureVideoPlaying() {
        if (!this.viewVideo || !this.viewVideo.srcObject) return;
        
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
                })
                .catch(error => {
                    console.error('Error playing video:', error);
                    this.showPlayButton();
                });
        }
    }
    
    showPlayButton() {
        console.log('Showing play button');
        
        const placeholder = document.getElementById('placeholder');
        if (placeholder) {
            placeholder.style.display = 'flex';
            placeholder.innerHTML = `
                <div class="placeholder-content">
                    <i class="fas fa-play-circle" style="font-size: 64px; margin-bottom: 20px; cursor: pointer;" id="playButton"></i>
                    <h3>Click to play video</h3>
                    <p>Browser requires user interaction to start playback</p>
                </div>
            `;
            
            const playButton = document.getElementById('playButton');
            if (playButton) {
                playButton.addEventListener('click', () => {
                    console.log('Play button clicked');
                    this.viewVideo.play().then(() => {
                        console.log('Video started playing after user interaction');
                        placeholder.style.display = 'none';
                        if (this.statusText) {
                            this.statusText.innerHTML = 'Live Stream - Connected <span class="live-badge">LIVE</span>';
                        }
                    }).catch(error => {
                        console.error('Still failed to play after click:', error);
                    });
                });
            }
        }
        
        if (this.statusText) {
            this.statusText.innerHTML = 'Click play button to start <span class="live-badge">LIVE</span>';
        }
    }

    async handleDisconnection() {
        console.log('🔌 Handling disconnection...');
        
        if (this.peerConnection) {
            try {
                const pc = this.peerConnection;
                pc.ontrack = null;
                pc.onicecandidate = null;
                pc.oniceconnectionstatechange = null;
                pc.onicegatheringstatechange = null;
                pc.onsignalingstatechange = null;
                pc.onconnectionstatechange = null;
                pc.onnegotiationneeded = null;
                
                if (pc.getTransceivers) {
                    pc.getTransceivers().forEach(transceiver => {
                        try {
                            transceiver.stop && transceiver.stop();
                        } catch (e) {
                            console.warn('Error stopping transceiver:', e);
                        }
                    });
                }
                
                pc.close();
                console.log('✅ Peer connection closed cleanly');
            } catch (e) {
                console.error('Error closing peer connection:', e);
            } finally {
                this.peerConnection = null;
            }
        }
        
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts), 30000);
            this.reconnectAttempts++;
            
            console.log(`♻️ Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            this.updateStatus('reconnecting', `Reconnecting in ${Math.ceil(delay/1000)} seconds...`);
            
            if (this.reconnectTimeout) {
                clearTimeout(this.reconnectTimeout);
            }
            
            this.reconnectTimeout = setTimeout(async () => {
                try {
                    await this.init();
                    this.reconnectAttempts = 0;
                } catch (error) {
                    console.error('Reconnection failed:', error);
                    this.handleDisconnection();
                }
            }, delay);
        } else {
            console.error('Max reconnection attempts reached');
            this.showError('Connection lost. Please check your internet connection and refresh the page.');
        }
    }

    updateStatus(status, message) {
        const timestamp = new Date().toISOString().substr(11, 8);
        console.log(`[${timestamp}] Status: ${status} - ${message}`);
        if (this.statusText) {
            if (status === 'connected') {
                this.statusText.innerHTML = message + '<span class="live-badge">LIVE</span>';
            } else {
                this.statusText.innerHTML = message;
            }
            this.statusText.className = `status-${status}`;
        }
    }

    showError(message) {
        console.error('Error:', message);
        this.updateStatus('error', message);
    }

    handleNetworkChange() {
        try {
            if (navigator.onLine) {
                console.log('🌐 Network online - scheduling reconnect');
                this.updateStatus('connecting', 'Network online, reconnecting...');
                this.handleDisconnection();
            } else {
                console.log('🚫 Network offline');
                this.updateStatus('error', 'Network offline');
            }
        } catch (e) {
            console.error('Error in handleNetworkChange:', e);
        }
    }

    async attemptReconnect() {
        console.log('♻️ attemptReconnect called');
        await this.handleDisconnection();
    }

    async checkConnectionHealth() {
        console.log('🔍 Checking connection health...');
        
        if (!this.peerConnection) {
            console.log('ℹ️ No active peer connection, attempting to reconnect...');
            await this.attemptReconnect();
            return;
        }
        
        // Check if we have a working video stream
        const hasStream = !!(this.viewVideo && this.viewVideo.srcObject && (this.viewVideo.srcObject.getTracks()?.length > 0));
        const isVideoPlaying = !!(this.viewVideo && !this.viewVideo.paused);
        
        if (hasStream && isVideoPlaying) {
            this.isConnected = true;
            console.log('✅ Video is playing, connection is healthy');
            return;
        }
        
        if (!this.isConnected) {
            console.log('⚠️ Connection health check: Not connected, checking state...');
            if (hasStream) {
                this.isConnected = true;
                console.log('✅ Media tracks present, marking as connected');
                return;
            }
            const conn = this.peerConnection.connectionState;
            const ice = this.peerConnection.iceConnectionState;
            if (conn === 'connected' || ice === 'connected') {
                this.isConnected = true;
                console.log('✅ Connection is now active (health check)');
                return;
            }
            if (conn === 'connecting' || ice === 'checking' || ice === 'new' || ice === 'gathering') {
                console.log('⏳ Still establishing (health check), skipping reconnect');
                return;
            }
            console.log('🔄 Attempting to reconnect...');
            await this.handleDisconnection();
            return;
        }

        try {
            const connectionState = this.peerConnection?.connectionState || 'no-connection';
            const iceState = this.peerConnection?.iceConnectionState || 'no-ice';

            if (connectionState === 'connecting' || iceState === 'checking' || iceState === 'new' || iceState === 'gathering') {
                console.log('⏳ Connection still establishing, skipping reconnect check');
                return;
            }

            if (iceState === 'disconnected' || iceState === 'failed' || iceState === 'closed') {
                console.log('🔌 Connection issue detected, attempting to recover...');
                await this.handleDisconnection();
            }
        } catch (error) {
            console.error('❌ Error checking connection health:', error);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const viewer = new VideoViewer();
    console.log('🚀 Video Viewer initialized');
});

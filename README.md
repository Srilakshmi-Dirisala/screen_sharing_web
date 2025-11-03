# Screen Share - Real-time Screen Sharing Web App

A modern, responsive web application for real-time screen sharing built with WebRTC technology. Share your screen instantly with others through a beautiful, user-friendly interface.

## Features

- 🖥️ **Real-time Screen Sharing** - Share your entire screen or specific applications
- ✂️ **Crop Area Selection** - Select and share only a specific area of your screen
- 📐 **Section Selection** - Create customizable sharing sections with resize handles
- ⏸️ **Pause/Resume** - Pause and resume screen sharing with visual indicators
- 📱 **Mobile & Desktop Views** - Toggle between optimized mobile and desktop layouts
- 🔊 **Audio Sharing** - Include system audio in your screen share
- 📱 **Responsive Design** - Works perfectly on desktop, tablet, and mobile devices
- 🎨 **Modern UI** - Beautiful, intuitive interface with smooth animations
- ⌨️ **Keyboard Shortcuts** - Quick access with keyboard shortcuts
- 🔒 **Secure** - Uses WebRTC for secure, peer-to-peer communication
- 🚀 **Fast Performance** - Optimized for low latency and high quality
- 📊 **Real-time Stats** - View sharing status and viewer count
- 🖼️ **Fullscreen Mode** - Fullscreen viewing for better experience

## Browser Support

- ✅ Chrome 72+
- ✅ Firefox 66+
- ✅ Edge 79+
- ✅ Safari 13+
- ❌ Internet Explorer (not supported)

## Quick Start

1. **Clone or Download** the project files
2. **Open** `index.html` in a modern web browser
3. **Click** "Start Sharing" to begin screen sharing
4. **Allow** screen sharing permissions when prompted
5. **Share** the link with others to let them view your screen

## Installation

### Option 1: Simple File Opening
1. Download all files to a folder
2. Open `index.html` directly in your browser
3. Start sharing immediately!

### Option 2: Local Server (Recommended)
For the best experience, serve the files through a local web server:

```bash
# Using Python 3
python -m http.server 8000

# Using Node.js (if you have http-server installed)
npx http-server

# Using PHP
php -S localhost:8000
```

Then visit `http://localhost:8000` in your browser.

## Usage

### Starting Screen Share
1. Click the **"Start Sharing"** button
2. Select the screen or application you want to share
3. Choose whether to include audio
4. Click **"Share"** in the browser dialog

### Using Crop Area Selection
1. Click the **"Crop Area"** button
2. Click and drag to select the area you want to share
3. Use the **8 resize handles** to adjust the crop area size
4. Use **+Width/-Width** and **+Height/-Height** buttons for precise control
5. See real-time dimensions display
6. Click **"Confirm Selection"** to proceed
7. The screen share will start with only the selected area

### Using Section Selection
1. Click the **"Select Section"** button
2. Click and drag to create a section area
3. Use the **8 resize handles** to adjust the section size
4. Use **+Width/-Width** and **+Height/-Height** buttons for precise control
5. Click **"Confirm Section"** to start sharing the selected section

### Using Pause/Resume
1. Start screen sharing normally
2. Click the **"Pause"** button to pause the stream
3. The last frame of the video remains visible (no overlay)
4. Click **"Resume"** to continue sharing from where you left off
5. Use **Space bar** as a quick keyboard shortcut

### Switching View Modes
1. Click the **"Desktop"** button for desktop-optimized layout
2. Click the **"Mobile"** button for mobile-optimized layout
3. The interface automatically adapts to the selected view mode
4. Auto-detection switches based on screen size

### Controls
- **Start Sharing** - Begin screen sharing
- **Crop Area** - Select a specific area to share
- **Select Section** - Create customizable sharing sections with resize controls
- **Pause/Resume** - Pause and resume screen sharing
- **Desktop/Mobile View** - Toggle between view modes
- **Stop Sharing** - End the current screen share
- **Fullscreen** - Toggle fullscreen mode for the video

### Keyboard Shortcuts
- `Ctrl/Cmd + Shift + S` - Start/Stop screen sharing
- `Ctrl/Cmd + Shift + C` - Toggle crop area selection
- `Ctrl/Cmd + Shift + D` - Switch to desktop view
- `Ctrl/Cmd + Shift + M` - Switch to mobile view
- `Space` - Pause/Resume screen sharing (when sharing)
- `F11` - Toggle fullscreen mode
- `Escape` - Exit fullscreen mode or cancel crop selection
- `Enter` - Confirm crop selection (when in crop mode)

## Technical Details

### WebRTC Implementation
The app uses the `getDisplayMedia()` API to capture screen content:
- Supports screen, window, and tab sharing
- Configurable video quality (up to 1080p)
- Audio capture support
- Automatic track management

### Features Included
- **Error Handling** - Comprehensive error messages for different scenarios
- **Crop Area Selection** - Interactive area selection with 8 resize handles for dynamic editing
- **Section Selection** - Advanced section creation with 8 resize handles
- **Pause/Resume Control** - Toggle screen sharing on/off with visual indicators
- **Precise Controls** - Button-based width/height adjustments for both crop and section
- **Real-time Dimensions** - Live display of crop and section sizes
- **View Mode Switching** - Toggle between mobile and desktop optimized layouts
- **Auto-Detection** - Automatic view mode switching based on screen size
- **Performance Monitoring** - FPS tracking for optimal performance
- **Responsive Design** - Mobile-first approach with breakpoints
- **Accessibility** - Keyboard navigation and screen reader support
- **PWA Ready** - Service worker for offline capabilities

## File Structure

```
screen-sharing-web/
├── index.html          # Main HTML file
├── styles.css          # CSS styles and responsive design
├── script.js           # JavaScript functionality and WebRTC
├── README.md           # This documentation
└── sw.js              # Service worker (optional)
```

## Customization

### Changing Video Quality
Edit the `getDisplayMedia` constraints in `script.js`:

```javascript
video: {
    width: { ideal: 1920 },    // Change resolution
    height: { ideal: 1080 },
    frameRate: { ideal: 30 }   // Change frame rate
}
```

### Styling
Modify `styles.css` to customize:
- Colors and gradients
- Button styles
- Layout and spacing
- Animations and transitions

### Adding Features
The modular JavaScript structure makes it easy to add:
- Chat functionality
- Recording capabilities
- Multiple viewer management
- Custom controls

## Troubleshooting

### Common Issues

**"Screen sharing was denied"**
- Make sure to click "Allow" when the browser asks for permission
- Check if another application is already using screen sharing

**"Screen sharing is not supported"**
- Update your browser to the latest version
- Use Chrome, Firefox, or Edge for best compatibility

**"No audio in screen share"**
- Make sure to check "Share audio" when starting screen share
- Some browsers require HTTPS for audio sharing

**Poor video quality**
- Check your internet connection
- Close other applications using bandwidth
- Try reducing the video quality in the code

### Browser-Specific Notes

**Chrome/Edge:**
- Best support for all features
- Requires HTTPS for audio sharing in production

**Firefox:**
- Good support for screen sharing
- May have different UI for permission dialogs

**Safari:**
- Basic screen sharing support
- Limited audio sharing options

## Security Considerations

- Screen sharing requires explicit user permission
- No data is stored or transmitted to external servers
- All communication happens locally in the browser
- Use HTTPS in production for enhanced security

## Future Enhancements

Potential features for future versions:
- Multi-user screen sharing
- Chat and messaging
- Screen recording
- Mobile app versions
- Server-side relay for better connectivity
- User authentication
- Meeting rooms and scheduling

## License

This project is open source and available under the MIT License.

## Support

For issues, questions, or contributions:
1. Check the troubleshooting section above
2. Review browser compatibility requirements
3. Ensure you're using a supported browser version

---

**Built with ❤️ using WebRTC technology**

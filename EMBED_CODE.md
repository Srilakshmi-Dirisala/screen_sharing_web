# Embed Code for ViewVideo.html

This guide shows you how to embed the video viewer on any website.

## Method 1: Simple Iframe Embed (Recommended)

### Basic Embed Code

```html
<iframe 
    src="https://your-app-name.onrender.com/viewvideo-embed.html" 
    width="100%" 
    height="600" 
    frameborder="0" 
    allowfullscreen
    style="border: none; border-radius: 8px;">
</iframe>
```

### Responsive Embed Code

```html
<div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%; background: #000; border-radius: 8px;">
    <iframe 
        src="https://your-app-name.onrender.com/viewvideo-embed.html" 
        style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none;"
        allowfullscreen>
    </iframe>
</div>
```

### Full Screen Embed Code

```html
<iframe 
    src="https://your-app-name.onrender.com/viewvideo-embed.html" 
    width="100%" 
    height="100vh" 
    frameborder="0" 
    allowfullscreen
    style="border: none; position: fixed; top: 0; left: 0; z-index: 9999;">
</iframe>
```

## Method 2: WordPress Embed

### For WordPress Posts/Pages

1. Go to your WordPress post/page editor
2. Add an HTML block
3. Paste this code:

```html
<div class="screen-share-embed">
    <iframe 
        src="https://your-app-name.onrender.com/viewvideo-embed.html" 
        width="100%" 
        height="600" 
        frameborder="0" 
        allowfullscreen
        style="border: none; min-height: 400px;">
    </iframe>
</div>
```

### Add to WordPress Theme (functions.php)

```php
function add_screen_share_embed() {
    ?>
    <div style="margin: 20px 0;">
        <iframe 
            src="https://your-app-name.onrender.com/viewvideo-embed.html" 
            width="100%" 
            height="600" 
            frameborder="0" 
            allowfullscreen>
        </iframe>
    </div>
    <?php
}
add_action('wp_footer', 'add_screen_share_embed');
```

## Method 3: React Component

```jsx
import React from 'react';

const ScreenShareViewer = ({ url = "https://your-app-name.onrender.com/viewvideo-embed.html" }) => {
    return (
        <div style={{ width: '100%', height: '600px', position: 'relative' }}>
            <iframe
                src={url}
                width="100%"
                height="100%"
                frameBorder="0"
                allowFullScreen
                style={{ border: 'none', borderRadius: '8px' }}
                title="Screen Share Viewer"
            />
        </div>
    );
};

export default ScreenShareViewer;
```

## Method 4: Vue Component

```vue
<template>
    <div class="screen-share-viewer">
        <iframe
            :src="viewerUrl"
            width="100%"
            height="600"
            frameborder="0"
            allowfullscreen
            class="viewer-iframe"
        />
    </div>
</template>

<script>
export default {
    name: 'ScreenShareViewer',
    data() {
        return {
            viewerUrl: 'https://your-app-name.onrender.com/viewvideo-embed.html'
        }
    }
}
</script>

<style scoped>
.screen-share-viewer {
    width: 100%;
    border-radius: 8px;
    overflow: hidden;
}

.viewer-iframe {
    border: none;
    min-height: 400px;
}
</style>
```

## Method 5: HTML Widget for Website Builders

### For Wix

1. Go to Add Elements → Embed → HTML iframe
2. Paste this code:

```html
<iframe src="https://your-app-name.onrender.com/viewvideo-embed.html" width="100%" height="600" frameborder="0"></iframe>
```

### For Squarespace

1. Add a Code Block
2. Paste this code:

```html
<div class="sqs-block-html">
    <iframe src="https://your-app-name.onrender.com/viewvideo-embed.html" width="100%" height="600" frameborder="0" allowfullscreen></iframe>
</div>
```

### For Shopify

Add to your product page or template:

```liquid
<div class="screen-share-viewer">
    <iframe 
        src="https://your-app-name.onrender.com/viewvideo-embed.html" 
        width="100%" 
        height="600" 
        frameborder="0" 
        allowfullscreen>
    </iframe>
</div>
```

## Method 6: JavaScript Embed (Dynamic)

```html
<div id="screen-share-viewer"></div>

<script>
(function() {
    const container = document.getElementById('screen-share-viewer');
    const iframe = document.createElement('iframe');
    iframe.src = 'https://your-app-name.onrender.com/viewvideo-embed.html';
    iframe.width = '100%';
    iframe.height = '600';
    iframe.frameBorder = '0';
    iframe.allowFullscreen = true;
    iframe.style.border = 'none';
    iframe.style.borderRadius = '8px';
    container.appendChild(iframe);
})();
</script>
```

## Customization Options

### Custom Dimensions

```html
<iframe 
    src="https://your-app-name.onrender.com/viewvideo-embed.html" 
    width="800" 
    height="450" 
    frameborder="0" 
    allowfullscreen>
</iframe>
```

### With Custom Styling

```html
<iframe 
    src="https://your-app-name.onrender.com/viewvideo-embed.html" 
    width="100%" 
    height="600" 
    frameborder="0" 
    allowfullscreen
    style="border: 2px solid #667eea; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.3);">
</iframe>
```

### Responsive Container

```html
<style>
.screen-share-container {
    position: relative;
    padding-bottom: 56.25%; /* 16:9 Aspect Ratio */
    height: 0;
    overflow: hidden;
    max-width: 100%;
    background: #000;
    border-radius: 8px;
}

.screen-share-container iframe {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    border: none;
}
</style>

<div class="screen-share-container">
    <iframe 
        src="https://your-app-name.onrender.com/viewvideo-embed.html" 
        allowfullscreen>
    </iframe>
</div>
```

## Important Notes

1. **Replace the URL**: Change `https://your-app-name.onrender.com` to your actual Render deployment URL

2. **Firebase Configuration**: Make sure Firebase is configured in `firebase-config.js` for cross-device viewing

3. **HTTPS Required**: The embed requires HTTPS, which Render provides automatically

4. **CORS**: The iframe should work without CORS issues since it's a same-origin embed

5. **Mobile Responsive**: The embed is responsive and works on mobile devices

## Testing Your Embed

1. Copy one of the embed codes above
2. Replace the URL with your Render URL
3. Paste it into an HTML file and open in browser
4. Start sharing on `index.html`
5. The embed should show the live stream!

## Troubleshooting

- **Not showing video**: Check if Firebase is configured
- **Blank screen**: Verify the URL is correct and accessible
- **Mobile issues**: Use responsive embed code
- **Size issues**: Adjust width and height attributes

---

**Your embed is ready! Share it on any website! 🚀**


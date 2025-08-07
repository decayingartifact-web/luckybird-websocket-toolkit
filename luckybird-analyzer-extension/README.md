# LuckyBird WebSocket Analyzer - Browser Extension

A Chrome extension that provides real-time WebSocket traffic analysis directly on the luckybird.io website with an elegant sidebar dashboard.

## 🚀 Features

- **Real-time WebSocket interception** - Captures all WebSocket traffic on luckybird.io
- **AES-CBC decryption** - Automatically decrypts encrypted messages
- **Sidebar dashboard** - Clean, modern interface that overlays on the website
- **Message analysis** - Categorizes and analyzes message types and frequencies
- **Custom message sending** - Send test messages to the WebSocket
- **Data export** - Export captured data for further analysis
- **No authentication issues** - Works within the authenticated session

## 📦 Installation

### Method 1: Load as Unpacked Extension (Recommended)

1. **Download the extension files** to a folder on your computer
2. **Open Chrome** and navigate to `chrome://extensions/`
3. **Enable Developer mode** (toggle in top-right corner)
4. **Click "Load unpacked"** and select the extension folder
5. **Pin the extension** to your toolbar for easy access

### Method 2: Manual Installation

1. **Copy all extension files** to a new folder
2. **Ensure all files are present:**
   - `manifest.json`
   - `content.js`
   - `injected.js`
   - `analyzer.css`
   - `popup.html`
   - `popup.js`
3. **Follow Method 1 steps 2-5**

## 🎯 Usage

### Getting Started

1. **Install the extension** using the steps above
2. **Navigate to luckybird.io** and log in normally
3. **The analyzer will automatically activate** - you'll see a sidebar appear
4. **Start using the website** - WebSocket messages will be captured automatically

### Dashboard Features

#### Statistics Panel
- **Total Messages** - Count of all intercepted messages
- **Encrypted** - Number of encrypted messages
- **Success Rate** - Decryption success percentage

#### Message List
- **Real-time updates** - New messages appear instantly
- **Click to view details** - Select any message for detailed analysis
- **Message categorization** - Automatic type identification

#### Message Details
- **Decrypted content** - Full JSON structure of decrypted data
- **Encrypted payload** - Original encrypted message
- **Metadata** - Timestamp, size, message type

#### Custom Message Sender
- **Message Code** - Enter numeric message code (e.g., 3121)
- **JSON Data** - Custom payload data
- **Send Button** - Transmit message to WebSocket

### Controls

#### Sidebar Controls
- **Hide/Show** - Toggle dashboard visibility
- **Clear** - Remove all captured messages
- **Export** - Download data as JSON file

#### Extension Popup
- **Status indicator** - Shows if analyzer is active
- **Quick stats** - Message count and success rate
- **Quick actions** - Toggle, clear, export from popup

## 🔧 Technical Details

### Message Types Identified

| Code | Type | Description |
|------|------|-------------|
| 3121 | Heartbeat/Ping | Keep-alive messages |
| 3513 | Bet Confirmation | Bet placement confirmations |
| 3555 | Balance Update | User balance changes |
| 3951 | Game Result | Game outcome messages |
| 3022 | Connection Status | WebSocket connection state |
| 3013 | System Status | System announcements |

### Encryption Details

- **Algorithm**: AES-128-CBC
- **Key**: `Luckybird1234567` (hardcoded)
- **IV**: 32-character hex string (16 bytes)
- **Encoding**: Base64 + URL encoding

### Data Storage

- **Local storage only** - No data sent to external servers
- **Session-based** - Data cleared when page refreshes
- **Export capability** - Save data locally as JSON

## 🛠️ Development

### File Structure

```
luckybird-analyzer-extension/
├── manifest.json          # Extension manifest
├── content.js            # Content script (dashboard)
├── injected.js           # Page context script (WebSocket interception)
├── analyzer.css          # Dashboard styling
├── popup.html            # Extension popup interface
├── popup.js              # Popup functionality
└── README.md             # This file
```

### Key Components

1. **Injected Script** (`injected.js`)
   - Runs in page context
   - Overrides WebSocket constructor
   - Handles decryption and analysis

2. **Content Script** (`content.js`)
   - Creates dashboard overlay
   - Handles UI interactions
   - Communicates with injected script

3. **Popup** (`popup.html/js`)
   - Extension toolbar interface
   - Quick stats and controls
   - Status monitoring

## 🔍 Troubleshooting

### Extension Not Working

1. **Check extension is enabled** in `chrome://extensions/`
2. **Verify you're on luckybird.io** - extension only works on this domain
3. **Refresh the page** after installing/enabling extension
4. **Check browser console** for error messages

### Dashboard Not Appearing

1. **Look for sidebar on right side** of the page
2. **Click extension icon** and use "Toggle Dashboard"
3. **Check if dashboard is hidden** - click "Show" button
4. **Disable other extensions** that might conflict

### No Messages Captured

1. **Ensure you're logged into luckybird.io**
2. **Try interacting with the website** (place bets, navigate)
3. **Check browser console** for WebSocket connection messages
4. **Verify WebSocket traffic exists** in browser DevTools Network tab

### Decryption Failures

1. **Check console for error messages**
2. **Verify AES key is correct** (currently hardcoded)
3. **Ensure message format hasn't changed**
4. **Try refreshing the page**

## 📊 Data Export Format

Exported JSON contains:

```json
{
  "messages": [
    {
      "timestamp": 1234567890,
      "code": 3121,
      "messageType": "Heartbeat/Ping",
      "dataSize": 123,
      "decrypted": {...},
      "encrypted": {...}
    }
  ],
  "statistics": {
    "totalMessages": 100,
    "encryptedMessages": 80,
    "decryptionSuccessRate": "95.0%"
  },
  "exportTime": "2024-01-01T12:00:00.000Z"
}
```

## ⚠️ Legal Notice

This extension is for educational and authorized security research purposes only. Ensure compliance with:

- Website terms of service
- Applicable laws and regulations
- Responsible disclosure practices

## 🤝 Support

For issues or questions:

1. **Check troubleshooting section** above
2. **Review browser console** for error messages
3. **Verify extension permissions** are granted
4. **Test with fresh browser profile** if needed

---

**Version**: 1.0  
**Compatible**: Chrome 88+, Edge 88+  
**License**: Educational/Research Use Only

# LuckyBird WebSocket Reverse Engineering Toolkit

A comprehensive suite of tools for analyzing, monitoring, and interacting with LuckyBird's WebSocket communication protocol. This toolkit provides real-time decryption, message categorization, and detailed protocol documentation.

## 🚀 Features

- **Real-time Message Interception**: Automatically captures and decrypts WebSocket traffic
- **Advanced Analytics**: Message categorization, frequency analysis, and success rate tracking
- **Interactive Dashboard**: Modern web interface for monitoring and analysis
- **Custom Message Sending**: Send crafted messages to test server responses
- **Data Export**: Export captured data for further analysis
- **Protocol Documentation**: Comprehensive documentation of the reverse-engineered protocol

## 📁 Project Structure

```
luckybird-websocket-toolkit/
├── luckybird-ws-enhanced-decryptor.user.js  # Enhanced Tampermonkey userscript
├── dashboard.html                           # Main dashboard interface
├── dashboard.css                           # Dashboard styling
├── dashboard.js                            # Dashboard functionality
├── WEBSOCKET_PROTOCOL.md                   # Protocol documentation
└── README.md                              # This file
```

## 🛠️ Installation & Setup

### Step 1: Install the Tampermonkey Script

1. Install [Tampermonkey](https://www.tampermonkey.net/) browser extension
2. Open Tampermonkey dashboard
3. Click "Create a new script"
4. Replace the default content with `luckybird-ws-enhanced-decryptor.user.js`
5. Save the script (Ctrl+S)

### Step 2: Set up the Dashboard

1. Save all files to a local directory
2. Open `dashboard.html` in your web browser
3. The dashboard will automatically connect to the Tampermonkey script

### Step 3: Start Analyzing

1. Navigate to [luckybird.io](https://luckybird.io) in the same browser
2. The script will automatically start intercepting WebSocket messages
3. View real-time analysis in the dashboard

## 🎯 Usage Guide

### Basic Monitoring

1. **Open Dashboard**: Load `dashboard.html` in your browser
2. **Visit LuckyBird**: Navigate to luckybird.io in the same browser
3. **Watch Messages**: Messages will appear in real-time as they're intercepted

### Message Analysis

- **Click any message** in the sidebar to view detailed information
- **View statistics** in the top panel for traffic overview
- **Monitor message types** to understand communication patterns

### Custom Message Sending

1. Enter a **message code** (e.g., 3120 for heartbeat)
2. Add **JSON data** in the textarea
3. Click **"Validate JSON"** to check syntax
4. Click **"Send Message"** to transmit

### Data Export

- Click **"Export Data"** to download all captured messages and statistics
- Data is exported in JSON format for further analysis
- Includes timestamps, message types, and decrypted content

## 🔍 Key Components

### Enhanced Tampermonkey Script

**Features:**
- Automatic WebSocket interception
- AES-CBC decryption with hardcoded key
- Message categorization based on observed codes
- Real-time statistics tracking
- Custom event dispatching for dashboard integration

**Key Functions:**
```javascript
window.wsAnalyzer.getStats()      // Get current statistics
window.wsAnalyzer.exportData()    // Export all data
window.wsAnalyzer.sendMessage()   // Send custom message
window.wsAnalyzer.clearData()     // Clear stored data
```

### Interactive Dashboard

**Sections:**
- **Header**: Connection status and title
- **Statistics Panel**: Real-time metrics (total messages, encryption rate, etc.)
- **Message Log**: Chronological list of intercepted messages
- **Detail Panel**: In-depth analysis of selected messages
- **Message Types**: Frequency analysis of different message codes
- **Custom Sender**: Interface for sending test messages

### Protocol Documentation

Comprehensive documentation including:
- Message structure and encryption details
- Complete list of observed message codes
- Sample messages with explanations
- Security analysis and vulnerabilities
- Implementation notes and recommendations

## 📊 Message Types Identified

Based on traffic analysis, we've identified these message categories:

| Code Range | Category | Examples |
|------------|----------|----------|
| 1000-1999 | Authentication | 1080: User login |
| 3000-3099 | System Messages | 3022: Connection, 3030: Announcements |
| 3100-3199 | Game State | 3120: Heartbeat, 3117: Notifications |
| 3500-3599 | User Actions | 3513: Bet confirmation, 3555: Balance update |
| 3700-3999 | Game Results | 3951: Game outcome, 3803: History |
| 4000-4099 | Transactions | 4020: Transaction update, 4033: Errors |

## 🔐 Security Analysis

### Encryption Details
- **Algorithm**: AES-CBC with PKCS#7 padding
- **Key**: `Luckybird1234567` (hardcoded, 16 bytes)
- **IV**: 32-character hex string (16 bytes, should be random)
- **Encoding**: Base64 + URL encoding

### Identified Vulnerabilities
- **Hardcoded encryption key** in client-side code
- **No message authentication** (no HMAC/signatures)
- **Potential replay attacks** (no timestamp validation)
- **Client-side encryption** (key accessible to users)

## 🛡️ Ethical Usage

This toolkit is designed for:
- **Security research** and vulnerability assessment
- **Educational purposes** and protocol analysis
- **Authorized penetration testing** with proper permissions

**⚠️ Important**: Only use this toolkit on systems you own or have explicit permission to test. Unauthorized access to computer systems is illegal.

## 🔧 Advanced Usage

### Debugging

Enable debug mode in browser console:
```javascript
// View current statistics
console.log(window.wsAnalyzer.getStats());

// Simulate a test message
window.dashboardUtils.simulateMessage(3120, {test: true});

// Toggle auto-refresh
window.dashboardUtils.toggleAutoRefresh();
```

### Custom Message Types

Add new message types to the analyzer:
```javascript
window.wsAnalyzer.messageTypes[9999] = "Custom Test Message";
```

### Filtering Messages

Filter messages by type in the console:
```javascript
// Get all balance update messages
const balanceUpdates = window.wsAnalyzer.messages.filter(m => m.code === 3555);
```

## 📈 Performance Considerations

- **Memory Usage**: Dashboard stores up to 1000 recent messages
- **CPU Impact**: Minimal overhead from real-time decryption
- **Network**: No additional network requests (passive monitoring)
- **Browser**: Works in Chrome, Firefox, Edge with Tampermonkey

## 🐛 Troubleshooting

### Common Issues

**Dashboard not connecting:**
- Ensure Tampermonkey script is active
- Check browser console for errors
- Verify you're on luckybird.io domain

**Messages not appearing:**
- Check if WebSocket connection is established
- Verify script permissions in Tampermonkey
- Look for decryption errors in console

**Decryption failures:**
- Confirm AES key is correct
- Check IV format (should be 32-char hex)
- Verify Base64 encoding is valid

### Debug Commands

```javascript
// Check if analyzer is loaded
console.log(window.wsAnalyzer ? "Loaded" : "Not loaded");

// View raw message storage
console.log(window.wsAnalyzer.messages);

// Test WebSocket connection
console.log(window.wsAnalyzer.activeWebSocket?.readyState);
```

## 🤝 Contributing

Contributions are welcome! Areas for improvement:

- **Additional message types** identification
- **Enhanced security analysis** 
- **Performance optimizations**
- **UI/UX improvements**
- **Protocol documentation** updates

## 📄 License

This project is for educational and research purposes. Please ensure compliance with applicable laws and terms of service.

## 🔗 Related Resources

- [WebSocket Protocol RFC](https://tools.ietf.org/html/rfc6455)
- [AES-CBC Encryption](https://en.wikipedia.org/wiki/Block_cipher_mode_of_operation#CBC)
- [Tampermonkey Documentation](https://www.tampermonkey.net/documentation.php)
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)

---

**Disclaimer**: This toolkit is provided for educational and authorized security testing purposes only. Users are responsible for ensuring compliance with all applicable laws and regulations.

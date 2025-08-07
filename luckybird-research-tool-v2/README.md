# LuckyBird WebSocket Research Tool v2.0

A professional-grade Chrome extension for advanced WebSocket traffic analysis and reverse engineering on luckybird.io. Built with a **function-first philosophy** prioritizing research capabilities over visual aesthetics.

## 🎯 Version 2.0 - Research-Focused Design

### **Core Improvements from v1.0:**
- ✅ **Smart Filtering** - Hide heartbeat spam (3121) by default
- ✅ **Advanced Search** - Full-text search through message content
- ✅ **Message Categorization** - Important vs routine message highlighting
- ✅ **Structure Analysis** - Detailed JSON analysis with key identification
- ✅ **Research Export** - Export filtered data for external analysis
- ✅ **Performance Optimized** - Handle thousands of messages efficiently

## 🔬 Research Features

### **Advanced Filtering System**
- **Message Type Filters**: All/Encrypted/Unencrypted/Unknown/Important
- **Heartbeat Hiding**: Checkbox to filter out useless 3121 messages
- **Content Search**: Search through message codes, types, and JSON content
- **Error Filtering**: Show only failed decryption attempts
- **Smart Categorization**: Visual indicators for message importance

### **Message Analysis Tools**
- **Structure Analysis**: Data keys, nesting level, object complexity
- **Encryption Status**: Clear indicators for encrypted vs unencrypted
- **Timing Analysis**: Timestamps and frequency tracking
- **Size Analysis**: Payload size and compression ratios
- **Type Identification**: Automatic categorization of message purposes

### **Research Workflow Support**
- **Sortable Lists**: Sort by time, code, or message type
- **Click-to-Analyze**: Detailed view of any message structure
- **Copy Functions**: One-click JSON copying for external tools
- **Export Capabilities**: Complete research data export
- **Statistics Dashboard**: Real-time metrics and type distribution

## 📦 Installation

### Quick Setup
1. **Download** the `luckybird-research-tool-v2` folder
2. **Open Chrome** and navigate to `chrome://extensions/`
3. **Enable Developer mode** (toggle in top-right)
4. **Click "Load unpacked"** and select the tool folder
5. **Pin the extension** to your toolbar

### File Structure
```
luckybird-research-tool-v2/
├── manifest.json          # Extension configuration
├── content.js             # Main dashboard and filtering logic
├── injected.js            # WebSocket interception
├── analyzer.css           # Research-focused styling
├── popup.html             # Extension popup interface
├── popup.js               # Popup functionality
├── DESIGN_PHILOSOPHY.md   # Design principles and rationale
└── README.md              # This file
```

## 🎛️ Usage Guide

### Getting Started
1. **Install the extension** using steps above
2. **Navigate to luckybird.io** and log in normally
3. **The research dashboard appears** as a sidebar automatically
4. **Messages are captured** and filtered in real-time

### Research Interface

#### **Filter Controls**
- **Message Type Dropdown**: Filter by encryption status or importance
- **Search Box**: Find specific codes, types, or content
- **Hide Heartbeats**: Checkbox to remove 3121 spam (enabled by default)
- **Errors Only**: Show only failed decryption attempts

#### **Message List**
- **Visual Indicators**: 🔐 encrypted, 📝 unencrypted, ❓ unknown, ! important
- **Color Coding**: Important messages highlighted with orange border
- **Sort Options**: Time (default), Code, or Type
- **Click to Analyze**: Select any message for detailed analysis

#### **Analysis Panel**
- **Message Structure**: Keys, nesting, data types
- **Encryption Details**: IV length, payload size, encryption status
- **JSON Viewers**: Syntax-highlighted, collapsible content
- **Copy Functions**: One-click copying for external analysis

#### **Statistics Dashboard**
- **Total Messages**: All captured traffic
- **Filtered Count**: Messages matching current filters
- **Unique Types**: Number of different message codes
- **Success Rate**: Decryption success percentage

### **Custom Message Sender**
- **Message Code**: Enter numeric code (e.g., 3121)
- **JSON Data**: Custom payload for testing
- **Send Function**: Transmit to active WebSocket

## 🔍 Message Types Identified

| Code | Type | Purpose | Frequency |
|------|------|---------|-----------|
| 3121 | Heartbeat/Ping | Keep-alive | Very High |
| 3513 | Bet Confirmation | Bet placement | High |
| 3555 | Balance Update | Account balance | High |
| 3951 | Game Result | Game outcomes | Medium |
| 3022 | Connection Status | WebSocket state | Medium |
| 3013 | System Status | System messages | Low |
| 2250 | System Event | Special events | Low |

## 🛠️ Technical Details

### **Encryption Handling**
- **Algorithm**: AES-128-CBC with PKCS#7 padding
- **Key**: `Luckybird1234567` (hardcoded, 16 bytes)
- **IV**: 32-character hex string (16 bytes)
- **Encoding**: Base64 + URL encoding

### **Performance Optimizations**
- **Display Limit**: Max 200 filtered messages for UI responsiveness
- **Memory Management**: Store up to 2000 total messages
- **Efficient Filtering**: Real-time filter application
- **Lazy Updates**: Batch UI updates for performance

### **Data Export Format**
```json
{
  "messages": [...],           // Filtered messages
  "allMessages": [...],        // Complete message history
  "statistics": {
    "totalMessages": 1234,
    "filteredMessages": 567,
    "uniqueTypes": 15,
    "messageTypes": [...],
    "messageCodes": [...]
  },
  "filters": {...},            // Applied filter settings
  "exportTime": "2024-01-01T12:00:00.000Z"
}
```

## 🔬 Research Workflow

### **Discovery Phase**
1. **Enable all filters** to see complete traffic
2. **Identify unknown codes** using the "Unknown Types" filter
3. **Analyze frequency patterns** in the statistics panel
4. **Search for specific content** using the search box

### **Analysis Phase**
1. **Filter to important messages** to focus on non-routine traffic
2. **Click messages** to examine detailed structure
3. **Compare similar codes** using the sort functions
4. **Copy JSON data** for external analysis tools

### **Documentation Phase**
1. **Export filtered data** for comprehensive analysis
2. **Document message patterns** using the structure analysis
3. **Create type mappings** based on observed behavior
4. **Generate reports** using exported JSON data

## 🎯 Design Philosophy

This tool follows a **function-first design philosophy** where every feature serves research purposes:

- **Signal vs Noise**: Default filters eliminate useless heartbeat spam
- **Information Density**: Maximum useful data in minimal screen space
- **Research Workflow**: Features designed for protocol analysis
- **Performance**: Optimized for high-volume message streams
- **Extensibility**: Modular design for future enhancements

See `DESIGN_PHILOSOPHY.md` for complete design rationale.

## 🔧 Troubleshooting

### **Extension Not Working**
1. Check extension is enabled in `chrome://extensions/`
2. Verify you're on luckybird.io domain
3. Refresh page after installing extension
4. Check browser console for error messages

### **No Messages Appearing**
1. Ensure you're logged into luckybird.io
2. Try interacting with the website (place bets, navigate)
3. Check if filters are too restrictive
4. Look for WebSocket connection in browser DevTools

### **Dashboard Not Visible**
1. Look for sidebar on right side of page
2. Click extension icon and use "Toggle Dashboard"
3. Check if dashboard is hidden off-screen
4. Try refreshing the page

### **Performance Issues**
1. Clear messages if list becomes too long
2. Use more restrictive filters to reduce displayed messages
3. Close other browser tabs to free memory
4. Restart browser if extension becomes unresponsive

## 📊 Advanced Usage

### **External Analysis Integration**
```python
# Example: Load exported data in Python
import json
with open('luckybird-research-data.json', 'r') as f:
    data = json.load(f)

# Analyze message patterns
messages = data['messages']
codes = [msg['code'] for msg in messages]
print(f"Unique codes: {set(codes)}")
```

### **Custom Message Type Mapping**
```javascript
// Add custom message types in browser console
window.wsAnalyzer.messageTypes[9999] = "Custom Test Message";
```

### **Filter Debugging**
```javascript
// Check current filter state
console.log("All messages:", window.wsAnalyzer.messages.length);
console.log("Filtered:", filteredMessages.length);
```

## ⚠️ Legal Notice

This tool is for **educational and authorized security research** purposes only. Ensure compliance with:

- Website terms of service
- Applicable laws and regulations  
- Responsible disclosure practices
- Authorized testing permissions

## 📈 Version History

- **v2.0.0**: Complete redesign with research-focused features
- **v1.0.0**: Basic WebSocket interception and display

## 🤝 Contributing

Improvements welcome for:
- Additional message type identification
- Enhanced filtering capabilities
- Performance optimizations
- Export format enhancements
- Documentation updates

---

**Version**: 2.0.0  
**License**: Educational/Research Use Only  
**Compatibility**: Chrome 88+, Edge 88+  
**Philosophy**: Function-First Research Tool

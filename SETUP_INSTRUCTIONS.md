# LuckyBird WebSocket Analyzer - Setup Instructions

## Quick Setup Guide

### Step 1: Install the Tampermonkey Script
1. Copy the contents of `luckybird-ws-enhanced-decryptor.user.js`
2. Open Tampermonkey dashboard in your browser
3. Click "Create a new script"
4. Replace the default content with the copied script
5. Save the script (Ctrl+S)

### Step 2: Open the Dashboard
1. Keep the dashboard open at `http://localhost:8000/dashboard.html`
2. The dashboard will show "Waiting for connection..." initially

### Step 3: Connect to LuckyBird
1. **In the same browser**, open a new tab and go to `https://luckybird.io`
2. The Tampermonkey script will automatically activate
3. You should see console messages like:
   ```
   🔍 Enhanced WebSocket Analyzer: Script activated
   🔌 WebSocket connection established: wss://luckybird.io:443/mqtt
   ```

### Step 4: View Messages in Dashboard
1. Go back to the dashboard tab
2. Click the "Refresh" button
3. You should now see captured messages!

## Troubleshooting

### Dashboard shows "No messages captured yet"
**Solution**: 
1. Make sure you're on luckybird.io in another tab
2. Check browser console for Tampermonkey script messages
3. Click "Refresh" button in dashboard
4. Try the debug command: `window.dashboardUtils.checkAnalyzer()`

### Script not working
**Solution**:
1. Check if Tampermonkey extension is enabled
2. Verify the script is active in Tampermonkey dashboard
3. Make sure you're on the correct domain (luckybird.io)
4. Check browser console for error messages

### No WebSocket connection
**Solution**:
1. Make sure you're logged into luckybird.io
2. Try refreshing the luckybird.io page
3. Check if the site is using a different WebSocket URL

## Debug Commands

Open browser console on the dashboard page and try:

```javascript
// Check if analyzer is connected
window.dashboardUtils.checkAnalyzer()

// Simulate a test message
window.dashboardUtils.simulateMessage(3121, {test: "hello"})

// Check current messages
console.log("Messages:", window.dashboard.messages.length)
```

## Expected Console Output

When working correctly, you should see:
```
🎛️ Dashboard initialized - Enhanced version
🔗 Found wsAnalyzer in current window
📊 Loaded X messages from analyzer
```

## Message Types You'll See

Based on your console log, expect these message types:
- **3121**: Heartbeat/Ping (most frequent)
- **3513**: Bet Confirmation
- **3555**: Balance Update  
- **3951**: Game Result
- **3022**: Connection Status
- **3013**: System Status

## Tips

1. **Keep both tabs open**: Dashboard and luckybird.io need to be in the same browser
2. **Refresh dashboard**: Click refresh button to sync with latest messages
3. **Check console**: Browser console shows detailed debug information
4. **Export data**: Use export button to save captured messages for analysis

---

**Need Help?** Check the browser console for detailed error messages and debug information.

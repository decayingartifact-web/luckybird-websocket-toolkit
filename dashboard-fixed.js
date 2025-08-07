// Dashboard JavaScript for LuckyBird WebSocket Analyzer
class WebSocketDashboard {
    constructor() {
        this.messages = [];
        this.selectedMessage = null;
        this.statistics = {
            totalMessages: 0,
            encryptedMessages: 0,
            decryptedMessages: 0,
            messagesPerSecond: 0,
            decryptionRate: 0
        };
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupWebSocketListeners();
        this.startPeriodicUpdates();
        this.updateConnectionStatus(false);
        this.checkForAnalyzer();
        
        console.log("🎛️ Dashboard initialized - Enhanced version");
    }

    setupEventListeners() {
        // Control buttons
        document.getElementById('refreshBtn').addEventListener('click', () => this.refreshMessages());
        document.getElementById('clearBtn').addEventListener('click', () => this.clearMessages());
        document.getElementById('exportBtn').addEventListener('click', () => this.exportData());
        document.getElementById('copyBtn').addEventListener('click', () => this.copySelectedMessage());
        
        // Message sender
        document.getElementById('sendBtn').addEventListener('click', () => this.sendCustomMessage());
        document.getElementById('validateBtn').addEventListener('click', () => this.validateJSON());
        
        this.autoRefresh = true;
    }

    setupWebSocketListeners() {
        // Listen for decrypted messages from the userscript
        window.addEventListener('wsMessageDecrypted', (event) => {
            console.log("📨 Dashboard received decrypted message:", event.detail);
            this.handleNewMessage(event.detail);
        });

        // Listen for unencrypted messages
        window.addEventListener('wsMessageUnencrypted', (event) => {
            console.log("📨 Dashboard received unencrypted message:", event.detail);
            this.handleUnencryptedMessage(event.detail);
        });

        // Listen for BroadcastChannel messages
        if ('BroadcastChannel' in window) {
            this.bc = new BroadcastChannel('luckybird-ws-channel');
            this.bc.onmessage = (event) => {
                const msg = event.data;
                if (msg.type === 'decrypted') {
                    console.log("📡 BroadcastChannel decrypted message received", msg.data);
                    this.handleNewMessage(msg.data);
                } else if (msg.type === 'unencrypted') {
                    console.log("📡 BroadcastChannel unencrypted message received", msg.data);
                    this.handleUnencryptedMessage(msg.data);
                }
            };
        } else {
            console.warn("⚠️ BroadcastChannel not supported in this browser");
        }

        this.checkWebSocketAnalyzer();
    }

    checkForAnalyzer() {
        // Try to connect to parent window if in iframe
        if (window.parent && window.parent !== window) {
            try {
                if (window.parent.wsAnalyzer) {
                    console.log("🔗 Found wsAnalyzer in parent window");
                    this.connectToAnalyzer(window.parent.wsAnalyzer);
                    return;
                }
            } catch (e) {
                console.log("❌ Cannot access parent window:", e.message);
            }
        }

        // Try to find analyzer in current window
        if (window.wsAnalyzer) {
            console.log("🔗 Found wsAnalyzer in current window");
            this.connectToAnalyzer(window.wsAnalyzer);
        } else {
            console.log("⏳ wsAnalyzer not found, will keep checking...");
        }
    }

    connectToAnalyzer(analyzer) {
        this.wsAnalyzer = analyzer;
        this.updateConnectionStatus(true);
        this.loadExistingMessages();
        
        // Set up polling for new messages since events might not cross contexts
        this.startMessagePolling();
    }

    startMessagePolling() {
        setInterval(() => {
            if (this.wsAnalyzer && this.wsAnalyzer.messages) {
                const currentCount = this.messages.length;
                const analyzerCount = this.wsAnalyzer.messages.length;
                
                if (analyzerCount > currentCount) {
                    console.log(`📊 New messages detected: ${analyzerCount - currentCount}`);
                    this.loadExistingMessages();
                }
            }
        }, 2000); // Check every 2 seconds
    }

    checkWebSocketAnalyzer() {
        if (window.wsAnalyzer) {
            this.connectToAnalyzer(window.wsAnalyzer);
        } else {
            // Retry every 2 seconds
            setTimeout(() => this.checkWebSocketAnalyzer(), 2000);
        }
    }

    loadExistingMessages() {
        if (this.wsAnalyzer && this.wsAnalyzer.messages) {
            // Only update if we have new messages
            if (this.wsAnalyzer.messages.length !== this.messages.length) {
                this.messages = [...this.wsAnalyzer.messages];
                this.updateMessageList();
                this.updateStatistics();
                console.log(`📊 Loaded ${this.messages.length} messages from analyzer`);
            }
        }
    }

    handleNewMessage(messageData) {
        console.log("🆕 Handling new message:", messageData);
        this.messages.unshift(messageData);
        
        // Keep only recent messages for performance
        if (this.messages.length > 1000) {
            this.messages = this.messages.slice(0, 1000);
        }
        
        if (this.autoRefresh) {
            this.updateMessageList();
            this.updateStatistics();
        }
        
        this.updateConnectionStatus(true);
    }

    handleUnencryptedMessage(messageData) {
        console.log("📝 Unencrypted message received:", messageData);
        
        // Create a message object similar to encrypted ones
        const analysis = {
            timestamp: messageData.timestamp,
            code: messageData.data.code,
            messageType: this.getMessageType(messageData.data.code),
            dataSize: JSON.stringify(messageData.data).length,
            ivLength: 0,
            encryptedSize: 0,
            decrypted: messageData.data,
            encrypted: null
        };
        
        this.handleNewMessage(analysis);
    }

    getMessageType(code) {
        const messageTypes = {
            3121: "Heartbeat/Ping",
            3013: "System Status",
            3513: "Bet Confirmation",
            3555: "Balance Update",
            3012: "Connection Info",
            3944: "Game Event",
            3409: "User Action",
            3917: "Game State",
            3957: "Result Update",
            3122: "Session Info",
            3951: "Game Result",
            3531: "Transaction",
            3925: "Status Update",
            3022: "Connection Status",
            3054: "Chat/Social",
            2250: "System Event"
        };
        
        return messageTypes[code] || "Unknown";
    }

    updateConnectionStatus(connected) {
        const statusDot = document.getElementById('connectionStatus');
        const statusText = document.getElementById('statusText');
        
        if (connected) {
            statusDot.className = 'status-dot connected';
            statusText.textContent = 'Connected & Analyzing';
        } else {
            statusDot.className = 'status-dot disconnected';
            statusText.textContent = 'Waiting for connection...';
        }
    }

    updateMessageList() {
        const messageList = document.getElementById('messageList');
        
        if (this.messages.length === 0) {
            messageList.innerHTML = `
                <div class="empty-state">
                    <p>No messages captured yet</p>
                    <p class="empty-hint">Open luckybird.io in another tab with the Tampermonkey script active</p>
                    <p class="empty-hint">Then refresh this dashboard to see messages</p>
                </div>
            `;
            return;
        }

        const messagesHTML = this.messages.map((msg, index) => {
            const time = new Date(msg.timestamp).toLocaleTimeString();
            const isSelected = this.selectedMessage === index;
            
            return `
                <div class="message-item ${isSelected ? 'selected' : ''}" data-index="${index}">
                    <div class="message-header">
                        <span class="message-code">Code: ${msg.code}</span>
                        <span class="message-time">${time}</span>
                    </div>
                    <div class="message-type">${msg.messageType}</div>
                    <div class="message-size">${msg.dataSize} bytes</div>
                </div>
            `;
        }).join('');

        messageList.innerHTML = messagesHTML;

        // Add click listeners to message items
        messageList.querySelectorAll('.message-item').forEach(item => {
            item.addEventListener('click', () => {
                const index = parseInt(item.dataset.index);
                this.selectMessage(index);
            });
        });
    }

    selectMessage(index) {
        this.selectedMessage = index;
        this.updateMessageList();
        this.displayMessageDetails(this.messages[index]);
    }

    displayMessageDetails(message) {
        const detailContent = document.getElementById('detailContent');
        
        const decryptedJSON = this.formatJSON(message.decrypted);
        const encryptedJSON = message.encrypted ? this.formatJSON(message.encrypted) : '<span class="json-null">No encryption (unencrypted message)</span>';
        
        detailContent.innerHTML = `
            <div class="message-detail">
                <h4>Message Analysis</h4>
                <div class="detail-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px;">
                    <div class="detail-item">
                        <strong>Code:</strong> ${message.code}
                    </div>
                    <div class="detail-item">
                        <strong>Type:</strong> ${message.messageType}
                    </div>
                    <div class="detail-item">
                        <strong>Timestamp:</strong> ${new Date(message.timestamp).toLocaleString()}
                    </div>
                    <div class="detail-item">
                        <strong>Data Size:</strong> ${message.dataSize} bytes
                    </div>
                    <div class="detail-item">
                        <strong>IV Length:</strong> ${message.ivLength} chars
                    </div>
                    <div class="detail-item">
                        <strong>Encrypted Size:</strong> ${message.encryptedSize} chars
                    </div>
                </div>
                
                <h4 style="margin-top: 24px;">Decrypted Content</h4>
                <div class="json-viewer">${decryptedJSON}</div>
                
                <h4 style="margin-top: 24px;">Encrypted Payload</h4>
                <div class="json-viewer">${encryptedJSON}</div>
            </div>
        `;
    }

    formatJSON(obj) {
        const json = JSON.stringify(obj, null, 2);
        return json
            .replace(/(".*?")/g, '<span class="json-key">$1</span>')
            .replace(/: (".*?")/g, ': <span class="json-string">$1</span>')
            .replace(/: (\d+)/g, ': <span class="json-number">$1</span>')
            .replace(/: (true|false)/g, ': <span class="json-boolean">$1</span>')
            .replace(/: (null)/g, ': <span class="json-null">$1</span>');
    }

    updateStatistics() {
        if (this.wsAnalyzer && this.wsAnalyzer.getStats) {
            const stats = this.wsAnalyzer.getStats();
            
            document.getElementById('totalMessages').textContent = stats.totalMessages;
            document.getElementById('encryptedMessages').textContent = stats.encryptedMessages;
            document.getElementById('decryptionRate').textContent = stats.decryptionSuccessRate + '%';
            document.getElementById('messagesPerSecond').textContent = stats.messagesPerSecond;
            
            this.updateMessageTypes(stats.topMessageTypes);
        } else {
            // Use local statistics if analyzer not available
            const total = this.messages.length;
            const encrypted = this.messages.filter(m => m.encrypted).length;
            const rate = encrypted > 0 ? ((encrypted / encrypted) * 100).toFixed(1) : '0.0';
            
            document.getElementById('totalMessages').textContent = total;
            document.getElementById('encryptedMessages').textContent = encrypted;
            document.getElementById('decryptionRate').textContent = rate + '%';
            document.getElementById('messagesPerSecond').textContent = '0.0';
        }
    }

    updateMessageTypes(topTypes) {
        const grid = document.getElementById('messageTypesGrid');
        
        if (!topTypes || topTypes.length === 0) {
            // Generate from local messages if no stats available
            const typeCounts = {};
            this.messages.forEach(msg => {
                typeCounts[msg.code] = (typeCounts[msg.code] || 0) + 1;
            });
            
            const localTypes = Object.entries(typeCounts)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 10)
                .map(([code, count]) => ({
                    code: parseInt(code),
                    type: this.getMessageType(parseInt(code)),
                    count: count
                }));
            
            if (localTypes.length === 0) {
                grid.innerHTML = `
                    <div class="empty-state">
                        <p>Message type statistics will appear here</p>
                    </div>
                `;
                return;
            }
            
            topTypes = localTypes;
        }

        const typesHTML = topTypes.map(type => `
            <div class="message-type-item">
                <div class="message-type-info">
                    <div class="message-type-name">${type.type}</div>
                    <div class="message-type-code">Code: ${type.code}</div>
                </div>
                <div class="message-type-count">${type.count}</div>
            </div>
        `).join('');

        grid.innerHTML = typesHTML;
    }

    refreshMessages() {
        this.loadExistingMessages();
        this.showStatus('Messages refreshed', 'success');
    }

    clearMessages() {
        if (confirm('Are you sure you want to clear all messages?')) {
            this.messages = [];
            this.selectedMessage = null;
            
            if (this.wsAnalyzer && this.wsAnalyzer.clearData) {
                this.wsAnalyzer.clearData();
            }
            
            this.updateMessageList();
            this.updateStatistics();
            
            document.getElementById('detailContent').innerHTML = `
                <div class="welcome-message">
                    <h4>Messages Cleared</h4>
                    <p>All message data has been cleared. New messages will appear as they are captured.</p>
                </div>
            `;
            
            this.showStatus('All messages cleared', 'success');
        }
    }

    exportData() {
        const data = {
            messages: this.messages,
            statistics: this.wsAnalyzer ? this.wsAnalyzer.getStats() : this.getLocalStats(),
            exportTime: new Date().toISOString(),
            messageCount: this.messages.length
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `luckybird-websocket-analysis-${new Date().toISOString().slice(0, 19)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showStatus('Data exported successfully', 'success');
    }

    getLocalStats() {
        const total = this.messages.length;
        const encrypted = this.messages.filter(m => m.encrypted).length;
        return {
            totalMessages: total,
            encryptedMessages: encrypted,
            decryptedMessages: encrypted,
            decryptionSuccessRate: encrypted > 0 ? '100.0' : '0.0',
            messagesPerSecond: '0.0'
        };
    }

    copySelectedMessage() {
        if (this.selectedMessage !== null && this.messages[this.selectedMessage]) {
            const message = this.messages[this.selectedMessage];
            const text = JSON.stringify(message.decrypted, null, 2);
            
            navigator.clipboard.writeText(text).then(() => {
                this.showStatus('Message copied to clipboard', 'success');
            }).catch(() => {
                this.showStatus('Failed to copy message', 'error');
            });
        } else {
            this.showStatus('No message selected', 'error');
        }
    }

    validateJSON() {
        const textarea = document.getElementById('messageData');
        const data = textarea.value.trim();
        
        if (!data) {
            this.showSenderStatus('Please enter JSON data', 'error');
            return;
        }
        
        try {
            JSON.parse(data);
            this.showSenderStatus('JSON is valid', 'success');
        } catch (e) {
            this.showSenderStatus(`Invalid JSON: ${e.message}`, 'error');
        }
    }

    sendCustomMessage() {
        const codeInput = document.getElementById('messageCode');
        const dataInput = document.getElementById('messageData');
        
        const code = parseInt(codeInput.value);
        const dataText = dataInput.value.trim();
        
        if (!code) {
            this.showSenderStatus('Please enter a message code', 'error');
            return;
        }
        
        let data = {};
        if (dataText) {
            try {
                data = JSON.parse(dataText);
            } catch (e) {
                this.showSenderStatus(`Invalid JSON: ${e.message}`, 'error');
                return;
            }
        }
        
        const message = { code, data };
        
        if (this.wsAnalyzer && this.wsAnalyzer.sendMessage) {
            const success = this.wsAnalyzer.sendMessage(message);
            if (success) {
                this.showSenderStatus('Message sent successfully', 'success');
                codeInput.value = '';
                dataInput.value = '';
            } else {
                this.showSenderStatus('Failed to send message: No active connection', 'error');
            }
        } else {
            this.showSenderStatus('Failed to send message: WebSocket analyzer not available', 'error');
        }
    }

    showStatus(message, type) {
        console.log(`${type.toUpperCase()}: ${message}`);
    }

    showSenderStatus(message, type) {
        const statusDiv = document.getElementById('senderStatus');
        statusDiv.textContent = message;
        statusDiv.className = `sender-status ${type}`;
        
        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 5000);
    }

    startPeriodicUpdates() {
        // Update statistics every 5 seconds
        setInterval(() => {
            if (this.autoRefresh) {
                this.updateStatistics();
            }
        }, 5000);
        
        // Check for analyzer connection every 10 seconds
        setInterval(() => {
            if (!this.wsAnalyzer) {
                this.checkForAnalyzer();
            }
        }, 10000);
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new WebSocketDashboard();
});

// Debugging utilities
window.dashboardUtils = {
    simulateMessage: (code = 3121, data = { test: true }) => {
        const mockMessage = {
            timestamp: Date.now(),
            code: code,
            messageType: window.dashboard.getMessageType(code),
            dataSize: JSON.stringify(data).length,
            ivLength: 32,
            encryptedSize: 128,
            decrypted: { code, data },
            encrypted: { iv: "test-iv", detail: "test-encrypted-data" }
        };
        
        window.dashboard.handleNewMessage(mockMessage);
    },
    
    checkAnalyzer: () => {
        console.log("wsAnalyzer available:", !!window.wsAnalyzer);
        if (window.wsAnalyzer) {
            console.log("Messages in analyzer:", window.wsAnalyzer.messages?.length || 0);
            console.log("Stats:", window.wsAnalyzer.getStats?.());
        }
    }
};

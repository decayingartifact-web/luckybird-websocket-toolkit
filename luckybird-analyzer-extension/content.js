// Content script that injects the analyzer and creates the dashboard overlay
(function() {
    'use strict';

    console.log("🎛️ LuckyBird Analyzer Extension: Content script loaded");

    // Inject the analyzer script into the page context
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('injected.js');
    script.onload = function() {
        this.remove();
    };
    (document.head || document.documentElement).appendChild(script);

    // Storage for messages
    let messages = [];
    let filteredMessages = [];
    let isVisible = false;
    let selectedMessageType = 'all';
    let searchTerm = '';
    let hideHeartbeats = true;

    // Listen for messages from the injected script
    window.addEventListener('message', function(event) {
        if (event.source !== window) return;
        
        if (event.data.type === 'WS_ANALYZER_MESSAGE') {
            messages.unshift(event.data.data);
            if (messages.length > 1000) {
                messages.pop();
            }
            updateDashboard();
        }
    });

    // Create dashboard overlay
    function createDashboard() {
        const dashboard = document.createElement('div');
        dashboard.id = 'ws-analyzer-dashboard';
        dashboard.innerHTML = `
            <div class="ws-analyzer-header">
                <h3>🔍 WebSocket Analyzer</h3>
                <div class="ws-analyzer-controls">
                    <button id="ws-analyzer-toggle">Hide</button>
                    <button id="ws-analyzer-clear">Clear</button>
                    <button id="ws-analyzer-export">Export</button>
                </div>
            </div>
            <div class="ws-analyzer-stats">
                <div class="stat-item">
                    <span class="stat-value" id="total-messages">0</span>
                    <span class="stat-label">Total</span>
                </div>
                <div class="stat-item">
                    <span class="stat-value" id="encrypted-messages">0</span>
                    <span class="stat-label">Encrypted</span>
                </div>
                <div class="stat-item">
                    <span class="stat-value" id="success-rate">0%</span>
                    <span class="stat-label">Success</span>
                </div>
            </div>
            <div class="ws-analyzer-content">
                <div class="message-list" id="message-list">
                    <div class="empty-state">No messages captured yet</div>
                </div>
                <div class="message-detail" id="message-detail">
                    <div class="welcome-message">
                        <h4>WebSocket Analyzer Active</h4>
                        <p>Messages will appear here as they are intercepted.</p>
                        <p>Click on any message to view details.</p>
                    </div>
                </div>
            </div>
            <div class="ws-analyzer-sender">
                <input type="number" id="message-code" placeholder="Message Code (e.g., 3121)" />
                <textarea id="message-data" placeholder='{"example": "data"}'></textarea>
                <button id="send-message">Send</button>
            </div>
        `;

        document.body.appendChild(dashboard);

        // Add event listeners
        document.getElementById('ws-analyzer-toggle').addEventListener('click', toggleDashboard);
        document.getElementById('ws-analyzer-clear').addEventListener('click', clearMessages);
        document.getElementById('ws-analyzer-export').addEventListener('click', exportData);
        document.getElementById('send-message').addEventListener('click', sendCustomMessage);

        return dashboard;
    }

    // Toggle dashboard visibility
    function toggleDashboard() {
        const dashboard = document.getElementById('ws-analyzer-dashboard');
        const toggleBtn = document.getElementById('ws-analyzer-toggle');
        
        if (isVisible) {
            dashboard.style.transform = 'translateX(100%)';
            toggleBtn.textContent = 'Show';
            isVisible = false;
        } else {
            dashboard.style.transform = 'translateX(0)';
            toggleBtn.textContent = 'Hide';
            isVisible = true;
        }
    }

    // Update dashboard with new data
    function updateDashboard() {
        // Update statistics
        if (window.wsAnalyzer && window.wsAnalyzer.getStats) {
            const stats = window.wsAnalyzer.getStats();
            document.getElementById('total-messages').textContent = stats.totalMessages;
            document.getElementById('encrypted-messages').textContent = stats.encryptedMessages;
            document.getElementById('success-rate').textContent = stats.decryptionSuccessRate + '%';
        }

        // Update message list
        const messageList = document.getElementById('message-list');
        if (messages.length === 0) {
            messageList.innerHTML = '<div class="empty-state">No messages captured yet</div>';
            return;
        }

        const messagesHTML = messages.slice(0, 50).map((msg, index) => {
            const time = new Date(msg.timestamp).toLocaleTimeString();
            return `
                <div class="message-item" data-index="${index}">
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

        // Add click listeners
        messageList.querySelectorAll('.message-item').forEach(item => {
            item.addEventListener('click', () => {
                const index = parseInt(item.dataset.index);
                showMessageDetail(messages[index]);
                
                // Update selection
                messageList.querySelectorAll('.message-item').forEach(i => i.classList.remove('selected'));
                item.classList.add('selected');
            });
        });
    }

    // Show message details
    function showMessageDetail(message) {
        const detailPanel = document.getElementById('message-detail');
        const decryptedJSON = JSON.stringify(message.decrypted, null, 2);
        const encryptedJSON = message.encrypted ? JSON.stringify(message.encrypted, null, 2) : 'No encryption (unencrypted message)';
        
        detailPanel.innerHTML = `
            <div class="message-analysis">
                <h4>Message Analysis</h4>
                <div class="detail-grid">
                    <div><strong>Code:</strong> ${message.code}</div>
                    <div><strong>Type:</strong> ${message.messageType}</div>
                    <div><strong>Time:</strong> ${new Date(message.timestamp).toLocaleString()}</div>
                    <div><strong>Size:</strong> ${message.dataSize} bytes</div>
                </div>
                
                <h4>Decrypted Content</h4>
                <pre class="json-content">${decryptedJSON}</pre>
                
                <h4>Encrypted Payload</h4>
                <pre class="json-content">${encryptedJSON}</pre>
            </div>
        `;
    }

    // Clear messages
    function clearMessages() {
        if (confirm('Clear all captured messages?')) {
            messages = [];
            if (window.wsAnalyzer && window.wsAnalyzer.clearData) {
                window.wsAnalyzer.clearData();
            }
            updateDashboard();
        }
    }

    // Export data
    function exportData() {
        const data = {
            messages: messages,
            statistics: window.wsAnalyzer ? window.wsAnalyzer.getStats() : {},
            exportTime: new Date().toISOString()
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
    }

    // Send custom message
    function sendCustomMessage() {
        const codeInput = document.getElementById('message-code');
        const dataInput = document.getElementById('message-data');
        
        const code = parseInt(codeInput.value);
        const dataText = dataInput.value.trim();
        
        if (!code) {
            alert('Please enter a message code');
            return;
        }
        
        let data = {};
        if (dataText) {
            try {
                data = JSON.parse(dataText);
            } catch (e) {
                alert('Invalid JSON: ' + e.message);
                return;
            }
        }
        
        const message = { code, data };
        
        if (window.wsAnalyzer && window.wsAnalyzer.sendMessage) {
            const success = window.wsAnalyzer.sendMessage(message);
            if (success) {
                codeInput.value = '';
                dataInput.value = '';
                alert('Message sent successfully');
            } else {
                alert('Failed to send message: No active connection');
            }
        } else {
            alert('WebSocket analyzer not available');
        }
    }

    // Handle messages from popup
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        switch(request.action) {
            case 'getStats':
                const stats = window.wsAnalyzer ? window.wsAnalyzer.getStats() : {
                    totalMessages: messages.length,
                    decryptionSuccessRate: '0%'
                };
                sendResponse({stats: stats});
                break;
                
            case 'toggleDashboard':
                toggleDashboard();
                sendResponse({success: true});
                break;
                
            case 'clearData':
                clearMessages();
                sendResponse({success: true});
                break;
                
            case 'exportData':
                exportData();
                sendResponse({success: true});
                break;
        }
        return true;
    });

    // Initialize dashboard when page loads
    function initializeDashboard() {
        if (document.getElementById('ws-analyzer-dashboard')) return;
        
        createDashboard();
        isVisible = true;
        
        // Update dashboard every 2 seconds
        setInterval(updateDashboard, 2000);
        
        console.log("🎛️ Dashboard initialized");
    }

    // Wait for page to load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeDashboard);
    } else {
        initializeDashboard();
    }

})();

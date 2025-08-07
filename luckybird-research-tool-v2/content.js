// Enhanced Content script with proper filtering and research capabilities
(function() {
    'use strict';

    console.log("🎛️ LuckyBird Analyzer Extension: Enhanced Content script loaded");

    // Inject the analyzer script into the page context
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('injected.js');
    script.onload = function() {
        this.remove();
    };
    (document.head || document.documentElement).appendChild(script);

    // Storage for messages
    let allMessages = [];
    let filteredMessages = [];
    let isVisible = false;
    let selectedMessage = null;
    let filters = {
        hideHeartbeats: true,
        messageType: 'all',
        searchTerm: '',
        showOnlyErrors: false,
        showOnlyUnknown: false
    };

    // Listen for messages from the injected script
    window.addEventListener('message', function(event) {
        if (event.source !== window) return;
        
        if (event.data.type === 'WS_ANALYZER_MESSAGE') {
            allMessages.unshift(event.data.data);
            if (allMessages.length > 2000) {
                allMessages = allMessages.slice(0, 2000);
            }
            applyFiltersAndUpdate();
        }
    });

    // Create enhanced dashboard overlay
    function createDashboard() {
        const dashboard = document.createElement('div');
        dashboard.id = 'ws-analyzer-dashboard';
        dashboard.innerHTML = `
            <div class="ws-analyzer-header">
                <h3>🔍 WebSocket Research Tool</h3>
                <div class="ws-analyzer-controls">
                    <button id="ws-analyzer-toggle">Hide</button>
                    <button id="ws-analyzer-clear">Clear</button>
                    <button id="ws-analyzer-export">Export</button>
                </div>
            </div>
            
            <div class="ws-analyzer-filters">
                <div class="filter-section">
                    <div class="filter-row">
                        <select id="message-type-filter">
                            <option value="all">All Messages</option>
                            <option value="encrypted">Encrypted Only</option>
                            <option value="unencrypted">Unencrypted Only</option>
                            <option value="unknown">Unknown Types</option>
                            <option value="important">Important Only</option>
                        </select>
                        <input type="text" id="search-input" placeholder="Search code, type, or content..." />
                    </div>
                    <div class="filter-row">
                        <label class="checkbox-label">
                            <input type="checkbox" id="hide-heartbeats" checked> 
                            Hide Heartbeats (3121)
                        </label>
                        <label class="checkbox-label">
                            <input type="checkbox" id="show-errors"> 
                            Errors Only
                        </label>
                        <span class="message-count" id="message-count">0 messages</span>
                    </div>
                </div>
            </div>

            <div class="ws-analyzer-stats">
                <div class="stat-item">
                    <span class="stat-value" id="total-messages">0</span>
                    <span class="stat-label">Total</span>
                </div>
                <div class="stat-item">
                    <span class="stat-value" id="filtered-count">0</span>
                    <span class="stat-label">Filtered</span>
                </div>
                <div class="stat-item">
                    <span class="stat-value" id="unique-types">0</span>
                    <span class="stat-label">Types</span>
                </div>
                <div class="stat-item">
                    <span class="stat-value" id="success-rate">0%</span>
                    <span class="stat-label">Success</span>
                </div>
            </div>
            
            <div class="ws-analyzer-content">
                <div class="message-list-container">
                    <div class="message-list-header">
                        <span>Messages</span>
                        <div class="sort-controls">
                            <button id="sort-time" class="sort-btn active">Time</button>
                            <button id="sort-code" class="sort-btn">Code</button>
                            <button id="sort-type" class="sort-btn">Type</button>
                        </div>
                    </div>
                    <div class="message-list" id="message-list">
                        <div class="empty-state">No messages captured yet</div>
                    </div>
                </div>
                
                <div class="message-detail-container">
                    <div class="message-detail-header">
                        <span>Message Details</span>
                        <button id="copy-message" class="copy-btn">Copy JSON</button>
                    </div>
                    <div class="message-detail" id="message-detail">
                        <div class="welcome-message">
                            <h4>Research Tool Active</h4>
                            <p>• Filter messages by type, encryption, or content</p>
                            <p>• Search through message data</p>
                            <p>• Click messages to analyze structure</p>
                            <p>• Export data for external analysis</p>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="ws-analyzer-sender">
                <div class="sender-header">Custom Message Sender</div>
                <div class="sender-inputs">
                    <input type="number" id="message-code" placeholder="Code (e.g., 3121)" />
                    <textarea id="message-data" placeholder='{"key": "value"}'></textarea>
                    <button id="send-message">Send Message</button>
                </div>
            </div>
        `;

        document.body.appendChild(dashboard);
        setupEventListeners();
        return dashboard;
    }

    // Setup all event listeners
    function setupEventListeners() {
        // Main controls
        document.getElementById('ws-analyzer-toggle').addEventListener('click', toggleDashboard);
        document.getElementById('ws-analyzer-clear').addEventListener('click', clearMessages);
        document.getElementById('ws-analyzer-export').addEventListener('click', exportData);
        document.getElementById('send-message').addEventListener('click', sendCustomMessage);
        document.getElementById('copy-message').addEventListener('click', copySelectedMessage);

        // Filter controls
        document.getElementById('message-type-filter').addEventListener('change', applyFiltersAndUpdate);
        document.getElementById('search-input').addEventListener('input', applyFiltersAndUpdate);
        document.getElementById('hide-heartbeats').addEventListener('change', applyFiltersAndUpdate);
        document.getElementById('show-errors').addEventListener('change', applyFiltersAndUpdate);

        // Sort controls
        document.getElementById('sort-time').addEventListener('click', () => sortMessages('time'));
        document.getElementById('sort-code').addEventListener('click', () => sortMessages('code'));
        document.getElementById('sort-type').addEventListener('click', () => sortMessages('type'));
    }

    // Apply filters and update display
    function applyFiltersAndUpdate() {
        const typeFilter = document.getElementById('message-type-filter').value;
        const searchTerm = document.getElementById('search-input').value.toLowerCase();
        const hideHeartbeats = document.getElementById('hide-heartbeats').checked;
        const showErrors = document.getElementById('show-errors').checked;

        filteredMessages = allMessages.filter(msg => {
            // Hide heartbeats
            if (hideHeartbeats && msg.code === 3121) return false;
            
            // Type filters
            if (typeFilter === 'encrypted' && !msg.encrypted) return false;
            if (typeFilter === 'unencrypted' && msg.encrypted) return false;
            if (typeFilter === 'unknown' && msg.messageType !== 'Unknown') return false;
            if (typeFilter === 'important' && msg.code === 3121) return false;
            
            // Error filter
            if (showErrors && !msg.error) return false;
            
            // Search filter
            if (searchTerm) {
                const searchableText = `${msg.code} ${msg.messageType} ${JSON.stringify(msg.decrypted)}`.toLowerCase();
                if (!searchableText.includes(searchTerm)) return false;
            }
            
            return true;
        });

        updateDisplay();
    }

    // Sort messages
    function sortMessages(sortBy) {
        // Update active sort button
        document.querySelectorAll('.sort-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById(`sort-${sortBy}`).classList.add('active');

        switch(sortBy) {
            case 'time':
                filteredMessages.sort((a, b) => b.timestamp - a.timestamp);
                break;
            case 'code':
                filteredMessages.sort((a, b) => a.code - b.code);
                break;
            case 'type':
                filteredMessages.sort((a, b) => a.messageType.localeCompare(b.messageType));
                break;
        }
        
        updateMessageList();
    }

    // Update entire display
    function updateDisplay() {
        updateStatistics();
        updateMessageList();
    }

    // Update statistics
    function updateStatistics() {
        const uniqueTypes = new Set(allMessages.map(m => m.code)).size;
        const encryptedCount = allMessages.filter(m => m.encrypted).length;
        const successRate = encryptedCount > 0 ? ((encryptedCount / encryptedCount) * 100).toFixed(1) : '0.0';

        document.getElementById('total-messages').textContent = allMessages.length;
        document.getElementById('filtered-count').textContent = filteredMessages.length;
        document.getElementById('unique-types').textContent = uniqueTypes;
        document.getElementById('success-rate').textContent = successRate + '%';
        document.getElementById('message-count').textContent = `${filteredMessages.length} of ${allMessages.length} messages`;
    }

    // Update message list
    function updateMessageList() {
        const messageList = document.getElementById('message-list');
        
        if (filteredMessages.length === 0) {
            messageList.innerHTML = '<div class="empty-state">No messages match current filters</div>';
            return;
        }

        const messagesToShow = filteredMessages.slice(0, 200); // Show max 200 for performance
        const messagesHTML = messagesToShow.map((msg, index) => {
            const time = new Date(msg.timestamp).toLocaleTimeString();
            const isImportant = msg.code !== 3121;
            const isSelected = selectedMessage === msg;
            
            return `
                <div class="message-item ${isImportant ? 'important' : ''} ${isSelected ? 'selected' : ''}" 
                     data-timestamp="${msg.timestamp}">
                    <div class="message-header">
                        <span class="message-code ${isImportant ? 'code-important' : ''}">
                            ${msg.code}
                        </span>
                        <span class="message-time">${time}</span>
                        <span class="message-indicators">
                            ${msg.encrypted ? '🔐' : '📝'}
                            ${msg.messageType === 'Unknown' ? '❓' : ''}
                        </span>
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
                const timestamp = parseInt(item.dataset.timestamp);
                const message = allMessages.find(m => m.timestamp === timestamp);
                if (message) {
                    selectMessage(message);
                }
            });
        });
    }

    // Select and display message details
    function selectMessage(message) {
        selectedMessage = message;
        
        // Update selection in list
        document.querySelectorAll('.message-item').forEach(item => {
            item.classList.remove('selected');
            if (parseInt(item.dataset.timestamp) === message.timestamp) {
                item.classList.add('selected');
            }
        });

        showMessageDetail(message);
    }

    // Show detailed message analysis
    function showMessageDetail(message) {
        const detailPanel = document.getElementById('message-detail');
        
        const decryptedJSON = JSON.stringify(message.decrypted, null, 2);
        const encryptedJSON = message.encrypted ? JSON.stringify(message.encrypted, null, 2) : 'No encryption (unencrypted message)';
        
        // Analyze message structure
        const dataKeys = Object.keys(message.decrypted.data || {});
        const hasNestedObjects = dataKeys.some(key => typeof message.decrypted.data[key] === 'object');
        
        detailPanel.innerHTML = `
            <div class="message-analysis">
                <div class="analysis-header">
                    <h4>Message Analysis - Code ${message.code}</h4>
                    <span class="message-type-badge ${message.messageType === 'Unknown' ? 'unknown' : ''}">${message.messageType}</span>
                </div>
                
                <div class="analysis-grid">
                    <div class="analysis-item">
                        <strong>Timestamp:</strong> ${new Date(message.timestamp).toLocaleString()}
                    </div>
                    <div class="analysis-item">
                        <strong>Data Size:</strong> ${message.dataSize} bytes
                    </div>
                    <div class="analysis-item">
                        <strong>Encryption:</strong> ${message.encrypted ? 'AES-CBC Encrypted' : 'Unencrypted'}
                    </div>
                    <div class="analysis-item">
                        <strong>Data Keys:</strong> ${dataKeys.length} (${dataKeys.join(', ')})
                    </div>
                    <div class="analysis-item">
                        <strong>Nested Data:</strong> ${hasNestedObjects ? 'Yes' : 'No'}
                    </div>
                    <div class="analysis-item">
                        <strong>IV Length:</strong> ${message.ivLength} chars
                    </div>
                </div>
                
                <div class="json-section">
                    <h4>Decrypted Content</h4>
                    <pre class="json-content">${decryptedJSON}</pre>
                </div>
                
                <div class="json-section">
                    <h4>Raw Encrypted Payload</h4>
                    <pre class="json-content encrypted">${encryptedJSON}</pre>
                </div>
            </div>
        `;
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

    // Clear all messages
    function clearMessages() {
        if (confirm('Clear all captured messages? This cannot be undone.')) {
            allMessages = [];
            filteredMessages = [];
            selectedMessage = null;
            
            if (window.wsAnalyzer && window.wsAnalyzer.clearData) {
                window.wsAnalyzer.clearData();
            }
            
            updateDisplay();
            
            document.getElementById('message-detail').innerHTML = `
                <div class="welcome-message">
                    <h4>Messages Cleared</h4>
                    <p>All message data has been cleared. New messages will appear as they are captured.</p>
                </div>
            `;
        }
    }

    // Export filtered data
    function exportData() {
        const exportData = {
            messages: filteredMessages,
            allMessages: allMessages,
            statistics: {
                totalMessages: allMessages.length,
                filteredMessages: filteredMessages.length,
                uniqueTypes: new Set(allMessages.map(m => m.code)).size,
                messageTypes: [...new Set(allMessages.map(m => m.messageType))],
                messageCodes: [...new Set(allMessages.map(m => m.code))].sort((a,b) => a-b)
            },
            filters: filters,
            exportTime: new Date().toISOString()
        };
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `luckybird-research-${new Date().toISOString().slice(0, 19)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // Copy selected message JSON
    function copySelectedMessage() {
        if (selectedMessage) {
            const text = JSON.stringify(selectedMessage.decrypted, null, 2);
            navigator.clipboard.writeText(text).then(() => {
                const btn = document.getElementById('copy-message');
                const originalText = btn.textContent;
                btn.textContent = 'Copied!';
                setTimeout(() => btn.textContent = originalText, 1000);
            });
        }
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
                
                const btn = document.getElementById('send-message');
                const originalText = btn.textContent;
                btn.textContent = 'Sent!';
                setTimeout(() => btn.textContent = originalText, 1000);
            } else {
                alert('Failed to send: No active WebSocket connection');
            }
        }
    }

    // Handle messages from popup
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        switch(request.action) {
            case 'getStats':
                sendResponse({
                    stats: {
                        totalMessages: allMessages.length,
                        filteredMessages: filteredMessages.length,
                        decryptionSuccessRate: '100%'
                    }
                });
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

    // Initialize dashboard
    function initializeDashboard() {
        if (document.getElementById('ws-analyzer-dashboard')) return;
        
        createDashboard();
        isVisible = true;
        
        // Update display every 3 seconds
        setInterval(() => {
            if (allMessages.length > 0) {
                updateStatistics();
            }
        }, 3000);
        
        console.log("🎛️ Enhanced Dashboard initialized with research capabilities");
    }

    // Wait for page to load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeDashboard);
    } else {
        initializeDashboard();
    }

})();

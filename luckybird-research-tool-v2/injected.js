// Injected script that runs in the page context to intercept WebSocket traffic
(function() {
    'use strict';

    console.log("🔍 LuckyBird WebSocket Analyzer: Injected script activated");

    // Configuration
    const AES_KEY = "Luckybird1234567";
    const MAX_STORED_MESSAGES = 1000;

    // Storage
    window.wsAnalyzer = {
        messages: [],
        statistics: {
            totalMessages: 0,
            encryptedMessages: 0,
            decryptedMessages: 0,
            failedDecryptions: 0,
            messageCodes: {},
            startTime: Date.now()
        },
        messageTypes: {
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
        }
    };

    // Decryption helpers
    function utf8ToBuffer(str) { return new TextEncoder().encode(str); }
    function bufferToUtf8(buf) { return new TextDecoder('utf-8', { fatal: false }).decode(buf); }
    function hexToBuffer(hex) {
        const clean = hex.replace(/[^0-9a-fA-F]/g, '');
        const bytes = new Uint8Array(clean.length / 2);
        for (let i = 0; i < bytes.length; i++) {
            bytes[i] = parseInt(clean.substr(i * 2, 2), 16);
        }
        return bytes.buffer;
    }
    function base64ToArrayBuffer(b64) {
        const bin = atob(b64.replace(/-/g, '+').replace(/_/g, '/'));
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) {
            bytes[i] = bin.charCodeAt(i);
        }
        return bytes.buffer;
    }

    // Decryption function
    async function decryptAES(encObj) {
        try {
            const ivBuf = hexToBuffer(encObj.iv);
            const encBuf = base64ToArrayBuffer(decodeURIComponent(encObj.detail));
            const keyBuf = utf8ToBuffer(AES_KEY);
            const cryptoKey = await crypto.subtle.importKey("raw", keyBuf, { name: "AES-CBC" }, false, ["decrypt"]);
            const decBuf = await crypto.subtle.decrypt({ name: "AES-CBC", iv: ivBuf }, cryptoKey, encBuf);
            const decTxt = bufferToUtf8(decBuf);
            return JSON.parse(decTxt);
        } catch (e) {
            console.error("🔴 DECRYPTION FAILED:", e);
            window.wsAnalyzer.statistics.failedDecryptions++;
            throw e;
        }
    }

    // Message analysis
    function analyzeMessage(decrypted, encrypted, timestamp) {
        const analysis = {
            timestamp: timestamp,
            code: decrypted.code,
            messageType: window.wsAnalyzer.messageTypes[decrypted.code] || "Unknown",
            dataSize: JSON.stringify(decrypted.data).length,
            ivLength: encrypted.iv ? encrypted.iv.length : 0,
            encryptedSize: encrypted.detail ? encrypted.detail.length : 0,
            decrypted: decrypted,
            encrypted: encrypted
        };

        // Update statistics
        const stats = window.wsAnalyzer.statistics;
        stats.messageCodes[decrypted.code] = (stats.messageCodes[decrypted.code] || 0) + 1;

        return analysis;
    }

    // Message handler
    async function handleIncomingMessage(data) {
        const timestamp = Date.now();
        window.wsAnalyzer.statistics.totalMessages++;

        try {
            let messageText;
            if (data instanceof ArrayBuffer) {
                messageText = new TextDecoder("utf-8").decode(data);
            } else {
                messageText = data;
            }

            if (!messageText.includes('{')) return;

            const jsonStart = messageText.indexOf('{');
            const jsonString = messageText.substring(jsonStart);
            let parsedData = JSON.parse(jsonString);

            // Check if encrypted
            if (parsedData.iv && parsedData.detail) {
                window.wsAnalyzer.statistics.encryptedMessages++;
                
                console.log(`🔐 [ENCRYPTED] Code: Unknown, IV: ${parsedData.iv.substring(0,8)}...`);
                
                try {
                    const decrypted = await decryptAES(parsedData);
                    window.wsAnalyzer.statistics.decryptedMessages++;
                    
                    const analysis = analyzeMessage(decrypted, parsedData, timestamp);
                    
                    console.log(`✅ [DECRYPTED] Code: ${decrypted.code} (${analysis.messageType})`);

                    // Store message
                    window.wsAnalyzer.messages.unshift(analysis);
                    if (window.wsAnalyzer.messages.length > MAX_STORED_MESSAGES) {
                        window.wsAnalyzer.messages.pop();
                    }

                    // Notify extension
                    window.postMessage({
                        type: 'WS_ANALYZER_MESSAGE',
                        data: analysis
                    }, '*');

                } catch (decryptError) {
                    console.error(`❌ [DECRYPT FAILED] IV: ${parsedData.iv.substring(0,8)}...`, decryptError);
                }
            } else {
                // Unencrypted message
                console.log(`📝 [UNENCRYPTED]`, parsedData);
                
                const analysis = {
                    timestamp: timestamp,
                    code: parsedData.code,
                    messageType: window.wsAnalyzer.messageTypes[parsedData.code] || "Unknown",
                    dataSize: JSON.stringify(parsedData).length,
                    ivLength: 0,
                    encryptedSize: 0,
                    decrypted: parsedData,
                    encrypted: null
                };

                window.wsAnalyzer.messages.unshift(analysis);
                if (window.wsAnalyzer.messages.length > MAX_STORED_MESSAGES) {
                    window.wsAnalyzer.messages.pop();
                }

                // Notify extension
                window.postMessage({
                    type: 'WS_ANALYZER_MESSAGE',
                    data: analysis
                }, '*');
            }

        } catch (error) {
            // Silent fail for non-JSON messages
        }
    }

    // WebSocket override
    const OriginalWebSocket = window.WebSocket;
    window.WebSocket = function(url, protocols) {
        const ws = new OriginalWebSocket(url, protocols);
        
        console.log(`🔌 WebSocket connection established: ${url}`);
        
        ws.addEventListener('message', event => {
            handleIncomingMessage(event.data);
        });

        // Store WebSocket reference
        window.wsAnalyzer.activeWebSocket = ws;
        
        return ws;
    };
    window.WebSocket.prototype = OriginalWebSocket.prototype;

    // Statistics functions
    window.wsAnalyzer.getStats = function() {
        const stats = window.wsAnalyzer.statistics;
        const runtime = (Date.now() - stats.startTime) / 1000;
        
        return {
            ...stats,
            runtime: runtime,
            messagesPerSecond: (stats.totalMessages / runtime).toFixed(2),
            decryptionSuccessRate: stats.encryptedMessages > 0 ? 
                ((stats.decryptedMessages / stats.encryptedMessages) * 100).toFixed(1) : '0.0',
            topMessageTypes: Object.entries(stats.messageCodes)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 10)
                .map(([code, count]) => ({
                    code: parseInt(code),
                    type: window.wsAnalyzer.messageTypes[code] || "Unknown",
                    count: count
                }))
        };
    };

    // Send custom message
    window.wsAnalyzer.sendMessage = function(messageObj) {
        if (window.wsAnalyzer.activeWebSocket && window.wsAnalyzer.activeWebSocket.readyState === WebSocket.OPEN) {
            const messageStr = JSON.stringify(messageObj);
            window.wsAnalyzer.activeWebSocket.send(messageStr);
            console.log("📤 [SENT MESSAGE]", messageObj);
            return true;
        } else {
            console.error("❌ No active WebSocket connection");
            return false;
        }
    };

    // Clear data
    window.wsAnalyzer.clearData = function() {
        window.wsAnalyzer.messages = [];
        window.wsAnalyzer.statistics = {
            totalMessages: 0,
            encryptedMessages: 0,
            decryptedMessages: 0,
            failedDecryptions: 0,
            messageCodes: {},
            startTime: Date.now()
        };
        console.log("🧹 Data cleared");
    };

    console.log("🚀 WebSocket Analyzer ready!");

})();

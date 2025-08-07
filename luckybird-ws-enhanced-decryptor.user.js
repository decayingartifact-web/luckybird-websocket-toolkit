// ==UserScript==
// @name         LuckyBird Enhanced WebSocket Analyzer
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Advanced WebSocket interceptor with message categorization, statistics, and real-time analysis
// @author       WebSocket Reverse Engineer
// @match        https://luckybird.io/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    console.log("🔍 Enhanced WebSocket Analyzer: Script activated");

    // --- CONFIGURATION ---
    const AES_KEY = "Luckybird1234567";
    const MAX_STORED_MESSAGES = 1000;

    // --- GLOBAL STORAGE ---
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
            // Based on observed codes from console data
            3547: "Game State Update",
            3599: "Player Action Response", 
            3555: "Balance Update",
            3513: "Bet Confirmation",
            3951: "Game Result",
            3022: "Connection Status",
            4033: "Error Response",
            3120: "Heartbeat/Ping",
            3053: "Chat Message",
            3078: "User Status",
            3052: "Room Update",
            3700: "Bonus/Reward",
            4020: "Transaction Update",
            3803: "Game History",
            1080: "Authentication",
            3029: "Settings Update",
            3117: "Notification",
            3574: "Leaderboard",
            3505: "Achievement",
            3030: "System Message"
        }
    };

    // --- BROADCAST CHANNEL ---
    const bc = new BroadcastChannel('luckybird-ws-channel');

    // --- DECRYPTION HELPERS ---
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

    // --- ENHANCED DECRYPTION ---
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
            console.error("🔴 DECRYPTION FAILED:", e, "Encrypted Object:", encObj);
            window.wsAnalyzer.statistics.failedDecryptions++;
            throw e;
        }
    }

    // --- MESSAGE ANALYSIS ---
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

    // --- ENHANCED MESSAGE HANDLER ---
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
                
                console.log(`🔐 [ENCRYPTED DETECTED] Code: Unknown, IV: ${parsedData.iv.substring(0,8)}...`, parsedData);
                
                try {
                    const decrypted = await decryptAES(parsedData);
                    window.wsAnalyzer.statistics.decryptedMessages++;
                    
                    const analysis = analyzeMessage(decrypted, parsedData, timestamp);
                    
                    console.log(`✅ [DECRYPTED] Code: ${decrypted.code} (${analysis.messageType})`, decrypted);
                    console.log(`📊 [ANALYSIS]`, {
                        messageType: analysis.messageType,
                        dataSize: analysis.dataSize,
                        frequency: window.wsAnalyzer.statistics.messageCodes[decrypted.code]
                    });

                    // Store message (keep only recent messages)
                    window.wsAnalyzer.messages.unshift(analysis);
                    if (window.wsAnalyzer.messages.length > MAX_STORED_MESSAGES) {
                        window.wsAnalyzer.messages.pop();
                    }

                    // Dispatch custom event for dashboard
                    window.dispatchEvent(new CustomEvent('wsMessageDecrypted', { 
                        detail: analysis 
                    }));

                    // Broadcast message to other tabs
                    bc.postMessage({ type: 'decrypted', data: analysis });

                } catch (decryptError) {
                    console.error(`❌ [DECRYPT FAILED] IV: ${parsedData.iv.substring(0,8)}...`, decryptError);
                }
            } else {
            // Unencrypted message
            console.log(`📝 [UNENCRYPTED]`, parsedData);
            
            window.dispatchEvent(new CustomEvent('wsMessageUnencrypted', { 
                detail: { timestamp, data: parsedData }
            }));

            // Broadcast unencrypted message
            bc.postMessage({ type: 'unencrypted', data: { timestamp, data: parsedData } });
            }

        } catch (error) {
            // Silent fail for non-JSON messages
        }
    }

    // --- STATISTICS FUNCTIONS ---
    window.wsAnalyzer.getStats = function() {
        const stats = window.wsAnalyzer.statistics;
        const runtime = (Date.now() - stats.startTime) / 1000;
        
        return {
            ...stats,
            runtime: runtime,
            messagesPerSecond: (stats.totalMessages / runtime).toFixed(2),
            decryptionSuccessRate: ((stats.decryptedMessages / stats.encryptedMessages) * 100).toFixed(1),
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

    window.wsAnalyzer.exportData = function() {
        return {
            messages: window.wsAnalyzer.messages,
            statistics: window.wsAnalyzer.getStats(),
            messageTypes: window.wsAnalyzer.messageTypes,
            exportTime: new Date().toISOString()
        };
    };

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

    // --- WEBSOCKET OVERRIDE ---
    const OriginalWebSocket = window.WebSocket;
    window.WebSocket = function(url, protocols) {
        const ws = new OriginalWebSocket(url, protocols);
        
        console.log(`🔌 WebSocket connection established: ${url}`);
        
        ws.addEventListener('message', event => {
            handleIncomingMessage(event.data);
        });

        // Store WebSocket reference for sending custom messages
        window.wsAnalyzer.activeWebSocket = ws;
        
        return ws;
    };
    window.WebSocket.prototype = OriginalWebSocket.prototype;

    // --- CUSTOM MESSAGE SENDING ---
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

    // --- PERIODIC STATS LOGGING ---
    setInterval(() => {
        const stats = window.wsAnalyzer.getStats();
        console.log(`📈 [STATS] Messages: ${stats.totalMessages}, Encrypted: ${stats.encryptedMessages}, Success Rate: ${stats.decryptionSuccessRate}%`);
    }, 30000); // Every 30 seconds

    console.log("🚀 Enhanced WebSocket Analyzer ready! Use window.wsAnalyzer for advanced features.");

})();

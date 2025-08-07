// ==UserScript==
// @name         Bird swiss army knife
// @namespace    http://tampermonkey.net/
// @version      9.2.5
// @description  Processes messages, persists data in IndexedDB, updates player balances with timestamps (big wins update balance), records tip events (with tip totals in USD and GOLD), provides modals (player detail, players list, all balances table), stacks notifications, adds a reset button to top balances (showing only those updated in the past 2 hours), and prevents duplicate bet events (if repeated within 30 seconds). Notifications for messages with code 3513 are suppressed.
// @match        https://luckybird.io/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // -------------------- CONFIG --------------------
    const DEBUG_MODE = true;
    const AES_KEY = "Luckybird1234567";
    const CUSTOM_SOUND_URL = "https://actions.google.com/sounds/v1/cartoon/clang_and_wobble.ogg";
    const BIG_WIN_THRESHOLD = 1000;
    const DUPLICATE_THRESHOLD_MS = 1000;
    const SUPPRESS_CODE = 3513;  // messages with this code won't trigger notifications
    const BET_DUPLICATE_TIME_THRESHOLD_MS = 30000; // 30 seconds time window for duplicate bets

    // -------------------- GLOBALS --------------------
    let pastDrops = [];
    let totalAmounts = {};
    let notificationsArchive = [];
    let tipTotals = {};  // e.g., { usd: 10.0, gold: 5.0 }
    let playersMap = {}; // key: uid
    let trackedPlayers = new Set();
    let actionsMap = {};
    let processedBetIds = new Set();
    let processedDrops = new Set();  // track coin drop events by rain_id

    // Use a Map to store bet signatures with the timestamp of processing
    let processedBetSignatures = new Map();

    // -------------------- UI REFERENCES --------------------
    let playersModal = null;
    let playerDetailModal = null;
    let allBalancesModal = null;
    let topBalancesContainer = null;
    let currentDetailUID = null;

    // -------------------- NOTIFICATION CONTAINER --------------------
    let notificationContainer = document.getElementById('notification-container');
    if (!notificationContainer) {
        notificationContainer = document.createElement('div');
        notificationContainer.id = 'notification-container';
        Object.assign(notificationContainer.style, {
            position: 'fixed',
            top: '10px',
            right: '10px',
            zIndex: 15000,
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            alignItems: 'flex-end',
            pointerEvents: 'none'
        });
        document.body.appendChild(notificationContainer);
    }

    // -------------------- INDEXEDDB SETUP --------------------
    let db;
    function openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open("coinDropDB", 1);
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains("persistence")) {
                    db.createObjectStore("persistence", { keyPath: "key" });
                }
                if (!db.objectStoreNames.contains("players")) {
                    db.createObjectStore("players", { keyPath: "uid" });
                }
            };
            request.onsuccess = () => {
                db = request.result;
                resolve(db);
            };
            request.onerror = () => reject(request.error);
        });
    }
    function getPersistence(key) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction("persistence", "readonly");
            const store = tx.objectStore("persistence");
            const req = store.get(key);
            req.onsuccess = () => resolve(req.result ? req.result.value : null);
            req.onerror = () => reject(req.error);
        });
    }
    function setPersistence(key, value) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction("persistence", "readwrite");
            const store = tx.objectStore("persistence");
            const req = store.put({ key, value });
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    }
    async function loadPersistence() {
        try {
            pastDrops = (await getPersistence("pastDrops")) || [];
            totalAmounts = (await getPersistence("totalAmounts")) || {};
            notificationsArchive = (await getPersistence("notificationsArchive")) || [];
            tipTotals = (await getPersistence("tipTotals")) || {};
            const trackedArr = await getPersistence("trackedPlayers");
            trackedPlayers = trackedArr ? new Set(trackedArr) : new Set();
            actionsMap = (await getPersistence("actionsMap")) || {};
            if (DEBUG_MODE) {
                console.log("[CoinDrop Debug] Loaded persistence:", { pastDrops, totalAmounts, notificationsArchive, tipTotals, trackedPlayers, actionsMap });
            }
            // Clean duplicate bet events from persisted actionsMap (if any)
            cleanDuplicateBets();
        } catch (e) {
            if (DEBUG_MODE) console.error("[CoinDrop Debug] loadPersistence error:", e);
        }
    }
    async function saveDropsAndTotals() {
        try {
            await setPersistence("pastDrops", pastDrops);
            await setPersistence("totalAmounts", totalAmounts);
        } catch (e) {
            if (DEBUG_MODE) console.error("[CoinDrop Debug] saveDropsAndTotals error:", e);
        }
    }
    async function saveArchive() {
        try {
            await setPersistence("notificationsArchive", notificationsArchive);
        } catch (e) {
            if (DEBUG_MODE) console.error("[CoinDrop Debug] saveArchive error:", e);
        }
    }
    async function saveTipTotals() {
        try {
            await setPersistence("tipTotals", tipTotals);
        } catch (e) {
            if (DEBUG_MODE) console.error("[CoinDrop Debug] saveTipTotals error:", e);
        }
    }
    async function saveTrackedPlayers() {
        try {
            await setPersistence("trackedPlayers", Array.from(trackedPlayers));
        } catch (e) {
            if (DEBUG_MODE) console.error("[CoinDrop Debug] saveTrackedPlayers error:", e);
        }
    }
    async function saveActionsMap() {
        try {
            await setPersistence("actionsMap", actionsMap);
        } catch (e) {
            if (DEBUG_MODE) console.error("[CoinDrop Debug] saveActionsMap error:", e);
        }
    }
    function loadPlayersFromDB() {
        const tx = db.transaction("players", "readonly");
        const store = tx.objectStore("players");
        const req = store.getAll();
        req.onsuccess = () => {
            req.result.forEach(player => {
                playersMap[player.uid] = player;
            });
            renderTopBalances();
        };
        req.onerror = (e) => console.error("Error loading players:", e);
    }
    function updatePlayerInDB(player) {
        const tx = db.transaction("players", "readwrite");
        const store = tx.objectStore("players");
        store.put(player);
        tx.oncomplete = () => { if (DEBUG_MODE) console.log("Player updated:", player.uid); };
        tx.onerror = (e) => console.error("Error updating player:", e);
    }

    // -------------------- CSV & ARCHIVE FUNCTIONS --------------------
    function archiveNotification(msg, currency) {
        notificationsArchive.unshift({ message: msg, currency, timestamp: Date.now() });
        if (notificationsArchive.length > 200) notificationsArchive.length = 200;
        saveArchive();
        updateArchiveUI();
    }
    function exportArchiveToCSV() {
        let csvContent = "data:text/csv;charset=utf-8,Timestamp,Message,Currency\n";
        notificationsArchive.forEach(entry => {
            const dateStr = new Date(entry.timestamp).toLocaleString().replace(/,/g, "");
            const safeMsg = (entry.message || "").replace(/"/g, '""');
            csvContent += `"${dateStr}","${safeMsg}","${entry.currency}"\n`;
        });
        const link = document.createElement("a");
        link.setAttribute("href", encodeURI(csvContent));
        link.setAttribute("download", "CoinDrop_Archive.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    function exportPlayersToCSV() {
        const allKeys = new Set();
        for (let uid in playersMap) {
            Object.keys(playersMap[uid]).forEach(k => allKeys.add(k));
        }
        const cols = Array.from(allKeys).sort();
        let csv = "data:text/csv;charset=utf-8," + cols.map(c => `"${c}"`).join(",") + "\n";
        for (let uid in playersMap) {
            const row = cols.map(k => {
                let val = playersMap[uid][k];
                if (val == null) return "";
                if (typeof val === "object") val = JSON.stringify(val);
                return `"${String(val).replace(/"/g, '""')}"`;
            }).join(",");
            csv += row + "\n";
        }
        const link = document.createElement("a");
        link.setAttribute("href", encodeURI(csv));
        link.setAttribute("download", "PlayersMap_Export.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // -------------------- ACTIONS MAP --------------------
    function logAction(uid, actionObj) {
        if (!uid) return;
        if (!actionsMap[uid]) actionsMap[uid] = [];
        const now = Date.now();
        const newSig = JSON.stringify(Object.assign({}, actionObj));
        const lastEvent = actionsMap[uid][0];
        if (lastEvent) {
            const lastSig = JSON.stringify(Object.assign({}, lastEvent, { time: undefined }));
            if (newSig === lastSig && (now - lastEvent.time < DUPLICATE_THRESHOLD_MS)) {
                if (DEBUG_MODE) console.log("Duplicate action, skipping:", newSig);
                return;
            }
        }
        actionObj.time = now;
        actionsMap[uid].unshift(actionObj);
        if (actionsMap[uid].length > 200) actionsMap[uid].length = 200;
        saveActionsMap();
    }

    // -------------------- CLEAN DUPLICATE BETS --------------------
    function cleanDuplicateBets() {
        for (let uid in actionsMap) {
            let seen = new Map();
            actionsMap[uid] = actionsMap[uid].filter(event => {
                if (event.type === "bet") {
                    let sig = JSON.stringify({ amount: event.amount, win: event.win, currency: event.currency });
                    if (seen.has(sig)) {
                        // Only keep if current event is at least BET_DUPLICATE_TIME_THRESHOLD_MS after the stored one
                        if (event.time - seen.get(sig) < BET_DUPLICATE_TIME_THRESHOLD_MS) {
                            return false;
                        }
                    }
                    seen.set(sig, event.time);
                    return true;
                }
                return true;
            });
        }
        saveActionsMap();
    }

    // -------------------- DECRYPT FUNCTIONS --------------------
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
    async function decryptAES(encObj) {
        try {
            const ivBuf = hexToBuffer(encObj.iv);
            const encBuf = base64ToArrayBuffer(decodeURIComponent(encObj.detail));
            const keyBuf = utf8ToBuffer(AES_KEY);
            const cryptoKey = await crypto.subtle.importKey("raw", keyBuf, { name: "AES-CBC" }, false, ["decrypt"]);
            const decBuf = await crypto.subtle.decrypt({ name: "AES-CBC", iv: ivBuf }, cryptoKey, encBuf);
            const decTxt = bufferToUtf8(decBuf);
            if (DEBUG_MODE) console.log("Decrypted text:", decTxt);
            return decTxt;
        } catch (e) {
            console.error("Decrypt error:", e);
            throw e;
        }
    }

    // -------------------- UI: MAIN WIDGET --------------------
    function createWidgetContainer() {
        const w = document.createElement('div');
        w.id = 'coin-drop-widget';
        Object.assign(w.style, {
            position: 'fixed',
            top: '10px',
            right: '10px',
            width: '350px',
            backgroundColor: 'rgba(0,0,0,0.8)',
            color: '#fff',
            fontFamily: 'Arial, sans-serif',
            fontSize: '14px',
            padding: '10px',
            borderRadius: '8px',
            zIndex: '10000',
            cursor: 'move'
        });
        w.innerHTML = `
            <div id="coin-drop-header" style="text-align:center; font-size:16px; font-weight:bold; margin-bottom:10px; position:relative;">
                Coin Drop Summary
                <span id="widget-close" style="position:absolute; top:5px; right:10px; cursor:pointer;">X</span>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                <div id="coin-drop-totals">
                    <h4 style="margin:0 0 5px;">Totals</h4>
                    <div id="coin-drop-summary"></div>
                </div>
                <div id="coin-drop-history" style="height:70px; overflow-y:auto;">
                    <h4 style="margin:0 0 5px;">History</h4>
                    <ul id="coin-drop-list" style="list-style:none; padding:0; margin:0;"></ul>
                </div>
            </div>
            <hr style="margin:8px 0; border-color:#555;">
            <div style="display:flex; gap:5px; margin-bottom:5px;">
                <button id="toggle-archive" style="flex:1; cursor:pointer;">Show Archive</button>
                <button id="export-csv" style="flex:1; cursor:pointer;">Export CSV</button>
            </div>
            <div id="coin-archive-container" style="display:none; height:120px; overflow-y:auto; border:1px solid #555; padding:5px; margin-bottom:8px;">
                <ul id="coin-archive-list" style="list-style:none; margin:0; padding:0;"></ul>
            </div>
            <hr style="margin:8px 0; border-color:#555;">
            <div style="display:flex; gap:5px; margin-bottom:5px;">
                <button id="btn-open-players-modal" style="flex:1; cursor:pointer;">Track Players</button>
                <button id="btn-export-players" style="flex:1; cursor:pointer;">Export Players CSV</button>
            </div>
            <hr style="margin:8px 0; border-color:#555;">
            <button id="toggle-top-balances" style="width:100%; cursor:pointer;">Show Top Balances</button>
            <div id="top-balances-container" style="display:none; max-height:320px; overflow-y:auto; border:1px solid #555; padding:5px; margin-top:8px;"></div>
            <div style="text-align:center; margin-top:8px;">
                <button id="btn-all-balances" style="cursor:pointer;">Show All Player Balances</button>
            </div>
        `;
        document.body.appendChild(w);
        makeElementDraggable(w);
        w.querySelector("#widget-close").addEventListener("click", () => { w.style.display = "none"; });
        const arcCtn = w.querySelector("#coin-archive-container");
        const togArcBtn = w.querySelector("#toggle-archive");
        togArcBtn.addEventListener("click", () => {
            arcCtn.style.display = (arcCtn.style.display === "none") ? "block" : "none";
            togArcBtn.textContent = (arcCtn.style.display === "none") ? "Show Archive" : "Hide Archive";
        });
        w.querySelector("#export-csv").addEventListener("click", exportArchiveToCSV);
        w.querySelector("#btn-open-players-modal").addEventListener("click", openPlayersModal);
        w.querySelector("#btn-export-players").addEventListener("click", exportPlayersToCSV);
        topBalancesContainer = w.querySelector("#top-balances-container");
        w.querySelector("#toggle-top-balances").addEventListener("click", () => {
            if (topBalancesContainer.style.display === "none") {
                topBalancesContainer.style.display = "block";
                w.querySelector("#toggle-top-balances").textContent = "Hide Top Balances";
                renderTopBalances();
            } else {
                topBalancesContainer.style.display = "none";
                w.querySelector("#toggle-top-balances").textContent = "Show Top Balances";
            }
        });
        document.querySelector("#btn-all-balances").addEventListener("click", openAllBalancesModal);
        if (DEBUG_MODE) console.log("[CoinDrop Debug] Main widget created");
    }
    function updateWidget() {
        const sumDiv = document.getElementById('coin-drop-summary');
        const listUl = document.getElementById('coin-drop-list');
        if (!sumDiv || !listUl) return;
        let sumHtml = "";
        for (let c in totalAmounts) {
            sumHtml += `<div>${c.toUpperCase()}: ${totalAmounts[c].toFixed(4)}</div>`;
        }
        // Append tip totals if available
        let tipHtml = "";
        for (let cur in tipTotals) {
            tipHtml += `<div>TIP ${cur.toUpperCase()}: ${tipTotals[cur].toFixed(4)}</div>`;
        }
        sumDiv.innerHTML = sumHtml + (tipHtml ? "<hr style='border-color:#555; margin:4px 0;'/>" + tipHtml : "");
        listUl.innerHTML = pastDrops.map(drop => {
            const t = new Date(drop.timestamp).toLocaleString();
            return `
                <li style="margin-bottom:5px; border-bottom:1px solid #555; padding-bottom:5px;">
                    <div style="font-weight:bold;">${drop.amount} ${drop.currency.toUpperCase()}</div>
                    <div>for ${drop.player_number} people</div>
                    <div><small>${drop.context ? decodeURIComponent(drop.context) : ''} @ ${t}</small></div>
                </li>
            `;
        }).join('');
        saveDropsAndTotals();
    }
    function updateArchiveUI() {
        const archList = document.getElementById("coin-archive-list");
        if (!archList) return;
        archList.innerHTML = notificationsArchive.map(e => {
            const t = new Date(e.timestamp).toLocaleString();
            return `
                <li style="margin-bottom:5px; border-bottom:1px solid #555; padding-bottom:5px;">
                    <div style="font-weight:bold;">[${t}]</div>
                    <div>${e.message}</div>
                </li>
            `;
        }).join('');
    }
    function renderTopBalances() {
        if (!topBalancesContainer) return;
        // Only show players updated in the past 2 hours.
        const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
        let resetBtnHTML = `<button id="reset-top-balances" style="margin-bottom:5px; cursor:pointer;">Reset Top Balances</button>`;
        const arr = Object.values(playersMap)
            .filter(u => u.hasOwnProperty("redeem_usd") && u.last_updated >= twoHoursAgo);
        arr.sort((a, b) => parseFloat(b.redeem_usd || "0") - parseFloat(a.redeem_usd || "0"));
        const top = arr.slice(0, 20);
        const listHTML = top.map(u => {
            const bal = parseFloat(u.redeem_usd || "0").toFixed(4);
            const lastUpdated = u.last_updated ? new Date(u.last_updated).toLocaleString() : "N/A";
            return `
                <div style="margin-bottom:5px; border-bottom:1px solid #555; padding-bottom:5px; cursor:pointer;" data-uid="${u.uid}">
                    <strong>${u.name}</strong><br/>
                    <span style="color:#ccc;">Balance: $${bal} (last updated ${lastUpdated})</span>
                </div>
            `;
        }).join('');
        topBalancesContainer.innerHTML = resetBtnHTML + listHTML;
        const resetBtn = topBalancesContainer.querySelector("#reset-top-balances");
        if (resetBtn) {
            resetBtn.addEventListener("click", () => {
                renderTopBalances();
                topBalancesContainer.scrollTop = 0;
            });
        }
        document.querySelectorAll("div[data-uid]").forEach(div => {
            div.addEventListener("click", () => openPlayerDetailModal(div.getAttribute("data-uid")));
        });
    }
    function makeElementDraggable(elm) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        const header = document.getElementById("coin-drop-header") || elm;
        header.style.cursor = "move";
        header.onmousedown = dragMouseDown;
        function dragMouseDown(e) {
            e = e || window.event;
            e.preventDefault();
            pos3 = e.clientX; pos4 = e.clientY;
            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;
        }
        function elementDrag(e) {
            e = e || window.event;
            e.preventDefault();
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            elm.style.top = (elm.offsetTop - pos2) + "px";
            elm.style.right = (parseInt(window.getComputedStyle(elm).right) + pos1) + "px";
        }
        function closeDragElement() {
            document.onmouseup = null;
            document.onmousemove = null;
        }
    }

    // -------------------- ALL PLAYER BALANCES MODAL (Table) --------------------
    function createAllBalancesModal() {
        if (allBalancesModal) return;
        allBalancesModal = document.createElement("div");
        allBalancesModal.id = "all-balances-modal";
        Object.assign(allBalancesModal.style, {
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%,-50%)",
            width: "500px",
            maxHeight: "80%",
            backgroundColor: "#333",
            color: "#fff",
            borderRadius: "10px",
            padding: "20px",
            boxShadow: "0 8px 16px rgba(0,0,0,0.8)",
            zIndex: 10002,
            overflowY: "auto",
            display: "none"
        });
        allBalancesModal.innerHTML = `
            <div style="position:relative; margin-bottom:10px;">
                <span style="font-size:18px; font-weight:bold;">All Player Balances</span>
                <span id="all-balances-close" style="position:absolute; top:0; right:0; cursor:pointer; font-weight:bold;">X</span>
            </div>
            <div id="all-balances-content"></div>
        `;
        document.body.appendChild(allBalancesModal);
        allBalancesModal.querySelector("#all-balances-close").addEventListener("click", () => { allBalancesModal.style.display = "none"; });
    }
    function openAllBalancesModal() {
        createAllBalancesModal();
        const arr = Object.values(playersMap).filter(u => u.hasOwnProperty("redeem_usd"));
        arr.sort((a, b) => parseFloat(b.redeem_usd || "0") - parseFloat(a.redeem_usd || "0"));
        const contentDiv = document.getElementById("all-balances-content");
        const tableHTML = `
            <table style="width:100%; border-collapse: collapse;">
                <thead>
                    <tr style="background:#444;">
                        <th style="padding:8px; border:1px solid #555;">Player</th>
                        <th style="padding:8px; border:1px solid #555;">Balance</th>
                        <th style="padding:8px; border:1px solid #555;">Last Updated</th>
                    </tr>
                </thead>
                <tbody>
                    ${arr.map(u => {
                        const bal = parseFloat(u.redeem_usd || "0").toFixed(4);
                        const lastUpdated = u.last_updated ? new Date(u.last_updated).toLocaleString() : "N/A";
                        return `<tr>
                                    <td style="padding:8px; border:1px solid #555;">${u.name}</td>
                                    <td style="padding:8px; border:1px solid #555;">$${bal}</td>
                                    <td style="padding:8px; border:1px solid #555;">${lastUpdated}</td>
                                </tr>`;
                    }).join('')}
                </tbody>
            </table>
        `;
        contentDiv.innerHTML = tableHTML;
        allBalancesModal.style.display = "block";
    }

    // -------------------- PLAYERS MODAL --------------------
    function createPlayersModal() {
        if (playersModal) return;
        playersModal = document.createElement('div');
        playersModal.id = "players-modal";
        Object.assign(playersModal.style, {
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%,-50%)',
            width: '500px',
            maxHeight: '70%',
            backgroundColor: '#333',
            color: '#fff',
            borderRadius: '10px',
            padding: '20px',
            boxShadow: '0 8px 16px rgba(0,0,0,0.8)',
            overflowY: "auto",
            display: 'none',
            zIndex: 10001
        });
        playersModal.innerHTML = `
            <div style="position:relative; margin-bottom:10px;">
                <span style="font-size:18px; font-weight:bold;">Track Players</span>
                <span id="players-modal-close" style="position:absolute; top:0; right:0; cursor:pointer; font-weight:bold;">X</span>
            </div>
            <div id="players-atoz" style="margin-bottom:10px; display:flex; flex-wrap:wrap; gap:3px;"></div>
            <div style="margin-bottom:10px;">
                <input type="text" id="players-search" placeholder="Search name..." style="width:100%; padding:8px; border-radius:4px; border:none; outline:none;" />
            </div>
            <div id="players-list-container" style="max-height:50vh; overflow-y:auto; border:1px solid #555; border-radius:4px; padding:5px;"></div>
        `;
        document.body.appendChild(playersModal);
        playersModal.querySelector("#players-modal-close").addEventListener("click", closePlayersModal);
        const atozContainer = playersModal.querySelector("#players-atoz");
        const searchInput = playersModal.querySelector("#players-search");
        const listContainer = playersModal.querySelector("#players-list-container");
        const letters = ["ALL","A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z"];
        atozContainer.innerHTML = letters.map(l => `<button data-letter="${l}" style="cursor:pointer; padding:3px 6px;">${l}</button>`).join('');
        atozContainer.querySelectorAll("button[data-letter]").forEach(btn => {
            btn.addEventListener("click", () => doLetterFilter(btn.getAttribute("data-letter")));
        });
        searchInput.addEventListener("input", () => renderPlayersList(searchInput.value, "ALL"));
    }
    let currentLetterFilter = "ALL";
    function doLetterFilter(letter) {
        const searchVal = document.querySelector("#players-search").value;
        renderPlayersList(searchVal, letter === "ALL" ? "ALL" : letter.toLowerCase());
    }
    function renderPlayersList(searchTxt, letterFilter) {
        currentLetterFilter = letterFilter;
        const listContainer = document.querySelector("#players-list-container");
        if (!listContainer) return;
        const lcFilter = (searchTxt || "").toLowerCase().trim();
        const sorted = Object.values(playersMap).sort((a, b) => (a.name || "").toLowerCase().localeCompare((b.name || "").toLowerCase()));
        const filtered = sorted.filter(u => {
            if (lcFilter && !(u.name || "").toLowerCase().includes(lcFilter)) return false;
            if (letterFilter !== "ALL" && (u.name || "").charAt(0).toLowerCase() !== letterFilter) return false;
            return true;
        });
        listContainer.innerHTML = filtered.map(u => {
            const isTracked = trackedPlayers.has(u.uid);
            const rowBg = isTracked ? "background-color:#444;" : "";
            const statusLbl = isTracked ? `<div style="color:#0f0;">TRACKED</div>` : `<div style="color:#ccc;">Not Tracked</div>`;
            return `
                <div style="margin-bottom:8px; border-bottom:1px solid #555; padding-bottom:8px; ${rowBg}" data-uid="${u.uid}">
                    <div style="font-weight:bold;">${u.name || "???"}</div>
                    ${statusLbl}
                    <button style="margin-top:5px; cursor:pointer;">${isTracked ? "Untrack" : "Track"}</button>
                    <button style="margin-top:5px; cursor:pointer;" data-action="info">Info</button>
                </div>
            `;
        }).join('');
        listContainer.querySelectorAll("div[data-uid]").forEach(div => {
            const uid = div.getAttribute("data-uid");
            const trackBtn = div.querySelector("button:not([data-action])");
            trackBtn.addEventListener("click", () => {
                toggleTrackPlayer(uid);
                renderPlayersList(document.querySelector("#players-search").value, currentLetterFilter);
            });
            const infoBtn = div.querySelector("button[data-action='info']");
            infoBtn.addEventListener("click", () => openPlayerDetailModal(uid));
        });
    }
    function openPlayersModal() {
        createPlayersModal();
        playersModal.style.display = "block";
        document.querySelector("#players-search").value = "";
        currentLetterFilter = "ALL";
        renderPlayersList("", "ALL");
    }
    function closePlayersModal() {
        if (playersModal) playersModal.style.display = "none";
    }

    // -------------------- PLAYER DETAIL MODAL --------------------
    function createPlayerDetailModal() {
        if (playerDetailModal) return;
        playerDetailModal = document.createElement('div');
        playerDetailModal.id = "player-detail-modal";
        Object.assign(playerDetailModal.style, {
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%,-50%)',
            width: '400px',
            maxHeight: '70%',
            backgroundColor: '#222',
            color: '#fff',
            borderRadius: '10px',
            padding: '20px',
            boxShadow: '0 8px 16px rgba(0,0,0,0.8)',
            overflowY: 'auto',
            display: 'none',
            zIndex: 10003 // Higher z-index to appear above the players modal
        });
        playerDetailModal.innerHTML = `
            <div style="position:relative; margin-bottom:10px;">
                <span style="font-size:18px; font-weight:bold;">Player Info</span>
                <span id="player-detail-close" style="position:absolute; top:0; right:0; cursor:pointer; font-weight:bold;">X</span>
            </div>
            <div id="player-detail-content"></div>
        `;
        document.body.appendChild(playerDetailModal);
        playerDetailModal.querySelector("#player-detail-close").addEventListener("click", closePlayerDetailModal);
    }
    function openPlayerDetailModal(uid) {
        createPlayerDetailModal();
        currentDetailUID = uid;
        playerDetailModal.style.display = "block";
        renderPlayerDetail(uid);
    }
    function closePlayerDetailModal() {
        if (playerDetailModal) playerDetailModal.style.display = "none";
    }
    function renderPlayerDetail(uid) {
        const contentDiv = document.getElementById("player-detail-content");
        if (!contentDiv) return;
        const user = playersMap[uid] || {};
        const events = actionsMap[uid] || [];
        const lines = events.map(ev => {
            const t = new Date(ev.time).toLocaleString();
            if (ev.type === "chat") {
                return `<div style="margin-bottom:6px; border-bottom:1px solid #555; padding-bottom:6px;">
                            <small style="color:#ccc;">${t}</small><br/>
                            [Chat] ${ev.message || ""}
                        </div>`;
            } else if (ev.type === "bet") {
                return `<div style="margin-bottom:6px; border-bottom:1px solid #555; padding-bottom:6px;">
                            <small style="color:#ccc;">${t}</small><br/>
                            [Bet] ${ev.amount} => ${ev.win} (${ev.currency?.toUpperCase()})
                        </div>`;
            } else if (ev.type === "deposit") {
                return `<div style="margin-bottom:6px; border-bottom:1px solid #555; padding-bottom:6px;">
                            <small style="color:#ccc;">${t}</small><br/>
                            [Deposit] ${ev.amount} ${ev.currency?.toUpperCase()}
                        </div>`;
            } else if (ev.type === "withdraw") {
                return `<div style="margin-bottom:6px; border-bottom:1px solid #555; padding-bottom:6px;">
                            <small style="color:#ccc;">${t}</small><br/>
                            [Withdraw] ${ev.amount} ${ev.currency?.toUpperCase()}
                        </div>`;
            } else if (ev.type === "tip") {
                return `<div style="margin-bottom:6px; border-bottom:1px solid #555; padding-bottom:6px;">
                            <small style="color:#ccc;">${t}</small><br/>
                            [Tip] ${ev.amount} (${ev.currency?.toUpperCase()})
                        </div>`;
            } else {
                return `<div style="margin-bottom:6px; border-bottom:1px solid #555; padding-bottom:6px;">
                            <small style="color:#ccc;">${t}</small><br/>
                            ${JSON.stringify(ev)}
                        </div>`;
            }
        }).join('');
        const bal = parseFloat(user.redeem_usd || "0").toFixed(4);
        const lastUpdated = user.last_updated ? new Date(user.last_updated).toLocaleString() : "N/A";
        contentDiv.innerHTML = `
            <div>
                <strong>Name:</strong> ${user.name || "???"}<br/>
                <strong>Balance:</strong> $${bal} <small>(last updated ${lastUpdated})</small><br/>
                <strong>Level:</strong> ${user.level || "?"}, VIP: ${user.vip_level || "?"}
            </div>
            <hr style="margin:10px 0; border-color:#555;">
            <div style="font-size:16px; font-weight:bold;">Actions Log</div>
            <div>${lines || "<div style='color:#999;'>No actions found.</div>"}</div>
        `;
    }

    // -------------------- ALL PLAYER BALANCES MODAL (Table) --------------------
    function createAllBalancesModal() {
        if (allBalancesModal) return;
        allBalancesModal = document.createElement("div");
        allBalancesModal.id = "all-balances-modal";
        Object.assign(allBalancesModal.style, {
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%,-50%)",
            width: "500px",
            maxHeight: "80%",
            backgroundColor: "#333",
            color: "#fff",
            borderRadius: "10px",
            padding: "20px",
            boxShadow: "0 8px 16px rgba(0,0,0,0.8)",
            zIndex: 10002,
            overflowY: "auto",
            display: "none"
        });
        allBalancesModal.innerHTML = `
            <div style="position:relative; margin-bottom:10px;">
                <span style="font-size:18px; font-weight:bold;">All Player Balances</span>
                <span id="all-balances-close" style="position:absolute; top:0; right:0; cursor:pointer; font-weight:bold;">X</span>
            </div>
            <div id="all-balances-content"></div>
        `;
        document.body.appendChild(allBalancesModal);
        allBalancesModal.querySelector("#all-balances-close").addEventListener("click", () => { allBalancesModal.style.display = "none"; });
    }
    function openAllBalancesModal() {
        createAllBalancesModal();
        const arr = Object.values(playersMap).filter(u => u.hasOwnProperty("redeem_usd"));
        arr.sort((a, b) => parseFloat(b.redeem_usd || "0") - parseFloat(a.redeem_usd || "0"));
        const contentDiv = document.getElementById("all-balances-content");
        const tableHTML = `
            <table style="width:100%; border-collapse: collapse;">
                <thead>
                    <tr style="background:#444;">
                        <th style="padding:8px; border:1px solid #555;">Player</th>
                        <th style="padding:8px; border:1px solid #555;">Balance</th>
                        <th style="padding:8px; border:1px solid #555;">Last Updated</th>
                    </tr>
                </thead>
                <tbody>
                    ${arr.map(u => {
                        const bal = parseFloat(u.redeem_usd || "0").toFixed(4);
                        const lastUpdated = u.last_updated ? new Date(u.last_updated).toLocaleString() : "N/A";
                        return `<tr>
                                    <td style="padding:8px; border:1px solid #555;">${u.name}</td>
                                    <td style="padding:8px; border:1px solid #555;">$${bal}</td>
                                    <td style="padding:8px; border:1px solid #555;">${lastUpdated}</td>
                                </tr>`;
                    }).join('')}
                </tbody>
            </table>
        `;
        contentDiv.innerHTML = tableHTML;
        allBalancesModal.style.display = "block";
    }

    // -------------------- TRACKING & PERSIST (PLAYERS) --------------------
    function ensurePlayerEntry(uObj) {
        if (!uObj || !uObj.uid) return null;
        const uid = uObj.uid;
        let ex = playersMap[uid] || {};
        Object.assign(ex, uObj);
        ex.last_updated = Date.now();
        playersMap[uid] = ex;
        updatePlayerInDB(ex);
        return ex;
    }
    function setRedeemUsdBalance(uid, newBal) {
        if (!playersMap[uid]) return;
        playersMap[uid].redeem_usd = newBal;
        playersMap[uid].last_updated = Date.now();
        updatePlayerInDB(playersMap[uid]);
        if (playerDetailModal && playerDetailModal.style.display === "block" && currentDetailUID === uid) {
            renderPlayerDetail(uid);
        }
        if (topBalancesContainer && topBalancesContainer.style.display !== "none") {
            renderTopBalances();
        }
    }
    function toggleTrackPlayer(uid) {
        if (trackedPlayers.has(uid)) trackedPlayers.delete(uid);
        else trackedPlayers.add(uid);
        saveTrackedPlayers();
    }

    // -------------------- NOTIFICATION & SOUND --------------------
    function playNotificationSound() {
        try {
            const audio = new Audio(CUSTOM_SOUND_URL);
            audio.play().catch(err => { if (DEBUG_MODE) console.error("Sound error:", err); });
        } catch (e) {
            if (DEBUG_MODE) console.error("Sound error:", e);
        }
    }
    function showNotification(message, currency = "misc") {
        archiveNotification(message, currency);
        const notif = document.createElement('div');
        notif.textContent = message;
        let bg = "#2196f3";
        if (currency === "usd") { bg = "#4caf50"; playNotificationSound(); }
        else if (currency === "gold") { bg = "#f44336"; }
        Object.assign(notif.style, {
            position: 'relative',
            backgroundColor: bg,
            color: '#fff',
            fontSize: '24px',
            fontWeight: 'bold',
            padding: '20px 40px 20px 20px',
            borderRadius: '10px',
            boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
            opacity: '0',
            transition: 'opacity 0.5s ease',
            pointerEvents: 'auto'
        });
        const closeBtn = document.createElement('span');
        closeBtn.textContent = 'X';
        Object.assign(closeBtn.style, {
            position: 'absolute',
            top: '5px',
            right: '10px',
            cursor: 'pointer',
            fontWeight: 'bold'
        });
        closeBtn.addEventListener('click', () => {
            if (notif.parentNode) notif.parentNode.removeChild(notif);
        });
        notif.appendChild(closeBtn);
        notificationContainer.appendChild(notif);
        setTimeout(() => { notif.style.opacity = '1'; }, 100);
        setTimeout(() => {
            notif.style.opacity = '0';
            setTimeout(() => { if (notif.parentNode) notif.parentNode.removeChild(notif); }, 500);
        }, 6000);
        updateArchiveUI();
    }

    // -------------------- MAIN PROCESSING --------------------
    function addDrop(coinDrop) {
        coinDrop.timestamp = Date.now();
        pastDrops.unshift(coinDrop);
        if (pastDrops.length > 20) pastDrops = pastDrops.slice(0, 20);
        const c = (coinDrop.currency || "usd").toLowerCase();
        const amt = parseFloat(coinDrop.amount || "0");
        if (!totalAmounts[c]) totalAmounts[c] = 0;
        totalAmounts[c] += amt;
        updateWidget();
    }
    function processMessage(parsedData) {
        if (!parsedData || parsedData.code === 3121) return;
        // Suppress notifications if code equals SUPPRESS_CODE
        const suppressNotifs = (parsedData.code === SUPPRESS_CODE);
        if (DEBUG_MODE) console.log("processMessage:", parsedData);

        // Process tip events if present
        const tip = parsedData.data?.chat_message?.tip || parsedData.data?.tip;
        if (tip) {
            const uid = parsedData.data.chat_message.user.uid;
            logAction(uid, { type: "tip", amount: tip.amount, currency: tip.currency });
            const cur = (tip.currency || "usd").toLowerCase();
            if (!tipTotals[cur]) tipTotals[cur] = 0;
            tipTotals[cur] += parseFloat(tip.amount || "0");
            saveTipTotals();
            if (trackedPlayers.has(uid) && !suppressNotifs) {
                showNotification(`Tracked Player ${parsedData.data.chat_message.user.name} tipped ${tip.amount} ${tip.currency?.toUpperCase()}`, cur);
            }
            return;
        }

        const userArr = parsedData.data?.chat_message?.user_arr;
        if (userArr) {
            for (let k in userArr) {
                let u = userArr[k];
                ensurePlayerEntry(u);
                if (u.redeem_usd) setRedeemUsdBalance(u.uid, parseFloat(u.redeem_usd) || 0);
            }
        }
        const chatUser = parsedData.data?.chat_message?.user;
        if (chatUser) ensurePlayerEntry(chatUser);
        const betUser = parsedData.data?.bet?.user;
        if (betUser) ensurePlayerEntry(betUser);
        const coinDrop = parsedData.data?.chat_message?.coin_drop || parsedData.data?.coin_drop;
        if (coinDrop && coinDrop.rain_id && coinDrop.status === 1) {
            // Prevent duplicate coin drops using rain_id
            if (processedDrops.has(coinDrop.rain_id)) return;
            processedDrops.add(coinDrop.rain_id);
            if (!suppressNotifs) {
                showNotification(`Coin Drop: ${coinDrop.amount} ${coinDrop.currency.toUpperCase()} for ${coinDrop.player_number} people`, coinDrop.currency.toLowerCase());
            }
            addDrop(coinDrop);
            return;
        }
        const dw = parsedData.data?.chat_message?.deposit_withdraw;
        if (dw) {
            let dwUsr = parsedData.data.chat_message.user;
            ensurePlayerEntry(dwUsr);
            const uid = dwUsr.uid;
            if (dw.type === 1) {
                logAction(uid, { type: "deposit", amount: dw.amount, currency: dw.currency });
                if (trackedPlayers.has(uid) && !suppressNotifs) {
                    showNotification(`Tracked Player ${dwUsr.name} deposited ${dw.amount} ${dw.currency?.toUpperCase()}`, (dw.currency || "usd").toLowerCase());
                }
            } else if (dw.type === 2) {
                logAction(uid, { type: "withdraw", amount: dw.amount, currency: dw.currency });
                if (trackedPlayers.has(uid) && !suppressNotifs) {
                    showNotification(`Tracked Player ${dwUsr.name} withdrew ${dw.amount} ${dw.currency?.toUpperCase()}`, (dw.currency || "usd").toLowerCase());
                }
            }
            return;
        }
        const singleBet = parsedData.data?.bet;
        if (singleBet) {
            // Compute a bet signature including current timestamp
            const betSig = JSON.stringify({
                user: singleBet.user?.uid,
                amount: singleBet.amount,
                win: singleBet.win,
                currency: singleBet.currency
            });
            const now = Date.now();
            if (processedBetSignatures.has(betSig)) {
                const lastTime = processedBetSignatures.get(betSig);
                if (now - lastTime < BET_DUPLICATE_TIME_THRESHOLD_MS) return;
            }
            processedBetSignatures.set(betSig, now);
            if (singleBet.record_id && processedBetIds.has(singleBet.record_id)) return;
            if (singleBet.record_id) processedBetIds.add(singleBet.record_id);
            const uid = singleBet.user?.uid || "";
            logAction(uid, { type: "bet", amount: singleBet.amount, win: singleBet.win, currency: singleBet.currency });
            const cur = (singleBet.currency || "usd").toLowerCase();
            const wAmt = parseFloat(singleBet.win || "0");
            if (wAmt >= BIG_WIN_THRESHOLD && !suppressNotifs) {
                showNotification(`Big Win: ${singleBet.user.name} won ${singleBet.win} ${singleBet.currency.toUpperCase()}`, cur);
                // Update player balance on big win using the provided balance (if available)
                if (singleBet.user && singleBet.user.redeem_usd) {
                    setRedeemUsdBalance(singleBet.user.uid, parseFloat(singleBet.user.redeem_usd));
                }
            }
            if (trackedPlayers.has(uid) && !suppressNotifs) {
                showNotification(`Tracked Player ${singleBet.user.name} bet ${singleBet.amount} => won ${singleBet.win} ${singleBet.currency.toUpperCase()}`, cur);
            }
            return;
        }
        const multiBets = parsedData.data?.bets;
        if (Array.isArray(multiBets)) {
            for (let b of multiBets) {
                const betSig = JSON.stringify({
                    user: b.user?.uid,
                    amount: b.amount,
                    win: b.win,
                    currency: b.currency
                });
                const now = Date.now();
                if (processedBetSignatures.has(betSig)) {
                    const lastTime = processedBetSignatures.get(betSig);
                    if (now - lastTime < BET_DUPLICATE_TIME_THRESHOLD_MS) continue;
                }
                processedBetSignatures.set(betSig, now);
                if (b.record_id && processedBetIds.has(b.record_id)) continue;
                if (b.record_id) processedBetIds.add(b.record_id);
                ensurePlayerEntry(b.user);
                const uid = b.user?.uid || "";
                logAction(uid, { type: "bet", amount: b.amount, win: b.win, currency: b.currency });
                const cc = (b.currency || "usd").toLowerCase();
                const wa = parseFloat(b.win || "0");
                if (wa >= BIG_WIN_THRESHOLD && !suppressNotifs) {
                    showNotification(`Big Win: ${b.user.name} won ${b.win} ${b.currency.toUpperCase()}`, cc);
                    if (b.user && b.user.redeem_usd) {
                        setRedeemUsdBalance(b.user.uid, parseFloat(b.user.redeem_usd));
                    }
                }
                if (trackedPlayers.has(uid) && !suppressNotifs) {
                    showNotification(`Tracked Player ${b.user.name} bet ${b.amount} => won ${b.win} ${b.currency.toUpperCase()}`, cc);
                }
            }
            return;
        }
        const cm = parsedData.data?.chat_message;
        if (cm?.type === "chatMessage") {
            let cmu = cm.user;
            if (cmu) {
                const decMsg = decodeURIComponent(cm.message || "");
                logAction(cmu.uid, { type: "chat", message: decMsg });
                if (trackedPlayers.has(cmu.uid) && !suppressNotifs) {
                    showNotification(`Tracked Player ${cmu.name} says: ${decMsg}`, "misc");
                }
            }
            return;
        }
        if (DEBUG_MODE) console.log("Message not processed:", parsedData);
    }
    async function handleIncomingMessage(data) {
        let msg;
        if (typeof data === "string") msg = data;
        else if (data instanceof ArrayBuffer) msg = new TextDecoder("utf-8").decode(data);
        else { if (DEBUG_MODE) console.log("Unsupported data type"); return; }
        const jsonStart = msg.indexOf('{');
        if (jsonStart === -1) { if (DEBUG_MODE) console.log("No JSON found."); return; }
        let jsonString = msg.substring(jsonStart);
        while (jsonString.startsWith('{{')) jsonString = jsonString.substring(1);
        let is3121 = false;
        try { if (JSON.parse(jsonString).code === 3121) is3121 = true; } catch(e) {}
        if (DEBUG_MODE && !is3121) {
            console.log("Raw msg:", msg);
            console.log("Extracted JSON:", jsonString);
        }
        try {
            let parsed = JSON.parse(jsonString);
            if (DEBUG_MODE && !is3121) console.log("Parsed data:", parsed);
            if (parsed.iv && parsed.detail) {
                try {
                    const decTxt = await decryptAES(parsed);
                    const decObj = JSON.parse(decTxt);
                    processMessage(decObj);
                } catch(err) { if (DEBUG_MODE && !is3121) console.error("Decrypt parse error:", err); }
            } else processMessage(parsed);
        } catch(err) { if (DEBUG_MODE && !is3121) console.error("JSON parse error:", err); }
    }

    // -------------------- WEBSOCKET OVERRIDE --------------------
    const OriginalWebSocket = window.WebSocket;
    window.WebSocket = function(url, protocols) {
        const ws = new OriginalWebSocket(url, protocols);
        ws.addEventListener('message', event => {
            let msgStr = "";
            if (typeof event.data === "string") msgStr = event.data;
            else if (event.data instanceof ArrayBuffer) msgStr = new TextDecoder("utf-8").decode(event.data);
            let is3121 = false;
            const jsIdx = msgStr.indexOf('{');
            if (jsIdx !== -1) {
                try { if (JSON.parse(msgStr.substring(jsIdx)).code === 3121) is3121 = true; } catch(e) {}
            }
            if (DEBUG_MODE && !is3121) console.log("Intercepted WS msg:", event.data);
            handleIncomingMessage(event.data);
        });
        return ws;
    };
    window.WebSocket.prototype = OriginalWebSocket.prototype;

    // -------------------- INIT --------------------
    openDB().then(async () => {
        await loadPersistence();
        loadPlayersFromDB();
        createWidgetContainer();
        updateWidget();
        updateArchiveUI();
        if (DEBUG_MODE) console.log("Init complete: IndexedDB persistence initialized.");
    }).catch(err => console.error("IndexedDB error:", err));
})();

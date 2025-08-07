// ==UserScript==
// @name         LuckyBird Transaction Analyzer
// @namespace    http://tampermonkey.net/
// @version      4.2
// @description  Adds buttons to refresh and view 'Tips' and 'P/L' data, with comprehensive, interactive analysis panels.
// @author       kloppervok
// @match        https://luckybird.io/*
// @grant        GM_setValue
// @grant        GM_getValue
// @require      https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js
// ==/UserScript==

(function() {
    'use strict';

    let fullScrapedData = { tips: [], buys: [], redeems: [] };

    const checkForModal = setInterval(() => {
        const modal = document.querySelector('div.commonAlert_wrap div.transactions_wrap');
        const buttonExists = document.getElementById('scrape-all-pages-btn-container');
        if (modal && !buttonExists) {
            console.log('Transaction modal detected. Adding analysis buttons.');
            createScrapeButtons(modal);
        }
    }, 1000);

    function createScrapeButtons(modal) {
        const buttonContainer = document.createElement('div');
        buttonContainer.id = 'scrape-all-pages-btn-container';
        buttonContainer.style.cssText = `position: absolute; top: 15px; right: 50px; z-index: 9999; display: flex; gap: 10px;`;
        const baseBtnStyle = `color: white; padding: 8px 12px; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: bold;`;

        const refreshTipsBtn = document.createElement('button');
        refreshTipsBtn.innerHTML = 'Refresh Tip Data';
        refreshTipsBtn.style.cssText = baseBtnStyle + 'background-color: #2196F3;';

        const refreshPLBtn = document.createElement('button');
        refreshPLBtn.innerHTML = 'Refresh P/L Data';
        refreshPLBtn.style.cssText = baseBtnStyle + 'background-color: #FF9800;'; // Orange

        const viewTipsBtn = document.createElement('button');
        viewTipsBtn.innerHTML = 'View Tip Analysis';
        viewTipsBtn.style.cssText = baseBtnStyle + 'background-color: #4CAF50;';
        viewTipsBtn.disabled = true; viewTipsBtn.style.opacity = '0.5';

        const viewPLBtn = document.createElement('button');
        viewPLBtn.innerHTML = 'View P/L Analysis';
        viewPLBtn.style.cssText = baseBtnStyle + 'background-color: #4CAF50;';
        viewPLBtn.disabled = true; viewPLBtn.style.opacity = '0.5';

        buttonContainer.appendChild(refreshTipsBtn);
        buttonContainer.appendChild(refreshPLBtn);
        buttonContainer.appendChild(viewTipsBtn);
        buttonContainer.appendChild(viewPLBtn);

        const titleElement = modal.closest('.commonAlert_wrap').querySelector('h2.commonAlert_title');
        if (titleElement) titleElement.appendChild(buttonContainer);

        refreshTipsBtn.addEventListener('click', async () => {
            try {
                refreshTipsBtn.disabled = true;
                fullScrapedData.tips = await scrapeGenericTab(refreshTipsBtn, 'Tips', scrapeTipsPage);
                downloadCSV(fullScrapedData.tips, 'tips_transactions.csv');
                refreshTipsBtn.innerHTML = 'Refresh Tip Data';
                refreshTipsBtn.disabled = false;
                viewTipsBtn.disabled = false; viewTipsBtn.style.opacity = '1';
            } catch (error) {
                console.error('Tip scraping failed:', error);
                refreshTipsBtn.innerHTML = 'Error!';
            }
        });

        refreshPLBtn.addEventListener('click', async () => {
            try {
                refreshPLBtn.disabled = true;
                fullScrapedData.buys = await scrapeGenericTab(refreshPLBtn, 'Buy', scrapeBuyPage);
                fullScrapedData.redeems = await scrapeGenericTab(refreshPLBtn, 'Redeem', scrapeRedeemPage);
                refreshPLBtn.innerHTML = 'Refresh P/L Data';
                refreshPLBtn.disabled = false;
                viewPLBtn.disabled = false; viewPLBtn.style.opacity = '1';
            } catch (error) {
                console.error('P/L scraping failed:', error);
                refreshPLBtn.innerHTML = 'Error!';
            }
        });

        viewTipsBtn.addEventListener('click', async () => {
            if (fullScrapedData.tips.length > 0) await analyzeAndDisplayBalances(fullScrapedData.tips);
            else alert('No Tip data available. Please refresh first.');
        });

        viewPLBtn.addEventListener('click', () => {
            if (fullScrapedData.buys.length > 0 || fullScrapedData.redeems.length > 0) displayProfitLossPanel();
            else alert('No P/L data available. Please refresh first.');
        });
    }

    async function scrapeGenericTab(button, tabName, scrapeFunction) {
        const tabSelector = `//div[contains(@class, 'tw-nav')]/div[text()='${tabName}']`;
        const tab = document.evaluate(tabSelector, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;

        if (tab && !tab.classList.contains('tw-nav-active')) {
            console.log(`Switching to '${tabName}' tab...`);
            tab.click();
            await new Promise(resolve => setTimeout(resolve, 1500));
        }

        let allRows = [];
        let pageCount = 1;
        const pagerItems = document.querySelectorAll('div.commonAlert_wrap ul.el-pager li.number');
        const totalPages = pagerItems.length > 0 ? pagerItems[pagerItems.length - 1].innerText : '?';

        while (true) {
            button.innerHTML = `Scraping ${tabName} P.${pageCount}/${totalPages}...`;
            console.log(`Scraping ${tabName} page ${pageCount}...`);

            // --- CORRECTED LOGIC ---
            // For Tips, the Date is the 4th column and is more unique.
            // For Buy/Redeem, the Date is the 1st column.
            const dateColumnIndex = tabName === 'Tips' ? 4 : 1;
            const firstRowDate = document.querySelector(`div.commonAlert_wrap div.el-table__body-wrapper tbody tr.el-table__row td:nth-child(${dateColumnIndex})`)?.innerText.trim() || '';

            allRows.push(...scrapeFunction());
            const nextButton = document.querySelector('div.commonAlert_wrap button.btn-next');
            if (!nextButton || nextButton.disabled) {
                console.log(`Last page of ${tabName} reached.`);
                break;
            }
            nextButton.click();
            await new Promise((resolve, reject) => {
                const timeout = 10000, interval = 100;
                let elapsedTime = 0;
                const checkInterval = setInterval(() => {
                    const newFirstRowDate = document.querySelector(`div.commonAlert_wrap div.el-table__body-wrapper tbody tr.el-table__row td:nth-child(${dateColumnIndex})`)?.innerText.trim();
                    if (newFirstRowDate && newFirstRowDate !== firstRowDate) {
                        clearInterval(checkInterval);
                        resolve();
                    }
                    elapsedTime += interval;
                    if (elapsedTime >= timeout) {
                        clearInterval(checkInterval);
                        reject(new Error(`Timeout waiting for ${tabName} page data to update.`));
                    }
                }, interval);
            });
            await new Promise(resolve => setTimeout(resolve, 250));
            pageCount++;
        }
        return allRows;
    }

    function scrapeTipsPage() {
        const rows = document.querySelectorAll("div.commonAlert_wrap section.tipSent_page tbody tr.el-table__row");
        const pageData = [];
        rows.forEach(row => {
            const cells = row.querySelectorAll("td");
            if (cells.length < 4) return;
            const fromUser = cells[0].innerText.trim();
            const toUser = cells[1].innerText.trim();
            const amountText = (cells[2].querySelector("span.amount_text")?.innerText || cells[2].innerText).trim();
            const amountValue = parseFloat(amountText);
            const isAmountValid = !isNaN(amountValue) && amountValue <= 999;
            const involvesLuckyBird = fromUser === 'LuckyBird' || toUser === 'LuckyBird';
            if (isAmountValid && !involvesLuckyBird) {
                const rowData = { 'From': fromUser, 'To': toUser, 'Amount': amountText, 'Date': cells[3].innerText.trim() };
                rowData.id = `${fromUser}-${toUser}-${amountText}-${rowData.Date}`;
                pageData.push(rowData);
            }
        });
        return pageData;
    }

    function scrapeBuyPage() {
        const rows = document.querySelectorAll("div.commonAlert_wrap div.deposit_main tbody tr.el-table__row");
        const pageData = [];
        rows.forEach(row => {
            const cells = row.querySelectorAll("td");
            if (cells.length < 4) return;
            const date = cells[0].innerText.trim();
            const priceText = cells[2].innerText.trim();
            const price = parseFloat(priceText);
            if (!isNaN(price) && cells[3].innerText.trim() === 'Successful') {
                pageData.push({ Date: date, Amount: price, Type: 'Deposit' });
            }
        });
        return pageData;
    }

    function scrapeRedeemPage() {
        const rows = document.querySelectorAll("div.commonAlert_wrap section.tsWithdrawal_page tbody tr.el-table__row");
        const pageData = [];
        rows.forEach(row => {
            const cells = row.querySelectorAll("td");
            if (cells.length < 4) return;
            const date = cells[0].innerText.trim();
            const fromText = cells[1].innerText.trim();
            const fromAmount = parseFloat(fromText);
            if (!isNaN(fromAmount) && cells[3].innerText.trim() === 'Successful') {
                pageData.push({ Date: date, Amount: fromAmount, Type: 'Withdrawal' });
            }
        });
        return pageData;
    }

    function parseDate(dateString) { return new Date(dateString); }

    async function analyzeAndDisplayBalances(data, filter = 'all') {
        if (data.length === 0) return;
        const excludedIds = await GM_getValue('excluded_transactions', []);
        const activeData = data.filter(row => !excludedIds.includes(row.id));
        const nameCounts = {};
        activeData.forEach(row => {
            nameCounts[row.From] = (nameCounts[row.From] || 0) + 1;
            nameCounts[row.To] = (nameCounts[row.To] || 0) + 1;
        });
        if (Object.keys(nameCounts).length === 0) {
            alert("No tip data found to analyze.");
            return;
        }
        const myUsername = Object.keys(nameCounts).reduce((a, b) => nameCounts[a] > nameCounts[b] ? a : b);
        const now = new Date();
        const filteredData = activeData.filter(row => {
            if (filter === 'all') return true;
            const rowDate = parseDate(row.Date);
            if (isNaN(rowDate)) return false;
            const daysDiff = (now - rowDate) / (1000 * 60 * 60 * 24);
            if (filter === '24h') return daysDiff * 24 <= 24;
            if (filter === '7d') return daysDiff <= 7;
            if (filter === '30d') return daysDiff <= 30;
            return true;
        });
        const balances = {};
        let totalSent = 0, totalReceived = 0;
        filteredData.forEach(row => {
            const amount = parseFloat(row.Amount);
            if (isNaN(amount)) return;
            if (row.From === myUsername) {
                balances[row.To] = (balances[row.To] || 0) - amount;
                totalSent += amount;
            } else if (row.To === myUsername) {
                balances[row.From] = (balances[row.From] || 0) + amount;
                totalReceived += amount;
            }
        });
        const peopleWhoOweMe = [], peopleYouOwe = [];
        for (const user in balances) {
            if (balances[user] > 0) peopleYouOwe.push({ user, amount: balances[user] });
            else if (balances[user] < 0) peopleWhoOweMe.push({ user, amount: -balances[user] });
        }
        peopleWhoOweMe.sort((a, b) => b.amount - a.amount);
        peopleYouOwe.sort((a, b) => b.amount - a.amount);
        displayResultsPanel(myUsername, peopleWhoOweMe, peopleYouOwe, totalSent, totalReceived, filter);
    }

    function displayResultsPanel(myUsername, peopleWhoOweMe, peopleYouOwe, totalSent, totalReceived, activeFilter) {
        document.getElementById('analysis-panel')?.remove();
        const panel = document.createElement('div');
        panel.id = 'analysis-panel';
        panel.style.cssText = `position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 550px; background-color: #172135; color: white; border: 1px solid #444; border-radius: 8px; z-index: 10000; padding: 20px; font-family: sans-serif; box-shadow: 0 5px 15px rgba(0,0,0,0.5); user-select: none;`;
        const filterBtnStyle = (filter) => `background-color: ${activeFilter === filter ? '#4CAF50' : '#555'}; color: white; border: none; font-size: 10px; padding: 4px 8px; border-radius: 3px; cursor: pointer; margin: 0 2px;`;
        const userLinkStyle = `color: #87CEEB; text-decoration: underline; cursor: pointer;`;
        let html = `
            <div id="analysis-panel-header" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #444; padding-bottom: 10px; margin-bottom: 10px; cursor: move;">
                <h2 style="margin: 0; font-size: 18px;">Tip Analysis for You (${myUsername})</h2>
                <button id="close-analysis-panel" style="background: none; border: none; color: white; font-size: 24px; cursor: pointer;">&times;</button>
            </div>
            <div style="font-size: 12px; margin-bottom: 15px; text-align: center;">
                <p style="margin: 2px 0;"><strong>Total Sent:</strong> ${totalSent.toFixed(4)} | <strong>Total Received:</strong> ${totalReceived.toFixed(4)}</p>
                <div>
                    <button class="filter-btn" data-filter="24h" style="${filterBtnStyle('24h')}">Last 24 Hours</button>
                    <button class="filter-btn" data-filter="7d" style="${filterBtnStyle('7d')}">Last 7 Days</button>
                    <button class="filter-btn" data-filter="30d" style="${filterBtnStyle('30d')}">Last 30 Days</button>
                    <button class="filter-btn" data-filter="all" style="${filterBtnStyle('all')}">All Time</button>
                </div>
            </div>
            <div style="display: flex; justify-content: space-between; gap: 20px; max-height: 400px; overflow-y: auto;">
                <div style="flex: 1;">
                    <h3 style="color: #4CAF50; margin-top: 0; display: flex; justify-content: space-between; align-items: center;">People Who Owe You <button class="copy-btn" data-list="owe-me">Copy</button></h3>
                    <ul style="list-style: none; padding: 0; margin: 0;">${peopleWhoOweMe.map(p => `<li><a class="user-detail-link" href="#" data-user="${p.user}" style="${userLinkStyle}">${p.user}</a>: <span style="font-weight: bold;">${p.amount.toFixed(4)}</span></li>`).join('')}</ul>
                </div>
                <div style="flex: 1;">
                    <h3 style="color: #F44336; margin-top: 0; display: flex; justify-content: space-between; align-items: center;">People You Owe <button class="copy-btn" data-list="you-owe">Copy</button></h3>
                    <ul style="list-style: none; padding: 0; margin: 0;">${peopleYouOwe.map(p => `<li><a class="user-detail-link" href="#" data-user="${p.user}" style="${userLinkStyle}">${p.user}</a>: <span style="font-weight: bold;">${p.amount.toFixed(4)}</span></li>`).join('')}</ul>
                </div>
            </div>
            <div style="text-align: center; margin-top: 15px; border-top: 1px solid #444; padding-top: 10px; display: flex; justify-content: center; gap: 10px;">
                <button id="player-db-btn" style="${filterBtnStyle('db')}">Player Database</button>
                <button id="pl-analysis-btn" style="${filterBtnStyle('pl')}">Profit/Loss Analysis</button>
                <button id="download-tips-csv" style="${filterBtnStyle('csv')}">Download Tips CSV</button>
            </div>
        `;
        panel.innerHTML = html;
        document.body.appendChild(panel);
        document.getElementById('close-analysis-panel').onclick = () => panel.remove();
        panel.querySelectorAll('.filter-btn').forEach(button => button.onclick = (e) => analyzeAndDisplayBalances(fullScrapedData.tips, e.target.dataset.filter));
        panel.querySelectorAll('.user-detail-link').forEach(link => {
            link.onclick = (e) => { e.preventDefault(); displayUserDetailPanel(e.target.dataset.user, myUsername, fullScrapedData.tips); };
        });
        panel.querySelectorAll('.copy-btn').forEach(button => {
            button.style.cssText = `background-color: #555; color: white; border: none; font-size: 10px; padding: 2px 6px; border-radius: 3px; cursor: pointer;`;
            button.onclick = (e) => {
                const listData = e.target.dataset.list === 'owe-me' ? peopleWhoOweMe : peopleYouOwe;
                const textToCopy = listData.map(p => `${p.user}: ${p.amount.toFixed(4)}`).join('\n');
                navigator.clipboard.writeText(textToCopy).then(() => { e.target.textContent = 'Copied!'; setTimeout(() => e.target.textContent = 'Copy', 2000); });
            };
        });
        document.getElementById('player-db-btn').onclick = () => displayPlayerDatabasePanel(myUsername, fullScrapedData.tips);
        document.getElementById('pl-analysis-btn').onclick = () => displayProfitLossPanel();
        document.getElementById('download-tips-csv').onclick = () => downloadCSV(fullScrapedData.tips, 'tips_transactions.csv');
        makeDraggable(panel);
    }

    function displayProfitLossPanel(filter = 'all') {
        document.getElementById('pl-analysis-panel')?.remove();
        const now = new Date();
        const filterData = (data) => data.filter(row => {
            if (filter === 'all') return true;
            const rowDate = parseDate(row.Date);
            if (isNaN(rowDate)) return false;
            const daysDiff = (now - rowDate) / (1000 * 60 * 60 * 24);
            if (filter === '24h') return daysDiff <= 1;
            if (filter === '7d') return daysDiff <= 7;
            if (filter === '30d') return daysDiff <= 30;
            if (filter === '90d') return daysDiff <= 90;
            return true;
        });
        const deposits = filterData(fullScrapedData.buys);
        const withdrawals = filterData(fullScrapedData.redeems);
        const totalDeposits = deposits.reduce((sum, row) => sum + row.Amount, 0);
        const totalWithdrawals = withdrawals.reduce((sum, row) => sum + row.Amount, 0);
        const netProfitLoss = totalWithdrawals - totalDeposits;
        const panel = document.createElement('div');
        panel.id = 'pl-analysis-panel';
        panel.style.cssText = `position: fixed; top: 60%; left: 40%; transform: translate(-50%, -50%); width: 400px; background-color: #1a263a; color: white; border: 1px solid #555; border-radius: 8px; z-index: 10002; padding: 15px; font-family: sans-serif; box-shadow: 0 5px 15px rgba(0,0,0,0.6); user-select: none;`;
        const filterBtnStyle = (f) => `background-color: ${filter === f ? '#4CAF50' : '#555'}; color: white; border: none; font-size: 10px; padding: 4px 8px; border-radius: 3px; cursor: pointer; margin: 0 2px;`;
        const netColor = netProfitLoss >= 0 ? '#4CAF50' : '#F44336';
        panel.innerHTML = `
            <div id="pl-analysis-panel-header" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #444; padding-bottom: 8px; margin-bottom: 8px; cursor: move;">
                <h3 style="margin: 0; font-size: 16px;">Profit/Loss Analysis</h3>
                <button class="close-pl-panel" style="background: none; border: none; color: white; font-size: 20px; cursor: pointer;">&times;</button>
            </div>
            <div style="font-size: 12px; margin-bottom: 15px; text-align: center;">
                <button class="pl-filter-btn" data-filter="24h" style="${filterBtnStyle('24h')}">24 Hours</button>
                <button class="pl-filter-btn" data-filter="7d" style="${filterBtnStyle('7d')}">7 Days</button>
                <button class="pl-filter-btn" data-filter="30d" style="${filterBtnStyle('30d')}">30 Days</button>
                <button class="pl-filter-btn" data-filter="90d" style="${filterBtnStyle('90d')}">90 Days</button>
                <button class="pl-filter-btn" data-filter="all" style="${filterBtnStyle('all')}">All Time</button>
            </div>
            <div style="text-align: center; font-size: 14px;">
                <p style="margin: 5px 0;">Total Deposits: <span style="color: #F44336;">$${totalDeposits.toFixed(2)}</span></p>
                <p style="margin: 5px 0;">Total Withdrawals: <span style="color: #4CAF50;">$${totalWithdrawals.toFixed(2)}</span></p>
                <hr style="border-color: #444; margin: 10px 0;" />
                <p style="margin: 5px 0; font-size: 16px; font-weight: bold;">Net Profit/Loss: <span style="color: ${netColor};">$${netProfitLoss.toFixed(2)}</span></p>
            </div>
            <div style="text-align: center; margin-top: 15px; border-top: 1px solid #444; padding-top: 10px;">
                <button id="download-pl-csv" style="${filterBtnStyle('csv')}">Download P/L CSV</button>
            </div>
        `;
        document.body.appendChild(panel);
        panel.querySelector('.close-pl-panel').onclick = () => panel.remove();
        panel.querySelectorAll('.pl-filter-btn').forEach(button => {
            button.onclick = (e) => displayProfitLossPanel(e.target.dataset.filter);
        });
        document.getElementById('download-pl-csv').onclick = () => {
            const plData = [...fullScrapedData.buys, ...fullScrapedData.redeems];
            downloadCSV(plData, 'profit_loss_transactions.csv');
        };
        makeDraggable(panel);
    }

    // Unchanged functions (displayUserDetailPanel, displayPlayerDatabasePanel, makeDraggable, downloadCSV) are included below
    async function displayUserDetailPanel(user, myUsername, allData) {
        const panelId = `detail-panel-${user}`;
        document.getElementById(panelId)?.remove();
        const excludedIds = await GM_getValue('excluded_transactions', []);
        const userTransactions = allData.filter(row => ((row.From === myUsername && row.To === user) || (row.From === user && row.To === myUsername)));
        userTransactions.sort((a, b) => parseDate(b.Date) - parseDate(a.Date));
        const panel = document.createElement('div');
        panel.id = panelId;
        panel.style.cssText = `position: fixed; top: 55%; left: 55%; transform: translate(-50%, -50%); width: 450px; background-color: #1a263a; color: white; border: 1px solid #555; border-radius: 8px; z-index: 10001; padding: 15px; font-family: sans-serif; box-shadow: 0 5px 15px rgba(0,0,0,0.6); user-select: none;`;
        let tableRows = userTransactions.map(row => {
            const direction = row.From === myUsername ? 'Sent' : 'Received';
            const color = direction === 'Sent' ? '#F44336' : '#4CAF50';
            const isExcluded = excludedIds.includes(row.id);
            return `<tr style="opacity: ${isExcluded ? '0.4' : '1'};">
                        <td style="color: ${color}; padding: 4px;">${direction}</td>
                        <td style="padding: 4px;">${parseFloat(row.Amount).toFixed(4)}</td>
                        <td style="padding: 4px;">${row.Date}</td>
                        <td style="padding: 4px;"><button class="exclude-btn" data-id="${row.id}" style="font-size:10px; cursor:pointer;">${isExcluded ? 'Include' : 'Exclude'}</button></td>
                    </tr>`;
        }).join('');
        let html = `
            <div id="${panelId}-header" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #444; padding-bottom: 8px; margin-bottom: 8px; cursor: move;">
                <h3 style="margin: 0; font-size: 16px;">History with ${user}</h3>
                <button class="close-detail-panel" style="background: none; border: none; color: white; font-size: 20px; cursor: pointer;">&times;</button>
            </div>
            <div style="max-height: 300px; overflow-y: auto;">
                <table style="width: 100%; font-size: 12px; border-collapse: collapse;">
                    <thead><tr><th>Direction</th><th>Amount</th><th>Date</th><th>Action</th></tr></thead>
                    <tbody>${tableRows}</tbody>
                </table>
            </div>
        `;
        panel.innerHTML = html;
        document.body.appendChild(panel);
        panel.querySelector('.close-detail-panel').onclick = () => panel.remove();
        panel.querySelectorAll('.exclude-btn').forEach(button => {
            button.onclick = async (e) => {
                const transactionId = e.target.dataset.id;
                let currentExclusions = await GM_getValue('excluded_transactions', []);
                if (currentExclusions.includes(transactionId)) {
                    currentExclusions = currentExclusions.filter(id => id !== transactionId);
                } else {
                    currentExclusions.push(transactionId);
                }
                await GM_setValue('excluded_transactions', currentExclusions);
                const activeFilterEl = document.querySelector('#analysis-panel .filter-btn[style*="background-color: rgb(76, 175, 80)"]');
                const activeFilter = activeFilterEl ? activeFilterEl.dataset.filter : 'all';
                await analyzeAndDisplayBalances(fullScrapedData.tips, activeFilter);
                displayUserDetailPanel(user, myUsername, allData);
            };
        });
        makeDraggable(panel);
    }
    async function displayPlayerDatabasePanel(myUsername, allData) {
        const panelId = 'player-database-panel';
        document.getElementById(panelId)?.remove();
        const excludedIds = await GM_getValue('excluded_transactions', []);
        const activeData = allData.filter(row => !excludedIds.includes(row.id));
        const playerStats = {};
        activeData.forEach(row => {
            const amount = parseFloat(row.Amount);
            if (isNaN(amount)) return;
            const otherUser = row.From === myUsername ? row.To : row.From;
            if (!playerStats[otherUser]) {
                playerStats[otherUser] = { totalSent: 0, totalReceived: 0 };
            }
            if (row.From === myUsername) {
                playerStats[otherUser].totalSent += amount;
            } else {
                playerStats[otherUser].totalReceived += amount;
            }
        });
        const playerList = Object.keys(playerStats).map(user => ({
            user,
            totalSent: playerStats[user].totalSent,
            totalReceived: playerStats[user].totalReceived,
            netBalance: playerStats[user].totalReceived - playerStats[user].totalSent,
        }));
        const panel = document.createElement('div');
        panel.id = panelId;
        panel.style.cssText = `position: fixed; top: 45%; left: 45%; transform: translate(-50%, -50%); width: 600px; background-color: #1a263a; color: white; border: 1px solid #555; border-radius: 8px; z-index: 10002; padding: 15px; font-family: sans-serif; box-shadow: 0 5px 15px rgba(0,0,0,0.6); user-select: none;`;
        const renderTable = (sortKey, sortAsc = false) => {
            if (sortKey === 'user') {
                playerList.sort((a, b) => a.user.localeCompare(b.user) * (sortAsc ? 1 : -1));
            } else {
                playerList.sort((a, b) => (sortAsc ? a[sortKey] - b[sortKey] : b[sortKey] - a[sortKey]));
            }
            const userLinkStyle = `color: #87CEEB; text-decoration: underline; cursor: pointer;`;
            const tableRows = playerList.map(p => {
                const netColor = p.netBalance > 0 ? '#4CAF50' : (p.netBalance < 0 ? '#F44336' : 'white');
                return `<tr>
                    <td style="padding: 4px;"><a class="db-user-detail-link" href="#" data-user="${p.user}" style="${userLinkStyle}">${p.user}</a></td>
                    <td style="padding: 4px;">${p.totalSent.toFixed(4)}</td>
                    <td style="padding: 4px;">${p.totalReceived.toFixed(4)}</td>
                    <td style="padding: 4px; color: ${netColor}; font-weight: bold;">${p.netBalance.toFixed(4)}</td>
                </tr>`;
            }).join('');
            const headerStyle = `cursor: pointer;`;
            panel.innerHTML = `
                <div id="${panelId}-header" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #444; padding-bottom: 8px; margin-bottom: 8px; cursor: move;">
                    <h3 style="margin: 0; font-size: 16px;">Player Database</h3>
                    <button class="close-db-panel" style="background: none; border: none; color: white; font-size: 20px; cursor: pointer;">&times;</button>
                </div>
                <div style="max-height: 500px; overflow-y: auto;">
                    <table style="width: 100%; font-size: 12px; border-collapse: collapse;">
                        <thead>
                            <tr>
                                <th style="${headerStyle}" data-sort="user">Username</th>
                                <th style="${headerStyle}" data-sort="totalSent">Total Sent To Them</th>
                                <th style="text-align: left; ${headerStyle}" data-sort="totalReceived">Total Received From Them</th>
                                <th style="${headerStyle}" data-sort="netBalance">Net Balance</th>
                            </tr>
                        </thead>
                        <tbody>${tableRows}</tbody>
                    </table>
                </div>
            `;
            panel.querySelector('.close-db-panel').onclick = () => panel.remove();
            panel.querySelectorAll('th[data-sort]').forEach(th => {
                th.onclick = (e) => {
                    const newSortKey = e.target.dataset.sort;
                    renderTable(newSortKey, false);
                };
            });
            panel.querySelectorAll('.db-user-detail-link').forEach(link => {
                link.onclick = (e) => {
                    e.preventDefault();
                    displayUserDetailPanel(e.target.dataset.user, myUsername, fullScrapedData.tips);
                };
            });
            makeDraggable(panel);
        };
        renderTable('netBalance', false);
        document.body.appendChild(panel);
    }
    function makeDraggable(element) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        const header = element.querySelector("#" + element.id + "-header");
        if (header) header.onmousedown = dragMouseDown;
        function dragMouseDown(e) { e.preventDefault(); pos3 = e.clientX; pos4 = e.clientY; document.onmouseup = closeDragElement; document.onmousemove = elementDrag; }
        function elementDrag(e) { e.preventDefault(); pos1 = pos3 - e.clientX; pos2 = pos4 - e.clientY; pos3 = e.clientX; pos4 = e.clientY; element.style.top = (element.offsetTop - pos2) + "px"; element.style.left = (element.offsetLeft - pos1) + "px"; }
        function closeDragElement() { document.onmouseup = null; document.onmousemove = null; }
    }
    function downloadCSV(data, filename) {
        if (data.length === 0) { console.log(`No data for ${filename} to download.`); return; }
        const csv = Papa.unparse(data);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        console.log(`Successfully prepared ${data.length} rows for download as ${filename}.`);
    }

})();

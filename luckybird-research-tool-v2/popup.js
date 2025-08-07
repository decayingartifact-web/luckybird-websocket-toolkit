// Popup script for the WebSocket Research Tool v2.0
document.addEventListener('DOMContentLoaded', function() {
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    const totalMessages = document.getElementById('totalMessages');
    const filteredCount = document.getElementById('filteredCount');
    const toggleDashboard = document.getElementById('toggleDashboard');
    const clearData = document.getElementById('clearData');
    const exportData = document.getElementById('exportData');

    // Check if we're on luckybird.io
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        const currentTab = tabs[0];
        
        if (currentTab.url && currentTab.url.includes('luckybird.io')) {
            statusDot.classList.add('active');
            statusText.textContent = 'Active - Research Tool Ready';
            
            // Get statistics from the content script
            chrome.tabs.sendMessage(currentTab.id, {action: 'getStats'}, function(response) {
                if (response && response.stats) {
                    totalMessages.textContent = response.stats.totalMessages || 0;
                    filteredCount.textContent = response.stats.filteredMessages || 0;
                }
            });
        } else {
            statusText.textContent = 'Navigate to luckybird.io';
        }
    });

    // Toggle dashboard visibility
    toggleDashboard.addEventListener('click', function() {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            const currentTab = tabs[0];
            
            if (currentTab.url && currentTab.url.includes('luckybird.io')) {
                chrome.tabs.sendMessage(currentTab.id, {action: 'toggleDashboard'});
                window.close();
            } else {
                alert('Please navigate to luckybird.io first');
            }
        });
    });

    // Clear data
    clearData.addEventListener('click', function() {
        if (confirm('Clear all captured WebSocket research data?')) {
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                const currentTab = tabs[0];
                
                if (currentTab.url && currentTab.url.includes('luckybird.io')) {
                    chrome.tabs.sendMessage(currentTab.id, {action: 'clearData'});
                    totalMessages.textContent = '0';
                    filteredCount.textContent = '0';
                } else {
                    alert('Please navigate to luckybird.io first');
                }
            });
        }
    });

    // Export data
    exportData.addEventListener('click', function() {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            const currentTab = tabs[0];
            
            if (currentTab.url && currentTab.url.includes('luckybird.io')) {
                chrome.tabs.sendMessage(currentTab.id, {action: 'exportData'});
                window.close();
            } else {
                alert('Please navigate to luckybird.io first');
            }
        });
    });
});

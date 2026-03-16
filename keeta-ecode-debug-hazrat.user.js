// ==UserScript==
// @name         Keeta - 调试HAZRAT
// @namespace    http://tampermonkey.net/
// @version      debug
// @description  专门调试HAZRAT SUBHAN ULLAH匹配问题
// @author       You
// @match        https://courier.mykeeta.com/*
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    console.log('[Keeta Debug] 调试版启动 - 专门查HAZRAT');

    const SHEET_ID = '1ygLS9F-lTiWONtHF0JY4SZpj7C7cFm0aLpLbS_iz9DE';
    let riders = [];
    let isLoaded = false;

    GM_addStyle(`
        .debug-panel {
            position: fixed;
            top: 10px;
            right: 10px;
            width: 400px;
            max-height: 80vh;
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.2);
            z-index: 99999;
            font-size: 13px;
            overflow: auto;
            padding: 15px;
        }
        .debug-title {
            font-weight: bold;
            margin-bottom: 10px;
            color: #333;
        }
        .debug-section {
            margin-bottom: 15px;
            padding: 10px;
            background: #f5f5f5;
            border-radius: 8px;
        }
        .debug-item {
            padding: 5px;
            border-bottom: 1px solid #ddd;
            font-family: monospace;
            font-size: 12px;
        }
        .match { background: #e8f5e9; }
        .nomatch { background: #ffebee; }
        .test-btn {
            width: 100%;
            padding: 10px;
            background: #FFD100;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            margin-top: 10px;
        }
    `);

    async function loadData() {
        try {
            const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Sheet1`;
            const response = await fetch(url);
            const text = await response.text();

            const lines = text.split('\n');
            const headers = parseLine(lines[0]);

            let nameIdx = headers.findIndex(h => h.toLowerCase().includes('name'));
            let ecodeIdx = headers.findIndex(h => h.toLowerCase().includes('ecode'));
            if (nameIdx === -1) nameIdx = 1;
            if (ecodeIdx === -1) ecodeIdx = 3;

            riders = [];
            for (let i = 1; i < lines.length; i++) {
                const values = parseLine(lines[i]);
                if (values.length > Math.max(nameIdx, ecodeIdx)) {
                    const name = values[nameIdx].trim();
                    const ecode = values[ecodeIdx].trim();
                    if (name && ecode) {
                        riders.push({ name, ecode, lowerName: name.toLowerCase() });
                    }
                }
            }

            isLoaded = true;
            console.log('[Keeta Debug] 加载完成:', riders.length, '人');

            // 专门查HAZRAT
            const hazratRiders = riders.filter(r => r.lowerName.includes('hazrat'));
            console.log('[Keeta Debug] 包含HAZRAT的骑手:', hazratRiders);

            createDebugPanel(hazratRiders);
            scanPageForHazrat();

        } catch (err) {
            console.error('[Keeta Debug] 加载失败:', err);
        }
    }

    function parseLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current.trim());
        return result;
    }

    function createDebugPanel(hazratRiders) {
        const panel = document.createElement('div');
        panel.className = 'debug-panel';
        panel.innerHTML = `
            <div class="debug-title">🔍 HAZRAT 调试面板</div>
            <div class="debug-section">
                <div style="font-weight:bold;margin-bottom:5px;">表格中包含HAZRAT的骑手:</div>
                ${hazratRiders.map(r => `
                    <div class="debug-item">
                        "${r.name}" → ${r.ecode}
                    </div>
                `).join('')}
            </div>
            <div class="debug-section">
                <div style="font-weight:bold;margin-bottom:5px;">页面上找到的HAZRAT:</div>
                <div id="pageHazratList"></div>
            </div>
            <div class="debug-section">
                <div style="font-weight:bold;margin-bottom:5px;">匹配测试结果:</div>
                <div id="matchTestResult"></div>
            </div>
            <button class="test-btn" onclick="window.testMatch()">测试匹配逻辑</button>
            <button class="test-btn" onclick="window.scanPage()" style="margin-top:5px;">重新扫描页面</button>
        `;
        document.body.appendChild(panel);

        window.testMatch = function() {
            const resultDiv = document.getElementById('matchTestResult');
            const testCases = [
                'HAZRAT SUBHAN ULLAH',
                'HAZRAT SUBHAN',
                'HAZRAT SUBHAN...',
                'HAZRAT S',
                'hazrat subhan ullah',
                'Hazrat Subhan'
            ];

            let html = '';
            testCases.forEach(test => {
                const match = findMatch(test);
                if (match) {
                    html += `<div class="debug-item match">✅ "${test}" → ${match.ecode}</div>`;
                } else {
                    html += `<div class="debug-item nomatch">❌ "${test}" → 无匹配</div>`;
                }
            });
            resultDiv.innerHTML = html;
        };

        window.scanPage = scanPageForHazrat;
    }

    function findMatch(text) {
        if (!text) return null;
        const cleanText = text.replace(/[.…]+/g, '').trim().toLowerCase();

        const matches = [];
        for (let rider of riders) {
            if (rider.lowerName.startsWith(cleanText) ||
                cleanText.startsWith(rider.lowerName) ||
                rider.lowerName === cleanText) {
                matches.push(rider);
            }
        }

        return matches.length === 1 ? matches[0] : null;
    }

    function scanPageForHazrat() {
        const elements = document.querySelectorAll('td, span, div, a, p, label');
        const found = [];

        elements.forEach(el => {
            const text = el.textContent.trim();
            if (text && text.toLowerCase().includes('hazrat')) {
                found.push({
                    text: text,
                    tag: el.tagName,
                    className: el.className
                });
            }
        });

        console.log('[Keeta Debug] 页面上找到的HAZRAT:', found);

        const listDiv = document.getElementById('pageHazratList');
        if (listDiv) {
            if (found.length === 0) {
                listDiv.innerHTML = '<div class="debug-item">页面上没有找到HAZRAT</div>';
            } else {
                listDiv.innerHTML = found.map(f => `
                    <div class="debug-item">
                        "${f.text}"<br>
                        <span style="color:#666;font-size:11px;">
                            标签: ${f.tag} |
                            class: ${f.className || '无'}
                        </span>
                    </div>
                `).join('');
            }
        }
    }

    // 启动
    setTimeout(loadData, 1000);
})();

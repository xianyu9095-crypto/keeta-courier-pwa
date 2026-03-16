// ==UserScript==
// @name         Keeta - ECODE调试版 (Firefox)
// @namespace    http://tampermonkey.net/
// @version      debug
// @description  Firefox调试版 - 显示详细匹配过程
// @author       You
// @match        https://courier.mykeeta.com/*
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    console.log('[Keeta Debug] 调试版启动');

    // 防止重复运行
    if (window.keetaDebugLoaded) return;
    window.keetaDebugLoaded = true;

    const SHEET_ID = '1ygLS9F-lTiWONtHF0JY4SZpj7C7cFm0aLpLbS_iz9DE';
    let riders = [];
    let debugLogs = [];

    // 添加样式
    GM_addStyle(`
        .keeta-debug-panel {
            position: fixed !important;
            top: 10px !important;
            left: 10px !important;
            right: 10px !important;
            max-height: 80vh !important;
            background: white !important;
            border-radius: 12px !important;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3) !important;
            z-index: 2147483647 !important;
            font-size: 13px !important;
            overflow: auto !important;
            border: 3px solid #FFD100 !important;
        }
        .keeta-debug-header {
            background: linear-gradient(135deg, #FFD100 0%, #FFA500 100%);
            padding: 15px;
            font-weight: bold;
            position: sticky;
            top: 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .keeta-debug-content {
            padding: 15px;
        }
        .keeta-debug-section {
            margin-bottom: 20px;
            padding: 12px;
            background: #f5f5f5;
            border-radius: 8px;
        }
        .keeta-debug-title {
            font-weight: bold;
            color: #333;
            margin-bottom: 8px;
            font-size: 14px;
        }
        .keeta-debug-log {
            padding: 6px 10px;
            margin: 4px 0;
            border-radius: 6px;
            font-family: monospace;
            font-size: 12px;
            word-break: break-all;
        }
        .keeta-log-success { background: #e8f5e9; border-left: 3px solid #4CAF50; }
        .keeta-log-error { background: #ffebee; border-left: 3px solid #f44336; }
        .keeta-log-info { background: #e3f2fd; border-left: 3px solid #2196F3; }
        .keeta-log-warn { background: #fff3e0; border-left: 3px solid #FF9800; }
        .keeta-close-btn {
            background: #333;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 6px;
            cursor: pointer;
        }
        .keeta-test-btn {
            background: #4CAF50;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 8px;
            cursor: pointer;
            margin-top: 10px;
            font-size: 14px;
        }
    `);

    function log(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = { time: timestamp, message, type };
        debugLogs.push(logEntry);
        console.log(`[Keeta Debug] ${message}`);
        updateDebugPanel();
    }

    function createDebugPanel() {
        // 检查是否已存在
        if (document.getElementById('keetaDebugPanel')) return;

        const panel = document.createElement('div');
        panel.id = 'keetaDebugPanel';
        panel.className = 'keeta-debug-panel';
        panel.innerHTML = `
            <div class="keeta-debug-header">
                <span>🔍 Keeta ECODE 调试面板</span>
                <button class="keeta-close-btn" onclick="document.getElementById('keetaDebugPanel').style.display='none'">关闭</button>
            </div>
            <div class="keeta-debug-content" id="keetaDebugContent">
                <div class="keeta-debug-section">
                    <div class="keeta-debug-title">📋 调试日志</div>
                    <div id="keetaLogList">加载中...</div>
                </div>
                <div class="keeta-debug-section">
                    <div class="keeta-debug-title">📊 数据统计</div>
                    <div id="keetaStats">等待数据...</div>
                </div>
                <div class="keeta-debug-section">
                    <div class="keeta-debug-title">🧪 测试功能</div>
                    <button class="keeta-test-btn" onclick="window.testHazrat()">测试 HAZRAT SUBHAN ULLAH</button>
                    <button class="keeta-test-btn" onclick="window.rescanPage()" style="margin-left: 10px; background: #2196F3;">重新扫描页面</button>
                </div>
            </div>
        `;
        document.body.appendChild(panel);

        // 全局测试函数
        window.testHazrat = function() {
            testSpecificRider('HAZRAT SUBHAN ULLAH');
        };

        window.rescanPage = function() {
            document.querySelectorAll('.keeta-ecode-badge').forEach(el => el.remove());
            document.querySelectorAll('[data-keeta-matched]').forEach(el => {
                delete el.dataset.keetaMatched;
            });
            debugLogs = [];
            processPage();
        };
    }

    function updateDebugPanel() {
        const logList = document.getElementById('keetaLogList');
        const stats = document.getElementById('keetaStats');

        if (logList) {
            logList.innerHTML = debugLogs.slice(-20).map(log => `
                <div class="keeta-debug-log keeta-log-${log.type}">
                    <span style="color: #999;">[${log.time}]</span> ${log.message}
                </div>
            `).join('');
        }

        if (stats) {
            const matchCount = document.querySelectorAll('.keeta-ecode-badge').length;
            stats.innerHTML = `
                <div>表格骑手数: ${riders.length}</div>
                <div>页面匹配数: ${matchCount}</div>
                <div>日志条数: ${debugLogs.length}</div>
            `;
        }
    }

    async function loadData() {
        log('开始加载数据...', 'info');

        try {
            const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Sheet1`;
            log(`请求URL: ${url}`, 'info');

            const response = await fetch(url);
            log(`响应状态: ${response.status}`, response.ok ? 'success' : 'error');

            const text = await response.text();
            log(`获取数据长度: ${text.length} 字符`, 'success');

            const lines = text.split('\n');
            log(`总行数: ${lines.length}`, 'info');

            // 解析标题
            const headers = parseLine(lines[0]);
            log(`表头: ${headers.join(', ')}`, 'info');

            // 找列索引
            let nameIdx = headers.findIndex(h => h.toLowerCase().includes('name'));
            let ecodeIdx = headers.findIndex(h => h.toLowerCase().includes('ecode'));
            if (nameIdx === -1) nameIdx = 1;
            if (ecodeIdx === -1) ecodeIdx = 3;

            log(`Name列索引: ${nameIdx} (${headers[nameIdx]}), ECODE列索引: ${ecodeIdx} (${headers[ecodeIdx]})`, 'info');

            // 解析数据
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

            log(`成功加载 ${riders.length} 条骑手数据`, 'success');

            // 显示前5条
            riders.slice(0, 5).forEach((r, i) => {
                log(`骑手${i+1}: "${r.name}" -> ${r.ecode}`, 'info');
            });

            // 专门找HAZRAT
            const hazratRiders = riders.filter(r => r.lowerName.includes('hazrat'));
            log(`找到 ${hazratRiders.length} 个包含HAZRAT的骑手`, 'warn');
            hazratRiders.forEach(r => {
                log(`  - "${r.name}" -> ${r.ecode}`, 'warn');
            });

            GM_setValue('ridersCache', JSON.stringify(riders));
            processPage();

        } catch (err) {
            log(`加载失败: ${err.message}`, 'error');
            log('尝试使用缓存...', 'info');

            const cached = GM_getValue('ridersCache');
            if (cached) {
                riders = JSON.parse(cached);
                log(`使用缓存数据: ${riders.length} 条`, 'warn');
                processPage();
            }
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

    function testSpecificRider(testName) {
        log(`\n=== 测试特定骑手: "${testName}" ===`, 'warn');

        // 在页面上查找
        const elements = document.querySelectorAll('td, span, div, a, p');
        let foundElements = [];

        elements.forEach(el => {
            const text = el.textContent.trim();
            if (text.toLowerCase().includes(testName.toLowerCase())) {
                foundElements.push({
                    text: text,
                    tag: el.tagName,
                    className: el.className
                });
            }
        });

        log(`在页面上找到 ${foundElements.length} 个包含"${testName}"的元素`, foundElements.length > 0 ? 'success' : 'error');
        foundElements.slice(0, 5).forEach((el, i) => {
            log(`  元素${i+1}: "${el.text}" (标签: ${el.tag})`, 'info');
        });

        // 测试匹配逻辑
        const testRider = riders.find(r => r.lowerName === testName.toLowerCase());
        if (testRider) {
            log(`表格中找到: "${testRider.name}" -> ${testRider.ecode}`, 'success');
        } else {
            log(`表格中未找到完全匹配`, 'error');
        }
    }

    function processPage() {
        if (riders.length === 0) {
            log('没有数据，跳过页面处理', 'error');
            return;
        }

        log('\n=== 开始扫描页面 ===', 'info');

        const elements = document.querySelectorAll('td, span, div, a, p, label');
        log(`扫描 ${elements.length} 个元素`, 'info');

        let matchCount = 0;
        let testedCount = 0;

        elements.forEach(el => {
            // 跳过已处理
            if (el.dataset.keetaMatched) return;
            if (el.querySelector('.keeta-ecode-badge')) {
                el.dataset.keetaMatched = '1';
                return;
            }

            const text = el.textContent.trim();
            if (!text || text.length < 2 || text.length > 50) return;

            testedCount++;

            // 尝试匹配
            const cleanText = text.replace(/[.…]+/g, '').trim().toLowerCase();
            const matches = riders.filter(r =>
                r.lowerName.startsWith(cleanText) ||
                r.lowerName === cleanText
            );

            if (matches.length === 1) {
                // 成功匹配
                const badge = document.createElement('span');
                badge.className = 'keeta-ecode-badge';
                badge.style.cssText = 'display: inline-flex !important; background: linear-gradient(135deg, #FFD100 0%, #FFA500 100%) !important; color: #333 !important; padding: 2px 8px !important; border-radius: 12px !important; font-size: 12px !important; font-weight: 600 !important; margin-left: 8px !important; font-family: monospace !important;';
                badge.textContent = matches[0].ecode;

                badge.addEventListener('click', (e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(matches[0].ecode);
                    badge.textContent = '✓';
                    setTimeout(() => badge.textContent = matches[0].ecode, 1000);
                });

                el.appendChild(badge);
                el.dataset.keetaMatched = '1';

                matchCount++;
                log(`✅ 匹配: "${text}" -> ${matches[0].ecode}`, 'success');
            } else if (matches.length > 1) {
                // 多个匹配
                if (text.toLowerCase().includes('hazrat') || matchCount < 3) {
                    log(`⚠️ 多个匹配 (${matches.length}个): "${text}" -> ${matches.slice(0, 3).map(m => m.name).join(', ')}`, 'warn');
                }
            }
        });

        log(`扫描完成: 测试了 ${testedCount} 个元素，匹配成功 ${matchCount} 个`, matchCount > 0 ? 'success' : 'warn');
    }

    // 初始化
    function init() {
        console.log('[Keeta Debug] 初始化');
        createDebugPanel();
        log('调试面板已创建', 'success');
        loadData();

        // 监听变化
        const observer = new MutationObserver(() => {
            if (riders.length > 0) {
                setTimeout(processPage, 500);
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
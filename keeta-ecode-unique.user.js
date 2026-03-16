// ==UserScript==
// @name         Keeta - ECODE唯一对应版
// @namespace    http://tampermonkey.net/
// @version      7.0
// @description  唯一对应逻辑：网页名字和表格名字前段能唯一匹配，才显示ECODE
// @author       You
// @match        https://courier.mykeeta.com/*
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    console.log('[Keeta Unique] 唯一对应版脚本已加载');

    const SHEET_ID = '1ygLS9F-lTiWONtHF0JY4SZpj7C7cFm0aLpLbS_iz9DE';

    // 存储表格数据: [{name: '完整名字', ecode: 'E123', lowerName: '小写名字'}, ...]
    let riders = [];
    let isDataLoaded = false;
    let processedElements = new WeakSet();

    // 样式
    GM_addStyle(`
        .ecode-badge {
            display: inline-flex !important;
            align-items: center;
            gap: 4px;
            background: linear-gradient(135deg, #FFD100 0%, #FFA500 100%);
            color: #333;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 600;
            margin-left: 8px;
            font-family: monospace;
            cursor: pointer;
            white-space: nowrap;
        }
        .ecode-badge:hover {
            transform: scale(1.05);
            box-shadow: 0 2px 8px rgba(255, 209, 0, 0.4);
        }
        .ecode-badge.copied {
            background: #4CAF50;
            color: white;
        }
        .ecode-panel {
            position: fixed;
            top: 10px;
            right: 10px;
            background: white;
            padding: 10px 15px;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.15);
            z-index: 99999;
            font-size: 13px;
        }
        .ecode-match-highlight {
            background: rgba(255, 209, 0, 0.2) !important;
            border-radius: 4px;
            padding: 2px 4px;
        }
    `);

    // 加载数据
    async function loadData() {
        if (isDataLoaded) return;

        updateStatus('⏳ 加载中...');

        try {
            const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Sheet1`;
            const response = await fetch(url);
            const text = await response.text();

            const lines = text.split('\n');
            const headers = parseLine(lines[0]);

            // 找Name和ECODE列
            let nameIdx = headers.findIndex(h => h.toLowerCase().includes('name'));
            let ecodeIdx = headers.findIndex(h => h.toLowerCase().includes('ecode'));
            if (nameIdx === -1) nameIdx = 1;
            if (ecodeIdx === -1) ecodeIdx = 3;

            // 解析数据
            riders = [];
            for (let i = 1; i < lines.length; i++) {
                const values = parseLine(lines[i]);
                if (values.length > Math.max(nameIdx, ecodeIdx)) {
                    const name = values[nameIdx].trim();
                    const ecode = values[ecodeIdx].trim();
                    if (name && ecode) {
                        riders.push({
                            name: name,
                            ecode: ecode,
                            lowerName: name.toLowerCase()
                        });
                    }
                }
            }

            isDataLoaded = true;
            console.log(`[Keeta Unique] 加载完成: ${riders.length} 人`);
            updateStatus(`✅ 已加载 ${riders.length} 人`);

            // 保存缓存
            GM_setValue('ridersCache', JSON.stringify(riders));

            processPage();

        } catch (err) {
            console.error('[Keeta Unique] 加载失败:', err);
            // 尝试缓存
            const cached = GM_getValue('ridersCache');
            if (cached) {
                riders = JSON.parse(cached);
                isDataLoaded = true;
                updateStatus('⚠️ 使用缓存');
                processPage();
            } else {
                updateStatus('❌ 加载失败');
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

    // 核心逻辑：唯一对应匹配
    function findUniqueMatch(text) {
        if (!text || text.length < 2) return null;

        // 标准化网页文本
        const cleanText = text.replace(/[.…]+/g, '').trim().toLowerCase();
        if (!cleanText) return null;

        // 在表格中查找所有可能的匹配
        const candidates = [];

        for (let rider of riders) {
            const tableName = rider.lowerName;

            // 检查是否匹配：
            // 1. 网页名字是表格名字的前缀（网页名字短，表格名字长）
            // 2. 表格名字是网页名字的前缀（表格名字短，网页名字长）
            // 3. 完全相同

            if (tableName.startsWith(cleanText) ||
                cleanText.startsWith(tableName) ||
                tableName === cleanText) {
                candidates.push(rider);
            }
        }

        // 唯一对应原则：只有一个候选才返回
        if (candidates.length === 1) {
            return candidates[0];
        }

        // 有多个或没有，返回null
        if (candidates.length > 1) {
            console.log(`[Keeta Unique] "${text}" 匹配到 ${candidates.length} 个:`,
                candidates.slice(0, 3).map(c => c.name));
        }

        return null;
    }

    function processPage() {
        if (!isDataLoaded || riders.length === 0) return;

        const elements = document.querySelectorAll('td, span, div, a, p, label');
        let addedCount = 0;

        elements.forEach(el => {
            // 跳过已处理
            if (processedElements.has(el)) return;
            if (el.querySelector('.ecode-badge')) {
                processedElements.add(el);
                return;
            }

            const text = el.textContent.trim();
            if (!text || text.length < 2 || text.length > 50) return;

            // 核心：唯一对应匹配
            const match = findUniqueMatch(text);

            if (match) {
                console.log(`[Keeta Unique] 唯一匹配: "${text}" -> "${match.name}" (${match.ecode})`);

                // 再次检查
                if (el.querySelector('.ecode-badge')) {
                    processedElements.add(el);
                    return;
                }

                const badge = document.createElement('span');
                badge.className = 'ecode-badge';
                badge.textContent = match.ecode;
                badge.title = `骑手: ${match.name}`;

                badge.addEventListener('click', (e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(match.ecode).then(() => {
                        badge.textContent = '✓';
                        setTimeout(() => badge.textContent = match.ecode, 1000);
                    });
                });

                el.appendChild(badge);
                el.classList.add('ecode-match-highlight');
                processedElements.add(el);
                addedCount++;
            }
        });

        if (addedCount > 0) {
            console.log(`[Keeta Unique] 新增 ${addedCount} 个`);
        }
    }

    function createPanel() {
        const panel = document.createElement('div');
        panel.className = 'ecode-panel';
        panel.id = 'keetaPanel';
        panel.innerHTML = `
            <span id="keetaStatus">⏳ 初始化...</span>
            <button onclick="window.refreshKeeta()" style="margin-left:10px;padding:4px 10px;background:#333;color:white;border:none;border-radius:4px;cursor:pointer;">刷新</button>
        `;
        document.body.appendChild(panel);

        window.refreshKeeta = function() {
            isDataLoaded = false;
            processedElements = new WeakSet();
            document.querySelectorAll('.ecode-badge').forEach(el => el.remove());
            document.querySelectorAll('.ecode-match-highlight').forEach(el =>
                el.classList.remove('ecode-match-highlight'));
            loadData();
        };
    }

    function updateStatus(text) {
        const el = document.getElementById('keetaStatus');
        if (el) el.textContent = text;
    }

    function init() {
        console.log('[Keeta Unique] 初始化');
        createPanel();
        loadData();

        // 监听变化
        const observer = new MutationObserver(() => {
            if (isDataLoaded) setTimeout(processPage, 500);
        });
        observer.observe(document.body, { childList: true, subtree: true });

        // 定期扫描
        setInterval(() => {
            if (isDataLoaded) processPage();
        }, 3000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

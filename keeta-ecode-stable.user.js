// ==UserScript==
// @name         Keeta - ECODE显示 (稳定版)
// @namespace    http://tampermonkey.net/
// @version      8.0
// @description  修复重复弹窗和交互问题
// @author       You
// @match        https://courier.mykeeta.com/*
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // 防止重复运行
    if (window.keetaEcodeLoaded) {
        console.log('[Keeta Stable] 脚本已运行，跳过');
        return;
    }
    window.keetaEcodeLoaded = true;

    console.log('[Keeta Stable] 稳定版脚本加载');

    const SHEET_ID = '1ygLS9F-lTiWONtHF0JY4SZpj7C7cFm0aLpLbS_iz9DE';
    let riders = [];
    let isLoaded = false;

    // 样式
    GM_addStyle(`
        .keeta-badge {
            display: inline-flex !important;
            align-items: center;
            background: linear-gradient(135deg, #FFD100 0%, #FFA500 100%) !important;
            color: #000 !important;
            padding: 2px 8px !important;
            border-radius: 4px !important;
            font-size: 11px !important;
            font-weight: bold !important;
            margin-left: 6px !important;
            font-family: monospace !important;
            cursor: pointer !important;
            white-space: nowrap !important;
            user-select: none !important;
        }
        .keeta-panel {
            position: fixed !important;
            top: 10px !important;
            right: 10px !important;
            background: white !important;
            padding: 12px 16px !important;
            border-radius: 10px !important;
            box-shadow: 0 2px 12px rgba(0,0,0,0.15) !important;
            z-index: 2147483647 !important;
            font-size: 13px !important;
            line-height: 1.5 !important;
        }
        .keeta-panel button {
            margin-left: 10px;
            padding: 4px 10px;
            background: #333;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
        }
        .keeta-highlight {
            background: rgba(255, 209, 0, 0.15) !important;
        }
    `);

    // 只创建一次面板
    function createPanelOnce() {
        // 检查是否已存在
        if (document.getElementById('keetaPanel')) {
            console.log('[Keeta Stable] 面板已存在');
            return document.getElementById('keetaPanel');
        }

        const panel = document.createElement('div');
        panel.id = 'keetaPanel';
        panel.className = 'keeta-panel';
        panel.innerHTML = `
            <span id="keetaStatus">⏳ 加载中...</span>
            <button id="keetaRefresh">刷新</button>
        `;

        // 使用事件委托确保按钮可点击
        panel.addEventListener('click', function(e) {
            if (e.target.id === 'keetaRefresh') {
                console.log('[Keeta Stable] 刷新按钮点击');
                doRefresh();
            }
        });

        // 确保body存在再添加
        if (document.body) {
            document.body.appendChild(panel);
            console.log('[Keeta Stable] 面板已创建');
        } else {
            // 等待body
            setTimeout(() => {
                if (document.body) {
                    document.body.appendChild(panel);
                    console.log('[Keeta Stable] 面板延迟创建');
                }
            }, 100);
        }

        return panel;
    }

    function updateStatus(text) {
        const el = document.getElementById('keetaStatus');
        if (el) el.textContent = text;
    }

    async function loadData() {
        if (isLoaded) return;

        updateStatus('⏳ 加载中...');

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
                        riders.push({
                            name: name,
                            ecode: ecode,
                            lowerName: name.toLowerCase()
                        });
                    }
                }
            }

            isLoaded = true;
            console.log(`[Keeta Stable] 加载完成: ${riders.length} 人`);
            updateStatus(`✅ 已加载 ${riders.length} 人`);

            GM_setValue('ridersCache', JSON.stringify(riders));
            processPage();

        } catch (err) {
            console.error('[Keeta Stable] 加载失败:', err);
            // 使用缓存
            const cached = GM_getValue('ridersCache');
            if (cached) {
                riders = JSON.parse(cached);
                isLoaded = true;
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

    // 核心匹配逻辑
    function findUniqueMatch(text) {
        if (!text || text.length < 2) return null;

        const cleanText = text.replace(/[.…]+/g, '').trim().toLowerCase();
        if (!cleanText) return null;

        const matches = [];
        for (let rider of riders) {
            const tableName = rider.lowerName;
            // 网页名字是表格名字的前缀，或完全相同
            if (tableName.startsWith(cleanText) || tableName === cleanText) {
                matches.push(rider);
            }
        }

        // 只有一个匹配才返回
        return matches.length === 1 ? matches[0] : null;
    }

    function processPage() {
        if (!isLoaded || riders.length === 0) return;

        const elements = document.querySelectorAll('td, span, div, a, p, label');
        let added = 0;

        elements.forEach(el => {
            // 跳过已处理
            if (el.dataset.keetaDone) return;
            if (el.querySelector('.keeta-badge')) {
                el.dataset.keetaDone = '1';
                return;
            }

            const text = el.textContent.trim();
            if (!text || text.length < 2 || text.length > 50) return;

            const match = findUniqueMatch(text);

            if (match) {
                const badge = document.createElement('span');
                badge.className = 'keeta-badge';
                badge.textContent = match.ecode;
                badge.title = match.name;

                badge.addEventListener('click', function(e) {
                    e.stopPropagation();
                    e.preventDefault();
                    navigator.clipboard.writeText(match.ecode).then(() => {
                        badge.textContent = '✓';
                        setTimeout(() => badge.textContent = match.ecode, 1000);
                    });
                });

                el.appendChild(badge);
                el.classList.add('keeta-highlight');
                el.dataset.keetaDone = '1';
                added++;
            }
        });

        if (added > 0) {
            console.log(`[Keeta Stable] 新增 ${added} 个`);
        }
    }

    function doRefresh() {
        console.log('[Keeta Stable] 执行刷新');
        isLoaded = false;
        // 清除所有标记
        document.querySelectorAll('[data-keeta-done]').forEach(el => {
            delete el.dataset.keetaDone;
            el.classList.remove('keeta-highlight');
        });
        document.querySelectorAll('.keeta-badge').forEach(el => el.remove());
        // 重新加载
        loadData();
    }

    // 初始化 - 只执行一次
    function init() {
        console.log('[Keeta Stable] 初始化');
        createPanelOnce();
        loadData();

        // 监听DOM变化
        const observer = new MutationObserver(() => {
            if (isLoaded) setTimeout(processPage, 300);
        });
        observer.observe(document.body, { childList: true, subtree: true });

        // 定期扫描
        setInterval(() => {
            if (isLoaded) processPage();
        }, 5000);
    }

    // 启动
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

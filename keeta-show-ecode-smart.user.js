// ==UserScript==
// @name         Keeta - 显示骑手ECODE (智能匹配版)
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  智能匹配缩写名字，支持点击选择
// @author       You
// @match        https://courier.mykeeta.com/*
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    console.log('[Keeta ECODE Smart] 智能版脚本已加载');

    const SHEET_ID = '1ygLS9F-lTiWONtHF0JY4SZpj7C7cFm0aLpLbS_iz9DE';

    let ecodeMap = new Map();
    let nameList = []; // 存储所有名字用于模糊匹配
    let isDataLoaded = false;

    // 添加样式
    GM_addStyle(`
        .ecode-badge {
            display: inline-flex;
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
            transition: all 0.2s;
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

        .ecode-partial {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            background: #e3f2fd;
            color: #1976d2;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 11px;
            margin-left: 8px;
            cursor: pointer;
            border: 1px solid #90caf9;
        }

        .ecode-partial:hover {
            background: #bbdefb;
        }

        .ecode-selector {
            position: absolute;
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.2);
            padding: 10px;
            z-index: 10000;
            min-width: 200px;
            max-height: 300px;
            overflow-y: auto;
        }

        .ecode-selector-item {
            padding: 10px 15px;
            border-radius: 8px;
            cursor: pointer;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .ecode-selector-item:hover {
            background: #f5f5f5;
        }

        .ecode-selector-name {
            font-weight: 500;
        }

        .ecode-selector-code {
            background: #FFD100;
            padding: 2px 8px;
            border-radius: 10px;
            font-size: 12px;
            font-family: monospace;
        }

        .status-panel {
            position: fixed;
            top: 10px;
            right: 10px;
            background: white;
            padding: 12px 15px;
            border-radius: 12px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.15);
            z-index: 9999;
            font-size: 13px;
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .status-text {
            color: #666;
        }

        .status-count {
            background: #FFD100;
            color: #333;
            padding: 4px 10px;
            border-radius: 12px;
            font-weight: 600;
        }

        .btn-refresh {
            background: #333;
            color: white;
            border: none;
            padding: 6px 12px;
            border-radius: 6px;
            font-size: 12px;
            cursor: pointer;
        }
    `);

    // 加载数据
    async function loadData() {
        if (isDataLoaded) return;

        try {
            const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Sheet1`;
            const response = await fetch(csvUrl);
            const csvText = await response.text();

            const lines = csvText.split('\n');
            if (lines.length < 2) throw new Error('表格为空');

            // 解析列
            const headers = parseCSVLine(lines[0]);
            let nameIdx = -1, ecodeIdx = -1;
            headers.forEach((h, i) => {
                const lower = h.toLowerCase();
                if (nameIdx === -1 && (lower.includes('名字') || lower.includes('姓名') || lower.includes('name'))) nameIdx = i;
                if (ecodeIdx === -1 && (lower.includes('ecode') || lower.includes('code') || lower.includes('编号'))) ecodeIdx = i;
            });
            if (nameIdx === -1) nameIdx = 0;
            if (ecodeIdx === -1) ecodeIdx = 1;

            // 解析所有数据
            ecodeMap.clear();
            nameList = [];

            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;

                const values = parseCSVLine(line);
                if (values.length > Math.max(nameIdx, ecodeIdx)) {
                    const name = values[nameIdx].trim();
                    const ecode = values[ecodeIdx].trim();
                    if (name && ecode) {
                        ecodeMap.set(name, ecode);
                        nameList.push(name);

                        // 也存无空格版本
                        ecodeMap.set(name.replace(/\s/g, ''), ecode);

                        // 存前2-3个字的缩写版本
                        if (name.length >= 2) {
                            ecodeMap.set(name.substring(0, 2), ecode);
                        }
                        if (name.length >= 3) {
                            ecodeMap.set(name.substring(0, 3), ecode);
                        }
                    }
                }
            }

            isDataLoaded = true;
            updateStatus(`✅ 已加载 ${nameList.length} 人`);
            processPage();

        } catch (err) {
            console.error('加载失败:', err);
            updateStatus('❌ 加载失败');
        }
    }

    function parseCSVLine(line) {
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

    function processPage() {
        if (!isDataLoaded) return;

        const elements = document.querySelectorAll('td, span, div, a, p');

        elements.forEach(el => {
            if (el.dataset.ecodeProcessed) return;

            let text = el.textContent.trim();
            if (!text || text.length < 2) return;

            // 检查是否包含中文
            if (!/[\u4e00-\u9fa5]/.test(text)) return;

            // 移除省略号，获取原始名字（可能不完整）
            const originalText = text;
            text = text.replace(/[.…]+/g, '').trim();

            let ecode = null;
            let matchType = 'none'; // 'exact', 'partial'

            // 1. 精确匹配
            if (ecodeMap.has(text)) {
                ecode = ecodeMap.get(text);
                matchType = 'exact';
            }
            // 2. 无空格版本
            else if (ecodeMap.has(text.replace(/\s/g, ''))) {
                ecode = ecodeMap.get(text.replace(/\s/g, ''));
                matchType = 'exact';
            }
            // 3. 前缀匹配（处理缩写）
            else {
                // 查找所有以text开头的名字
                const matches = nameList.filter(name =>
                    name.startsWith(text) ||
                    text.startsWith(name.substring(0, Math.min(name.length, text.length + 1)))
                );

                if (matches.length === 1) {
                    // 只有一个匹配，直接显示
                    ecode = ecodeMap.get(matches[0]);
                    matchType = 'partial';
                } else if (matches.length > 1) {
                    // 多个匹配，显示选择器
                    showSelector(el, text, matches);
                    el.dataset.ecodeProcessed = 'true';
                    return;
                }
            }

            if (ecode && !el.querySelector('.ecode-badge, .ecode-partial')) {
                const badge = document.createElement('span');
                badge.className = matchType === 'exact' ? 'ecode-badge' : 'ecode-partial';
                badge.textContent = ecode;
                badge.title = matchType === 'partial' ? `可能是: ${originalText}` : '点击复制';

                badge.addEventListener('click', (e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(ecode).then(() => {
                        badge.textContent = '✓';
                        badge.classList.add('copied');
                        setTimeout(() => {
                            badge.textContent = ecode;
                            badge.classList.remove('copied');
                        }, 1000);
                    });
                });

                el.appendChild(badge);
                el.dataset.ecodeProcessed = 'true';
            }
        });
    }

    function showSelector(element, partialName, matches) {
        // 创建选择器
        const selector = document.createElement('div');
        selector.className = 'ecode-selector';

        const title = document.createElement('div');
        title.style.cssText = 'padding: 8px; color: #666; font-size: 12px; border-bottom: 1px solid #eee; margin-bottom: 5px;';
        title.textContent = `"${partialName}" 可能匹配:`;
        selector.appendChild(title);

        matches.slice(0, 5).forEach(name => {
            const item = document.createElement('div');
            item.className = 'ecode-selector-item';
            item.innerHTML = `
                <span class="ecode-selector-name">${name}</span>
                <span class="ecode-selector-code">${ecodeMap.get(name)}</span>
            `;
            item.addEventListener('click', () => {
                navigator.clipboard.writeText(ecodeMap.get(name));
                selector.remove();

                // 添加ECODE标签
                const badge = document.createElement('span');
                badge.className = 'ecode-badge';
                badge.textContent = ecodeMap.get(name);
                element.appendChild(badge);
            });
            selector.appendChild(item);
        });

        // 定位
        const rect = element.getBoundingClientRect();
        selector.style.left = rect.left + 'px';
        selector.style.top = (rect.bottom + 5) + 'px';

        document.body.appendChild(selector);

        // 点击外部关闭
        setTimeout(() => {
            document.addEventListener('click', function close(e) {
                if (!selector.contains(e.target)) {
                    selector.remove();
                    document.removeEventListener('click', close);
                }
            });
        }, 100);
    }

    function createPanel() {
        const panel = document.createElement('div');
        panel.className = 'status-panel';
        panel.id = 'statusPanel';
        panel.innerHTML = `
            <span class="status-text">⏳ 初始化...</span>
            <span class="status-count">0</span>
            <button class="btn-refresh" onclick="location.reload()">刷新</button>
        `;
        document.body.appendChild(panel);
    }

    function updateStatus(text) {
        const panel = document.getElementById('statusPanel');
        if (panel) {
            panel.querySelector('.status-text').textContent = text;
            panel.querySelector('.status-count').textContent = isDataLoaded ? nameList.length : '0';
        }
    }

    function init() {
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
        }, 2000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
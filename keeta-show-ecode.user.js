// ==UserScript==
// @name         Keeta - 显示骑手ECODE
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  在美团骑手后台自动显示骑手的ECODE
// @author       You
// @match        https://courier.mykeeta.com/*
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    console.log('[Keeta ECODE] 脚本已加载');

    // Google 表格配置 - 在这里填入你的表格ID
    const SHEET_ID = '1ygLS9F-lTiWONtHF0JY4SZpj7C7cFm0aLpLbS_iz9DE';

    // ECODE映射表
    let ecodeMap = new Map();
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

        .ecode-loading {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            background: #f0f0f0;
            color: #999;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 11px;
            margin-left: 8px;
        }

        .ecode-panel {
            position: fixed;
            top: 10px;
            right: 10px;
            background: white;
            padding: 10px 15px;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.15);
            z-index: 9999;
            font-size: 13px;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .ecode-panel .status {
            color: #666;
        }

        .ecode-panel .count {
            background: #FFD100;
            color: #333;
            padding: 2px 8px;
            border-radius: 10px;
            font-weight: 600;
        }

        .ecode-panel button {
            background: #333;
            color: white;
            border: none;
            padding: 6px 12px;
            border-radius: 6px;
            font-size: 12px;
            cursor: pointer;
        }

        .ecode-match-highlight {
            background: rgba(255, 209, 0, 0.2) !important;
            border-radius: 4px;
            padding: 2px 4px;
        }
    `);

    // 从Google表格加载数据
    async function loadEcodeData() {
        if (isDataLoaded) return;

        console.log('[Keeta ECODE] 正在加载数据...');
        updatePanelStatus('⏳ 加载中...');

        try {
            const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Sheet1`;
            const response = await fetch(csvUrl);
            const csvText = await response.text();

            // 解析CSV
            const lines = csvText.split('\n');
            if (lines.length < 2) {
                throw new Error('表格数据为空');
            }

            // 第一行是标题，找出名字和ECODE列
            const headers = parseCSVLine(lines[0]);
            let nameIndex = -1;
            let ecodeIndex = -1;

            headers.forEach((h, i) => {
                const lower = h.toLowerCase();
                if (nameIndex === -1 && (lower.includes('名字') || lower.includes('姓名') || lower.includes('name') || lower.includes('骑手'))) {
                    nameIndex = i;
                }
                if (ecodeIndex === -1 && (lower.includes('ecode') || lower.includes('code') || lower.includes('编号') || lower.includes('工号'))) {
                    ecodeIndex = i;
                }
            });

            // 如果没找到，默认第一列是名字，第二列是ECODE
            if (nameIndex === -1) nameIndex = 0;
            if (ecodeIndex === -1) ecodeIndex = 1;

            console.log(`[Keeta ECODE] 名字列: ${headers[nameIndex]}, ECODE列: ${headers[ecodeIndex]}`);

            // 解析数据
            ecodeMap.clear();
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;

                const values = parseCSVLine(line);
                if (values.length > Math.max(nameIndex, ecodeIndex)) {
                    const name = values[nameIndex].trim();
                    const ecode = values[ecodeIndex].trim();
                    if (name && ecode) {
                        ecodeMap.set(name, ecode);
                        // 也存储去掉空格的版本
                        ecodeMap.set(name.replace(/\s/g, ''), ecode);
                    }
                }
            }

            isDataLoaded = true;
            console.log(`[Keeta ECODE] 已加载 ${ecodeMap.size / 2} 条映射`);
            updatePanelStatus(`✅ 已加载 ${ecodeMap.size / 2} 人`);

            // 保存到缓存
            const cacheData = {};
            ecodeMap.forEach((value, key) => {
                cacheData[key] = value;
            });
            GM_setValue('ecodeCache', JSON.stringify(cacheData));
            GM_setValue('ecodeCacheTime', new Date().toISOString());

            // 立即处理页面上的名字
            processPageNames();

        } catch (error) {
            console.error('[Keeta ECODE] 加载失败:', error);

            // 尝试使用缓存
            const cached = GM_getValue('ecodeCache');
            if (cached) {
                const cacheData = JSON.parse(cached);
                Object.entries(cacheData).forEach(([key, value]) => {
                    ecodeMap.set(key, value);
                });
                isDataLoaded = true;
                updatePanelStatus('⚠️ 使用缓存');
                processPageNames();
            } else {
                updatePanelStatus('❌ 加载失败');
            }
        }
    }

    // 解析CSV行
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

    // 处理页面上的名字
    function processPageNames() {
        if (!isDataLoaded || ecodeMap.size === 0) return;

        // 查找页面上所有可能包含骑手名字的元素
        const selectors = [
            'td', 'span', 'div', 'a', 'p',
            '[class*="name"]', '[class*="rider"]',
            '[class*="courier"]', '[class*="staff"]'
        ];

        const elements = document.querySelectorAll(selectors.join(', '));

        elements.forEach(el => {
            // 跳过已经处理过的
            if (el.dataset.ecodeProcessed) return;

            const text = el.textContent.trim();
            if (!text || text.length < 2 || text.length > 20) return;

            // 检查是否匹配名字
            let ecode = ecodeMap.get(text);
            if (!ecode) {
                // 尝试去掉空格
                ecode = ecodeMap.get(text.replace(/\s/g, ''));
            }

            if (ecode && !el.querySelector('.ecode-badge')) {
                // 创建ECODE标签
                const badge = document.createElement('span');
                badge.className = 'ecode-badge';
                badge.textContent = ecode;
                badge.title = '点击复制';

                // 点击复制
                badge.addEventListener('click', (e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(ecode).then(() => {
                        badge.textContent = '✓ 已复制';
                        badge.classList.add('copied');
                        setTimeout(() => {
                            badge.textContent = ecode;
                            badge.classList.remove('copied');
                        }, 1500);
                    });
                });

                // 插入到元素中
                if (el.childNodes.length === 1 && el.childNodes[0].nodeType === Node.TEXT_NODE) {
                    // 如果只有文本节点
                    el.appendChild(badge);
                } else {
                    // 尝试找到文本节点插入
                    const textNode = Array.from(el.childNodes).find(n =>
                        n.nodeType === Node.TEXT_NODE && n.textContent.trim() === text
                    );
                    if (textNode) {
                        const span = document.createElement('span');
                        span.textContent = text;
                        span.appendChild(badge);
                        el.replaceChild(span, textNode);
                    } else {
                        el.appendChild(badge);
                    }
                }

                el.dataset.ecodeProcessed = 'true';
                el.classList.add('ecode-match-highlight');
            }
        });

        console.log(`[Keeta ECODE] 处理了页面上的名字`);
    }

    // 创建状态面板
    function createStatusPanel() {
        const panel = document.createElement('div');
        panel.className = 'ecode-panel';
        panel.id = 'ecodeStatusPanel';
        panel.innerHTML = `
            <span class="status">⏳ 初始化...</span>
            <button onclick="window.refreshEcodeData()">刷新数据</button>
        `;
        document.body.appendChild(panel);

        // 添加刷新函数到全局
        window.refreshEcodeData = function() {
            isDataLoaded = false;
            loadEcodeData();
        };
    }

    // 更新面板状态
    function updatePanelStatus(text) {
        const panel = document.getElementById('ecodeStatusPanel');
        if (panel) {
            const status = panel.querySelector('.status');
            if (status) status.textContent = text;
        }
    }

    // 监听页面变化（动态加载的内容）
    function observeChanges() {
        const observer = new MutationObserver((mutations) => {
            let shouldProcess = false;

            mutations.forEach(mutation => {
                if (mutation.addedNodes.length > 0) {
                    shouldProcess = true;
                }
            });

            if (shouldProcess && isDataLoaded) {
                setTimeout(processPageNames, 500);
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        console.log('[Keeta ECODE] 已启动页面变化监听');
    }

    // 初始化
    function init() {
        console.log('[Keeta ECODE] 初始化...');

        // 创建状态面板
        createStatusPanel();

        // 加载数据
        loadEcodeData();

        // 监听页面变化
        observeChanges();

        // 定期重新处理（以防漏掉）
        setInterval(() => {
            if (isDataLoaded) {
                processPageNames();
            }
        }, 3000);
    }

    // 页面加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    console.log('[Keeta ECODE] 脚本初始化完成');
})();

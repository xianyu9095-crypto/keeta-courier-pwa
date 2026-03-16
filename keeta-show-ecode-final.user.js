// ==UserScript==
// @name         Keeta - 显示骑手ECODE (稳定版)
// @namespace    http://tampermonkey.net/
// @version      4.0-final
// @description  基于第一版优化，稳定显示ECODE
// @author       You
// @match        https://courier.mykeeta.com/*
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    console.log('[Keeta ECODE Final] 稳定版脚本已加载');

    // Google 表格配置
    const SHEET_ID = '1ygLS9F-lTiWONtHF0JY4SZpj7C7cFm0aLpLbS_iz9DE';

    // ECODE映射表
    let ecodeMap = new Map();
    let isDataLoaded = false;
    let processedElements = new WeakSet(); // 使用WeakSet避免内存泄漏

    // 添加样式
    GM_addStyle(`
        .ecode-badge {
            display: inline-flex !important;
            align-items: center;
            gap: 4px;
            background: linear-gradient(135deg, #FFD100 0%, #FFA500 100%) !important;
            color: #333 !important;
            padding: 2px 8px !important;
            border-radius: 12px !important;
            font-size: 12px !important;
            font-weight: 600 !important;
            margin-left: 8px !important;
            font-family: monospace !important;
            cursor: pointer !important;
            white-space: nowrap !important;
            vertical-align: middle !important;
        }

        .ecode-badge:hover {
            transform: scale(1.05);
            box-shadow: 0 2px 8px rgba(255, 209, 0, 0.4) !important;
        }

        .ecode-badge.copied {
            background: #4CAF50 !important;
            color: white !important;
        }

        .ecode-panel {
            position: fixed !important;
            top: 10px !important;
            right: 10px !important;
            background: white !important;
            padding: 10px 15px !important;
            border-radius: 12px !important;
            box-shadow: 0 4px 20px rgba(0,0,0,0.15) !important;
            z-index: 99999 !important;
            font-size: 13px !important;
            display: flex !important;
            align-items: center !important;
            gap: 10px !important;
        }
    `);

    // 从Google表格加载数据
    async function loadEcodeData() {
        if (isDataLoaded) return;

        console.log('[Keeta ECODE Final] 正在加载数据...');
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

            // 第一行是标题
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

            // 默认第一列是名字，第二列是ECODE
            if (nameIndex === -1) nameIndex = 0;
            if (ecodeIndex === -1) ecodeIndex = 1;

            console.log(`[Keeta ECODE Final] 名字列(${nameIndex}): ${headers[nameIndex]}, ECODE列(${ecodeIndex}): ${headers[ecodeIndex]}`);

            // 解析数据
            ecodeMap.clear();
            let count = 0;
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;

                const values = parseCSVLine(line);
                if (values.length > Math.max(nameIndex, ecodeIndex)) {
                    const name = values[nameIndex].trim();
                    const ecode = values[ecodeIndex].trim();
                    if (name && ecode) {
                        ecodeMap.set(name, ecode);
                        // 同时存储去掉空格的版本
                        ecodeMap.set(name.replace(/\s/g, ''), ecode);
                        count++;
                    }
                }
            }

            isDataLoaded = true;
            console.log(`[Keeta ECODE Final] 已加载 ${count} 条映射`);
            updatePanelStatus(`✅ 已加载 ${count} 人`);

            // 保存到缓存
            const cacheData = {};
            ecodeMap.forEach((value, key) => {
                cacheData[key] = value;
            });
            GM_setValue('ecodeCache', JSON.stringify(cacheData));

            // 立即处理页面
            processPageNames();

        } catch (error) {
            console.error('[Keeta ECODE Final] 加载失败:', error);

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
        if (!isDataLoaded || ecodeMap.size === 0) {
            console.log('[Keeta ECODE Final] 数据未就绪');
            return;
        }

        console.log('[Keeta ECODE Final] 开始扫描页面...');

        // 查找页面上所有可能包含骑手名字的元素
        const selectors = [
            'td', 'span', 'div', 'a', 'p', 'label',
            '[class*="name"]', '[class*="rider"]',
            '[class*="courier"]', '[class*="staff"]',
            '[class*="user"]', '[class*="people"]'
        ];

        const elements = document.querySelectorAll(selectors.join(', '));
        console.log(`[Keeta ECODE Final] 扫描 ${elements.length} 个元素`);

        let matchCount = 0;

        elements.forEach(el => {
            // 跳过已处理的元素
            if (processedElements.has(el)) return;

            // 跳过已有ecode-badge的元素
            if (el.querySelector('.ecode-badge')) return;

            const text = el.textContent.trim();
            if (!text || text.length < 2 || text.length > 20) return;

            // 检查是否包含中文
            if (!/[\u4e00-\u9fa5]/.test(text)) return;

            // 检查是否匹配名字
            let ecode = ecodeMap.get(text);
            if (!ecode) {
                // 尝试去掉空格
                ecode = ecodeMap.get(text.replace(/\s/g, ''));
            }

            if (ecode) {
                console.log(`[Keeta ECODE Final] 匹配: "${text}" -> ${ecode}`);

                // 创建ECODE标签
                const badge = document.createElement('span');
                badge.className = 'ecode-badge';
                badge.textContent = ecode;
                badge.title = '点击复制';

                // 点击复制
                badge.addEventListener('click', (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    navigator.clipboard.writeText(ecode).then(() => {
                        badge.textContent = '✓ 已复制';
                        badge.classList.add('copied');
                        setTimeout(() => {
                            badge.textContent = ecode;
                            badge.classList.remove('copied');
                        }, 1500);
                    }).catch(() => {
                        // 降级方案
                        const input = document.createElement('input');
                        input.value = ecode;
                        document.body.appendChild(input);
                        input.select();
                        document.execCommand('copy');
                        document.body.removeChild(input);
                        badge.textContent = '✓';
                        setTimeout(() => badge.textContent = ecode, 1000);
                    });
                });

                // 直接添加到元素末尾
                el.appendChild(badge);

                // 标记为已处理
                processedElements.add(el);
                matchCount++;
            }
        });

        console.log(`[Keeta ECODE Final] 本次匹配 ${matchCount} 个`);
    }

    // 创建状态面板
    function createStatusPanel() {
        const panel = document.createElement('div');
        panel.className = 'ecode-panel';
        panel.id = 'ecodeStatusPanel';
        panel.innerHTML = `
            <span class="status">⏳ 初始化...</span>
            <button onclick="window.refreshEcodeData()">刷新</button>
        `;
        document.body.appendChild(panel);

        // 添加刷新函数到全局
        window.refreshEcodeData = function() {
            isDataLoaded = false;
            processedElements = new WeakSet();
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

    // 初始化
    function init() {
        console.log('[Keeta ECODE Final] 初始化...');

        createStatusPanel();
        loadEcodeData();

        // 监听页面变化
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

        // 定期重新处理
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

    console.log('[Keeta ECODE Final] 脚本初始化完成');
})();

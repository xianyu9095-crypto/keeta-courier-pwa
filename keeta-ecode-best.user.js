// ==UserScript==
// @name         Keeta - ECODE显示 (最佳版)
// @namespace    http://tampermonkey.net/
// @version      5.0
// @description  基于第一版样式，修复英文和省略号匹配
// @author       You
// @match        https://courier.mykeeta.com/*
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    console.log('[Keeta Best] 最佳版脚本已加载');

    const SHEET_ID = '1ygLS9F-lTiWONtHF0JY4SZpj7C7cFm0aLpLbS_iz9DE';
    let ecodeMap = new Map();
    let isDataLoaded = false;

    // 第一版的样式（用户喜欢的背景色高亮）
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

        /* 第一版的背景色高亮效果 */
        .ecode-match-highlight {
            background: rgba(255, 209, 0, 0.2) !important;
            border-radius: 4px;
            padding: 2px 4px;
        }
    `);

    // 加载数据
    async function loadEcodeData() {
        if (isDataLoaded) return;

        console.log('[Keeta Best] 正在加载数据...');
        updatePanelStatus('⏳ 加载中...');

        try {
            const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Sheet1`;
            const response = await fetch(csvUrl);
            const csvText = await response.text();

            const lines = csvText.split('\n');
            if (lines.length < 2) {
                throw new Error('表格数据为空');
            }

            // 解析标题
            const headers = parseCSVLine(lines[0]);
            console.log('[Keeta Best] 表头:', headers);

            // 找Name和ECODE列
            let nameIndex = headers.findIndex(h => h.toLowerCase().includes('name'));
            let ecodeIndex = headers.findIndex(h => h.toLowerCase().includes('ecode'));

            if (nameIndex === -1) nameIndex = 1;  // 默认第二列是Name
            if (ecodeIndex === -1) ecodeIndex = 3; // 默认第四列是ECODE

            console.log(`[Keeta Best] Name列(${nameIndex}): ${headers[nameIndex]}, ECODE列(${ecodeIndex}): ${headers[ecodeIndex]}`);

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
                        // 存储多种格式，方便匹配
                        const lowerName = name.toLowerCase();
                        ecodeMap.set(lowerName, ecode);                          // 全小写
                        ecodeMap.set(lowerName.replace(/\s+/g, ' '), ecode);      // 单空格
                        ecodeMap.set(lowerName.replace(/\s/g, ''), ecode);        // 无空格

                        // 存储前3个字（处理省略号）
                        if (lowerName.length >= 3) {
                            ecodeMap.set(lowerName.substring(0, 3), ecode);
                        }
                        // 存储前5个字（处理中等省略）
                        if (lowerName.length >= 5) {
                            ecodeMap.set(lowerName.substring(0, 5), ecode);
                        }
                        // 存储前8个字（处理长名字省略）
                        if (lowerName.length >= 8) {
                            ecodeMap.set(lowerName.substring(0, 8), ecode);
                        }

                        count++;
                        if (count <= 3) {
                            console.log(`[Keeta Best] 数据${count}: "${name}" -> ${ecode}`);
                        }
                    }
                }
            }

            isDataLoaded = true;
            console.log(`[Keeta Best] 已加载 ${count} 条映射，${ecodeMap.size} 个key`);
            updatePanelStatus(`✅ 已加载 ${count} 人`);

            // 保存缓存
            const cacheData = {};
            ecodeMap.forEach((value, key) => {
                if (!cacheData[key]) cacheData[key] = value;
            });
            GM_setValue('ecodeCache', JSON.stringify(cacheData));

            // 立即处理页面
            processPageNames();

        } catch (error) {
            console.error('[Keeta Best] 加载失败:', error);

            // 使用缓存
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

    function processPageNames() {
        if (!isDataLoaded || ecodeMap.size === 0) return;

        const selectors = [
            'td', 'span', 'div', 'a', 'p',
            '[class*="name"]', '[class*="rider"]',
            '[class*="courier"]', '[class*="staff"]'
        ];

        const elements = document.querySelectorAll(selectors.join(', '));
        let matchCount = 0;

        elements.forEach(el => {
            // 跳过已处理
            if (el.dataset.ecodeProcessed) return;

            // 跳过已有badge的
            if (el.querySelector('.ecode-badge')) return;

            let text = el.textContent.trim();
            if (!text || text.length < 2 || text.length > 50) return;

            // 去掉省略号（关键修复）
            const originalText = text;
            text = text.replace(/[.…]+/g, '').trim();

            // 尝试各种匹配方式
            const lowerText = text.toLowerCase();
            let ecode = null;
            let matchedKey = null;

            // 1. 完整匹配
            ecode = ecodeMap.get(lowerText);
            if (ecode) matchedKey = lowerText;

            // 2. 单空格格式
            if (!ecode) {
                const singleSpace = lowerText.replace(/\s+/g, ' ').trim();
                ecode = ecodeMap.get(singleSpace);
                if (ecode) matchedKey = singleSpace;
            }

            // 3. 无空格格式
            if (!ecode) {
                const noSpace = lowerText.replace(/\s/g, '');
                ecode = ecodeMap.get(noSpace);
                if (ecode) matchedKey = noSpace;
            }

            // 4. 前缀匹配（处理省略号名字）
            if (!ecode && text.length >= 3) {
                // 尝试前3、5、8个字符
                for (let len of [8, 5, 3]) {
                    if (text.length >= len) {
                        const prefix = lowerText.substring(0, len);
                        ecode = ecodeMap.get(prefix);
                        if (ecode) {
                            matchedKey = prefix;
                            break;
                        }
                    }
                }
            }

            if (ecode) {
                console.log(`[Keeta Best] 匹配: "${originalText}" (key: ${matchedKey}) -> ${ecode}`);

                // 创建badge（第一版的样式）
                const badge = document.createElement('span');
                badge.className = 'ecode-badge';
                badge.textContent = ecode;
                badge.title = '点击复制';

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

                // 添加到元素
                el.appendChild(badge);

                // 添加背景高亮（第一版效果）
                el.dataset.ecodeProcessed = 'true';
                el.classList.add('ecode-match-highlight');

                matchCount++;
            }
        });

        console.log(`[Keeta Best] 本次匹配 ${matchCount} 个`);
    }

    function createStatusPanel() {
        const panel = document.createElement('div');
        panel.className = 'ecode-panel';
        panel.id = 'ecodeStatusPanel';
        panel.innerHTML = `
            <span class="status">⏳ 初始化...</span>
            <button onclick="window.refreshEcodeData()">刷新数据</button>
        `;
        document.body.appendChild(panel);

        window.refreshEcodeData = function() {
            isDataLoaded = false;
            // 清除所有已处理标记
            document.querySelectorAll('[data-ecode-processed]').forEach(el => {
                delete el.dataset.ecodeProcessed;
                el.classList.remove('ecode-match-highlight');
            });
            document.querySelectorAll('.ecode-badge').forEach(el => el.remove());
            loadEcodeData();
        };
    }

    function updatePanelStatus(text) {
        const panel = document.getElementById('ecodeStatusPanel');
        if (panel) {
            const status = panel.querySelector('.status');
            if (status) status.textContent = text;
        }
    }

    function init() {
        console.log('[Keeta Best] 初始化...');
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

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    console.log('[Keeta Best] 脚本初始化完成');
})();
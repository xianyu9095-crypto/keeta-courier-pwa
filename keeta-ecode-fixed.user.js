// ==UserScript==
// @name         Keeta - ECODE显示 (修复重复版)
// @namespace    http://tampermonkey.net/
// @version      6.0
// @description  修复重复显示问题，每个骑手只显示一个ECODE
// @author       You
// @match        https://courier.mykeeta.com/*
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    console.log('[Keeta Fixed] 修复版脚本已加载');

    const SHEET_ID = '1ygLS9F-lTiWONtHF0JY4SZpj7C7cFm0aLpLbS_iz9DE';
    let ecodeMap = new Map();
    let originalNames = []; // 存储原始名字列表
    let isDataLoaded = false;
    let processedElements = new WeakSet(); // 使用 WeakSet 防止重复处理

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

        .ecode-match-highlight {
            background: rgba(255, 209, 0, 0.2) !important;
            border-radius: 4px;
            padding: 2px 4px;
        }
    `);

    // 加载数据
    async function loadEcodeData() {
        if (isDataLoaded) return;

        console.log('[Keeta Fixed] 正在加载数据...');
        updatePanelStatus('⏳ 加载中...');

        try {
            const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Sheet1`;
            const response = await fetch(csvUrl);
            const csvText = await response.text();

            const lines = csvText.split('\n');
            if (lines.length < 2) throw new Error('表格为空');

            // 解析标题
            const headers = parseCSVLine(lines[0]);
            let nameIndex = headers.findIndex(h => h.toLowerCase().includes('name'));
            let ecodeIndex = headers.findIndex(h => h.toLowerCase().includes('ecode'));

            if (nameIndex === -1) nameIndex = 1;
            if (ecodeIndex === -1) ecodeIndex = 3;

            console.log(`[Keeta Fixed] Name列(${nameIndex}): ${headers[nameIndex]}, ECODE列(${ecodeIndex}): ${headers[ecodeIndex]}`);

            // 解析数据
            ecodeMap.clear();
            originalNames = [];

            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;

                const values = parseCSVLine(line);
                if (values.length > Math.max(nameIndex, ecodeIndex)) {
                    const name = values[nameIndex].trim();
                    const ecode = values[ecodeIndex].trim();

                    if (name && ecode) {
                        originalNames.push(name);
                        const lowerName = name.toLowerCase();

                        // 只存储完整名字和标准化版本
                        ecodeMap.set(lowerName, ecode);
                        ecodeMap.set(lowerName.replace(/\s+/g, ' '), ecode);
                        ecodeMap.set(lowerName.replace(/\s/g, ''), ecode);
                    }
                }
            }

            isDataLoaded = true;
            console.log(`[Keeta Fixed] 已加载 ${originalNames.length} 条映射`);
            updatePanelStatus(`✅ 已加载 ${originalNames.length} 人`);

            // 保存缓存
            GM_setValue('ecodeCache', JSON.stringify({names: originalNames, map: Object.fromEntries(ecodeMap)}));

            processPageNames();

        } catch (error) {
            console.error('[Keeta Fixed] 加载失败:', error);
            updatePanelStatus('❌ 加载失败');
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

    // 查找最佳匹配
    function findBestMatch(text) {
        if (!text || text.length < 2) return null;

        // 去掉省略号
        const cleanText = text.replace(/[.…]+/g, '').trim();
        const lowerText = cleanText.toLowerCase();

        // 1. 完整匹配（优先级最高）
        let ecode = ecodeMap.get(lowerText);
        if (ecode) return {ecode, matchType: 'exact'};

        // 2. 标准化空格
        const singleSpace = lowerText.replace(/\s+/g, ' ').trim();
        ecode = ecodeMap.get(singleSpace);
        if (ecode) return {ecode, matchType: 'exact'};

        // 3. 无空格
        const noSpace = lowerText.replace(/\s/g, '');
        ecode = ecodeMap.get(noSpace);
        if (ecode) return {ecode, matchType: 'exact'};

        // 4. 模糊匹配（只在没有精确匹配时才执行）
        // 检查是否是某个名字的前缀
        const matches = [];
        for (let name of originalNames) {
            const lowerName = name.toLowerCase();
            if (lowerName.startsWith(lowerText) || lowerText.startsWith(lowerName.substring(0, Math.min(lowerName.length, lowerText.length + 2)))) {
                const similarity = calculateSimilarity(lowerText, lowerName);
                if (similarity > 0.6) { // 相似度阈值
                    matches.push({name, ecode: ecodeMap.get(lowerName), similarity});
                }
            }
        }

        // 如果只有一个匹配，返回它
        if (matches.length === 1) {
            return {ecode: matches[0].ecode, matchType: 'fuzzy'};
        }

        // 如果有多个匹配，选择相似度最高的
        if (matches.length > 1) {
            matches.sort((a, b) => b.similarity - a.similarity);
            // 如果最高相似度比第二高明显高（差距>0.1），才返回
            if (matches[0].similarity - matches[1].similarity > 0.1) {
                return {ecode: matches[0].ecode, matchType: 'fuzzy'};
            }
            // 否则返回null，避免重复
            console.log(`[Keeta Fixed] 多个相似匹配，跳过: "${text}"`, matches.slice(0, 3));
            return null;
        }

        return null;
    }

    // 计算相似度（简单版本）
    function calculateSimilarity(str1, str2) {
        const len1 = str1.length;
        const len2 = str2.length;
        const minLen = Math.min(len1, len2);
        const maxLen = Math.max(len1, len2);

        // 计算相同前缀长度
        let samePrefix = 0;
        for (let i = 0; i < minLen; i++) {
            if (str1[i] === str2[i]) {
                samePrefix++;
            } else {
                break;
            }
        }

        return samePrefix / maxLen;
    }

    function processPageNames() {
        if (!isDataLoaded || ecodeMap.size === 0) return;

        const selectors = [
            'td', 'span', 'div', 'a', 'p', 'label',
            '[class*="name"]', '[class*="rider"]',
            '[class*="courier"]', '[class*="staff"]'
        ];

        const elements = document.querySelectorAll(selectors.join(', '));
        let matchCount = 0;
        let skipCount = 0;

        elements.forEach(el => {
            // 跳过已处理的元素（关键修复）
            if (processedElements.has(el)) {
                return;
            }

            // 跳过已有badge的元素
            if (el.querySelector('.ecode-badge')) {
                processedElements.add(el);
                return;
            }

            const text = el.textContent.trim();
            if (!text || text.length < 2 || text.length > 50) return;

            // 查找匹配
            const result = findBestMatch(text);

            if (result) {
                console.log(`[Keeta Fixed] 匹配(${result.matchType}): "${text}" -> ${result.ecode}`);

                // 再次检查是否已有badge（防止竞态）
                if (el.querySelector('.ecode-badge')) {
                    processedElements.add(el);
                    return;
                }

                // 创建badge
                const badge = document.createElement('span');
                badge.className = 'ecode-badge';
                badge.textContent = result.ecode;
                badge.title = '点击复制';

                badge.addEventListener('click', (e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(result.ecode).then(() => {
                        badge.textContent = '✓ 已复制';
                        badge.classList.add('copied');
                        setTimeout(() => {
                            badge.textContent = result.ecode;
                            badge.classList.remove('copied');
                        }, 1500);
                    });
                });

                // 添加到元素
                el.appendChild(badge);

                // 添加背景高亮
                el.classList.add('ecode-match-highlight');

                // 标记为已处理（关键）
                processedElements.add(el);
                matchCount++;
            }
        });

        if (matchCount > 0) {
            console.log(`[Keeta Fixed] 本次新增匹配: ${matchCount} 个`);
        }
    }

    function createStatusPanel() {
        const panel = document.createElement('div');
        panel.className = 'ecode-panel';
        panel.id = 'ecodeStatusPanel';
        panel.innerHTML = `
            <span class="status">⏳ 初始化...</span>
            <button onclick="window.refreshEcodeData()">刷新</button>
        `;
        document.body.appendChild(panel);

        window.refreshEcodeData = function() {
            isDataLoaded = false;
            processedElements = new WeakSet();
            // 清除所有badge
            document.querySelectorAll('.ecode-badge').forEach(el => el.remove());
            document.querySelectorAll('.ecode-match-highlight').forEach(el => {
                el.classList.remove('ecode-match-highlight');
            });
            loadEcodeData();
        };
    }

    function updatePanelStatus(text) {
        const panel = document.getElementById('ecodeStatusPanel');
        if (panel) {
            panel.querySelector('.status').textContent = text;
        }
    }

    function init() {
        console.log('[Keeta Fixed] 初始化...');
        createStatusPanel();
        loadEcodeData();

        // 监听页面变化
        const observer = new MutationObserver((mutations) => {
            let shouldProcess = false;
            mutations.forEach(mutation => {
                if (mutation.addedNodes.length > 0) shouldProcess = true;
            });
            if (shouldProcess && isDataLoaded) {
                setTimeout(processPageNames, 500);
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        // 定期扫描
        setInterval(() => {
            if (isDataLoaded) processPageNames();
        }, 3000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
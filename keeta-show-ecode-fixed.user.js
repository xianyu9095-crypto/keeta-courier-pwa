// ==UserScript==
// @name         Keeta - 显示骑手ECODE (修复版)
// @namespace    http://tampermonkey.net/
// @version      3.0-fixed
// @description  修复版 - 稳定显示ECODE
// @author       You
// @match        https://courier.mykeeta.com/*
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    console.log('[Keeta ECODE Fixed] 修复版脚本已加载');

    const SHEET_ID = '1ygLS9F-lTiWONtHF0JY4SZpj7C7cFm0aLpLbS_iz9DE';

    let ecodeMap = new Map();
    let isDataLoaded = false;

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
            border: none !important;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1) !important;
        }

        .ecode-badge:hover {
            transform: scale(1.05);
            box-shadow: 0 4px 8px rgba(255, 209, 0, 0.4) !important;
        }

        .ecode-badge.copied {
            background: #4CAF50 !important;
            color: white !important;
        }

        .status-panel {
            position: fixed;
            top: 10px;
            right: 10px;
            background: white;
            padding: 12px 15px;
            border-radius: 12px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.15);
            z-index: 99999;
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

        console.log('[Keeta ECODE Fixed] 正在加载数据...');
        updateStatus('⏳ 加载中...');

        try {
            const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Sheet1`;
            console.log('[Keeta ECODE Fixed] 请求URL:', csvUrl);

            const response = await fetch(csvUrl);
            const csvText = await response.text();

            console.log('[Keeta ECODE Fixed] CSV数据长度:', csvText.length);
            console.log('[Keeta ECODE Fixed] CSV前200字符:', csvText.substring(0, 200));

            const lines = csvText.split('\n');
            console.log('[Keeta ECODE Fixed] 总行数:', lines.length);

            if (lines.length < 2) {
                throw new Error('表格数据为空');
            }

            // 解析列
            const headers = parseCSVLine(lines[0]);
            console.log('[Keeta ECODE Fixed] 表头:', headers);

            let nameIdx = -1, ecodeIdx = -1;
            headers.forEach((h, i) => {
                const lower = h.toLowerCase().trim();
                if (nameIdx === -1 && (lower.includes('名字') || lower.includes('姓名') || lower.includes('name') || lower.includes('骑手'))) {
                    nameIdx = i;
                }
                if (ecodeIdx === -1 && (lower.includes('ecode') || lower.includes('code') || lower.includes('编号') || lower.includes('工号') || lower.includes('id'))) {
                    ecodeIdx = i;
                }
            });

            if (nameIdx === -1) nameIdx = 0;
            if (ecodeIdx === -1) ecodeIdx = 1;

            console.log(`[Keeta ECODE Fixed] 名字列索引: ${nameIdx}, ECODE列索引: ${ecodeIdx}`);

            // 解析数据
            ecodeMap.clear();
            let successCount = 0;

            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;

                const values = parseCSVLine(line);
                if (values.length > Math.max(nameIdx, ecodeIdx)) {
                    const name = values[nameIdx].trim();
                    const ecode = values[ecodeIdx].trim();

                    if (name && ecode) {
                        ecodeMap.set(name, ecode);
                        // 同时存储去掉空格的版本
                        ecodeMap.set(name.replace(/\s/g, ''), ecode);
                        successCount++;

                        if (successCount <= 5) {
                            console.log(`[Keeta ECODE Fixed] 数据${successCount}: ${name} -> ${ecode}`);
                        }
                    }
                }
            }

            isDataLoaded = true;
            console.log(`[Keeta ECODE Fixed] 成功加载 ${successCount} 条映射`);
            updateStatus(`✅ 已加载 ${successCount} 人`);

            // 保存到缓存
            const cacheObj = {};
            ecodeMap.forEach((v, k) => cacheObj[k] = v);
            GM_setValue('ecodeCache', JSON.stringify(cacheObj));

            // 立即处理页面
            processPage();

        } catch (err) {
            console.error('[Keeta ECODE Fixed] 加载失败:', err);

            // 尝试使用缓存
            const cached = GM_getValue('ecodeCache');
            if (cached) {
                try {
                    const cacheObj = JSON.parse(cached);
                    Object.entries(cacheObj).forEach(([k, v]) => ecodeMap.set(k, v));
                    isDataLoaded = true;
                    updateStatus('⚠️ 使用缓存数据');
                    processPage();
                    console.log('[Keeta ECODE Fixed] 使用缓存数据:', ecodeMap.size, '条');
                } catch (e) {
                    updateStatus('❌ 缓存无效');
                }
            } else {
                updateStatus('❌ 加载失败: ' + err.message);
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

    function processPage() {
        if (!isDataLoaded) {
            console.log('[Keeta ECODE Fixed] 数据未加载，跳过处理');
            return;
        }

        console.log('[Keeta ECODE Fixed] 开始处理页面...');

        // 查找所有可能包含文字的元素
        const selectors = [
            'td', 'span', 'div', 'a', 'p',
            '[class*="name"]', '[class*="rider"]',
            '[class*="courier"]', '[class*="staff"]'
        ];

        const elements = document.querySelectorAll(selectors.join(', '));
        console.log('[Keeta ECODE Fixed] 找到元素数量:', elements.length);

        let matchCount = 0;

        elements.forEach((el, index) => {
            // 跳过已处理的
            if (el.dataset.ecodeProcessed) return;

            // 获取纯文本
            const text = el.textContent.trim();

            // 基本条件检查
            if (!text || text.length < 2 || text.length > 20) return;

            // 检查是否包含中文
            if (!/[\u4e00-\u9fa5]/.test(text)) return;

            // 检查是否已添加过标签
            if (el.querySelector('.ecode-badge')) return;

            // 尝试匹配
            let ecode = ecodeMap.get(text);

            // 如果没匹配到，尝试去掉空格
            if (!ecode) {
                const noSpaceText = text.replace(/\s/g, '');
                ecode = ecodeMap.get(noSpaceText);
            }

            // 如果没匹配到，尝试去掉省略号
            if (!ecode) {
                const cleanText = text.replace(/[.…]+/g, '').trim();
                ecode = ecodeMap.get(cleanText);
            }

            // 如果匹配到了
            if (ecode) {
                console.log(`[Keeta ECODE Fixed] 匹配成功 [${index}]: "${text}" -> ${ecode}`);

                const badge = document.createElement('span');
                badge.className = 'ecode-badge';
                badge.textContent = ecode;
                badge.title = '点击复制';

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

                // 尝试添加到元素
                try {
                    el.appendChild(badge);
                    el.dataset.ecodeProcessed = 'true';
                    matchCount++;
                } catch (e) {
                    console.error('[Keeta ECODE Fixed] 添加标签失败:', e);
                }
            }
        });

        console.log(`[Keeta ECODE Fixed] 处理完成，成功匹配 ${matchCount} 个`);
    }

    function createPanel() {
        const panel = document.createElement('div');
        panel.className = 'status-panel';
        panel.id = 'statusPanel';
        panel.innerHTML = `
            <span class="status-text">⏳ 初始化...</span>
            <span class="status-count">0</span>
            <button class="btn-refresh" onclick="window.location.reload()">刷新</button>
        `;
        document.body.appendChild(panel);
        console.log('[Keeta ECODE Fixed] 状态面板已创建');
    }

    function updateStatus(text) {
        const panel = document.getElementById('statusPanel');
        if (panel) {
            panel.querySelector('.status-text').textContent = text;
            panel.querySelector('.status-count').textContent = isDataLoaded ? Math.floor(ecodeMap.size / 2) : '0';
        }
    }

    function init() {
        console.log('[Keeta ECODE Fixed] 初始化开始...');
        createPanel();

        // 延迟加载数据，确保页面已经渲染
        setTimeout(() => {
            loadData();
        }, 1000);

        // 监听DOM变化
        const observer = new MutationObserver((mutations) => {
            if (isDataLoaded) {
                // 检查是否有新元素添加
                const hasNewElements = mutations.some(m => m.addedNodes.length > 0);
                if (hasNewElements) {
                    setTimeout(processPage, 500);
                }
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        // 定期扫描（备用）
        setInterval(() => {
            if (isDataLoaded) {
                processPage();
            }
        }, 3000);

        console.log('[Keeta ECODE Fixed] 初始化完成');
    }

    // 启动
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

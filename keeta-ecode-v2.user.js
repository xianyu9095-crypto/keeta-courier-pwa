// ==UserScript==
// @name         Keeta - ECODE显示 V2
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  针对实际表格结构优化
// @author       You
// @match        https://courier.mykeeta.com/*
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    console.log('[Keeta V2] 脚本启动');

    const SHEET_ID = '1ygLS9F-lTiWONtHF0JY4SZpj7C7cFm0aLpLbS_iz9DE';
    let ecodeMap = new Map();

    GM_addStyle(`
        .keeta-ecode {
            display: inline-flex !important;
            align-items: center;
            background: #FFD100 !important;
            color: #000 !important;
            padding: 2px 8px !important;
            border-radius: 4px !important;
            font-size: 11px !important;
            font-weight: bold !important;
            margin-left: 6px !important;
            font-family: monospace !important;
            cursor: pointer !important;
        }
        .keeta-status {
            position: fixed !important;
            top: 10px !important;
            right: 10px !important;
            background: white !important;
            padding: 10px 15px !important;
            border-radius: 8px !important;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2) !important;
            z-index: 99999 !important;
            font-size: 13px !important;
            max-width: 300px !important;
        }
    `);

    async function loadData() {
        console.log('[Keeta V2] 加载数据...');

        try {
            const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Sheet1`;
            const response = await fetch(url);
            const text = await response.text();

            const lines = text.split('\n');
            console.log('[Keeta V2] 总行数:', lines.length);

            // 解析标题行
            const headers = parseLine(lines[0]);
            console.log('[Keeta V2] 列名:', headers);

            // 找到Name和ECODE列
            let nameIdx = headers.findIndex(h => h.toLowerCase().includes('name'));
            let ecodeIdx = headers.findIndex(h => h.toLowerCase().includes('ecode'));

            if (nameIdx === -1) nameIdx = 1;
            if (ecodeIdx === -1) ecodeIdx = 3;

            console.log(`[Keeta V2] Name列索引: ${nameIdx}, ECODE列索引: ${ecodeIdx}`);

            // 解析数据
            ecodeMap.clear();
            for (let i = 1; i < lines.length; i++) {
                const values = parseLine(lines[i]);
                if (values.length > Math.max(nameIdx, ecodeIdx)) {
                    const name = values[nameIdx].trim();
                    const ecode = values[ecodeIdx].trim();
                    if (name && ecode) {
                        // 存储多种格式
                        ecodeMap.set(name.toLowerCase(), ecode);
                        ecodeMap.set(name.toLowerCase().replace(/\s+/g, ' '), ecode);
                        ecodeMap.set(name.toLowerCase().replace(/\s/g, ''), ecode);

                        if (i <= 3) {
                            console.log(`[Keeta V2] 数据${i}: "${name}" -> ${ecode}`);
                        }
                    }
                }
            }

            console.log(`[Keeta V2] 加载完成，共 ${ecodeMap.size / 3} 条`);
            updateStatus(`✅ 已加载 ${Math.floor(ecodeMap.size / 3)} 人`);

            processPage();

        } catch (err) {
            console.error('[Keeta V2] 加载失败:', err);
            updateStatus('❌ 加载失败: ' + err.message);
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

    function processPage() {
        console.log('[Keeta V2] 开始处理页面...');

        // 获取所有文本元素
        const elements = document.querySelectorAll('td, span, div, a, p, label, h1, h2, h3, h4, h5, h6, li');
        console.log('[Keeta V2] 扫描元素数:', elements.length);

        let matchCount = 0;

        elements.forEach(el => {
            // 跳过已处理的
            if (el.querySelector('.keeta-ecode')) return;

            const text = el.textContent.trim();
            if (!text || text.length < 2 || text.length > 50) return;

            // 尝试匹配（不区分大小写，忽略多余空格）
            const lowerText = text.toLowerCase();
            const normalizedText = lowerText.replace(/\s+/g, ' ').trim();
            const noSpaceText = lowerText.replace(/\s/g, '');

            // 调试：打印前5个检查的文本
            if (matchCount < 5) {
                console.log(`[Keeta V2] 检查文本: "${text}"`);
            }

            let ecode = ecodeMap.get(lowerText) ||
                       ecodeMap.get(normalizedText) ||
                       ecodeMap.get(noSpaceText);

            // 如果完全匹配失败，尝试部分匹配（处理省略号）
            if (!ecode) {
                for (let [key, value] of ecodeMap) {
                    if (key.includes(lowerText) || lowerText.includes(key)) {
                        if (Math.abs(key.length - lowerText.length) <= 3) {
                            ecode = value;
                            break;
                        }
                    }
                }
            }

            if (ecode) {
                console.log(`[Keeta V2] 匹配: "${text}" -> ${ecode}`);

                const badge = document.createElement('span');
                badge.className = 'keeta-ecode';
                badge.textContent = ecode;
                badge.onclick = (e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(ecode);
                    badge.textContent = '✓';
                    setTimeout(() => badge.textContent = ecode, 1000);
                };

                el.appendChild(badge);
                matchCount++;
            }
        });

        console.log(`[Keeta V2] 匹配完成: ${matchCount} 个`);
        updateStatus(`✅ 已加载 ${Math.floor(ecodeMap.size / 3)} 人 | 页面匹配: ${matchCount}`);
    }

    function updateStatus(msg) {
        let panel = document.getElementById('keetaStatus');
        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'keetaStatus';
            panel.className = 'keeta-status';
            document.body.appendChild(panel);
        }
        panel.textContent = msg;
    }

    // 启动
    setTimeout(loadData, 1000);

    // 监听变化
    const observer = new MutationObserver(() => {
        setTimeout(processPage, 500);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // 定期扫描
    setInterval(processPage, 5000);

    console.log('[Keeta V2] 初始化完成');
})();
// ==UserScript==
// @name         Keeta Debug - 查看页面结构
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  调试美团页面结构
// @author       You
// @match        https://courier.mykeeta.com/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // 等待页面加载完成
    setTimeout(() => {
        let info = '📱 页面结构分析\n\n';

        // 1. 查找标签页
        info += '【标签页】\n';
        const allTabs = document.querySelectorAll('*');
        let tabCount = 0;
        allTabs.forEach(el => {
            const text = (el.textContent || '').trim();
            if ((el.tagName === 'DIV' || el.tagName === 'SPAN' || el.tagName === 'A') &&
                text.length > 0 && text.length < 20) {
                if (text.includes('实时') || text.includes('监控') || text.includes('调度') ||
                    text.includes('订单') || text.includes('数据') || text.includes('统计')) {
                    info += `标签${++tabCount}: "${text}"\n`;
                    info += `  class="${el.className}"\n`;
                    info += `  tag="${el.tagName.toLowerCase()}"\n\n`;
                }
            }
        });

        // 2. 查找菜单/侧边栏
        info += '\n【可能的侧边栏】\n';
        document.querySelectorAll('nav, aside, [class*="menu"], [class*="sider"], [class*="sidebar"]').forEach((el, i) => {
            if (el.offsetWidth > 50 && el.offsetHeight > 100) {
                info += `${i+1}. class="${el.className}"\n`;
            }
        });

        // 3. 查找头部
        info += '\n【可能的头部】\n';
        document.querySelectorAll('header, [class*="header"], [class*="navbar"]').forEach((el, i) => {
            if (el.offsetHeight > 30) {
                info += `${i+1}. class="${el.className}"\n`;
            }
        });

        // 显示在页面上
        const div = document.createElement('div');
        div.style.cssText = 'position:fixed;top:10px;left:10px;right:10px;bottom:10px;background:white;z-index:99999;padding:20px;overflow:auto;font-size:14px;line-height:1.6;border:3px solid #FFD100;border-radius:10px;box-shadow:0 10px 40px rgba(0,0,0,0.3);';
        div.innerHTML = `<h2 style="color:#333;margin-bottom:15px;">📱 页面结构分析结果</h2><pre style="white-space:pre-wrap;word-break:break-all;background:#f5f5f5;padding:15px;border-radius:8px;">${info}</pre><button onclick="this.parentElement.remove()" style="position:fixed;top:20px;right:20px;padding:10px 20px;background:#FFD100;color:#333;border:none;border-radius:8px;font-weight:bold;">关闭</button><p style="margin-top:15px;color:#666;font-size:13px;">💡 请截图或复制上面的信息发给我</p>`;
        document.body.appendChild(div);

        console.log(info);
    }, 3000);

    console.log('[Keeta Debug] 脚本已加载，3秒后显示页面结构...');
})();

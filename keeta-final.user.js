// ==UserScript==
// @name         Keeta Courier - 只显示实时监控
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  隐藏美团骑手后台的其他内容，只显示实时骑手监控
// @author       You
// @match        https://courier.mykeeta.com/*
// @grant        GM_addStyle
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    console.log('[Keeta] 脚本已加载');

    // 添加样式隐藏不需要的元素
    GM_addStyle(`
        /* 隐藏头部 */
        .roo-plus-layout-header,
        .appHeader,
        header[class*="header"] {
            display: none !important;
        }

        /* 隐藏侧边栏 */
        .roo-plus-layout-aside,
        [class*="siderExternal"],
        [class*="Side-index"],
        aside {
            display: none !important;
        }

        /* 隐藏面包屑、标题等 */
        .roo-plus-layout-breadcrumb,
        [class*="breadcrumb"],
        .page-title,
        .header-title {
            display: none !important;
        }

        /* 最大化内容区域 */
        .roo-plus-layout-content,
        [class*="layout-content"],
        main,
        .content {
            margin-left: 0 !important;
            padding: 0 !important;
            width: 100% !important;
        }
    `);

    // 页面加载后处理标签页
    function processTabs() {
        console.log('[Keeta] 正在处理标签页...');

        // 查找所有标签
        const tabs = document.querySelectorAll('.ant-tabs-tab, [role="tab"], .tab-item, [class*="tab"]');

        if (tabs.length === 0) {
            console.log('[Keeta] 未找到标签，稍后重试');
            return false;
        }

        console.log('[Keeta] 找到', tabs.length, '个标签');

        let hasMonitor = false;

        tabs.forEach((tab, index) => {
            const text = (tab.textContent || tab.innerText || '').trim();
            console.log('[Keeta] 标签', index, ':', text);

            // 检查是否是实时监控标签
            const isMonitor = text.includes('实时') ||
                            text.includes('监控') ||
                            text.includes('调度') ||
                            text.includes('Courier');

            if (isMonitor) {
                hasMonitor = true;
                tab.style.display = 'block';
                tab.style.visibility = 'visible';
                // 尝试点击这个标签
                if (!tab.classList.contains('ant-tabs-tab-active')) {
                    console.log('[Keeta] 点击实时监控标签');
                    tab.click();
                }
            } else if (text.length > 0) {
                // 隐藏其他标签
                tab.style.display = 'none';
                console.log('[Keeta] 隐藏标签:', text);
            }
        });

        return hasMonitor;
    }

    // 隐藏其他面板内容
    function hideOtherPanels() {
        // 查找所有面板
        const panels = document.querySelectorAll('.ant-tabs-tabpane, [role="tabpanel"], .tab-panel');

        panels.forEach(panel => {
            const text = (panel.textContent || '').substring(0, 100);
            const isMonitorPanel = text.includes('实时') ||
                                   text.includes('监控') ||
                                   panel.classList.contains('ant-tabs-tabpane-active');

            if (!isMonitorPanel && !panel.classList.contains('ant-tabs-tabpane-active')) {
                panel.style.display = 'none';
            }
        });
    }

    // 主函数
    function init() {
        console.log('[Keeta] 初始化...');

        // 处理标签
        const success = processTabs();

        // 隐藏面板
        hideOtherPanels();

        // 如果还没找到，继续尝试
        if (!success) {
            console.log('[Keeta] 将在2秒后重试');
        }
    }

    // 页面加载完成后执行
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // 延迟多次尝试（因为页面可能是动态加载的）
    setTimeout(init, 2000);
    setTimeout(init, 4000);
    setTimeout(init, 6000);

    // 监听页面变化
    const observer = new MutationObserver((mutations) => {
        // 如果添加了新元素，重新处理
        const hasNewElements = mutations.some(m => m.addedNodes.length > 0);
        if (hasNewElements) {
            processTabs();
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    console.log('[Keeta] 初始化完成');
})();

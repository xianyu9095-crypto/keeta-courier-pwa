// ==UserScript==
// @name         Keeta Courier - 美观版实时监控
// @namespace    http://tampermonkey.net/
// @version      3.0
// @description  美观地显示美团骑手实时监控，隐藏其他内容
// @author       You
// @match        https://courier.mykeeta.com/*
// @grant        GM_addStyle
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    console.log('[Keeta Beautiful] 脚本已加载');

    // 添加美化样式
    GM_addStyle(`
        /* 隐藏头部 - 但保留必要的工具栏 */
        .roo-plus-layout-header,
        .appHeader {
            display: none !important;
        }

        /* 隐藏侧边栏 */
        .roo-plus-layout-aside,
        [class*="siderExternal"],
        [class*="Side-index"] {
            display: none !important;
        }

        /* 主布局调整 */
        .roo-plus-layout {
            min-height: 100vh !important;
        }

        /* 内容区域全屏 */
        .roo-plus-layout-content,
        [class*="layout-content"] {
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            min-height: 100vh !important;
        }

        /* 页面主体 */
        main, .main-content, [class*="main-content"] {
            padding: 0 !important;
            margin: 0 !important;
        }

        /* 隐藏面包屑 */
        .roo-plus-layout-breadcrumb,
        [class*="breadcrumb"],
        .page-title,
        h1[class*="title"],
        .header-title {
            display: none !important;
        }

        /* 标签页样式优化 - 保留但美化 */
        .ant-tabs-nav {
            background: linear-gradient(135deg, #FFD100 0%, #FFA500 100%) !important;
            padding: 10px 20px !important;
            margin: 0 !important;
            border-bottom: none !important;
        }

        .ant-tabs-tab {
            background: rgba(255,255,255,0.9) !important;
            border-radius: 20px !important;
            padding: 8px 20px !important;
            margin-right: 10px !important;
            border: none !important;
            font-weight: 500 !important;
            transition: all 0.3s ease !important;
        }

        .ant-tabs-tab:hover {
            background: white !important;
            transform: translateY(-2px) !important;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important;
        }

        .ant-tabs-tab-active {
            background: white !important;
            color: #333 !important;
            font-weight: 600 !important;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important;
        }

        /* 隐藏非监控标签 */
        .ant-tabs-tab:not(.ant-tabs-tab-active) {
            display: none !important;
        }

        /* 标签页内容区域 */
        .ant-tabs-content {
            padding: 0 !important;
            height: calc(100vh - 60px) !important;
        }

        .ant-tabs-tabpane {
            height: 100% !important;
        }

        /* 地图容器全屏 */
        .amap-container,
        [class*="map-container"],
        [class*="Map-container"],
        #map,
        [id*="map"] {
            width: 100% !important;
            height: 100% !important;
            min-height: calc(100vh - 60px) !important;
        }

        /* 卡片样式优化 */
        .ant-card {
            border-radius: 12px !important;
            box-shadow: 0 2px 8px rgba(0,0,0,0.08) !important;
            margin: 10px !important;
        }

        .ant-card-body {
            padding: 16px !important;
        }

        /* 统计信息卡片 */
        [class*="statistic"],
        [class*="Statistical"] {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
            color: white !important;
            border-radius: 12px !important;
            padding: 15px !important;
        }

        /* 按钮样式优化 */
        button[class*="primary"],
        .ant-btn-primary {
            background: linear-gradient(135deg, #FFD100 0%, #FFA500 100%) !important;
            border: none !important;
            border-radius: 8px !important;
            color: #333 !important;
            font-weight: 500 !important;
        }

        /* 输入框优化 */
        .ant-input,
        .ant-select-selector {
            border-radius: 8px !important;
            border: 1px solid #e0e0e0 !important;
        }

        /* 表格优化 */
        .ant-table {
            border-radius: 12px !important;
            overflow: hidden !important;
        }

        .ant-table-thead > tr > th {
            background: #f8f9fa !important;
            font-weight: 600 !important;
        }

        /* 滚动条美化 */
        ::-webkit-scrollbar {
            width: 6px !important;
            height: 6px !important;
        }

        ::-webkit-scrollbar-track {
            background: #f1f1f1 !important;
        }

        ::-webkit-scrollbar-thumb {
            background: #c1c1c1 !important;
            border-radius: 3px !important;
        }

        ::-webkit-scrollbar-thumb:hover {
            background: #a8a8a8 !important;
        }

        /* 隐藏不必要的元素 */
        .ant-page-header,
        .ant-layout-footer,
        footer,
        [class*="footer"] {
            display: none !important;
        }

        /* 工具栏美化 */
        [class*="toolbar"],
        [class*="Toolbar"] {
            background: white !important;
            padding: 12px 20px !important;
            box-shadow: 0 2px 8px rgba(0,0,0,0.06) !important;
            border-radius: 0 0 12px 12px !important;
            margin-bottom: 10px !important;
        }
    `);

    // 处理标签页 - 只保留实时监控
    function processTabs() {
        const tabs = document.querySelectorAll('.ant-tabs-tab, [role="tab"], .tab-item');

        tabs.forEach((tab) => {
            const text = (tab.textContent || tab.innerText || '').trim();

            // 检查是否是实时监控相关标签
            const isMonitor = text.includes('实时') ||
                            text.includes('监控') ||
                            text.includes('调度') ||
                            text.includes('Courier') ||
                            text.includes('Monitor');

            if (!isMonitor && text.length > 0) {
                // 隐藏非监控标签
                tab.style.display = 'none';
                console.log('[Keeta] 隐藏标签:', text);
            } else if (isMonitor) {
                // 确保监控标签可见并处于活动状态
                tab.style.display = 'block';

                // 如果未激活，点击它
                if (!tab.classList.contains('ant-tabs-tab-active') &&
                    !tab.getAttribute('aria-selected') === 'true') {
                    console.log('[Keeta] 点击监控标签:', text);
                    setTimeout(() => tab.click(), 500);
                }
            }
        });
    }

    // 优化布局
    function optimizeLayout() {
        // 查找主要内容区域
        const contentArea = document.querySelector('.roo-plus-layout-content, [class*="layout-content"], main');
        if (contentArea) {
            contentArea.style.marginLeft = '0';
            contentArea.style.padding = '0';
            contentArea.style.width = '100%';
            contentArea.style.minHeight = '100vh';
        }

        // 确保地图占满剩余空间
        const mapContainers = document.querySelectorAll('.amap-container, [class*="map-container"], [class*="Map"]');
        mapContainers.forEach(map => {
            map.style.width = '100%';
            map.style.height = 'calc(100vh - 60px)';
        });
    }

    // 初始化
    function init() {
        console.log('[Keeta Beautiful] 初始化...');
        processTabs();
        optimizeLayout();
    }

    // 页面加载完成后执行
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // 延迟多次尝试
    setTimeout(init, 1000);
    setTimeout(init, 3000);
    setTimeout(init, 5000);

    // 监听变化
    const observer = new MutationObserver(() => {
        processTabs();
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    console.log('[Keeta Beautiful] 初始化完成');
})();

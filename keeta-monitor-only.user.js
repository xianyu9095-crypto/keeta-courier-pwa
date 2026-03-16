// ==UserScript==
// @name         Keeta Courier - 仅显示实时骑手监控
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  隐藏美团骑手管理后台的其他标签页，仅显示实时骑手监控
// @author       You
// @match        https://courier.mykeeta.com/partner/web/admin/courier*
// @match        https://courier.mykeeta.com/partner/web/*
// @grant        GM_addStyle
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // 添加自定义样式
    GM_addStyle(`
        /* 隐藏顶部导航栏 */
        .ant-layout-header,
        header.ant-layout-header,
        .partner-header,
        .common-header {
            display: none !important;
        }

        /* 隐藏左侧菜单栏 */
        .ant-layout-sider,
        aside.ant-layout-sider,
        .partner-sider,
        .common-sider,
        .ant-menu,
        .ant-menu-root {
            display: none !important;
        }

        /* 隐藏所有 tab 标签页，除了实时骑手监控 */
        .ant-tabs-nav,
        .ant-tabs-tab,
        .ant-tabs-tab-btn {
            display: none !important;
        }

        /* 保留实时骑手监控标签 */
        .ant-tabs-tab:has([aria-selected="true"]),
        .ant-tabs-tab-active,
        .ant-tabs-tabpane-active {
            display: block !important;
        }

        /* 调整主内容区域 */
        .ant-layout-content,
        main.ant-layout-content {
            margin-left: 0 !important;
            padding: 0 !important;
        }

        /* 隐藏面包屑导航 */
        .ant-breadcrumb,
        .breadcrumb,
        .ant-page-header {
            display: none !important;
        }

        /* 隐藏页面标题区域 */
        .page-title,
        .ant-page-header-heading,
        .header-title {
            display: none !important;
        }

        /* 最大化内容区域 */
        .ant-layout {
            min-height: 100vh !important;
        }

        /* 隐藏统计卡片等其他模块（如果不是实时监控） */
        .ant-card:not(:has(.realtime-map)):not(:has([class*="map"])),
        .statistic-card,
        .dashboard-card {
            display: none !important;
        }

        /* 显示实时地图容器 */
        .realtime-map,
        [class*="map"],
        [class*="monitor"],
        .ant-card:has(.realtime-map),
        .ant-card:has([class*="map"]) {
            display: block !important;
            width: 100% !important;
            height: 100vh !important;
        }

        /* 全屏地图 */
        .amap-container,
        .amap-map,
        #map,
        [id*="map"] {
            width: 100% !important;
            height: 100vh !important;
        }

        /* 隐藏底部信息 */
        .ant-layout-footer,
        footer {
            display: none !important;
        }

        /* 隐藏通知横幅 */
        .ant-alert,
        .notification-banner {
            display: none !important;
        }

        /* 保持模态框可显示 */
        .ant-modal-wrap,
        .ant-modal-mask,
        .ant-modal {
            display: block !important;
        }
    `);

    // 页面加载完成后执行
    function init() {
        console.log('[Keeta Monitor] 正在优化界面...');

        // 检查是否在实时骑手监控页面
        const checkAndRedirect = () => {
            const currentUrl = window.location.href;

            // 如果不是实时监控页面，尝试跳转
            if (!currentUrl.includes('scheduler') &&
                !currentUrl.includes('monitor') &&
                !currentUrl.includes('realtime')) {

                // 尝试点击实时骑手监控菜单项
                const monitorMenuItems = document.querySelectorAll(
                    '.ant-menu-item, .menu-item, [class*="menu"]'
                );

                for (let item of monitorMenuItems) {
                    const text = item.textContent || item.innerText || '';
                    if (text.includes('实时') ||
                        text.includes('监控') ||
                        text.includes('调度') ||
                        text.includes('骑手监控')) {
                        item.click();
                        console.log('[Keeta Monitor] 已跳转到实时监控页面');
                        return true;
                    }
                }
            }
            return false;
        };

        // 延迟执行以确保页面元素已加载
        setTimeout(checkAndRedirect, 1000);
        setTimeout(checkAndRedirect, 3000);

        // 隐藏其他标签页
        const hideOtherTabs = () => {
            const tabs = document.querySelectorAll('.ant-tabs-tab');
            tabs.forEach(tab => {
                const text = tab.textContent || tab.innerText || '';
                // 如果不是实时监控相关标签，隐藏它
                if (!text.includes('实时') &&
                    !text.includes('监控') &&
                    !text.includes('调度') &&
                    !text.includes('骑手监控')) {
                    tab.style.display = 'none';
                }
            });
        };

        // 多次尝试隐藏标签
        setTimeout(hideOtherTabs, 1500);
        setTimeout(hideOtherTabs, 3000);
        setTimeout(hideOtherTabs, 5000);

        // 观察 DOM 变化，动态隐藏新元素
        const observer = new MutationObserver((mutations) => {
            hideOtherTabs();
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // 页面加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // 监听页面变化（SPA路由）
    let lastUrl = location.href;
    new MutationObserver(() => {
        const url = location.href;
        if (url !== lastUrl) {
            lastUrl = url;
            console.log('[Keeta Monitor] 页面变化，重新优化...');
            setTimeout(init, 1000);
        }
    }).observe(document, { subtree: true, childList: true });

    console.log('[Keeta Monitor] 脚本已加载');
})();

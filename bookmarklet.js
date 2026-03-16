javascript:(function(){
    // 隐藏顶部导航
    document.querySelectorAll('.ant-layout-header, header, .partner-header').forEach(el => el.style.display = 'none');
    // 隐藏侧边栏
    document.querySelectorAll('.ant-layout-sider, aside, .ant-menu').forEach(el => el.style.display = 'none');
    // 隐藏标签页
    document.querySelectorAll('.ant-tabs-nav').forEach(el => {
        const tabs = el.querySelectorAll('.ant-tabs-tab');
        tabs.forEach(tab => {
            const text = tab.textContent || '';
            if (!text.includes('实时') && !text.includes('监控')) {
                tab.style.display = 'none';
            }
        });
    });
    // 调整内容区域
    document.querySelectorAll('.ant-layout-content, main').forEach(el => {
        el.style.marginLeft = '0';
        el.style.padding = '0';
    });
    // 全屏显示地图
    document.querySelectorAll('.amap-container, [class*="map"]').forEach(el => {
        el.style.width = '100%';
        el.style.height = '100vh';
    });
    alert('已切换到实时监控模式！');
})();

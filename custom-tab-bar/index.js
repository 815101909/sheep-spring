const themeManager = require('../utils/themeManager');
Component({
  data: {
    selected: 0,
    color: "#7A7E83",
    selectedColor: "#87CEEB",
    themeClass: 'light',
    list: [
      {
        pagePath: "/pages/garden/garden",
        text: "春日扬帆",
        iconPath: "/assets/images/garden.png",
        selectedIconPath: "/assets/images/garden.png"
      },
      {
        pagePath: "/pages/music/music",
        text: "初春牧歌",
        iconPath: "/assets/images/music.png",
        selectedIconPath: "/assets/images/music.png"
      },
      {
        pagePath: "/pages/hoofprint/hoofprint",
        text: "仲春蹄印",
        iconPath: "/assets/images/sheep.png",
        selectedIconPath: "/assets/images/sheep.png"
      }
    ]
  },
  attached() {
    // 获取当前页面路径来设置选中状态
    const pages = getCurrentPages();
    if (pages.length > 0) {
      const currentPage = pages[pages.length - 1];
      if (currentPage && currentPage.route) {
        const currentPath = currentPage.route;
        // 根据当前页面路径设置选中索引
        if (currentPath.includes('garden')) {
          this.setData({ selected: 0 });
        } else if (currentPath.includes('music')) {
          this.setData({ selected: 1 });
        } else if (currentPath.includes('hoofprint')) {
          this.setData({ selected: 2 });
        }
      }
    }
    this.setData({ themeClass: themeManager.isDark() ? 'dark' : 'light' });
  },
  methods: {
    switchTab(e) {
      getApp().playClickSound();
      const data = e.currentTarget.dataset;
      const url = data.path;
      wx.switchTab({ url });
    },
    updateTheme() {
      this.setData({ themeClass: themeManager.isDark() ? 'dark' : 'light' });
    }
  }
});

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
      },
      {
        pagePath: "/pages/sheep-chat/sheep-chat",
        text: "绵羊对话",
        iconPath: "/assets/images/sheep.png",
        selectedIconPath: "/assets/images/sheep.png"
      }
    ]
  },
  attached() {
    this.updateSelectedTab();
    this.setData({ themeClass: themeManager.isDark() ? 'dark' : 'light' });
  },
  
  pageLifetimes: {
    show: function() {
      // 页面显示时更新选中状态
      this.updateSelectedTab();
    }
  },
  
  methods: {
    // 更新选中tab的方法
    updateSelectedTab() {
      const pages = getCurrentPages();
      if (pages.length > 0) {
        const currentPage = pages[pages.length - 1];
        if (currentPage && currentPage.route) {
          const currentPath = currentPage.route;
          console.log('当前页面路径:', currentPath);
          
          // 精确匹配页面路径
          if (currentPath === 'pages/garden/garden') {
            this.setData({ selected: 0 });
          } else if (currentPath === 'pages/music/music') {
            this.setData({ selected: 1 });
          } else if (currentPath === 'pages/hoofprint/hoofprint') {
            this.setData({ selected: 2 });
          } else if (currentPath === 'pages/sheep-chat/sheep-chat') {
            this.setData({ selected: 3 });
          } else {
            // 默认选中第一个
            this.setData({ selected: 0 });
          }
        }
      }
    },
    
    switchTab(e) {
      getApp().playClickSound();
      const data = e.currentTarget.dataset;
      const url = data.path;
      const index = data.index;
      
      // 更新选中状态
      this.setData({ selected: index });
      
      // 对于tabBar页面，始终使用switchTab
      wx.switchTab({ url });
    },
    updateTheme() {
      this.setData({ themeClass: themeManager.isDark() ? 'dark' : 'light' });
    }
  }
});

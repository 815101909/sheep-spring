// pages/collection/collection.js
const favoriteManager = require('../../utils/favoriteManager');

Page({
  data: {
    activeTab: 'music', // 当前激活的标签页：music 或 articles

    // 统计数据
    favoriteSongsCount: 0,
    favoriteArticlesCount: 0,

    // 收藏列表
    favoriteSongs: [],
    favoriteArticles: []
  },

  onLoad: function (options) {
    this.loadFavoriteData();
    // 异步同步云端数据
    this.syncCloudData();
  },

  onShow: function () {
    // 页面显示时刷新数据
    this.loadFavoriteData();
  },

  /**
   * 同步云端数据
   */
  syncCloudData: async function() {
    wx.showNavigationBarLoading();
    await favoriteManager.syncFromCloud();
    this.loadFavoriteData(); // 重新加载数据
    wx.hideNavigationBarLoading();
  },

  /**
   * 加载收藏数据
   */
  loadFavoriteData: function () {
    // 强制触发一次去重（通过重新实例化或调用去重逻辑，但 FavoriteManager 是单例模式还是每次 require 都是同一实例？
    // require 是缓存的，所以是同一实例。我们需要显式调用去重，或者让页面刷新时触发。
    // 由于 _deduplicate 是私有的（约定），我们可以在 getAll 之前做一次简单去重，或者修改 FavoriteManager 暴露 cleanup 方法。
    // 但既然我在 constructor 里加了 _deduplicate，只要重新加载页面（小程序冷启动）就会去重。
    // 为了即时生效，我在 collection.js 里也做一个去重展示。

    // 1. 获取所有收藏数据
    const allMusic = favoriteManager.getAll('music');
    const allArticles = favoriteManager.getAll('article');

    console.log('Collection: Raw articles from storage:', allArticles);

    const uniqueArticles = [];
    const seenKeys = new Set();
    allArticles.forEach(item => {
      const raw = item.data || {};
      const ct = raw.cardType || raw.card_type || 'main';
      const key = `${item.id}_${ct}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        uniqueArticles.push(item);
      }
    });

    // 2. 转换音乐数据格式
    const favoriteSongs = allMusic.map(item => {
      // 优先使用原始数据，如果没有则使用通用字段
      const raw = item.data || {};
      return {
        ...raw, // 保留原始所有字段
        title: item.title,
        artist: item.subtitle,
        cover: item.cover,
        // 确保播放需要的字段存在
        media_url: raw.media_url || '',
        audio_url: raw.audio_url || '',
        image: item.cover,
        type: raw.type || 'image'
      };
    });

    // 3. 转换文章数据格式（严格按保存的 cardType 与字段渲染）
    const favoriteArticles = uniqueArticles.map(item => {
      const raw = item.data || {};
      const cardType = raw.cardType || raw.card_type || 'main';

      return {
        id: item.id,
        titleCn: raw.titleCn || raw.title || item.title || '无标题',
        subtitle: raw.subtitle || item.subtitle || '',
        category: raw.category || item.subtitle || '',
        cover: item.cover,
        date: raw.date || '未知日期',
        cardType: cardType
      };
    });

    // 4. 更新页面数据
    this.setData({
      favoriteSongs: favoriteSongs,
      favoriteArticles: favoriteArticles,
      favoriteSongsCount: favoriteSongs.length,
      favoriteArticlesCount: favoriteArticles.length
    });
  },

  /**
   * 切换标签页
   */
  switchTab: function (e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({
      activeTab: tab
    });
  },

  /**
   * 播放音乐
   */
  playSong: function (e) {
    // 跳转到初春牧歌页面
    wx.switchTab({
      url: '/pages/music/music',
      fail: function () {
        wx.showToast({
          title: '跳转失败',
          icon: 'none'
        });
      }
    });
  },

  /**
   * 阅读文章
   */
  readArticle: function (e) {
    const article = e.currentTarget.dataset.article;
    const isSmallCard = article.cardType === 'small';

    // 跳转到文章详情页面
    wx.navigateTo({
      url: `/pages/article-detail/article-detail?articleId=${article.id}&isSmallCard=${isSmallCard}`,
      fail: function () {
        wx.showToast({
          title: '跳转失败',
          icon: 'none'
        });
      }
    });
  }
});

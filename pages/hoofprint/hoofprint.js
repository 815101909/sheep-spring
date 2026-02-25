// pages/hoofprint/hoofprint.js
const favoriteManager = require('../../utils/favoriteManager');

Page({
  /**
   * 跳转到绵羊对话页面
   */
  openSheepChat: function () {
    getApp().playClickSound();
    wx.navigateTo({
      url: '/pages/sheep-chat/sheep-chat'
    });
  },


  /**
   * 页面的初始数据
   */
  data: {
    carouselItems: [], // 将动态生成
    todayGentle: null, // 今日温柔卡片
    todayGentleDate: '',
    selectedDate: '', // 存储选择的日期
    selectedDateText: '', // 显示的日期文本
    selectedType: '全部', // 存储选择的类型
    selectedTypeText: '全部', // 显示的类型文本
    typeOptions: ['全部', '文化', '生活', '成长', '科技', '技能', '祝福', '思考', '学习', '旅行', '商业', '体育', '热词', '医疗', '健康', '历史', '人物', '节日', '故事', '典故'], // 类型选项
    showTypeDropdown: false, // 控制类型下拉列表显示隐藏
    timelineData: [], // 初始为空
    filteredTimelineData: [], // 存储筛选后的时间线数据
    displayFilteredTimelineData: [], // 展示用子集
    displayLimit: 8,
    displayIncrement: 8,

    // 收藏状态
    favoriteArticles: [40, 41] // 模拟已收藏的文章ID
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    // 默认不筛选日期，显示所有时间线内容
    this.setData({
      selectedDate: '',
      selectedDateText: '全部日期'
    });

    // 加载收藏状态
    this.updateFavoriteStatus();

    this.loadDailyTenderness();
    // 从云端加载数据
    this.loadArticlesFromCloud();
  },

  onShow: function() {
    this.updateFavoriteStatus();
  },

  updateFavoriteStatus: function() {
    this.filterTimeline();
  },

  /**
   * 加载今日温柔数据 (daily_tenderness)
   */
  loadDailyTenderness: async function() {
    try {
      const cached = wx.getStorageSync('spring_daily_tenderness_cache') || null;
      if (cached && cached.expiresAt && cached.expiresAt > Date.now() && cached.item) {
        this.setData({ dailyTendernessItem: cached.item });
        return;
      }
      const c1 = new wx.cloud.Cloud({
        resourceAppid: 'wx85d92d28575a70f4', 
        resourceEnv: 'cloud1-1gsyt78b92c539ef', 
      });
      await c1.init();
      const db = c1.database();
      const res = await db.collection('spring_daily_tenderness')
        .orderBy('publish_time', 'desc')
        .limit(1)
        .get();

      if (res.data && res.data.length > 0) {
        const item = res.data[0];
        let pictureUrl = item.picture;
        if (pictureUrl && pictureUrl.startsWith('cloud://')) {
          try {
            const ttlMs = 2 * 60 * 60 * 1000;
            const tempMap = await this.convertTempUrlsWithCache(c1, [pictureUrl], ttlMs);
            pictureUrl = tempMap[pictureUrl] || pictureUrl;
          } catch (_) {}
        }
        const dataItem = { id: item._id, cover: pictureUrl, publish_time: item.publish_time };
        this.setData({ dailyTendernessItem: dataItem });
        try {
          wx.setStorageSync('spring_daily_tenderness_cache', {
            item: dataItem,
            expiresAt: Date.now() + 3 * 60 * 60 * 1000
          });
        } catch (_) {}
      }
    } catch (err) {
      console.error('加载今日温柔失败', err);
    }
  },

  /**
   * 从云端加载文章数据
   */
  loadArticlesFromCloud: async function() {
    let hasCache = false;
    try {
      const cached = wx.getStorageSync('spring_timeline_cache') || null;
      if (cached && cached.expiresAt && cached.expiresAt > Date.now()) {
        this.setData({
          carouselItems: cached.carouselItems || [],
          timelineData: cached.timelineData || [],
          dailyTendernessItem: cached.dailyTendernessItem || this.data.dailyTendernessItem || null
        });
        this.filterTimeline();
        this.computeTodayGentle();
        hasCache = true;
      }
    } catch (_) {}
    if (!hasCache) {
      wx.showLoading({ title: '加载中...' });
    }
    
    // 初始化跨环境云实例
    const c1 = new wx.cloud.Cloud({
      resourceAppid: 'wx85d92d28575a70f4', // 资源方 AppID
      resourceEnv: 'cloud1-1gsyt78b92c539ef', // 资源方环境 ID
    });
    await c1.init();

    c1.callFunction({
      name: 'spring_get_hoofprint_articles',
      success: async res => {
        const result = res.result;
        if (result.code === 0) {
          const { carouselItems, timelineData, dailyTenderness } = result.data;
          let chosenDaily = dailyTenderness;
          try {
            if (!chosenDaily) {
              const db2 = c1.database();
              const qres = await db2.collection('spring_daily_tenderness')
                .orderBy('publish_time', 'desc')
                .limit(1)
                .get();
              if (qres.data && qres.data.length > 0) chosenDaily = qres.data[0];
            }
          } catch (_) {}
          
          // 处理图片链接 (转换 cloud:// 到 http)
          const fileList = [];
          
          // 收集所有需要转换的图片链接
          carouselItems.forEach(item => {
            if (item.cover && item.cover.startsWith('cloud://')) fileList.push(item.cover);
            if (item.a4Image && item.a4Image.startsWith('cloud://')) fileList.push(item.a4Image);
          });
          timelineData.forEach(group => {
            group.articles.forEach(article => {
              if (article.cover && article.cover.startsWith('cloud://')) fileList.push(article.cover);
              if (article.a4Image && article.a4Image.startsWith('cloud://')) fileList.push(article.a4Image);
            });
          });
          
          // 处理今日温柔图片
          if (chosenDaily && chosenDaily.picture && chosenDaily.picture.startsWith('cloud://')) {
            fileList.push(chosenDaily.picture);
          }

          const fixedSmallCover = 'cloud://cloud1-1gsyt78b92c539ef.636c-cloud1-1gsyt78b92c539ef-1370520707/cover/春暖花开.jpg';
          fileList.push(fixedSmallCover);
          
          // 批量换取临时链接
          let tempUrlMap = {};
          if (fileList.length > 0) {
            try {
              const ttlMs = 2 * 60 * 60 * 1000;
              tempUrlMap = await this.convertTempUrlsWithCache(c1, fileList, ttlMs);
            } catch (err) {
              console.error('图片链接转换失败', err);
            }
          }
          
          // 辅助函数：格式化日期 (时间戳 -> YYYY.MM.DD)
          const formatDate = (timestamp) => {
            if (!timestamp) return '';
            if (typeof timestamp === 'string' && timestamp.includes('.')) return timestamp; // 已经是格式化好的字符串
            const date = new Date(timestamp);
            const year = date.getFullYear();
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const day = date.getDate().toString().padStart(2, '0');
            return `${year}年${month}月${day}日`;
          };

          // 替换链接并格式化日期
          const finalCarouselItems = carouselItems.map(item => ({
            ...item,
            cover: tempUrlMap[item.cover] || item.cover,
            a4Image: tempUrlMap[item.a4Image] || item.a4Image,
            level: item.level || item.level === 0 ? item.level : 'low'
          }));
          
          const finalTimelineData = timelineData.map(group => ({
            ...group,
            date: formatDate(group.date),
            articles: group.articles.map(article => ({
              ...article,
              cover: tempUrlMap[article.cover] || article.cover,
              a4Image: tempUrlMap[article.a4Image] || article.a4Image,
              level: article.level || (article.level === 0 ? article.level : 'low'),
              smallCover: tempUrlMap[fixedSmallCover] || ''
            }))
          }));

          // 设置今日温柔数据
          if (chosenDaily) {
            this.setData({
              dailyTendernessItem: {
                id: chosenDaily._id,
                cover: tempUrlMap[chosenDaily.picture] || chosenDaily.picture,
                publish_time: chosenDaily.publish_time
              }
            });
          }

          this.setData({
            carouselItems: finalCarouselItems,
            timelineData: finalTimelineData
          });
          try {
            wx.setStorageSync('spring_timeline_cache', {
              carouselItems: finalCarouselItems,
              timelineData: finalTimelineData,
              dailyTendernessItem: this.data.dailyTendernessItem || null,
              expiresAt: Date.now() + 10 * 60 * 1000
            });
          } catch (_) {}
          
          // 初始化筛选
          this.filterTimeline();
          // 计算今日温柔卡片
          this.computeTodayGentle();
          
        } else {
          console.error('获取文章失败', result.msg);
          wx.showToast({ title: '获取数据失败', icon: 'none' });
        }
        if (!hasCache) wx.hideLoading();
      },
      fail: err => {
        console.error('云函数调用失败', err);
        if (!hasCache) wx.hideLoading();
        wx.showToast({ title: '加载失败', icon: 'none' });
      }
    });
  },
  getTempUrlCache() {
    return wx.getStorageSync('temp_url_cache_map') || {};
  },
  setTempUrlCache(map) {
    wx.setStorageSync('temp_url_cache_map', map || {});
  },
  getCachedTempUrl(fid) {
    if (!fid) return '';
    const map = this.getTempUrlCache();
    const e = map[fid];
    if (e && e.url && e.expiresAt && e.expiresAt > Date.now()) return e.url;
    return '';
  },
  setCachedTempUrl(fid, url, ttlMs) {
    if (!fid || !url) return;
    const map = this.getTempUrlCache();
    map[fid] = { url, expiresAt: Date.now() + (ttlMs || 0) };
    this.setTempUrlCache(map);
  },
  async convertTempUrlsWithCache(c1, fids, ttlMs) {
    const result = {};
    const toFetch = [];
    (fids || []).forEach(fid => {
      const u = this.getCachedTempUrl(fid);
      if (u) result[fid] = u;
      else toFetch.push(fid);
    });
    if (toFetch.length) {
      const secs = Math.max(1, Math.floor((ttlMs || 0) / 1000));
      const resp = await c1.getTempFileURL({ fileList: toFetch, config: { maxAge: secs } });
      const list = resp.fileList || [];
      list.forEach(it => {
        if (it.status === 0) {
          result[it.fileID] = it.tempFileURL;
          this.setCachedTempUrl(it.fileID, it.tempFileURL, ttlMs || 0);
        }
      });
    }
    return result;
  },

  /**
   * 将时间戳或 Date 生成 YYYY年MM月DD日
   */
  formatDate: function (ts) {
    const date = (typeof ts === 'number' || typeof ts === 'string') ? new Date(ts) : (ts || new Date());
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${y}年${m}月${d}日`;
  },

  /**
   * 计算今日温柔卡片列表：
   * 优先取当天的文章，如果不够5篇，则从时间线前面补充，凑够5篇以便轮播
   */
  computeTodayGentle: function () {
    const { carouselItems } = this.data;
    
    // 直接使用 is_carousel 的数据
    if (!carouselItems || carouselItems.length === 0) {
      this.setData({ todayGentleList: [] });
      return;
    }
    
    // 截取前 5 个
    const candidates = carouselItems.slice(0, 5);
    
    this.setData({
      todayGentleList: candidates,
      currentGentleIndex: 0
    });
    
    this.startGentleTimer();
  },

  gentleTimer: null,

  startGentleTimer: function() {
    this.stopGentleTimer();
    if (this.data.todayGentleList.length > 1) {
      this.gentleTimer = setInterval(() => {
        this.nextGentleSlide();
      }, 4000);
    }
  },

  stopGentleTimer: function() {
    if (this.gentleTimer) {
      clearInterval(this.gentleTimer);
      this.gentleTimer = null;
    }
  },

  nextGentleSlide: function() {
    const len = this.data.todayGentleList.length;
    if (len < 2) return;
    this.setData({
      currentGentleIndex: (this.data.currentGentleIndex + 1) % len
    });
  },

  prevGentleSlide: function() {
    const len = this.data.todayGentleList.length;
    if (len < 2) return;
    this.setData({
      currentGentleIndex: (this.data.currentGentleIndex - 1 + len) % len
    });
    // 重置计时器，避免手动点击后立即自动切换
    this.startGentleTimer(); 
  },
  
  // 手动切换下一张
  handleNextSlide: function() {
      getApp().playClickSound();
      this.nextGentleSlide();
      this.startGentleTimer();
  },
  
  // 手动切换上一张
  handlePrevSlide: function() {
      getApp().playClickSound();
      this.prevGentleSlide();
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady: function () {

  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({
        selected: 2
      })
    }
  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide: function () {

  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload: function () {

  },

  /**
   * 日期选择器改变事件
   */
  bindDateChange: function (e) {
    getApp().playClickSound();
    const dateParts = e.detail.value.split('-');
    const formattedDate = `${dateParts[0]}年${dateParts[1]}月${dateParts[2]}日`;
    this.setData({
      selectedDate: e.detail.value,
      selectedDateText: formattedDate
    });
    wx.showToast({
      title: `选择了: ${formattedDate}`,
      icon: 'none'
    });
    this.filterTimeline();
  },

  /**
   * 选择全部日期
   */
  selectAllDates: function () {
    getApp().playClickSound();
    this.setData({
      selectedDate: '',
      selectedDateText: '全部日期'
    });
    wx.showToast({
      title: '显示全部日期',
      icon: 'none'
    });
    this.filterTimeline();
  },

  /**
   * 显示日期选择器
   */
  showDatePicker: function () {
    getApp().playClickSound();
    // 日期选择器会自动显示，因为picker组件绑定了showDatePicker事件
  },

  /**
   * 切换类型下拉列表显示/隐藏
   */
  toggleTypeDropdown: function () {
    getApp().playClickSound();
    this.setData({
      showTypeDropdown: !this.data.showTypeDropdown
    });
  },


  /**
   * 选择类型
   */
  selectType: function (e) {
    getApp().playClickSound();
    const type = e.currentTarget.dataset.type;
    this.setData({
      selectedType: type,
      selectedTypeText: type,
      showTypeDropdown: false // 选择后关闭下拉列表
    });
    wx.showToast({
      title: `筛选类型: ${type}`,
      icon: 'none'
    });
    this.filterTimeline();
  },


  /**
   * 生成轮播数据 - 从所有勾选的文章中获取
   */
  generateCarouselItems: function () {
    const { timelineData } = this.data;
    const selectedArticles = [];

    // 遍历所有日期的所有文章，收集勾选的文章
    timelineData.forEach(dateBlock => {
      dateBlock.articles.forEach(article => {
        if (article.selected) {
          selectedArticles.push({
            id: article.id,
            title: article.titleCn,
            cover: article.cover,
            date: dateBlock.date,
            category: article.category
          });
        }
      });
    });

    this.setData({
      carouselItems: selectedArticles
    });
  },

  /**
   * 筛选时间线数据
   */
  filterTimeline: function () {
    const { timelineData, selectedDate, selectedType } = this.data;
    let filteredData = timelineData;

    // 1. 按日期筛选 (精确匹配)
    if (selectedDate) {
      const dateText = this.data.selectedDateText;
      filteredData = filteredData.filter(item => item.date === dateText);
    }

    // 2. 按类型筛选
    if (selectedType !== '全部') {
      filteredData = filteredData.filter(dateBlock => {
        // 检查这个日期块是否包含指定类型的文章
        const hasMatchingArticle = dateBlock.articles.some(article => {
          return article.category !== '放松' && article.titleCn.startsWith(selectedType + '｜');
        });

        // 如果包含指定类型的文章，保留整个日期块
        if (hasMatchingArticle) {
          return true;
        }

        // 如果不包含指定类型的文章，移除整个日期块
        return false;
      });
    }


    // 4. 注入收藏状态（按卡片类型区分）
    filteredData = filteredData.map(dateBlock => {
      const articlesWithFav = (dateBlock.articles || []).map(a => ({
        ...a,
        isFavoritedMain: favoriteManager.isFavorite(a.id, 'article', 'main'),
        isFavoritedSmall: favoriteManager.isFavorite(a.id, 'article', 'small')
      }));
      return { ...dateBlock, articles: articlesWithFav };
    });

    const limit = this.data.displayLimit || filteredData.length;
    this.setData({
      filteredTimelineData: filteredData,
      displayFilteredTimelineData: filteredData.slice(0, limit)
    });
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh: function () {

  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom: function () {
    const full = this.data.filteredTimelineData || [];
    const limit = this.data.displayLimit || 0;
    const inc = this.data.displayIncrement || 6;
    const next = Math.min(limit + inc, full.length);
    if (next > limit) {
      this.setData({ displayLimit: next, displayFilteredTimelineData: full.slice(0, next) });
    }
  },

  /**
   * 打开轮播文章详情页面
   */
  openCarouselArticle: function (e) {
    const { article } = e.currentTarget.dataset;

    // 记录阅读数量（按日期统计）
    if (article && article.date) {
      this.recordReadCount(article.date);
    }

    wx.navigateTo({
      url: `/pages/article-detail/article-detail?articleId=${article.id}&isSmallCard=false`,
      success: function() {
        console.log('从轮播跳转到短文详情页面成功', article.id);
      },
      fail: function(err) {
        console.error('跳转失败', err);
        wx.showToast({
          title: '跳转失败',
          icon: 'none'
        });
      }
    });
  },

  /**
   * 打开短文详情页面
   */
  openArticleDetail: function (e) {
    const { article, date, cardType } = e.currentTarget.dataset;

    // 记录阅读数量（按日期统计）
    if (date) {
      this.recordReadCount(date);
    }

    // 检测是否为小卡片
    const isSmallCard = cardType === 'small';

    wx.navigateTo({
      url: `/pages/article-detail/article-detail?articleId=${article.id}&isSmallCard=${isSmallCard}`,
      success: function() {
        console.log('跳转到短文详情页面成功', article.id, isSmallCard ? '小卡片' : '主卡片');
      },
      fail: function(err) {
        console.error('跳转失败', err);
        wx.showToast({
          title: '跳转失败',
          icon: 'none'
        });
      }
    });
  },

  /**
   * 记录阅读数量
   */
  recordReadCount: function(articleId) {
    if (!articleId) return;
    
    const dt = new Date();
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const d = String(dt.getDate()).padStart(2, '0');
    const today = `${y}/${m}/${d}`;
    // 组合 Key: 文章ID_日期 (按天去重)
    const recordKey = `${articleId}_${today}`;
    
    let readCards = wx.getStorageSync('readCards') || [];

    // 检查今天是否已经记录过这篇文章
    if (!readCards.includes(recordKey)) {
      readCards.push(recordKey);
      wx.setStorageSync('readCards', readCards);
    }
  },

  /**
   * 切换文章收藏状态
   */
  toggleFavorite: function (e) {
    getApp().playClickSound();
    const article = e.currentTarget.dataset.article;
    const cardType = e.currentTarget.dataset.cardType;
    const cardIndex = e.currentTarget.dataset.cardIndex;
    
    // 构建完整的文章对象用于收藏
    const articleToSave = {
      ...article,
      cardType: cardType || 'main',
      cardIndex: cardIndex || 0,
      date: this.data.selectedDateText || article.date || '未知日期'
    };

    const isFavorited = favoriteManager.toggle(articleToSave, 'article');

    if (isFavorited) {
      wx.showToast({
        title: '已添加到收藏',
        icon: 'success',
        duration: 1000
      });
    } else {
      wx.showToast({
        title: '已取消收藏',
        icon: 'success',
        duration: 1000
      });
    }

    // 更新页面数据
    this.updateFavoriteStatus();
  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage: function () {

  }
})

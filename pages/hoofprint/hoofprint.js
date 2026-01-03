// pages/hoofprint/hoofprint.js
const favoriteManager = require('../../utils/favoriteManager');

Page({

  /**
   * 页面的初始数据
   */
  data: {
    carouselItems: [], // 将动态生成
    selectedDate: '', // 存储选择的日期
    selectedDateText: '', // 显示的日期文本
    selectedType: '全部', // 存储选择的类型
    selectedTypeText: '全部', // 显示的类型文本
    typeOptions: ['全部', '文化', '生活', '成长', '科技', '技能', '祝福', '思考', '学习', '旅行', '商业', '体育', '热词', '医疗', '健康', '历史', '人物', '节日'], // 类型选项
    showTypeDropdown: false, // 控制类型下拉列表显示隐藏
    selectedDifficulty: '全部',
    selectedDifficultyText: '全部',
    difficultyOptions: ['全部', '低难度', '高难度'],
    showDifficultyDropdown: false,
    timelineData: [], // 初始为空
    filteredTimelineData: [], // 存储筛选后的时间线数据

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
   * 从云端加载文章数据
   */
  loadArticlesFromCloud: async function() {
    wx.showLoading({ title: '加载中...' });
    
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
          const { carouselItems, timelineData } = result.data;
          
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
          
          // 批量换取临时链接
          let tempUrlMap = {};
          if (fileList.length > 0) {
            try {
              const tempRes = await c1.getTempFileURL({
                fileList: fileList,
                config: { maxAge: 3 * 60 * 60 }
              });
              tempRes.fileList.forEach(file => {
                if (file.status === 0) tempUrlMap[file.fileID] = file.tempFileURL;
              });
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
              level: article.level || (article.level === 0 ? article.level : 'low')
            }))
          }));

          this.setData({
            carouselItems: finalCarouselItems,
            timelineData: finalTimelineData
          });
          
          // 初始化筛选
          this.filterTimeline();
          
        } else {
          console.error('获取文章失败', result.msg);
          wx.showToast({ title: '获取数据失败', icon: 'none' });
        }
        wx.hideLoading();
      },
      fail: err => {
        console.error('云函数调用失败', err);
        wx.hideLoading();
        wx.showToast({ title: '加载失败', icon: 'none' });
      }
    });
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

  toggleDifficultyDropdown: function () {
    getApp().playClickSound();
    this.setData({
      showDifficultyDropdown: !this.data.showDifficultyDropdown
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

  selectDifficulty: function (e) {
    getApp().playClickSound();
    const difficulty = e.currentTarget.dataset.difficulty;
    this.setData({
      selectedDifficulty: difficulty,
      selectedDifficultyText: difficulty,
      showDifficultyDropdown: false
    });
    wx.showToast({
      title: `筛选难度: ${difficulty}`,
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
    const { timelineData, selectedDate, selectedType, selectedDifficulty } = this.data;
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

    // 3. 按难度筛选（基于后端 level 字段，仅过滤卡片，不整天移除）
    if (selectedDifficulty && selectedDifficulty !== '全部') {
      const normalizeLevel = (lv) => {
        const s = String(lv || '').toLowerCase();
        if (s.includes('low') || s.includes('低')) return '低难度';
        if (s.includes('high') || s.includes('高')) return '高难度';
        return '低难度';
      };
      filteredData = filteredData
        .map(dateBlock => {
          const articles = (dateBlock.articles || []).filter(a => normalizeLevel(a.level) === selectedDifficulty);
          return { ...dateBlock, articles };
        })
        .filter(db => (db.articles || []).length > 0);
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

    this.setData({
      filteredTimelineData: filteredData
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
    
    const today = new Date().toDateString();
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

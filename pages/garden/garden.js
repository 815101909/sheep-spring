// pages/garden/garden.js
const favoriteManager = require('../../utils/favoriteManager');

Page({
  data: {
    isLoggedIn: false, // 登录状态
    userInfo: {
      name: '', // 未登录时为空
      description: '在春日的草原上，寻找属于自己的节奏',
      daysCount: 0,
      listenCount: 0,    // 收听数量 (原articlesCount)
      readCount: 0       // 阅读数量 (原favoritesCount)
    },
    currentAvatar: '',
    // A4区域三个栏目的数据
    checkinDays: 7,      // 打卡天数
    unlockedImages: 3,   // 解锁形象个数
    isVip: false,        // 是否是会员
    vipExpiry: '2024-12-31', // 会员到期时间
    audioCount: 0,      // 随身听数量
    cardCount: 0,        // 成长卡数量
    showAboutModal: false, // 关于我们模态框显示状态
    
    // 烦恼泡泡相关数据
    showWorryModal: false,
    worryText: '',
    isRecording: false,
    isAnimating: false,
    fallingChars: [],
    plants: [],
    encouragingText: '',
    
    // 气泡拖动相关
    bubbleLeft: 15, // 初始位置 (对应30rpx approx 15px)
    bubbleTop: 240, // 初始位置 (对应480rpx approx 240px)
    isDraggingBubble: false,
    bubbleStartX: 0,
    bubbleStartY: 0,
    
    encouragingQuotes: [
      "烦恼是小乌云，吹一口气，就散成阳光啦！",
      "把烦恼轻轻放在手心，吹一口魔法气，它就化啦～",
      "烦恼画在沙滩上，浪一来，全被带走啦！",
      "烦恼变成小雪花，呼～落地就化啦～～",
      "把烦恼揉成纸团，投进垃圾桶，拜拜不见啦～",
      "烦恼是小灰尘，拿个小扫把，唰唰扫进垃圾桶～",
      "把烦恼揉成小纸团，啪嗒一下投进筐，满分！",
      "烦恼是小怪兽，给它喂颗甜甜的糖，它就会乖乖跑掉！"
    ]
    ,showSoundStarter: false
  },

  onLoad: function (options) {
    this.loadUserInfo();
    this.loadCheckinStats();
    this.checkAndCancelVipIfExpired();
    this.initRecord();
  },

  onShow: function () {
    // 每次进入页面自动记录访问天数（不需要登录账号）
    this.recordLoginDay();
    
    // 每次显示页面时刷新用户数据
    this.loadUserInfo();
    this.loadCheckinStats();
    this.checkAndCancelVipIfExpired();
    this.updateCollectionStats();

    const enabled = wx.getStorageSync('backgroundMusicEnabled');
    const started = wx.getStorageSync('soundStarted');
    const needStarter = (enabled !== false) && !started;
    if (needStarter) {
      this.setData({ showSoundStarter: true });
    } else {
      if (getApp && typeof getApp === 'function' && getApp() && typeof getApp().playBGM === 'function') {
        getApp().playBGM();
      }
    }
    
    // 设置自定义 TabBar 选中状态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({
        selected: 0
      })
    }
  },

  startSound: function () {
    wx.setStorageSync('soundStarted', true);
    if (getApp && typeof getApp === 'function' && getApp() && typeof getApp().playBGM === 'function') {
      getApp().playBGM();
    }
    this.setData({ showSoundStarter: false });
  },

  /**
   * 更新收藏统计数据
   */
  updateCollectionStats: function() {
    const musicList = favoriteManager.getAll('music');
    const articleList = favoriteManager.getAll('article');
    
    this.setData({
      audioCount: musicList.length,
      cardCount: articleList.length
    });
  },

  /**
   * 加载用户信息
   */
  loadUserInfo: async function () {
    const isLoggedIn = wx.getStorageSync('isLoggedIn') || false;
    const userName = wx.getStorageSync('userName') || '';
    const info = wx.getStorageSync('userInfo') || {};
    let currentAvatar = '';
    if (info && typeof info.visualization === 'string' && info.visualization.length) {
      currentAvatar = info.visualization;
      if (typeof currentAvatar === 'string' && currentAvatar.indexOf('cloud://') === 0) {
        try {
          const c1 = new wx.cloud.Cloud({ resourceAppid: 'wx85d92d28575a70f4', resourceEnv: 'cloud1-1gsyt78b92c539ef' });
          await c1.init();
          const tmp = await c1.getTempFileURL({ fileList: [currentAvatar], config: { maxAge: 10800 } });
          const fl = tmp.fileList || [];
          if (fl.length && fl[0].status === 0) currentAvatar = fl[0].tempFileURL;
        } catch (e) {}
      }
    } else {
      currentAvatar = '/assets/images/小卡片默认形象.png';
    }

    let userInfo = info || this.data.userInfo;
    // 如果没有头像，尝试加载云端默认头像
    if (!userInfo.avatarUrl) {
        // 先检查缓存
        const cachedDefaultAvatar = wx.getStorageSync('defaultCloudAvatar');
        if (cachedDefaultAvatar) {
            userInfo.avatarUrl = cachedDefaultAvatar;
        } else {
            // 异步加载，不阻塞
            this.loadDefaultCloudAvatar().then(url => {
                if (url) {
                    userInfo.avatarUrl = url;
                    this.setData({ userInfo });
                }
            });
        }
    } else if (userInfo.avatarUrl && userInfo.avatarUrl.startsWith('cloud://')) {
        // 如果是云存储路径，需要换取临时链接（针对已登录但头像是云路径的情况）
        this.getTempUrl(userInfo.avatarUrl).then(url => {
            if (url) {
                userInfo.avatarUrl = url;
                this.setData({ userInfo });
            }
        });
    }

    // 更新登录状态和用户名
    userInfo.name = isLoggedIn ? (userName || '春小咩') : '';

    // 更新真实的统计数据
    userInfo.daysCount = this.getLoginDaysCount();
    userInfo.listenCount = this.getListenCount();
    userInfo.readCount = this.getReadCount();

    this.setData({ userInfo, isLoggedIn, currentAvatar });
  },

  /**
   * 加载云端默认头像
   */
  loadDefaultCloudAvatar: async function() {
    try {
        const c1 = new wx.cloud.Cloud({ resourceAppid: 'wx85d92d28575a70f4', resourceEnv: 'cloud1-1gsyt78b92c539ef' });
        await c1.init();
        const db = c1.database();
        const res = await db.collection('spring_avatar').where({ isDefault: true }).limit(1).get();
        if (res.data && res.data.length > 0) {
            let avatarUrl = res.data[0].avatar;
            if (avatarUrl.startsWith('cloud://')) {
                avatarUrl = await this.getTempUrl(avatarUrl, c1);
            }
            if (avatarUrl) {
                wx.setStorageSync('defaultCloudAvatar', avatarUrl);
                return avatarUrl;
            }
        }
    } catch (e) {
        console.error('获取云端默认头像失败', e);
    }
    return '';
  },

  /**
   * 换取临时链接辅助函数
   */
  getTempUrl: async function(cloudPath, cloudInstance) {
      try {
        const c1 = cloudInstance || new wx.cloud.Cloud({ resourceAppid: 'wx85d92d28575a70f4', resourceEnv: 'cloud1-1gsyt78b92c539ef' });
        if (!cloudInstance) await c1.init();
        
        const tmp = await c1.getTempFileURL({ fileList: [cloudPath], config: { maxAge: 10800 } });
        const fl = tmp.fileList || [];
        if (fl.length && fl[0].status === 0) return fl[0].tempFileURL;
      } catch(e) {
          console.error('换取临时链接失败', e);
      }
      return '';
  },

  ensureDefaultAvatar: function () {
    const url = '/assets/images/小卡片默认形象.png';
    this.setData({ currentAvatar: url });
    wx.setStorageSync('currentAvatar', url);
  },

  loadCheckinStats: async function () {
    try {
      const c1 = new wx.cloud.Cloud({ resourceAppid: 'wx85d92d28575a70f4', resourceEnv: 'cloud1-1gsyt78b92c539ef' });
      await c1.init();
      const db = c1.database();
      const info = wx.getStorageSync('userInfo') || {};
      if (!info || !info._id) return;
      let checkDays = 0;
      try {
        const uRes = await db.collection('springuser').doc(info._id).get();
        const u = uRes.data || {};
        checkDays = u.checkinDays || 0;
      } catch (e1) {}
      let unlockedCnt = 0;
      const uid = info.userId || '';
      if (uid) {
        try {
          const res = await db.collection('spring_avatar_unlock').where({ userId: uid }).get();
          unlockedCnt = (res.data || []).length;
        } catch (e2) {}
      }
    this.setData({ checkinDays: checkDays, unlockedImages: unlockedCnt });
  } catch (e) {}
  },

  formatVipExpiry: function (input) {
    if (!input) return '';
    let y, m, d;
    if (typeof input === 'number' || /^\d+$/.test(String(input))) {
      const dt = new Date(Number(input));
      if (isNaN(dt.getTime())) return '';
      y = dt.getFullYear();
      m = dt.getMonth() + 1;
      d = dt.getDate();
    } else if (typeof input === 'string') {
      const m1 = input.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
      if (!m1) return '';
      y = Number(m1[1]);
      m = Number(m1[2]);
      d = Number(m1[3]);
    } else {
      return '';
    }
    return '至' + y + '年' + m + '月' + d + '日';
  },

  refreshVipStatus: async function () {
    try {
      const c1 = new wx.cloud.Cloud({ resourceAppid: 'wx85d92d28575a70f4', resourceEnv: 'cloud1-1gsyt78b92c539ef' });
      await c1.init();
      const ret = await c1.callFunction({ name: 'spring_pay', data: { action: 'checkMemberStatus' } });
      const r = ret.result || {};
      const expiryStr = r.vipExpireTime ? this.formatVipExpiry(r.vipExpireTime) : '';
      this.setData({ isVip: !!r.isVip, vipExpiry: expiryStr });
    } catch (e) {}
  },

  checkAndCancelVipIfExpired: async function () {
    try {
      const c1 = new wx.cloud.Cloud({ resourceAppid: 'wx85d92d28575a70f4', resourceEnv: 'cloud1-1gsyt78b92c539ef' });
      await c1.init();
      const ret = await c1.callFunction({ name: 'spring_pay', data: { action: 'checkMemberStatus' } });
      const r = ret.result || {};
      const nowTs = Date.now();
      const expired = r.vipExpireTime && r.vipExpireTime <= nowTs;
      const noticeKey = 'vipExpiredNotifiedExpireTs';
      const expireTs = Number(r.vipExpireTime) || 0;
      const notifiedTs = Number(wx.getStorageSync(noticeKey)) || 0;
      if (expired) {
        this.setData({ isVip: false, vipExpiry: '' });
        if (!notifiedTs || notifiedTs !== expireTs) {
          wx.showToast({ title: '会员已过期，已取消', icon: 'none' });
          wx.setStorageSync(noticeKey, expireTs);
        }
    } else {
      const expiryStr = expireTs ? this.formatVipExpiry(expireTs) : '';
      this.setData({ isVip: !!r.isVip, vipExpiry: expiryStr });
      if (expireTs && expireTs > nowTs && notifiedTs && notifiedTs !== expireTs) {
        wx.removeStorageSync(noticeKey);
      }
    }
    } catch (e) {}
  },

  /**
   * 获取登录天数
   */
  getLoginDaysCount: function () {
    const loginRecords = wx.getStorageSync('loginRecords') || [];
    return loginRecords.length;
  },

  /**
   * 获取收听数量（初春牧歌页面播放的歌曲数）
   */
  getListenCount: function () {
    const listenedSongs = wx.getStorageSync('listenedSongs') || [];
    return listenedSongs.length;
  },

  /**
   * 获取阅读数量（仲春蹄印页面阅读的日期卡片数）
   */
  getReadCount: function () {
    const readCards = wx.getStorageSync('readCards') || [];
    return readCards.length;
  },

  /**
   * 记录登录天数
   */
  recordLoginDay: function () {
    const today = new Date().toDateString();
    let loginRecords = wx.getStorageSync('loginRecords') || [];

    // 检查今天是否已经记录过
    if (!loginRecords.includes(today)) {
      loginRecords.push(today);
      wx.setStorageSync('loginRecords', loginRecords);
    }
  },

  /**
   * 快速登录
   */
  quickLogin: function () {
    // 跳转到登录页面
    wx.navigateTo({
      url: '/pages/login/login'
    });
  },

  /**
   * 点击悬浮形象
   */
  onCharacterTap: function () {
    // 触发波动动画（通过添加CSS类实现）
    // 这里可以添加更多的交互逻辑
    wx.showToast({
      title: '点击了小绵羊！',
      icon: 'none',
      duration: 1500
    });
  },

  /**
   * 编辑个人资料
   */
  editProfile: function () {
    // 跳转到设置页面
    wx.navigateTo({
      url: '/pages/profile/profile'
    });
  },


  /**
   * 打开打卡页面
   */
  openCheckinPage: function () {
    getApp().playClickSound();
    wx.navigateTo({
      url: '/pages/checkin/checkin'
    });
  },

  /**
   * 打开关于我们页面
   */
  openAbout: function () {
    getApp().playClickSound();
    this.setData({
      showAboutModal: true
    });
  },

  /**
   * 关闭关于我们模态框
   */
  closeAboutModal: function () {
    getApp().playClickSound();
    this.setData({
      showAboutModal: false
    });
  },

  /**
   * 打开会员页面
   */
  openVip: function () {
    getApp().playClickSound();
    wx.navigateTo({
      url: '/pages/vip/vip'
    });
  },

  /**
   * 打开收藏库页面
   */
  openCollection: function () {
    getApp().playClickSound();
    wx.navigateTo({
      url: '/pages/collection/collection'
    });
  },

  /**
   * 打开帮助中心
   */
  openHelp: function () {
    getApp().playClickSound();
    wx.navigateTo({
      url: '/pages/service/service'
    });
  },

  /**
   * 气泡拖动开始
   */
  onBubbleTouchStart: function(e) {
    // 记录开始触摸的坐标和状态
    this._bubbleStartX = e.touches[0].clientX;
    this._bubbleStartY = e.touches[0].clientY;
    this._hasMoved = false; // 重置移动标记

    this.setData({
      isDraggingBubble: true,
      initialBubbleLeft: this.data.bubbleLeft,
      initialBubbleTop: this.data.bubbleTop
    });
  },

  /**
   * 气泡拖动中
   */
  onBubbleTouchMove: function(e) {
    if (!this.data.isDraggingBubble) return;
    
    const dx = e.touches[0].clientX - this._bubbleStartX;
    const dy = e.touches[0].clientY - this._bubbleStartY;

    // 如果尚未确认为移动，检查是否超过阈值
    if (!this._hasMoved) {
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        this._hasMoved = true;
      } else {
        // 未超过阈值，不移动气泡，视为潜在的点击
        return;
      }
    }
    
    // 计算新位置
    let newLeft = this.data.initialBubbleLeft + dx;
    let newTop = this.data.initialBubbleTop + dy;
    
    // 边界限制 (使用 wx.getWindowInfo 替代 deprecated API)
    let windowInfo;
    try {
        windowInfo = wx.getWindowInfo();
    } catch (error) {
        // Fallback for older versions if needed
        windowInfo = wx.getSystemInfoSync();
    }
    const windowWidth = windowInfo.windowWidth;
    const windowHeight = windowInfo.windowHeight;
    const bubbleSize = 60; // 假设气泡大概大小 px
    
    if (newLeft < 0) newLeft = 0;
    if (newLeft > windowWidth - bubbleSize) newLeft = windowWidth - bubbleSize;
    if (newTop < 0) newTop = 0;
    if (newTop > windowHeight - bubbleSize) newTop = windowHeight - bubbleSize;
    
    this.setData({
      bubbleLeft: newLeft,
      bubbleTop: newTop
    });
  },

  /**
   * 气泡拖动结束
   */
  onBubbleTouchEnd: function() {
    this.setData({
      isDraggingBubble: false
    });

    // 如果没有移动（即点击），则打开模态框
    if (!this._hasMoved) {
      this.openWorryModal();
    }
  },

  /**
   * 打开烦恼输入模态框
   */
  openWorryModal: function () {
    getApp().playClickSound();
    this.setData({
      showWorryModal: true,
      worryText: ''
    });
  },

  /**
   * 关闭烦恼输入模态框
   */
  closeWorryModal: function () {
    this.setData({
      showWorryModal: false
    });
  },

  /**
   * 阻止冒泡
   */
  stopProp: function () {
    return;
  },

  /**
   * 监听烦恼输入
   */
  onWorryInput: function (e) {
    this.setData({
      worryText: e.detail.value
    });
  },

  /**
   * 提交烦恼
   */
  submitWorry: function () {
    const text = this.data.worryText;
    if (!text.trim()) {
      wx.showToast({
        title: '请写下你的烦恼...',
        icon: 'none'
      });
      return;
    }

    this.closeWorryModal();
    this.startWorryAnimation(text);
  },

  /**
   * 开始烦恼转化动画
   */
  startWorryAnimation: function (text) {
    const chars = text.split('');
    const totalChars = chars.length;
    
    // 小羊移动参数
    const sheepAnimDuration = 12; // 12秒走完
    const startLeft = -75; // -550rpx 对应的百分比 
    const endLeft = 120; // 终点百分比
    const totalDist = endLeft - startLeft;
    const speed = totalDist / sheepAnimDuration; // 每秒移动的百分比
    
    // 掉落时间窗口 (小羊在屏幕内的时间段，大概 3.5s 到 9.5s)
    const startTime = 3.5;
    const endTime = 9.5;
    const timeWindow = endTime - startTime;

    const fallingChars = chars.map((char, index) => {
      // 根据索引线性分布在时间窗口内，保证“边走边落”的效果
      // 加上一点随机抖动 (-0.25s 到 0.25s)
      const progress = index / totalChars; 
      const impactTime = startTime + (progress * timeWindow) + (Math.random() * 0.5 - 0.25);
      
      // 计算撞击时小羊的位置
      const sheepLeft = startLeft + speed * impactTime;
      
      // 文字位置 = 小羊位置 + 偏移量 (约35%，适配520rpx大羊的中心)
      const textLeft = sheepLeft + 35; 
      
      // 动画总时长 (下落+弹开)
      const duration = (Math.random() * 0.5 + 2).toFixed(2); // 2.0 - 2.5s
      const numDuration = parseFloat(duration);
      
      // 下落占动画的60% (对应css中的keyframe 60%)
      const fallTime = numDuration * 0.6;
      
      // 动画延迟 = 撞击时间 - 下落时间
      let delay = impactTime - fallTime;
      if (delay < 0) delay = 0;
      
      return {
        char: char,
        size: Math.floor(Math.random() * 40) + 30, // 30-70rpx
        left: textLeft.toFixed(2), // 计算出的动态位置
        duration: duration,
        delay: delay.toFixed(2),
        bounceDir: Math.random() > 0.5 ? 1 : -1
      };
    });

    const randomQuote = this.data.encouragingQuotes[Math.floor(Math.random() * this.data.encouragingQuotes.length)];

    // Play audio
    // The previous background music '烦恼橡皮擦.mp3' is replaced by the bounce sound effect '弹射音.mp3' per character
    if (this.worryAudio) {
      this.worryAudio.stop();
      this.worryAudio.destroy();
      this.worryAudio = null;
    }
    
    // Reset bounce timers and audios
    if (this.bounceTimers) {
      this.bounceTimers.forEach(t => clearTimeout(t));
    }
    this.bounceTimers = [];
    
    if (this.bounceAudios) {
      this.bounceAudios.forEach(ctx => ctx.destroy());
    }
    this.bounceAudios = [];

    // Schedule bounce sounds
    fallingChars.forEach(item => {
      const duration = parseFloat(item.duration);
      const delay = parseFloat(item.delay);
      // Impact happens when fall animation ends (60% of duration)
      const impactTime = (delay + duration * 0.6) * 1000; 

      const timer = setTimeout(() => {
        const ctx = wx.createInnerAudioContext();
        ctx.src = '/assets/audio/弹射音.mp3';
        ctx.obeyMuteSwitch = false;
        ctx.onEnded(() => {
            ctx.destroy();
            if (this.bounceAudios) {
                const idx = this.bounceAudios.indexOf(ctx);
                if (idx > -1) this.bounceAudios.splice(idx, 1);
            }
        });
        ctx.onError((res) => {
            console.error('Bounce audio error:', res);
            ctx.destroy();
            if (this.bounceAudios) {
                const idx = this.bounceAudios.indexOf(ctx);
                if (idx > -1) this.bounceAudios.splice(idx, 1);
            }
        });
        ctx.play();
        this.bounceAudios.push(ctx);
      }, impactTime);
      this.bounceTimers.push(timer);
    });

    this.setData({
      isAnimating: true,
      fallingChars: fallingChars,
      encouragingText: randomQuote,
      showEncouragingText: false // Initially hidden
    });

    // 小羊跑完动画大概是12秒 (sheepAnimDuration)
    // 监听音乐播放或者设定定时器在跑完后停止音乐并显示文字
    setTimeout(() => {
        // Stop music
        if (this.worryAudio) {
            this.worryAudio.stop();
            this.worryAudio.destroy();
            this.worryAudio = null;
        }

        // Show encouraging text animation
        this.setData({
            showEncouragingText: true
        });

    }, sheepAnimDuration * 1000); // 12000ms

    // 18秒后自动结束动画 (extended to accommodate text animation)
    setTimeout(() => {
      if (this.data.isAnimating) {
        this.closeAnimation();
      }
    }, 18000);
  },

  /**
   * 关闭动画
   */
  closeAnimation: function () {
    if (this.worryAudio) {
      this.worryAudio.stop();
      this.worryAudio.destroy();
      this.worryAudio = null;
    }

    if (this.bounceTimers) {
      this.bounceTimers.forEach(t => clearTimeout(t));
      this.bounceTimers = [];
    }
    
    if (this.bounceAudios) {
      this.bounceAudios.forEach(ctx => ctx.destroy());
      this.bounceAudios = [];
    }

    this.setData({
      isAnimating: false,
      fallingChars: [],
      plants: []
    });
  },

  /**
   * 初始化语音识别
   */
  initRecord: function () {
    const that = this;
    try {
      const plugin = requirePlugin("WechatSI");
      const manager = plugin.getRecordRecognitionManager();
      
      manager.onStart = function(res) {
        console.log("record start", res);
        wx.showToast({
            title: '正在聆听...',
            icon: 'none',
            duration: 30000 
        });
      }

      manager.onRecognize = function(res) {
        console.log("current result", res.result);
      }

      manager.onStop = function(res) {
        console.log("record stop", res);
        wx.hideToast(); // 隐藏正在聆听的提示
        if (res.result) {
          const currentText = that.data.worryText || '';
          that.setData({
             worryText: currentText + res.result,
             isRecording: false
          });
        } else {
           that.setData({ isRecording: false });
           wx.showToast({ title: '未识别到内容', icon: 'none' });
        }
      }

      manager.onError = function(res) {
        console.error("error msg", res.msg, res.retcode);
        wx.hideToast();
        that.setData({ isRecording: false });
        
        // 详细的错误处理
        let errorMsg = '语音识别失败';
        if (res.retcode === -30001 || res.retcode === -30002) {
            errorMsg = '录音接口出错';
        } else if (res.retcode === -30004) {
            errorMsg = '网络不稳定';
        } else if (res.retcode === -30003) {
             errorMsg = '录音时间太短';
        }
        
        wx.showToast({ title: errorMsg, icon: 'none' });
      }
      that.recordManager = manager;
    } catch (e) {
      console.error("WechatSI plugin init failed", e);
      // 如果插件加载失败，通常是因为后台没添加插件或者开发者工具没清除缓存
      wx.showModal({
          title: '插件加载失败',
          content: '请确保在小程序管理后台添加了“微信同声传译”插件，并在开发者工具中清除缓存后重试。',
          showCancel: false
      });
    }
  },

  /**
   * 开始录音
   */
  startRecord: function () {
    const that = this;
    wx.getSetting({
      success(res) {
        if (!res.authSetting['scope.record']) {
          wx.authorize({
            scope: 'scope.record',
            success() {
              that._startRecordAction();
            },
            fail() {
              wx.showModal({
                title: '提示',
                content: '需要录音权限才能进行语音识别',
                success(res) {
                  if (res.confirm) {
                    wx.openSetting();
                  }
                }
              })
            }
          })
        } else {
          that._startRecordAction();
        }
      }
    })
  },

  _startRecordAction: function() {
    if (this.data.isRecording) return; // 防止重复调用
    
    this.setData({ isRecording: true });
    if (this.recordManager) {
      try {
        this.recordManager.start({ duration: 30000, lang: "zh_CN" });
      } catch(e) {
        console.error("start record error", e);
        this.setData({ isRecording: false });
      }
    } else {
      wx.showToast({ title: '语音插件未加载', icon: 'none' });
      this.setData({ isRecording: false });
    }
  },

  /**
   * 停止录音
   */
  stopRecord: function () {
    if (!this.data.isRecording) return; // 如果没有在录音，则不执行 stop

    if (this.recordManager) {
      try {
        this.recordManager.stop();
      } catch(e) {
        console.error("stop record error", e);
      }
    }
    // 注意：isRecording 状态的重置最好在 onStop 或 onError 回调中进行，
    // 但为了 UI 响应即时性，这里先重置，如果回调中有错误再处理
    this.setData({ isRecording: false });
  },

  onHide: function () {
    if (this.data.isAnimating) {
      this.closeAnimation();
    }
  },

  onUnload: function () {
    if (this.data.isAnimating) {
      this.closeAnimation();
    }
  }
})

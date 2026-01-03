// pages/checkin/checkin.js
Page({
  data: {
    // 打卡统计数据
    checkinDays: 0,      // 连续打卡天数
    totalCheckins: 0,    // 累计打卡天数
    unlockedImages: 0,   // 解锁形象数量

    // 日历数据
    currentYear: new Date().getFullYear(),
    currentMonth: new Date().getMonth() + 1,
    weekdays: ['日', '一', '二', '三', '四', '五', '六'],
    calendarDays: [],

    // 打卡记录
    checkinRecords: {},

    // 打卡成功提示
    showCheckinSuccess: false,

    // 盲盒奖励
    showReward: false,
    hasNewAvatar: false,
    rewardImage: '',
    rewardImages: [],

    // 后端设置：今天是否有形象
    todayHasAvatar: false, // 模拟后端设置

    // 形象数据
    unlockedAvatarList: [],
    currentAvatar: ''
    , lastRewardReady: false
    , lastHasNewAvatar: false
    , lastRewardUrl: ''
  },

  onLoad: function (options) {
    this.loadCheckinData();
    this.generateCalendar();
    this.loadAvatarData();
    const storedAvatar = wx.getStorageSync('currentAvatar') || '';
    if (storedAvatar) this.setData({ currentAvatar: storedAvatar });
  },

  onShow: function () {
    // 页面显示时刷新数据
    this.loadCheckinData();
    this.generateCalendar();
    const storedAvatar = wx.getStorageSync('currentAvatar') || '';
    if (storedAvatar) this.setData({ currentAvatar: storedAvatar });
  },

  /**
   * 加载打卡数据
   */
  loadCheckinData: async function () {
    try {
      const c1 = new wx.cloud.Cloud({ resourceAppid: 'wx85d92d28575a70f4', resourceEnv: 'cloud1-1gsyt78b92c539ef' });
      await c1.init();
      const db = c1.database();
      const info = wx.getStorageSync('userInfo') || {};
      if (!info || !info._id) return;
      const userRes = await db.collection('springuser').doc(info._id).get();
      const user = userRes.data || {};
      let unlockedImages = 0;
      const uid = user.userId || info.userId || '';
      if (uid) {
        const unlockRes = await db.collection('spring_avatar_unlock').where({ userId: uid }).get();
        unlockedImages = (unlockRes.data || []).length;
        console.log('checkin:loadUnlockCount', { count: unlockedImages });
      }
      console.log('checkin:stats', { checkinDays: user.checkinDays, totalCheckins: user.totalCheckins });
      this.setData({
        checkinDays: user.checkinDays || 0,
        totalCheckins: user.totalCheckins || 0,
        unlockedImages: unlockedImages
      });
    } catch (e) {}
  },

  /**
   * 计算打卡统计
   */
  calculateCheckinStats: function (records) {
    const today = new Date();
    const todayStr = today.toDateString();

    let continuousDays = 0;
    let totalDays = Object.keys(records).length;

    // 检查今天是否已打卡
    if (records[todayStr]) {
      continuousDays = 1;

      // 向前检查连续天数
      for (let i = 1; i <= 365; i++) {
        const checkDate = new Date(today);
        checkDate.setDate(today.getDate() - i);
        const checkDateStr = checkDate.toDateString();

        if (records[checkDateStr]) {
          continuousDays++;
        } else {
          break;
        }
      }
    } else {
      // 如果今天没打卡，检查昨天开始的连续天数
      for (let i = 1; i <= 365; i++) {
        const checkDate = new Date(today);
        checkDate.setDate(today.getDate() - i);
        const checkDateStr = checkDate.toDateString();

        if (records[checkDateStr]) {
          continuousDays++;
        } else {
          break;
        }
      }
    }

    return {
      continuousDays: continuousDays,
      totalDays: totalDays
    };
  },

  /**
   * 生成日历
   */
  generateCalendar: async function () {
    const { currentYear, currentMonth } = this.data;
    const firstDay = new Date(currentYear, currentMonth - 1, 1);
    const lastDay = new Date(currentYear, currentMonth, 0);
    const today = new Date();

    const calendarDays = [];
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    // 计算当前月份需要的总行数
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    const totalDays = daysInMonth + startingDayOfWeek;
    const totalRows = Math.ceil(totalDays / 7);
    const totalCells = totalRows * 7;

    // 拉取当月云端打卡记录
    let monthMap = new Set();
    try {
      const c1 = new wx.cloud.Cloud({ resourceAppid: 'wx85d92d28575a70f4', resourceEnv: 'cloud1-1gsyt78b92c539ef' });
      await c1.init();
      const db = c1.database();
      const info = wx.getStorageSync('userInfo') || {};
      const uid = info.userId || '';
      if (uid) {
        const res = await db.collection('spring_checkin').where({ userId: uid }).orderBy('date', 'desc').limit(500).get();
        const list = res.data || [];
        // 构建当月的日期集合
        const y = currentYear;
        const m = String(currentMonth).padStart(2, '0');
        const prefix = `${y}-${m}-`;
        list.forEach(it => { if (typeof it.date === 'string' && it.date.startsWith(prefix)) monthMap.add(it.date); });
        console.log('checkin:monthRecords', { count: list.length, monthCheckins: monthMap.size, month: `${y}-${m}` });
      }
    } catch (e) {}

    for (let i = 0; i < totalCells; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);

      const dateStr = date.toDateString();
      const dateISO = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
      const isCurrentMonth = date.getMonth() === currentMonth - 1;
      const isToday = date.toDateString() === today.toDateString();

      calendarDays.push({
        date: dateISO,
        day: date.getDate(),
        checkin: monthMap.has(dateISO),
        today: isToday,
        currentMonth: isCurrentMonth
      });
    }

    this.setData({
      calendarDays: calendarDays
    });
  },

  /**
   * 点击日期
   */
  onDayTap: function (e) {
    const { date } = e.currentTarget.dataset;
    const today = new Date();
    const todayISO = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    if (date !== todayISO) {
      wx.showToast({
        title: '只能打卡当天',
        icon: 'none'
      });
      return;
    }

    this.checkin();
  },

  /**
   * 执行打卡
   */
  checkin: async function () {
    try {
      const isLoggedIn = wx.getStorageSync('isLoggedIn') || false;
      if (!isLoggedIn) {
        wx.showModal({
          title: '提示',
          content: '请先登录后再打卡',
          confirmText: '去登录',
          cancelText: '取消',
          success: (res) => {
            if (res.confirm) {
              wx.navigateTo({ url: '/pages/login/login' });
            }
          }
        });
        return;
      }
      wx.showLoading({ title: '打卡中...' });
      const c1 = new wx.cloud.Cloud({ resourceAppid: 'wx85d92d28575a70f4', resourceEnv: 'cloud1-1gsyt78b92c539ef' });
      await c1.init();
      const res = await c1.callFunction({ name: 'spring_do_checkin', data: { client: { platform: 'mp' } } });
      console.log('checkin:callResult', res && res.result);
      if (res && res.result && res.result.debug) {
        console.log('checkin:debug', res.result.debug);
      }
      wx.hideLoading();
      const r = res.result || {};
      console.log('checkin:resultCode', r && r.code, r && (r.msg || r.error));
      if (r.code === 1) {
        wx.showToast({ title: '今日已打卡', icon: 'success' });
        return;
      }
      if (r.code === 0) {
        const d = r.data || {};
        const success = d.rewardStatus === 'success';
        console.log('checkin:reward', { status: d.rewardStatus, avatarId: d.rewardAvatarId });
        this.setData({
          showCheckinSuccess: true,
          showReward: false,
          lastRewardReady: true,
          lastHasNewAvatar: success,
          lastRewardUrl: success ? (d.rewardAvatarUrl || '') : ''
        });
        // 延迟到用户点击盲盒后再刷新形象和日历
        return;
      }
      if (r.code === -2) {
        try {
          const authRes = await c1.callFunction({ name: 'spring_auth', data: {} });
          console.log('checkin:autoAuthResult', authRes && authRes.result);
          const ar = authRes.result || {};
          if (ar.code === 0 && ar.data) {
            wx.setStorageSync('isLoggedIn', true);
            wx.setStorageSync('userInfo', ar.data);
            wx.setStorageSync('userName', ar.data.nickName || '春小咩');
            const reRes = await c1.callFunction({ name: 'spring_do_checkin', data: { client: { platform: 'mp' } } });
            console.log('checkin:retryResult', reRes && reRes.result);
            const rr = reRes.result || {};
            if (rr.code === 0) {
              const d2 = rr.data || {};
              const s2 = d2.rewardStatus === 'success';
              console.log('checkin:rewardRetry', { status: d2.rewardStatus, avatarId: d2.rewardAvatarId });
              this.setData({
                showCheckinSuccess: true,
                showReward: false,
                lastRewardReady: true,
                lastHasNewAvatar: s2,
                lastRewardUrl: s2 ? (d2.rewardAvatarUrl || '') : ''
              });
              // 延迟到用户点击盲盒后再刷新形象和日历
              return;
            }
          }
        } catch (e2) {}
        wx.showModal({
          title: '提示',
          content: '登录信息异常，请重新登录后再试',
          confirmText: '去登录',
          cancelText: '取消',
          success: (res) => {
            if (res.confirm) {
              wx.navigateTo({ url: '/pages/login/login' });
            }
          }
        });
        return;
      }
      const msgFail = (r && (r.msg || r.error)) ? (r.msg || r.error) : '打卡失败';
      wx.showToast({ title: msgFail, icon: 'none' });
    } catch (e) {
      wx.hideLoading();
      const msg = (e && e.message) ? e.message : '服务异常';
      wx.showToast({ title: msg, icon: 'none' });
      console.log('checkin:error', e);
    }
  },

  /**
   * 打开盲盒
   */
  openBlindBox: function () {
    this.setData({ showCheckinSuccess: false });
    const ready = this.data.lastRewardReady
    const has = this.data.lastHasNewAvatar
    let url = this.data.lastRewardUrl || ''
    if (!ready) return
    const run = async () => {
      try {
        if (has && typeof url === 'string' && url.indexOf('cloud://') === 0) {
          const c1 = new wx.cloud.Cloud({ resourceAppid: 'wx85d92d28575a70f4', resourceEnv: 'cloud1-1gsyt78b92c539ef' });
          await c1.init();
          const tmp = await c1.getTempFileURL({ fileList: [url], config: { maxAge: 10800 } })
          const fl = tmp.fileList || []
          if (fl.length && fl[0].status === 0) url = fl[0].tempFileURL
        }
      } catch (e) {}
      this.setData({ showReward: true, hasNewAvatar: has, rewardImage: has ? (url || '') : '' });
    }
    run()
    this.generateCalendar();
    this.loadAvatarData();
  },

  /**
   * 检查盲盒奖励
   */
  checkBlindBoxReward: function () {
    const { todayHasAvatar, rewardImages } = this.data;

    if (todayHasAvatar) {
      // 有新形象
      const randomIndex = Math.floor(Math.random() * rewardImages.length);
      const rewardImage = rewardImages[randomIndex];

      // 检查是否已经解锁过这个形象
      const unlockedImages = wx.getStorageSync('unlockedImages') || [];
      if (!unlockedImages.includes(rewardImage)) {
        unlockedImages.push(rewardImage);
        wx.setStorageSync('unlockedImages', unlockedImages.length);

        // 添加到已解锁形象列表（去重）
        const unlockedAvatarList = [...this.data.unlockedAvatarList];
        if (!unlockedAvatarList.includes(rewardImage)) {
          unlockedAvatarList.push(rewardImage);
          wx.setStorageSync('unlockedAvatarList', unlockedAvatarList);
        }

        this.setData({
          showReward: true,
          hasNewAvatar: true,
          rewardImage: rewardImage,
          unlockedImages: unlockedImages.length,
          unlockedAvatarList: unlockedAvatarList
        });
      } else {
        // 已经解锁过，显示无奖励
        this.setData({
          showReward: true,
          hasNewAvatar: false
        });
      }
    } else {
      // 今天没有形象
      this.setData({
        showReward: true,
        hasNewAvatar: false
      });
    }
  },

  /**
   * 关闭奖励弹窗
   */
  closeReward: function () {
    this.setData({
      showReward: false,
      showCheckinSuccess: false
    });
  },

  /**
   * 上一月
   */
  prevMonth: function () {
    let { currentYear, currentMonth } = this.data;
    currentMonth--;
    if (currentMonth < 1) {
      currentMonth = 12;
      currentYear--;
    }
    this.setData({
      currentYear: currentYear,
      currentMonth: currentMonth
    });
    this.generateCalendar();
  },

  /**
   * 下一月
   */
  nextMonth: function () {
    let { currentYear, currentMonth } = this.data;
    currentMonth++;
    if (currentMonth > 12) {
      currentMonth = 1;
      currentYear++;
    }
    this.setData({
      currentYear: currentYear,
      currentMonth: currentMonth
    });
    this.generateCalendar();
  },

  /**
   * 上一年
   */
  prevYear: function () {
    let { currentYear } = this.data;
    currentYear--;
    this.setData({
      currentYear: currentYear
    });
    this.generateCalendar();
  },

  /**
   * 下一年
   */
  nextYear: function () {
    let { currentYear } = this.data;
    currentYear++;
    this.setData({
      currentYear: currentYear
    });
    this.generateCalendar();
  },

  /**
   * 加载形象数据
   */
  loadAvatarData: async function () {
    try {
      const c1 = new wx.cloud.Cloud({ resourceAppid: 'wx85d92d28575a70f4', resourceEnv: 'cloud1-1gsyt78b92c539ef' });
      await c1.init();
      const db = c1.database();
      const info = wx.getStorageSync('userInfo') || {};
      const uid = info.userId || '';
      if (!uid) return;
      const res = await db.collection('spring_avatar_unlock').where({ userId: uid }).orderBy('unlockedAt', 'desc').get();
      const rows = res.data || []
      const ids = rows.map(x => x.avatarUrl).filter(v => typeof v === 'string' && v.indexOf('cloud://') === 0)
      const urlMap = {}
      if (ids.length) {
        try {
          const tmp = await c1.getTempFileURL({ fileList: ids, config: { maxAge: 10800 } })
          ;(tmp.fileList || []).forEach(f => { if (f.status === 0) urlMap[f.fileID] = f.tempFileURL })
        } catch (eurl) {}
      }
      const list = rows.map(x => urlMap[x.avatarUrl] || x.avatarUrl).filter(Boolean)
      this.setData({ unlockedAvatarList: list });
    } catch (e) {}
  },

  /**
   * 选择默认形象
   */
  selectDefaultAvatar: function () {
    const defaultAvatar = '/assets/images/小卡片默认形象.png';
    this.setData({ currentAvatar: defaultAvatar });
    wx.setStorageSync('currentAvatar', defaultAvatar);
    try {
      const info = wx.getStorageSync('userInfo') || {};
      if (info && info._id) {
        const c1 = new wx.cloud.Cloud({ resourceAppid: 'wx85d92d28575a70f4', resourceEnv: 'cloud1-1gsyt78b92c539ef' });
        c1.init().then(async () => {
          const db = c1.database();
          await db.collection('springuser').doc(info._id).update({ data: { visualization: defaultAvatar, updateTime: new Date() } });
          const updated = { ...info, visualization: defaultAvatar };
          wx.setStorageSync('userInfo', updated);
        }).catch(() => {});
      }
    } catch (e) {}
    wx.showToast({ title: '已切换到默认形象', icon: 'success' });
  },

  /**
   * 选择形象
   */
  selectAvatar: async function (e) {
    const { index } = e.currentTarget.dataset;
    const selectedAvatar = this.data.unlockedAvatarList[index];
    if (!selectedAvatar) return;
    this.setData({ currentAvatar: selectedAvatar });
    wx.setStorageSync('currentAvatar', selectedAvatar);
    try {
      const info = wx.getStorageSync('userInfo') || {};
      if (info && info._id) {
        const c1 = new wx.cloud.Cloud({ resourceAppid: 'wx85d92d28575a70f4', resourceEnv: 'cloud1-1gsyt78b92c539ef' });
        await c1.init();
        const db = c1.database();
        await db.collection('springuser').doc(info._id).update({ data: { visualization: selectedAvatar, updateTime: new Date() } });
        const updated = { ...info, visualization: selectedAvatar };
        wx.setStorageSync('userInfo', updated);
      }
    } catch (e) {}
    wx.showToast({ title: '形象切换成功', icon: 'success' });
  },

});

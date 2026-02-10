Page({
  data: {
    weekStartStr: '',
    weekEndStr: '',
    weekRangeText: '',
    loginDaysThisWeek: 0,
    listenedCountThisWeek: 0,
    readCountThisWeek: 0,
    medalsThisWeek: 0,
    parentTaskCount: 0,
    smallGoalCount: 0,
    longestMailbox: '',
    longestMailboxDate: '',
    userInfo: {},
    keyword: '',
    greeting: ''
  },
  onLoad: async function () {
    this.loadUserInfo();
    const now = new Date();
    if (!(now.getDay() === 1 && now.getHours() >= 9)) {
      wx.showToast({ title: '每周一上午9点开放', icon: 'none' });
      setTimeout(() => { wx.navigateBack({ delta: 1 }); }, 800);
      return;
    }
    const thisMon = this.getWeekMonday(now);
    const start = new Date(thisMon.getTime());
    start.setDate(start.getDate() - 7);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start.getTime());
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    const startStr = this.formatDate(start);
    const endStr = this.formatDate(end);
    this.setData({
      weekStartStr: startStr,
      weekEndStr: endStr,
      weekRangeText: `${startStr} 至 ${endStr}`
    });
    // 临时关闭“本周是否已解锁”校验，方便测试
    // const storeKey = 'spring_weekly_report_unlock_map';
    // const unlockMap = wx.getStorageSync(storeKey) || {};
    // const weekKey = startStr;
    // const unlocked = !!unlockMap[weekKey];
    // if (!unlocked) {
    //   wx.showToast({ title: '本周未解锁', icon: 'none' });
    //   setTimeout(() => { wx.navigateBack({ delta: 1 }); }, 800);
    //   return;
    // }
    this.loadWeeklyStats(start, end);
    await this.loadMedalsThisWeek(start, end);
  },
  getWeekMonday: function (d) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const day = x.getDay();
    const diff = (day + 6) % 7;
    x.setDate(x.getDate() - diff);
    x.setHours(0, 0, 0, 0);
    return x;
  },
  getWeekSunday: function (d) {
    const mon = this.getWeekMonday(d);
    const x = new Date(mon.getTime());
    x.setDate(mon.getDate() + 6);
    x.setHours(23, 59, 59, 999);
    return x;
  },
  formatDate: function (d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  },
  formatDayOfWeek: function(d) {
    const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return days[d.getDay()];
  },
  inRange: function (d, start, end) {
    const t = d.getTime();
    return t >= start.getTime() && t <= end.getTime();
  },
  parseDateStr: function (s) {
    if (!s) return null;
    const str = String(s).trim();
    if (/^\d{4}[-/]\d{2}[-/]\d{2}$/.test(str)) {
      const t = str.replace(/-/g, '/');
      const d = new Date(t);
      if (!isNaN(d.getTime())) return d;
    }
    const parts = str.split(' ');
    if (parts.length === 4) {
      const monMap = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
      const m = monMap[parts[1]];
      const dd = Number(parts[2]);
      const y = Number(parts[3]);
      if (m && dd && y) {
        const mm = m < 10 ? ('0' + m) : String(m);
        const ddd = dd < 10 ? ('0' + dd) : String(dd);
        const t2 = `${y}/${mm}/${ddd}`;
        const d2 = new Date(t2);
        if (!isNaN(d2.getTime())) return d2;
      }
    }
    const d3 = new Date(str);
    if (!isNaN(d3.getTime())) return d3;
    return null;
  },
  loadUserInfo: function () {
    const userInfo = wx.getStorageSync('userInfo') || {};
    // 简单的昵称处理
    if (!userInfo.name) userInfo.name = '春小咩';
    // 随机问候语
    const greetings = [
      '春天是远道而来的浪漫。',
      '愿你的每一天都闪闪发光。',
      '慢慢走，沿途有风景。',
      '生活明朗，万物可爱。',
      '种自己的花，爱自己的宇宙。'
    ];
    const greeting = greetings[Math.floor(Math.random() * greetings.length)];
    this.setData({ userInfo, greeting });
  },
  generateKeyword: function(login, listen, read) {
    if (login >= 5) return '#元气满满';
    if (listen >= 5) return '#音乐治愈师';
    if (read >= 5) return '#博学多才';
    if (login + listen + read === 0) return '#蓄势待发';
    return '#快乐生长';
  },
  loadWeeklyStats: function (start, end) {
    const loginRecords = wx.getStorageSync('loginRecords') || [];
    const loginCount = loginRecords.filter(s => {
      const dt = this.parseDateStr(s);
      return dt && this.inRange(dt, start, end);
    }).length;
    const listenedSongs = wx.getStorageSync('listenedSongs') || [];
    const listenedCount = listenedSongs.filter(k => {
      const parts = String(k).split('_');
      const ds = parts[parts.length - 1];
      const dt = this.parseDateStr(ds);
      return dt && this.inRange(dt, start, end);
    }).length;
    const readCards = wx.getStorageSync('readCards') || [];
    const readCount = readCards.filter(k => {
      const parts = String(k).split('_');
      const ds = parts[parts.length - 1];
      const dt = this.parseDateStr(ds);
      return dt && this.inRange(dt, start, end);
    }).length;

    // 统计心语信箱和小目标
    let maxLen = 0;
    let maxMsg = '';
    let maxDate = '';
    let goalCount = 0;

    try {
      const keys = wx.getStorageInfoSync().keys;
      keys.forEach(key => {
        if (key.startsWith('mailbox_')) {
          const msgs = wx.getStorageSync(key) || [];
          if (Array.isArray(msgs)) {
            msgs.forEach(m => {
              if (m.time && this.inRange(new Date(m.time), start, end)) {
                const txt = (m.text || '').trim();
                if (txt.length > maxLen) {
                  maxLen = txt.length;
                  maxMsg = txt;
                  maxDate = this.formatDayOfWeek(new Date(m.time));
                }
              }
            });
          }
        } else if (key.startsWith('goals_')) {
          const goals = wx.getStorageSync(key) || [];
          if (Array.isArray(goals)) {
            goals.forEach(g => {
              // 统计本周创建且已完成的小目标
              if (g.done && g.time && this.inRange(new Date(g.time), start, end)) {
                goalCount++;
              }
            });
          }
        }
      });
    } catch (e) {
      console.error('Load extra stats failed', e);
    }

    this.setData({
      loginDaysThisWeek: loginCount,
      listenedCountThisWeek: listenedCount,
      readCountThisWeek: readCount,
      smallGoalCount: goalCount,
      longestMailbox: maxMsg,
      longestMailboxDate: maxDate,
      keyword: this.generateKeyword(loginCount, listenedCount, readCount)
    });
  },
  loadMedalsThisWeek: async function (start, end) {
    try {
      const user = wx.getStorageSync('userInfo') || {};
      const uid = user && user.userId ? user.userId : '';
      if (!uid) {
        this.setData({ medalsThisWeek: 0, parentTaskCount: 0 });
        return;
      }
      const c1 = new wx.cloud.Cloud({ resourceAppid: 'wx85d92d28575a70f4', resourceEnv: 'cloud1-1gsyt78b92c539ef' });
      await c1.init();
      const db = c1.database();
      const res = await db.collection('spring_user_medals').where({ userId: uid }).limit(1000).get();
      const list = res.data || [];
      
      let medalCnt = 0;
      let parentCnt = 0;

      list.forEach(x => {
        const a = x.acquiredAt;
        let dt = null;
        if (typeof a === 'number') dt = new Date(a);
        else if (typeof a === 'string') dt = new Date(a);
        else if (a && a.$date) dt = new Date(a.$date);
        else dt = null;

        if (dt && this.inRange(dt, start, end)) {
          medalCnt++;
          if (x.source === 'parent_task') {
            parentCnt++;
          }
        }
      });

      this.setData({ medalsThisWeek: medalCnt, parentTaskCount: parentCnt });
    } catch (e) {
      this.setData({ medalsThisWeek: 0, parentTaskCount: 0 });
    }
  },
  onShareAppMessage: function() {
    return {
      title: '我的春天成长报告',
      path: '/pages/weekly-report/weekly-report'
    };
  }
})

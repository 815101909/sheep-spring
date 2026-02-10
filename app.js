// app.js
const reminderManager = require('./utils/reminderManager')
const themeManager = require('./utils/themeManager')

const __originPage__ = Page;
Page = function (config) {
  const originalOnShow = config.onShow;
  config.onShow = function () {
    themeManager.applyToPage(this);
    if (typeof originalOnShow === 'function') {
      return originalOnShow.apply(this, arguments);
    }
  };
  return __originPage__(config);
};

App({
  onLaunch: function () {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      wx.cloud.init({
        // env 参数说明：
        //   env 参数决定接下来小程序发起的云开发调用（wx.cloud.xxx）会默认请求到哪个云环境的资源
        //   此处请填入环境 ID, 环境 ID 可打开云控制台查看
        //   如不填则使用默认环境（第一个创建的环境）
        env: 'cloud1-1gsyt78b92c539ef',
        traceUser: true,
      });
    }

    this.globalData = {};
    this.globalData.bgmSuppressed = false;
    themeManager.init();

    // 初始化背景音乐
    this.initBGM();
    reminderManager.checkAndNotify()
    if (!this._reminderTicker) {
      this._reminderTicker = setInterval(() => {
        reminderManager.checkAndNotify()
      }, 30000)
    }
  },

  onShow: function() {
      // 立即检查一次，确保在任意页面也能触发提醒弹窗
      reminderManager.checkAndNotify()
      themeManager.applyTheme();
      const bgmEnabled = wx.getStorageSync('backgroundMusicEnabled');
      const globalMgr = wx.getBackgroundAudioManager();
      const suppressed = !!(this.globalData && this.globalData.bgmSuppressed);
      const pages = (typeof getCurrentPages === 'function') ? getCurrentPages() : [];
      const top = (pages && pages.length > 0) ? pages[pages.length - 1] : null;
      const route = top && top.route ? String(top.route) : '';
      const onMusicPage = /pages\/music\/music$/.test(route);
      if (bgmEnabled !== false && !suppressed && !(globalMgr && !globalMgr.paused && globalMgr.src) && !onMusicPage) {
          if (!this.bgm || !this.bgm.src || this.bgm.paused) {
              this.playBGM();
          }
      }
  },

  onHide: function() {
      // 切后台时暂停 BGM
      if (this.bgm && !this.bgm.paused) {
          this.bgm.pause();
      }
  },

  bgm: null,
  bgmSrc: 'cloud://cloud1-1gsyt78b92c539ef.636c-cloud1-1gsyt78b92c539ef-1370520707/audio/bgm/back.mp3',
  bgmRealUrl: '',

  initBGM: function() {
    // 使用 InnerAudioContext 以支持音量调节
    this.bgm = wx.createInnerAudioContext();
    this.bgm.loop = true; // 循环播放
    this.bgm.volume = 0.05; // 降低音量
    this.bgm.autoplay = false;
    
    // 设置不遵循静音开关，确保在静音模式下也能播放（根据需求，通常背景音乐可以遵循，但如果为了稳定播放，设为false）
    if (wx.setInnerAudioOption) {
        wx.setInnerAudioOption({
            obeyMuteSwitch: false,
            mixWithOther: true
        });
    } else {
        this.bgm.obeyMuteSwitch = false;
    }

    this.bgm.onError((err) => {
        console.error('BGM Error:', err);
    });
    
    // 自动播放处理：如果自动播放被浏览器策略拦截，需要用户交互后再次尝试
    this.bgm.onCanplay(() => {
        const enabled = wx.getStorageSync('backgroundMusicEnabled');
        const suppressed = !!(this.globalData && this.globalData.bgmSuppressed);
        if (enabled !== false && !suppressed && this.bgm && this.bgm.src && this.bgm.paused) {
            this.bgm.play();
        }
    });

    // 检查设置，默认开启
    const bgmEnabled = wx.getStorageSync('backgroundMusicEnabled');
    if (bgmEnabled !== false) {
        this.playBGM();
    }
  },

  playBGM: async function(allowOnMusicPage) {
      if (!this.bgm) return;
      
      const bgmEnabled = wx.getStorageSync('backgroundMusicEnabled');
      if (bgmEnabled === false) return;
      if (this.globalData && this.globalData.bgmSuppressed) return;
      
      try {
        const pages = (typeof getCurrentPages === 'function') ? getCurrentPages() : [];
        const top = (pages && pages.length > 0) ? pages[pages.length - 1] : null;
        const route = top && top.route ? String(top.route) : '';
        const onMusicPage = /pages\/music\/music$/.test(route);
        if (onMusicPage && !allowOnMusicPage) return;
      } catch (_){}
      
      // 检查是否有其他音频（BackgroundAudioManager）正在播放
      const globalMgr = wx.getBackgroundAudioManager();
      if (globalMgr && !globalMgr.paused && globalMgr.src) {
          console.log('Global audio is playing, skip BGM');
          return; 
      }

      // 如果已设置链接且正在播放，不重复
      if (this.bgm && this.bgm.src && !this.bgm.paused) return;
      
      // 获取真实链接并播放
      if (this.bgmRealUrl) {
          this.bgm.src = this.bgmRealUrl;
          this.bgm.play();
          setTimeout(() => {
              const suppressed = !!(this.globalData && this.globalData.bgmSuppressed);
              const en = wx.getStorageSync('backgroundMusicEnabled');
              if (en === false || suppressed) return;
              try {
                const pages = (typeof getCurrentPages === 'function') ? getCurrentPages() : [];
                const top = (pages && pages.length > 0) ? pages[pages.length - 1] : null;
                const route = top && top.route ? String(top.route) : '';
                const onMusicPage = /pages\/music\/music$/.test(route);
                if (onMusicPage && !allowOnMusicPage) return;
              } catch (_){}
              if (this.bgm && this.bgm.src && this.bgm.paused) this.bgm.play();
          }, 200);
      } else {
          try {
              // 使用跨环境/跨账号方式获取
              const c1 = new wx.cloud.Cloud({
                  resourceAppid: 'wx85d92d28575a70f4',
                  resourceEnv: 'cloud1-1gsyt78b92c539ef',
              });
              await c1.init();
              
              const res = await c1.getTempFileURL({
                  fileList: [this.bgmSrc]
              });

              // Check again
              const currentEnabled = wx.getStorageSync('backgroundMusicEnabled');
              if (currentEnabled === false) return;

              if (res.fileList && res.fileList[0].tempFileURL) {
                  this.bgmRealUrl = res.fileList[0].tempFileURL;
                  this.bgm.src = this.bgmRealUrl;
                  this.bgm.play();
                  setTimeout(() => {
                      const suppressed = !!(this.globalData && this.globalData.bgmSuppressed);
                      const en2 = wx.getStorageSync('backgroundMusicEnabled');
                      if (en2 === false || suppressed) return;
                      try {
                        const pages = (typeof getCurrentPages === 'function') ? getCurrentPages() : [];
                        const top = (pages && pages.length > 0) ? pages[pages.length - 1] : null;
                        const route = top && top.route ? String(top.route) : '';
                        const onMusicPage = /pages\/music\/music$/.test(route);
                        if (onMusicPage && !allowOnMusicPage) return;
                      } catch (_){}
                      if (this.bgm && this.bgm.src && this.bgm.paused) this.bgm.play();
                  }, 200);
              }
          } catch (err) {
              console.error('Failed to get BGM URL', err);
          }
      }
  },
  
  stopBGM: function() {
      if (this.bgm) {
          this.bgm.pause();
      }
  },
  suppressBGM: function() {
      if (!this.globalData) this.globalData = {};
      this.globalData.bgmSuppressed = true;
      this.stopBGM();
  },
  releaseBGM: function() {
      if (!this.globalData) this.globalData = {};
      this.globalData.bgmSuppressed = false;
  },
  _reminderTicker: null,

  // 这里的 _doPlay 不再需要，因为 InnerAudioContext 逻辑不同，但为了兼容性可以留空或删除
  _doPlay: function(url) {
      // Deprecated for InnerAudioContext
  },

  playClickSound: function() {
    const innerAudioContext = wx.createInnerAudioContext()
    if (wx.setInnerAudioOption) {
        wx.setInnerAudioOption({
          obeyMuteSwitch: false,
          fail: function(e) {
            // 忽略开发者工具不支持的报错
            if (e.errMsg && e.errMsg.indexOf('开发者工具') > -1) return;
            console.error('setInnerAudioOption fail', e)
          }
        })
    } else {
        innerAudioContext.obeyMuteSwitch = false;
    }
    innerAudioContext.autoplay = true
    innerAudioContext.src = '/assets/audio/click.wav'
    innerAudioContext.onPlay(() => {
      // console.log('开始播放')
    })
    innerAudioContext.onEnded(() => {
        innerAudioContext.destroy()
    })
    innerAudioContext.onError((res) => {
      console.log(res.errMsg)
      console.log(res.errCode)
      innerAudioContext.destroy()
    })
    const enabled = wx.getStorageSync('backgroundMusicEnabled');
    if (enabled !== false) {
      this.playBGM();
    }
  }
});

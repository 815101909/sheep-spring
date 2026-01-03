// pages/music/music.js
const favoriteManager = require('../../utils/favoriteManager');

Page({
  data: {
    // 播放状态
    isPlaying: false,
    progress: 0,
    currentTime: '0:00',
    totalTime: '3:45',

    // 当前歌曲
    currentSongIndex: 0,
    currentSong: {
      title: '初夏小夜曲',
      artist: '春日音乐家',
      duration: '3:45'
    },

    // 播放模式（固定为单曲循环）
    playMode: 'list', // 列表循环、单曲循环、随机播放

    // 当前歌曲收藏状态
    isFavorite: false,

    // 播放倍速 (0.5x, 0.75x, 1.0x, 1.25x, 1.5x)
    playbackRate: 1.0,

    // 字体大小 ('small', 'medium', 'large')
    fontSize: 'medium',

    // 字体颜色 ('black', 'white', 'green', 'blue', 'red')
    fontColor: 'green',

    // 当前激活的面板 ('speed', 'fontSize', 'fontColor', null)
    activePanel: null,

    // 播放列表
    showPlaylist: false,
    // 搜索和筛选
    searchQuery: '',
    filterFavorite: false,
    displayPlaylist: [], // 用于UI显示的列表
    playlist: [], // 初始为空，等待加载

    // 歌词
    currentLyricsIndex: 0,
    lyrics: [
      { time: 0, text: '春日的微风轻拂着海岸线' },
      { time: 30, text: '海浪轻轻拍打着沙滩' },
      { time: 60, text: '夕阳洒下金色的余晖' },
      { time: 90, text: '照亮了我们相遇的瞬间' },
      { time: 120, text: '初夏的夜晚星空璀璨' },
      { time: 150, text: '月光洒满整个海湾' },
      { time: 180, text: '让我们一起唱起这首小夜曲' },
      { time: 210, text: '在春日的夜晚久久回荡' }
    ]
  },

  onLoad: function (options) {
    // 初始化音频上下文（如果需要）
    this.initAudio();
    // 初始化显示列表（针对默认数据）
    this.filterPlaylist();
    // 从云数据库加载音乐列表
    this.loadMusicList();
  },

  /**
   * 从云数据库加载音乐列表并合并收藏状态
   */
  loadMusicList: async function() {
    wx.showLoading({ title: '加载中...' });
    
    // 初始化跨环境云实例
    const c1 = new wx.cloud.Cloud({
      resourceAppid: 'wx85d92d28575a70f4', // 资源方 AppID (旧 AppID)
      resourceEnv: 'cloud1-1gsyt78b92c539ef', // 资源方环境 ID
    });
    await c1.init(); // 必须先初始化
    const db = c1.database(); // 使用跨环境数据库实例
    
    try {
      // 1. 并行请求：获取音乐列表和用户收藏列表
      const [musicRes, favRes] = await Promise.all([
        db.collection('spring_music_library')
          .orderBy('sort_order', 'asc')
          .limit(100) // 增加limit以获取更多歌曲（默认20）
          .get(),
        db.collection('spring_user_favorites').where({
          _openid: '{openid}',
          type: 'music'
        }).get()
      ]);

      const musicList = musicRes.data;
      const favListDB = favRes.data || [];

      // 通过统一收藏管理器再同步一次，保证跨环境/权限下也能拿到收藏
      let favIdsManager = [];
      try {
        const synced = await favoriteManager.syncFromCloud();
        favIdsManager = (synced || []).filter(f => f.type === 'music').map(f => f.id);
      } catch(_) {}

      const favMusicIds = [...new Set([
        ...favListDB.map(item => item.target_id),
        ...favIdsManager
      ])];
      const favSet = new Set(favMusicIds);

      // 2. 提取所有需要转换的 cloud:// 链接 (src, audio_url, image)
      const fileList = [];
      musicList.forEach(item => {
        if (item.media_url && item.media_url.startsWith('cloud://')) {
          fileList.push(item.media_url);
        }
        if (item.audio_url && item.audio_url.startsWith('cloud://')) {
          fileList.push(item.audio_url);
        }
        if (item.image && item.image.startsWith('cloud://')) {
          fileList.push(item.image);
        }
        if (item.poster_url && item.poster_url.startsWith('cloud://')) {
          fileList.push(item.poster_url);
        }
      });

      // 3. 批量换取临时链接 (缓存3小时 = 180分钟 = 10800秒)
      // 注意：使用跨环境实例 c1 来调用 getTempFileURL
      let tempUrlMap = {};
      if (fileList.length > 0) {
        const tempRes = await c1.getTempFileURL({
          fileList: fileList,
          config: {
             maxAge: 3 * 60 * 60 // 3小时有效期
          }
        });
        
        tempRes.fileList.forEach(file => {
          if (file.status === 0) {
            tempUrlMap[file.fileID] = file.tempFileURL;
          }
        });
      }

      // 4. 组装最终的 playlist 数据
      const finalPlaylist = musicList.map(item => {
        // 转换链接
        const realMediaUrl = (item.media_url && item.media_url.startsWith('cloud://')) 
                      ? (tempUrlMap[item.media_url] || item.media_url) 
                      : item.media_url;
        
        const realAudioUrl = (item.audio_url && item.audio_url.startsWith('cloud://')) 
                      ? (tempUrlMap[item.audio_url] || item.audio_url) 
                      : item.audio_url;

        const realImage = (item.image && item.image.startsWith('cloud://'))
                         ? (tempUrlMap[item.image] || item.image)
                         : (item.image || '');
                         
        const realPoster = (item.poster_url && item.poster_url.startsWith('cloud://'))
                         ? (tempUrlMap[item.poster_url] || item.poster_url)
                         : (item.poster_url || '');

        return {
          _id: item._id, // 保留数据库ID用于收藏操作
          title: item.title,
          artist: item.artist,
          duration: item.duration_str,
          type: item.media_type, // 'video' or 'image'
          media_url: realMediaUrl, // 视频链接
          audio_url: realAudioUrl, // 音频链接
          image: realImage,        // image模式下的展示图
          poster: realPoster,      // video模式下的封面图
          lyrics: item.lyrics || [], // 确保有歌词数组
          isFavorite: favSet.has(item._id) // 判断是否收藏
        };
      });

      // 5. 更新页面数据
      // 提前计算过滤后的列表，确保 UI 立即更新
      const displayPlaylist = this.getFilteredPlaylist(finalPlaylist, this.data.searchQuery, this.data.filterFavorite);
      console.log('Music list loaded:', finalPlaylist.length, 'Display count:', displayPlaylist.length);

      this.setData({
        playlist: finalPlaylist,
        displayPlaylist: displayPlaylist,
        // 如果当前没有播放，或者列表更新了，重置为第一首
        currentSongIndex: 0,
        currentSong: finalPlaylist[0] || {},
        lyrics: finalPlaylist[0]?.lyrics || [],
        totalTime: finalPlaylist[0]?.duration || '0:00',
        isFavorite: finalPlaylist[0]?.isFavorite || false
      });
      
      wx.hideLoading();

    } catch (err) {
      console.error('加载音乐列表失败：', err);
      wx.hideLoading();
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    }
  },

  onShow: function () {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({
        selected: 1
      })
    }
    // 重新进入页面时，同步一次收藏状态，确保心形和筛选正确
    this.refreshFavorites();
  },

  onHide: function () {

  },

  onUnload: function () {

  },

  // 初始化音频
  initAudio: function() {
    // 获取全局唯一的背景音频管理器
    const bgAudioManager = wx.getBackgroundAudioManager();
    const app = getApp();
    
    // 监听播放进度更新事件
    bgAudioManager.onTimeUpdate(() => {
      // 1. 过滤掉全局背景音乐的事件
      // 如果当前播放的音频 src 与全局 BGM 的 src (或真实链接) 相同，说明是 BGM 在播放
      // 此时不应更新本页面的进度条
      if (app.bgmSrc && (bgAudioManager.src === app.bgmSrc || bgAudioManager.src === app.bgmRealUrl)) {
          return;
      }

      // 只有当存在音频URL时，才以音频进度为主更新UI
      // 避免与视频进度冲突（如果同时播放，优先音频）
      if (this.data.currentSong.audio_url) {
        const currentTime = bgAudioManager.currentTime;
        const duration = bgAudioManager.duration;
        this.updateProgressFromEvent(currentTime, duration);
      }
    });

    // 监听自然播放结束事件
    bgAudioManager.onEnded(() => {
       // 同样过滤 BGM
       if (app.bgmSrc && (bgAudioManager.src === app.bgmSrc || bgAudioManager.src === app.bgmRealUrl)) {
          return;
       }

       if (this.data.currentSong.audio_url) {
         this.nextSong();
       }
    });

    // 监听播放/暂停/停止事件，同步UI状态
    bgAudioManager.onPlay(() => {
      // BGM 互斥逻辑：音乐页面开始播放时，暂停全局 BGM
      // 注意：现在的 BGM 是 InnerAudioContext，bgAudioManager 永远不会是 BGM
      getApp().stopBGM();

      this.setData({ isPlaying: true });
      
      // 记录收听数据（按天统计）
      this.recordListenCount();
      
      // 延迟设置倍速，确保音频管道已准备好
      // 某些机型或模拟器在立即设置时可能会失效
      setTimeout(() => {
          const mgr = wx.getBackgroundAudioManager();
          if (mgr.src) { // 确保仍在播放
             mgr.playbackRate = this.data.playbackRate;
          }
      }, 100);
      
      // 再尝试一次，针对顽固机型
      setTimeout(() => {
          const mgr = wx.getBackgroundAudioManager();
          if (mgr.src) mgr.playbackRate = this.data.playbackRate;
      }, 500);
    });
    bgAudioManager.onCanplay(() => {
        // 过滤 BGM (BGM 已移出 bgAudioManager，此逻辑可保留作为防守)
        if (app.bgmSrc && (bgAudioManager.src === app.bgmSrc || bgAudioManager.src === app.bgmRealUrl)) return;

        // 部分机型在 onCanplay 设置才有效
        setTimeout(() => {
            const mgr = wx.getBackgroundAudioManager();
            if (mgr.src) mgr.playbackRate = this.data.playbackRate;
        }, 50);
    });
    bgAudioManager.onPause(() => {
       // 如果当前是页面歌曲被暂停，才更新 UI
       if (this.data.currentSong.audio_url && bgAudioManager.src === this.data.currentSong.audio_url) {
         this.setData({ isPlaying: false });
         
         // 恢复 BGM (如果开启)
         getApp().playBGM();
       }
    });
    bgAudioManager.onStop(() => {
        // 同上
        if (this.data.currentSong.audio_url && bgAudioManager.src === this.data.currentSong.audio_url) {
         this.setData({ isPlaying: false });
         
         // 恢复 BGM (如果开启)
         getApp().playBGM();
        }
    });
    bgAudioManager.onEnded(() => {
       // 同样过滤 BGM
       if (app.bgmSrc && (bgAudioManager.src === app.bgmSrc || bgAudioManager.src === app.bgmRealUrl)) {
          return;
       }

       if (this.data.currentSong.audio_url) {
         this.nextSong();
         // 注意：nextSong 会自动播放下一首，所以不需要在这里恢复 BGM
         // 除非列表播完了停止了？nextSong 逻辑通常是循环或停止。
         // 如果 nextSong 触发播放，onPlay 会再次暂停 BGM。
       } else {
           // 如果没有下一首（虽然逻辑上不太可能，因为 nextSong 负责切），恢复 BGM
           getApp().playBGM();
       }
    });
  },

  // 重新同步收藏并刷新列表显示
  refreshFavorites: async function() {
    try {
      const synced = await favoriteManager.syncFromCloud();
      const favSet = new Set((synced || []).filter(f => f.type === 'music').map(f => f.id));
      const updatedPlaylist = (this.data.playlist || []).map(item => ({
        ...item,
        isFavorite: favSet.has(item._id)
      }));
      const displayPlaylist = this.getFilteredPlaylist(updatedPlaylist, this.data.searchQuery, this.data.filterFavorite);
      this.setData({
        playlist: updatedPlaylist,
        displayPlaylist: displayPlaylist,
        isFavorite: updatedPlaylist[this.data.currentSongIndex]?.isFavorite || false
      });
    } catch (_) {}
  },

  // 视频进度更新事件
  onVideoTimeUpdate: function(e) {
    // 只有当没有音频URL时（即纯视频模式），才以视频进度为主
    if (!this.data.currentSong.audio_url) {
      const currentTime = e.detail.currentTime;
      const duration = e.detail.duration;
      this.updateProgressFromEvent(currentTime, duration);
    }
  },

  // 视频播放结束事件
  onVideoEnded: function() {
    // 只有当没有音频URL时，视频结束才触发下一首
    // 如果有音频，视频可能会循环或停在最后，等待音频结束
    if (!this.data.currentSong.audio_url) {
      this.nextSong();
    }
  },

  // 统一的进度更新处理逻辑（替代原有的 startProgressTimer）
  updateProgressFromEvent: function(currentSeconds, totalSeconds) {
    // 格式化当前时间
    const minutes = Math.floor(currentSeconds / 60);
    const seconds = Math.floor(currentSeconds % 60);
    const currentTimeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    // 格式化总时间（如果有）
    let totalTimeStr = this.data.totalTime;
    if (totalSeconds) {
        const totalMin = Math.floor(totalSeconds / 60);
        const totalSec = Math.floor(totalSeconds % 60);
        totalTimeStr = `${totalMin}:${totalSec.toString().padStart(2, '0')}`;
    }

    // 计算进度百分比
    const progress = totalSeconds ? (currentSeconds / totalSeconds) * 100 : 0;
    
    // 更新当前歌词行
    const lyricsIndex = this.getCurrentLyricsIndex(currentSeconds);

    this.setData({
      progress: progress,
      currentTime: currentTimeStr,
      totalTime: totalTimeStr, // 更新为真实的duration
      currentLyricsIndex: lyricsIndex
    });
  },

  // 旧的定时器逻辑已废弃
  startProgressTimer: function() {
    // 空函数，防止报错
  },

  // 更新进度 (旧方法保留作为兼容，但主要逻辑已移至 updateProgressFromEvent)
  updateProgress: function(progress, currentSeconds, totalSeconds) {
      this.updateProgressFromEvent(currentSeconds, totalSeconds);
  },

  // 获取当前歌词行索引
  getCurrentLyricsIndex: function(currentSeconds) {
    const lyrics = this.data.lyrics;
    for (let i = lyrics.length - 1; i >= 0; i--) {
      if (currentSeconds >= lyrics[i].time) {
        return i;
      }
    }
    return 0;
  },

  // 切换播放/暂停
  togglePlay: function() {
    getApp().playClickSound();
    const isPlaying = !this.data.isPlaying;
    this.setData({
      isPlaying: isPlaying
    });
    
    const currentSong = this.data.playlist[this.data.currentSongIndex];
    
    // 1. 处理视频播放
    if (currentSong.media_url) {
      const videoContext = wx.createVideoContext('myVideo');
      if (isPlaying) {
        videoContext.play();
      } else {
        videoContext.pause();
      }
    }

    // 2. 处理音频播放
    // 如果有音频链接，使用背景音频管理器播放
    if (currentSong.audio_url) {
      const bgAudioManager = wx.getBackgroundAudioManager();
      if (isPlaying) {
        if (bgAudioManager.src !== currentSong.audio_url) {
            bgAudioManager.title = currentSong.title || '未知标题';
            bgAudioManager.singer = currentSong.artist || '未知艺术家';
            bgAudioManager.coverImgUrl = currentSong.image || currentSong.poster || '';
            bgAudioManager.src = currentSong.audio_url;
        } else {
            bgAudioManager.play();
        }
      } else {
        bgAudioManager.pause();
      }
    } else if (!currentSong.media_url) {
        // 如果既没有视频也没有音频（异常情况），重置状态
        this.setData({ isPlaying: false });
    }
  },

  // 下载歌曲
  downloadSong: function() {
    getApp().playClickSound();
    const currentSong = this.data.playlist[this.data.currentSongIndex];
    // 根据类型选择下载链接
    const src = currentSong.type === 'video' ? currentSong.media_url : currentSong.audio_url;
    
    wx.showLoading({ title: '下载中...' });
    
    // 如果是网络资源
    if (src && src.startsWith('http')) {
      wx.downloadFile({
        url: src,
        success: (res) => {
          if (res.statusCode === 200) {
            wx.hideLoading();
            console.log('文件下载路径：', res.tempFilePath);
            
            // 如果是视频，尝试保存到相册
            if (currentSong.type === 'video') {
              wx.saveVideoToPhotosAlbum({
                filePath: res.tempFilePath,
                success: () => wx.showToast({ title: '已保存到相册' }),
                fail: () => wx.showToast({ title: '保存失败', icon: 'none' })
              });
            } else {
                // 音频文件无法直接保存到系统音乐库，只能提示下载成功（临时路径）
                // 或者可以保存到文件系统 wx.getFileSystemManager().saveFile
                wx.showToast({
                    title: '下载成功',
                    icon: 'success'
                });
            }
          }
        },
        fail: (err) => {
          wx.hideLoading();
          wx.showToast({
            title: '下载失败',
            icon: 'none'
          });
          console.error('下载失败', err);
        }
      });
    } else {
      wx.hideLoading();
      wx.showToast({
        title: '非网络资源',
        icon: 'none'
      });
    }
  },

  // 上一首
  prevSong: function() {
    getApp().playClickSound();
    let newIndex = this.data.currentSongIndex - 1;
    if (this.data.playMode === 'random') {
      newIndex = Math.floor(Math.random() * this.data.playlist.length);
    } else if (newIndex < 0) {
      newIndex = this.data.playlist.length - 1;
    }
    
    this.changeSong(newIndex);
  },

  // 下一首
  nextSong: function() {
    getApp().playClickSound();
    let newIndex = this.data.currentSongIndex + 1;
    if (this.data.playMode === 'random') {
      newIndex = Math.floor(Math.random() * this.data.playlist.length);
    } else if (newIndex >= this.data.playlist.length) {
      newIndex = 0;
    }
    
    this.changeSong(newIndex);
  },
  
  // 切换歌曲通用方法
  changeSong: function(index) {
    const nextSong = this.data.playlist[index];
    this.setData({
      currentSongIndex: index,
      currentSong: nextSong,
      progress: 0,
      currentTime: '0:00',
      isPlaying: true // 切换后自动播放
    }, () => {
      // 记录收听数据
      this.recordListenCount();
      
      // setData 回调，确保视图更新后再操作视频上下文
      // 1. 如果有视频，自动播放视频
      if (nextSong.media_url) {
        const videoContext = wx.createVideoContext('myVideo');
        // 稍微延迟确保组件已挂载
        setTimeout(() => {
          videoContext.playbackRate(this.data.playbackRate); 
          videoContext.play();
        }, 200);
      }
    });
    
    // 2. 如果有音频，自动播放音频
    if (nextSong.audio_url) {
      const bgAudioManager = wx.getBackgroundAudioManager();
      bgAudioManager.title = nextSong.title || '未知标题';
      bgAudioManager.singer = nextSong.artist || '未知艺术家';
      bgAudioManager.coverImgUrl = nextSong.image || nextSong.poster || '';
      bgAudioManager.src = nextSong.audio_url;
      // 设置 src 后会自动触发 onPlay，那里会应用倍速
      // 但为了保险，这里也尝试设置一次（虽然可能被 reset）
      bgAudioManager.playbackRate = this.data.playbackRate; 
    } else {
      // 如果没有音频链接，但可能有视频声音，或者确实没有音频
      // 停止之前的背景音频，以免声音混杂
      wx.getBackgroundAudioManager().stop();
    }
  },

  // 切换播放模式
  cyclePlayMode: function() {
    getApp().playClickSound();
    const modes = ['list', 'single', 'random'];
    let currentIndex = modes.indexOf(this.data.playMode);
    let newIndex = (currentIndex + 1) % modes.length;
    
    this.setData({
      playMode: modes[newIndex]
    });
    
    let modeName = '';
    switch(modes[newIndex]) {
      case 'list': modeName = '列表循环'; break;
      case 'single': modeName = '单曲循环'; break;
      case 'random': modeName = '随机播放'; break;
    }
    
    wx.showToast({
      title: modeName,
      icon: 'none'
    });
  },

  // 收藏/取消收藏
  toggleFavorite: async function() {
    getApp().playClickSound();
    const index = this.data.currentSongIndex;
    const currentSong = this.data.playlist[index];
    const isFavorite = !currentSong.isFavorite;
    
    // 乐观更新：先更新前端UI，让用户感觉很快
    const up = `playlist[${index}].isFavorite`;
    this.setData({
      isFavorite: isFavorite,
      [up]: isFavorite
    });

    if (this.data.filterFavorite) {
      this.filterPlaylist();
    }

    // 更新统一收藏管理器 (One Dataset Design)
    // 注意：FavoriteManager 已经封装了云端同步逻辑，这里只需要调用它
    const songForManager = { ...currentSong, id: currentSong._id };
    if (isFavorite) {
      favoriteManager.add(songForManager, 'music');
      wx.showToast({ title: '已收藏', icon: 'none' });
    } else {
      favoriteManager.remove(currentSong._id, 'music');
      wx.showToast({ title: '已取消收藏', icon: 'none' });
    }
  },

  // 切换播放列表显示
  togglePlaylist: function() {
    getApp().playClickSound();
    this.setData({
      showPlaylist: !this.data.showPlaylist
    });
  },

  // 搜索输入
  onSearchInput: function(e) {
    this.setData({
      searchQuery: e.detail.value
    });
    this.filterPlaylist();
  },

  // 切换收藏筛选
  toggleFilterFavorite: function() {
    getApp().playClickSound();
    this.setData({
      filterFavorite: !this.data.filterFavorite
    });
    this.filterPlaylist();
  },

  // 筛选播放列表 (核心逻辑)
  getFilteredPlaylist: function(playlist, searchQuery, filterFavorite) {
    // 确保 query 是字符串，避免 undefined 报错
    const query = (searchQuery || '').toString().toLowerCase().trim();

    return (playlist || []).map((item, index) => {
      return { ...item, originalIndex: index };
    }).filter(item => {
      // 筛选逻辑，确保 title 和 artist 存在
      const title = (item.title || '').toString().toLowerCase();
      const artist = (item.artist || '').toString().toLowerCase();
      
      const matchSearch = title.includes(query) || artist.includes(query);
      const matchFavorite = filterFavorite ? item.isFavorite : true;
      return matchSearch && matchFavorite;
    });
  },

  // 响应搜索和筛选操作 (UI交互入口)
  filterPlaylist: function() {
    const { playlist, searchQuery, filterFavorite } = this.data;
    const displayPlaylist = this.getFilteredPlaylist(playlist, searchQuery, filterFavorite);

    console.log('Filter applied:', { query: searchQuery, filterFavorite, count: displayPlaylist.length });
    
    this.setData({
      displayPlaylist: displayPlaylist
    });
  },
  
  // 选择列表中的歌曲
  selectSong: function(e) {
    getApp().playClickSound();
    // 这里传入的是 originalIndex，因为我们在 filterPlaylist 中把它存进去了
    // 如果没有筛选，e.currentTarget.dataset.index 就是 originalIndex
    // 但为了安全，我们在 wxml 中使用 data-index="{{item.originalIndex}}"
    const index = e.currentTarget.dataset.index;
    this.changeSong(index);
    this.setData({
      showPlaylist: false
    });
  },

  // 设置播放倍速
  setPlaybackRate: function(e) {
    getApp().playClickSound();
    const rate = parseFloat(e.currentTarget.dataset.rate);
    this.setData({
      playbackRate: rate
    });
    
    const currentSong = this.data.currentSong;

    // 1. 如果有视频，设置视频倍速
    if (currentSong.media_url) {
        const videoContext = wx.createVideoContext('myVideo');
        videoContext.playbackRate(rate);
    }
    
    // 2. 如果有音频，设置音频倍速
    if (currentSong.audio_url) {
        const bgAudioManager = wx.getBackgroundAudioManager();
        // 必须在播放状态下设置才有效，如果不确定状态，可以尝试设置
        // 且为了兼容性，建议放在 try-catch 中
        try {
            bgAudioManager.playbackRate = rate;
            
            // 某些情况下需要 seek 才能触发 pipeline 更新
            // 但 seek 会导致音频跳动，所以仅作为最后的手段
            // 或者我们可以尝试暂停再播放（体验不好）
            
            // 延迟再次设置，确保生效
            setTimeout(() => {
                if (bgAudioManager.src) bgAudioManager.playbackRate = rate;
            }, 100);

        } catch (e) {
            console.error('设置音频倍速失败', e);
        }
    }

    wx.showToast({
      title: `${rate}x 倍速`,
      icon: 'none',
      duration: 1000
    });
  },

  // 设置字体大小
  setFontSize: function(e) {
    getApp().playClickSound();
    const size = e.currentTarget.dataset.size;
    this.setData({
      fontSize: size
    });
    const sizeText = {
      'small': '小',
      'medium': '中',
      'large': '大'
    };
    wx.showToast({
      title: `字体大小: ${sizeText[size]}`,
      icon: 'none',
      duration: 1000
    });
  },

  // 设置字体颜色
  setFontColor: function(e) {
    getApp().playClickSound();
    const color = e.currentTarget.dataset.color;
    this.setData({
      fontColor: color
    });
    const colorText = {
      'black': '黑色',
      'white': '白色',
      'green': '绿色',
      'blue': '蓝色',
      'red': '红色',
      'goose': '鹅黄色'
    };
    wx.showToast({
      title: `字体颜色: ${colorText[color]}`,
      icon: 'none',
      duration: 1000
    });
  },

  // 增加字体大小
  increaseFontSize: function() {
    getApp().playClickSound();
    // 这里可以添加字体大小调整逻辑
    wx.showToast({
      title: '字体放大',
      icon: 'none',
      duration: 1000
    });
  },

  // 减少字体大小
  decreaseFontSize: function() {
    getApp().playClickSound();
    // 这里可以添加字体大小调整逻辑
    wx.showToast({
      title: '字体缩小',
      icon: 'none',
      duration: 1000
    });
  },

  // 切换展开面板
  togglePanel: function(e) {
    getApp().playClickSound();
    const panel = e.currentTarget.dataset.panel;
    const currentPanel = this.data.activePanel;

    // 如果点击的是当前激活的面板，则关闭
    // 否则打开新的面板
    this.setData({
      activePanel: currentPanel === panel ? null : panel
    });
  },

  // 关闭展开面板（点击遮罩层）
  closePanel: function() {
    getApp().playClickSound();
    this.setData({
      activePanel: null
    });
  },

  // 记录收听数量
  recordListenCount: function() {
    const currentSong = this.data.currentSong;

    if (!currentSong) return;
    
    // 优先使用数据库ID，如果没有则降级使用 title-artist
    const songId = currentSong._id || `${currentSong.title}-${currentSong.artist}`;
    const today = new Date().toDateString();
    
    // 组合 Key: 歌曲ID_日期 (按天去重)
    const recordKey = `${songId}_${today}`;
    
    let listenedSongs = wx.getStorageSync('listenedSongs') || [];

    // 检查这首歌今天是否已经记录过
    if (!listenedSongs.includes(recordKey)) {
      listenedSongs.push(recordKey);
      wx.setStorageSync('listenedSongs', listenedSongs);
    }
  }
})

// pages/music/music.js
const favoriteManager = require('../../utils/favoriteManager');

function parseVttTimestampToSeconds(raw) {
  const str = (raw || '').trim();
  if (!str) return null;

  const parts = str.split(':');
  if (parts.length < 2 || parts.length > 3) return null;

  const last = parts[parts.length - 1];
  const [secStr, msStr] = last.split('.');

  const seconds = Number(secStr);
  const milliseconds = msStr == null ? 0 : Number(msStr.padEnd(3, '0').slice(0, 3));
  if (!Number.isFinite(seconds) || !Number.isFinite(milliseconds)) return null;

  let minutes = 0;
  let hours = 0;
  if (parts.length === 2) {
    minutes = Number(parts[0]);
  } else {
    hours = Number(parts[0]);
    minutes = Number(parts[1]);
  }
  if (!Number.isFinite(minutes) || !Number.isFinite(hours)) return null;

  return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
}

function parseWebVttToLyrics(vttText) {
  if (!vttText || typeof vttText !== 'string') return [];

  const normalized = vttText.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');

  const cues = [];
  let i = 0;

  while (i < lines.length) {
    const line = (lines[i] || '').trim();

    if (!line) {
      i += 1;
      continue;
    }

    if (line.toUpperCase() === 'WEBVTT') {
      i += 1;
      continue;
    }

    if (!line.includes('-->') && i + 1 < lines.length) {
      const nextLine = (lines[i + 1] || '').trim();
      if (nextLine.includes('-->')) {
        i += 1;
      }
    }

    const timeLine = (lines[i] || '').trim();
    if (!timeLine.includes('-->')) {
      i += 1;
      continue;
    }

    const [startPartRaw, endPartRaw] = timeLine.split('-->');
    const startPart = (startPartRaw || '').trim();
    const endPart = ((endPartRaw || '').trim().split(/\s+/)[0] || '').trim();

    const start = parseVttTimestampToSeconds(startPart);
    const end = parseVttTimestampToSeconds(endPart);
    if (start == null || end == null) {
      i += 1;
      continue;
    }

    i += 1;
    const textLines = [];
    while (i < lines.length) {
      const t = lines[i];
      if (t == null) break;
      if (!t.trim()) break;
      textLines.push(t);
      i += 1;
    }

    const text = textLines.join('\n').trim();
    if (text) {
      cues.push({ time: start, endTime: end, text });
    }

    i += 1;
  }

  cues.sort((a, b) => (a.time || 0) - (b.time || 0));
  return cues;
}

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
    filterType: 'all',
    filterDate: '',
    typeOptions: ['类型'],
    typeIndex: 0,
    showTypeDropdown: false,
    selectedTypeText: '类型',
    displayPlaylist: [], // 用于UI显示的列表
    playlist: [], // 初始为空，等待加载
    displayLimit: 30,
    displayIncrement: 30,
    filterPerson: 'all',
    personOptions: ['作者'],
    personIndex: 0,
    selectedPersonText: '作者',
    showPersonDropdown: false,

    // 歌词
    currentLyricsIndex: 0,
    lyrics: [],
    showVipModal: false
  },

  onLoad: function (options) {
    this.audioCtx = null;
    this._pauseByUser = false;
    this._lastPlayTs = 0;
    this._desiredPlaying = false;
    this._bgmResumeTimer = null;
    // 初始化显示列表（针对默认数据）
    this.filterPlaylist();
    // 从云数据库加载音乐列表
    this.loadMusicList();
  },

  /**
   * 从云数据库加载音乐列表并合并收藏状态
   */
  loadMusicList: async function() {
    const CACHE_DURATION = 3 * 60 * 60 * 1000;
    const cache = wx.getStorageSync('spring_music_cache') || null;
    const now = Date.now();
    if (cache && cache.expiresAt && cache.expiresAt > now && Array.isArray(cache.list) && cache.list.length > 0) {
      const finalPlaylist = cache.list;
      let topicMap = {};
      try {
        topicMap = await this.getTopicOrderMap();
      } catch (_){}
      try {
        this.sortPlaylistByTopic(finalPlaylist, topicMap);
      } catch (_){}
      try {
        (finalPlaylist || []).forEach(it => {
          if (!it || typeof it !== 'object') return;
          if (!it.publishDateStr) {
            let ts = this.parsePublishToTs(it.publish_date || it.publishDate || it.publish_time || it.publishTime);
            if (!Number.isFinite(ts) || ts <= 0) {
              ts = this.parsePublishToTs(it.publish_time || it.publish_date || it.publishTime || it.publishDate || it.date);
            }
            const fmt = this.formatDateYMD(ts);
            it.publishDateStr = fmt || this.parseDateFromTitleStr(it.title);
          }
        });
      } catch (_){}
      const displayPlaylist = this.getFilteredPlaylist(finalPlaylist, this.data.searchQuery, this.data.filterFavorite);
      const firstPrepared = await this.ensureCloudUrlsForSong(finalPlaylist[0] || {});
      let firstLyrics = (firstPrepared && Array.isArray(firstPrepared.lyrics) && firstPrepared.lyrics.length > 0)
        ? firstPrepared.lyrics
        : ((firstPrepared && firstPrepared.vtt && typeof firstPrepared.vtt === 'string' && firstPrepared.vtt.trim())
          ? parseWebVttToLyrics(firstPrepared.vtt)
          : []);
      this.setData({
        playlist: finalPlaylist,
        displayPlaylist: displayPlaylist.slice(0, this.data.displayLimit || displayPlaylist.length),
        currentSongIndex: 0,
        currentSong: firstPrepared || {},
        lyrics: firstLyrics,
        currentLyricsIndex: 0,
        totalTime: (firstPrepared && firstPrepared.duration) ? firstPrepared.duration : '0:00',
        isFavorite: (firstPrepared && firstPrepared.isFavorite) ? firstPrepared.isFavorite : false,
        typeOptions: this.buildTypeOptions(finalPlaylist),
        personOptions: this.buildPersonOptions(finalPlaylist),
        topicOptions: this.buildTopicOptions(finalPlaylist),
        personIndex: 0,
        selectedPersonText: '作者',
        filterPerson: 'all',
        topicIndex: 0,
        selectedTopicText: '专题',
        filterTopic: 'all',
        showTopicDropdown: false
      });
      if (firstPrepared && firstPrepared.audio_url) {
        this.initAudio();
      }
      this.refreshMusicListSilently();
      return;
    }
    wx.showLoading({ title: '加载中...' });
    
    // 初始化跨环境云实例
    const c1 = new wx.cloud.Cloud({
      resourceAppid: 'wx85d92d28575a70f4', // 资源方 AppID (旧 AppID)
      resourceEnv: 'cloud1-1gsyt78b92c539ef', // 资源方环境 ID
    });
    await c1.init(); // 必须先初始化
    const db = c1.database(); // 使用跨环境数据库实例
    
    try {
      const [musicRes, favRes, topicRes] = await Promise.all([
        db.collection('spring_music_library')
          .where({ status: true })
          .orderBy('sort_order', 'asc')
          .limit(100) // 增加limit以获取更多歌曲（默认20）
          .get(),
        db.collection('spring_user_favorites').where({
          _openid: '{openid}',
          type: 'music'
        }).get(),
        db.collection('spring_topic')
          .limit(1000)
          .get()
      ]);

      const musicList = musicRes.data;
      const favListDB = favRes.data || [];
      const topicMap = {};
      try {
        (topicRes && topicRes.data || []).forEach(it => {
          const k = String(it && it.topic || '').trim();
          const v = Number(it && it.order);
          if (k) topicMap[k] = v;
        });
      } catch (_){}

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

      // 2. 提取所有需要转换的 cloud:// 链接 (仅图片和封面，音视频按需转换)
      const fileList = [];
      musicList.forEach(item => {
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
      this.cloudCross = c1;
      this.tempUrlMap = tempUrlMap;

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

        // 映射后台字段 (Mock演示：如果数据库没有，根据标题或随机生成)
        const topic = item.topic || (item.title.indexOf('春日') > -1 ? '春日系列' : (item.title.indexOf('故事') > -1 ? '故事上新' : ''));
        const isVip = item.is_vip || item.isVip || (item.title.indexOf('特别') > -1) || false;

        let displayType = '';
        if (item.media_type) {
          const t = String(item.media_type).toLowerCase();
          if (t === 'video') displayType = '视频';
          else if (t === 'audio') displayType = '音频';
          else if (t === 'image') displayType = '图片';
        } else {
          if (realAudioUrl) displayType = '音频';
          else if (realMediaUrl) displayType = '视频';
          else if (realImage) displayType = '图片';
        }
        return {
          _id: item._id, // 保留数据库ID用于收藏操作
          title: item.title,
          artist: item.artist,
          duration: item.duration_str,
          type: item.type || item.category || '',
          media_url: realMediaUrl, // 视频链接
          audio_url: realAudioUrl, // 音频链接
          image: realImage,        // image模式下的展示图
          poster: realPoster,      // video模式下的封面图
          vtt: item.vtt || '',
          lyrics: (item.lyrics || []),
          isFavorite: favSet.has(item._id) // 判断是否收藏
          ,displayType
          ,initial: this.getInitialLetter(item.title)
          ,topic
          ,publishTs: (() => { const ts = this.parsePublishToTs(item.publish_time || item.publish_date || item.publishTime || item.publishDate || item.date); return ts; })()
          ,publishDateStr: (() => { let ts = this.parsePublishToTs(item.publish_date || item.publishDate || item.publish_time || item.publishTime); if (!Number.isFinite(ts) || ts <= 0) { ts = this.parsePublishToTs(item.publish_time || item.publish_date || item.publishTime || item.publishDate || item.date); } const fmt = this.formatDateYMD(ts); return fmt || this.parseDateFromTitleStr(item.title); })()
          ,isVip
        };
      });

      this.sortPlaylistByTopic(finalPlaylist, topicMap);

      // 5. 更新页面数据
      // 提前计算过滤后的列表，确保 UI 立即更新
      const displayPlaylist = this.getFilteredPlaylist(finalPlaylist, this.data.searchQuery, this.data.filterFavorite);
      console.log('Music list loaded:', finalPlaylist.length, 'Display count:', displayPlaylist.length);

      const firstPrepared = await this.ensureCloudUrlsForSong(finalPlaylist[0] || {});
      let firstLyrics = (firstPrepared && Array.isArray(firstPrepared.lyrics) && firstPrepared.lyrics.length > 0)
        ? firstPrepared.lyrics
        : ((firstPrepared && firstPrepared.vtt && typeof firstPrepared.vtt === 'string' && firstPrepared.vtt.trim())
          ? parseWebVttToLyrics(firstPrepared.vtt)
          : []);
      this.setData({
        playlist: finalPlaylist,
        displayPlaylist: displayPlaylist.slice(0, this.data.displayLimit || displayPlaylist.length),
        currentSongIndex: 0,
        currentSong: firstPrepared || {},
        lyrics: firstLyrics,
        currentLyricsIndex: 0,
        totalTime: (firstPrepared && firstPrepared.duration) ? firstPrepared.duration : '0:00',
        isFavorite: (firstPrepared && firstPrepared.isFavorite) ? firstPrepared.isFavorite : false,
        typeOptions: this.buildTypeOptions(finalPlaylist),
        personOptions: this.buildPersonOptions(finalPlaylist),
        topicOptions: this.buildTopicOptions(finalPlaylist),
        personIndex: 0,
        selectedPersonText: '作者',
        filterPerson: 'all',
        topicIndex: 0,
        selectedTopicText: '专题',
        filterTopic: 'all',
        showTopicDropdown: false
      });
      if (firstPrepared && firstPrepared.audio_url) {
        this.initAudio();
      }
      try {
        wx.setStorageSync('spring_music_cache', {
          list: finalPlaylist,
          expiresAt: Date.now() + CACHE_DURATION
        });
      } catch (_){}
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
  
  refreshMusicListSilently: async function() {
    try {
      const c1 = new wx.cloud.Cloud({
        resourceAppid: 'wx85d92d28575a70f4',
        resourceEnv: 'cloud1-1gsyt78b92c539ef',
      });
      await c1.init();
      const db = c1.database();
      const [musicRes, favRes, topicRes] = await Promise.all([
        db.collection('spring_music_library')
          .where({ status: true })
          .orderBy('sort_order', 'asc')
          .limit(100)
          .get(),
        db.collection('spring_user_favorites').where({
          _openid: '{openid}',
          type: 'music'
        }).get(),
        db.collection('spring_topic')
          .limit(1000)
          .get()
      ]);
      const musicList = musicRes.data;
      const favListDB = favRes.data || [];
      const topicMap = {};
      try {
        (topicRes && topicRes.data || []).forEach(it => {
          const k = String(it && it.topic || '').trim();
          const v = Number(it && it.order);
          if (k) topicMap[k] = v;
        });
      } catch (_){}
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
      const fileList = [];
      musicList.forEach(item => {
        if (item.image && item.image.startsWith('cloud://')) {
          fileList.push(item.image);
        }
        if (item.poster_url && item.poster_url.startsWith('cloud://')) {
          fileList.push(item.poster_url);
        }
      });
      let tempUrlMap = {};
      if (fileList.length > 0) {
        const tempRes = await c1.getTempFileURL({
          fileList: fileList,
          config: { maxAge: 3 * 60 * 60 }
        });
        tempRes.fileList.forEach(file => {
          if (file.status === 0) {
            tempUrlMap[file.fileID] = file.tempFileURL;
          }
        });
      }
      this.cloudCross = c1;
      this.tempUrlMap = tempUrlMap;
      const finalPlaylist = musicList.map(item => {
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
        
        // 映射后台字段 (Mock演示)
        const topic = item.topic || (item.title.indexOf('春日') > -1 ? '春日系列' : (item.title.indexOf('故事') > -1 ? '故事上新' : ''));
        const isVip = item.is_vip || item.isVip || (item.title.indexOf('特别') > -1) || false;

        let displayType = '';
        if (item.media_type) {
          const t = String(item.media_type).toLowerCase();
          if (t === 'video') displayType = '视频';
          else if (t === 'audio') displayType = '音频';
          else if (t === 'image') displayType = '图片';
        } else {
          if (realAudioUrl) displayType = '音频';
          else if (realMediaUrl) displayType = '视频';
          else if (realImage) displayType = '图片';
        }
        return {
          _id: item._id,
          title: item.title,
          artist: item.artist,
          duration: item.duration_str,
          type: item.type || item.category || '',
          media_url: realMediaUrl,
          audio_url: realAudioUrl,
          image: realImage,
          poster: realPoster,
          vtt: item.vtt || '',
          lyrics: (item.lyrics || []),
          isFavorite: favSet.has(item._id),
          displayType,
          initial: this.getInitialLetter(item.title),
          topic,
          publishTs: (() => { const ts = this.parsePublishToTs(item.publish_time || item.publish_date || item.publishTime || item.publishDate || item.date); return ts; })(),
          publishDateStr: (() => { let ts = this.parsePublishToTs(item.publish_date || item.publishDate || item.publish_time || item.publishTime); if (!Number.isFinite(ts) || ts <= 0) { ts = this.parsePublishToTs(item.publish_time || item.publish_date || item.publishTime || item.publishDate || item.date); } const fmt = this.formatDateYMD(ts); return fmt || this.parseDateFromTitleStr(item.title); })(),
          isVip
        };
      });
      this.sortPlaylistByTopic(finalPlaylist, topicMap);
      const displayPlaylist = this.getFilteredPlaylist(finalPlaylist, this.data.searchQuery, this.data.filterFavorite);
      this.setData({
        playlist: finalPlaylist,
        displayPlaylist: displayPlaylist.slice(0, this.data.displayLimit || displayPlaylist.length),
        typeOptions: this.buildTypeOptions(finalPlaylist),
        personOptions: this.buildPersonOptions(finalPlaylist),
        topicOptions: this.buildTopicOptions(finalPlaylist),
        personIndex: 0,
        selectedPersonText: '作者',
        filterPerson: 'all',
        topicIndex: 0,
        selectedTopicText: '专题',
        filterTopic: 'all',
        showTopicDropdown: false
      });
      try {
        wx.setStorageSync('spring_music_cache', {
          list: finalPlaylist,
          expiresAt: Date.now() + 3 * 60 * 60 * 1000
        });
      } catch (_){}
    } catch (_){}
  },

  ensureCloudUrlsForSong: async function(song) {
    if (!song || typeof song !== 'object') return song;
    const out = { ...song };
    const map = this.tempUrlMap || {};
    const need = [];
    if (out.audio_url && out.audio_url.startsWith('cloud://') && !map[out.audio_url]) {
      need.push(out.audio_url);
    }
    if (out.media_url && out.media_url.startsWith('cloud://') && !map[out.media_url]) {
      need.push(out.media_url);
    }
    if (out.poster && out.poster.startsWith('cloud://') && !map[out.poster]) {
      need.push(out.poster);
    }
    if (need.length > 0) {
      try {
        let c1 = this.cloudCross;
        if (!c1) {
          try {
            c1 = new wx.cloud.Cloud({ resourceAppid: 'wx85d92d28575a70f4', resourceEnv: 'cloud1-1gsyt78b92c539ef' });
            await c1.init();
            this.cloudCross = c1;
          } catch (_){}
        }
        if (c1) {
          const r = await c1.getTempFileURL({ fileList: need, config: { maxAge: 3 * 60 * 60 } });
          (r.fileList || []).forEach(file => { if (file.status === 0) { map[file.fileID] = file.tempFileURL; } });
        } else {
          const r2 = await wx.cloud.getTempFileURL({ fileList: need });
          (r2.fileList || []).forEach(file => { if (file.status === 0) { map[file.fileID] = file.tempFileURL; } });
        }
        this.tempUrlMap = map;
      } catch (_){}
    }
    if (out.audio_url && out.audio_url.startsWith('cloud://')) {
      out.audio_url = map[out.audio_url] || out.audio_url;
    }
    if (out.media_url && out.media_url.startsWith('cloud://')) {
      out.media_url = map[out.media_url] || out.media_url;
    }
    if (out.poster && out.poster.startsWith('cloud://')) {
      out.poster = map[out.poster] || out.poster;
    }
    return out;
  },

  getInitialLetter: function(str) {
    const s = (str || '').toString().trim();
    if (!s) return '#';
    const letter = s.match(/[A-Za-z]/);
    if (letter) return letter[0].toUpperCase();
    const digit = s.match(/[0-9]/);
    if (digit) return digit[0];
    return '#';
  },
  parsePublishToTs: function(raw) {
    if (raw == null) return 0;
    if (typeof raw === 'number') {
      if (!Number.isFinite(raw)) return 0;
      return raw < 1e12 ? Math.floor(raw * 1000) : Math.floor(raw);
    }
    if (raw instanceof Date) return raw.getTime() || 0;
    const s = String(raw || '').trim();
    if (!s) return 0;
    const d = new Date(s);
    const t = d.getTime();
    if (Number.isFinite(t)) return t;
    const n = Number(s);
    if (Number.isFinite(n)) return n < 1e12 ? Math.floor(n * 1000) : Math.floor(n);
    return 0;
  },
  formatDateYMD: function(ts) {
    const t = Number(ts);
    if (!Number.isFinite(t) || t <= 0) return '';
    const d = new Date(t);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  },
  parseDateFromTitleStr: function(title) {
    const s = String(title || '').trim();
    if (!s) return '';
    const m1 = s.match(/[【\[]\s*(\d{4})\s*[年\-\/\.]\s*(\d{1,2})\s*[月\-\/\.]\s*(\d{1,2})\s*日?\s*[】\]]/);
    if (m1) {
      const y = Number(m1[1]);
      const mo = String(Number(m1[2])).padStart(2, '0');
      const da = String(Number(m1[3])).padStart(2, '0');
      if (Number.isFinite(y)) return `${y}-${mo}-${da}`;
    }
    const m2 = s.match(/[【\[]\s*(\d{4})[-\/\.](\d{1,2})[-\/\.](\d{1,2})\s*[】\]]/);
    if (m2) {
      const y = Number(m2[1]);
      const mo = String(Number(m2[2])).padStart(2, '0');
      const da = String(Number(m2[3])).padStart(2, '0');
      if (Number.isFinite(y)) return `${y}-${mo}-${da}`;
    }
    const m3 = s.match(/[【\[]\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日\s*[】\]]/);
    if (m3) {
      const y = new Date().getFullYear();
      const mo = String(Number(m3[1])).padStart(2, '0');
      const da = String(Number(m3[2])).padStart(2, '0');
      return `${y}-${mo}-${da}`;
    }
    return '';
  },
  getTopicOrderMap: async function() {
    try {
      let c1 = this.cloudCross;
      if (!c1) {
        c1 = new wx.cloud.Cloud({ resourceAppid: 'wx85d92d28575a70f4', resourceEnv: 'cloud1-1gsyt78b92c539ef' });
        await c1.init();
        this.cloudCross = c1;
      }
      const db = c1.database();
      const res = await db.collection('spring_topic').limit(1000).get();
      const map = {};
      (res && res.data || []).forEach(it => {
        const k = String(it && it.topic || '').trim();
        const v = Number(it && it.order);
        if (k) map[k] = v;
      });
      return map;
    } catch (_){}
    try {
      const db2 = wx.cloud.database();
      const res2 = await db2.collection('spring_topic').limit(1000).get();
      const map2 = {};
      (res2 && res2.data || []).forEach(it => {
        const k = String(it && it.topic || '').trim();
        const v = Number(it && it.order);
        if (k) map2[k] = v;
      });
      return map2;
    } catch (_){}
    return {};
  },
  sortPlaylistByTopic: function(list, orderMap) {
    const map = orderMap || {};
    try {
      (list || []).sort((a, b) => {
        const ta = String(a && a.topic || '').trim();
        const tb = String(b && b.topic || '').trim();
        const oa = Number(map[ta]);
        const ob = Number(map[tb]);
        const av = Number.isFinite(oa) ? oa : Number.MAX_SAFE_INTEGER;
        const bv = Number.isFinite(ob) ? ob : Number.MAX_SAFE_INTEGER;
        if (av !== bv) return av - bv;
        if (ta === '每日播报' && tb === '每日播报') {
          const pa = Number(a && a.publishTs);
          const pb = Number(b && b.publishTs);
          const pav = Number.isFinite(pa) ? pa : 0;
          const pbv = Number.isFinite(pb) ? pb : 0;
          if (pav !== pbv) return pbv - pav;
        }
        const ia = this.getInitialLetter(a && a.title);
        const ib = this.getInitialLetter(b && b.title);
        if (ia === ib) return (a && a.title || '').localeCompare(b && b.title || '');
        return ia.localeCompare(ib);
      });
    } catch (_){}
    return list;
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
    this.audioCtx = wx.getBackgroundAudioManager();
    const currentSongInit = this.data.currentSong || {};
    try { this.audioCtx.title = String(currentSongInit.title || '随身听'); } catch(_){}
    try { this.audioCtx.epname = String(currentSongInit.topic || '春日扬帆'); } catch(_){}
    try { this.audioCtx.singer = String(currentSongInit.artist || ''); } catch(_){}
    try { this.audioCtx.coverImgUrl = String(currentSongInit.poster || currentSongInit.image || ''); } catch(_){}
    this.audioCtx.onTimeUpdate(() => {
      const ct = Number(this.audioCtx.currentTime || 0);
      const d = Number(this.audioCtx.duration || 0);
      this.updateProgressFromEvent(ct, d);
    });
    this.audioCtx.onPlay(() => {
      getApp().suppressBGM();
      this.setData({ isPlaying: true });
      this.recordListenCount();
      this._lastPlayTs = Date.now();
    });
    this.audioCtx.onPause(() => {
      this.setData({ isPlaying: false });
      const now = Date.now();
      const recent = (this._lastPlayTs && (now - this._lastPlayTs < 800));
      if (recent && !this._pauseByUser) {
        this._pauseByUser = false;
        return;
      }
      if (this._bgmResumeTimer) { try { clearTimeout(this._bgmResumeTimer); } catch (_){ } this._bgmResumeTimer = null; }
      if (!this._desiredPlaying) {
        getApp().releaseBGM();
        getApp().playBGM(true);
      }
      this._pauseByUser = false;
    });
    this.audioCtx.onStop(() => {
      this.setData({ isPlaying: false });
    });
    this.audioCtx.onEnded(() => {
      this.nextSong();
    });
    this.audioCtx.onError(() => {
      wx.showToast({ title: '播放失败', icon: 'none' });
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
      const start = Number(lyrics[i]?.time ?? lyrics[i]?.start ?? 0);
      if (Number.isFinite(start) && currentSeconds >= start) {
        return i;
      }
    }
    return 0;
  },

  // 切换播放/暂停
  togglePlay: function() {
    getApp().playClickSound();
    
    // 播放前的 VIP 检查
    if (!this.data.isPlaying) {
      const checkSong = this.data.currentSong || this.data.playlist[this.data.currentSongIndex] || {};
      if (checkSong && checkSong.isVip && !this.isVipValid()) {
        if (this.vipPreviewLocked) {
          this.setData({ showVipModal: true, isPlaying: false });
          return;
        }
      }
    }

    const isPlaying = !this.data.isPlaying;
    this.setData({
      isPlaying: isPlaying
    });
    this._desiredPlaying = isPlaying;
    if (isPlaying) {
      try { getApp().suppressBGM(); } catch (_){}
      this._pauseByUser = false;
      this._lastPlayTs = Date.now();
      if (this._bgmResumeTimer) { try { clearTimeout(this._bgmResumeTimer); } catch (_){ } this._bgmResumeTimer = null; }
    } else {
      this._pauseByUser = true;
    }
    
    let currentSong = this.data.currentSong || this.data.playlist[this.data.currentSongIndex] || {};
    if (!currentSong || (!currentSong.audio_url && !currentSong.media_url)) {
      wx.showToast({ title: '正在加载歌曲', icon: 'none' });
      this.setData({ isPlaying: false });
      return;
    }
    
    // 1. 处理视频播放
    if (currentSong.media_url) {
      if (typeof currentSong.media_url === 'string' && currentSong.media_url.startsWith('cloud://')) {
        this.ensureCloudUrlsForSong(currentSong).then(prepared => {
          currentSong = prepared || currentSong;
          this.setData({ currentSong });
          const videoContext = wx.createVideoContext('myVideo');
          if (isPlaying) {
            getApp().suppressBGM();
            videoContext.play();
            if (currentSong && currentSong.isVip && !this.isVipValid()) { this.startVipPreviewGate(); }
          } else {
            videoContext.pause();
            this.pauseVipPreviewGate();
            getApp().releaseBGM();
            getApp().playBGM(true);
          }
        });
        return;
      }
      const videoContext = wx.createVideoContext('myVideo');
      if (isPlaying) {
        getApp().suppressBGM();
        videoContext.play();
        if (currentSong && currentSong.isVip && !this.isVipValid()) { this.startVipPreviewGate(); }
      } else {
        videoContext.pause();
        this.pauseVipPreviewGate();
        getApp().releaseBGM();
        getApp().playBGM(true);
      }
      return;
    }

    if (currentSong.audio_url) {
      const needConvert = typeof currentSong.audio_url === 'string' && currentSong.audio_url.startsWith('cloud://');
      const doPlay = (songObj) => {
        if (!this.audioCtx) { this.initAudio(); }
        if (isPlaying) {
          getApp().suppressBGM();
          if (songObj && songObj.audio_url && this.audioCtx.src !== songObj.audio_url) {
            this.audioCtx.src = songObj.audio_url;
          }
          this.audioCtx.play();
          const gateSong = songObj || currentSong;
          if (gateSong && gateSong.isVip && !this.isVipValid()) { this.startVipPreviewGate(); }
        } else {
          this.audioCtx.pause();
          this.pauseVipPreviewGate();
          getApp().releaseBGM();
          getApp().playBGM(true);
        }
      };
      if (needConvert) {
        this.ensureCloudUrlsForSong(currentSong).then(prepared => {
          currentSong = prepared || currentSong;
          this.setData({ currentSong });
          doPlay(currentSong);
        });
        return;
      }
      if (!this.audioCtx) { this.initAudio(); }
      if (isPlaying) {
        getApp().suppressBGM();
        if (this.audioCtx.src !== currentSong.audio_url) {
          this.audioCtx.src = currentSong.audio_url;
        }
        this.audioCtx.play();
        if (currentSong && currentSong.isVip && !this.isVipValid()) { this.startVipPreviewGate(); }
      } else {
        this.audioCtx.pause();
        this.pauseVipPreviewGate();
        getApp().releaseBGM();
        getApp().playBGM(true);
      }
    } else if (!currentSong.media_url) {
      this.setData({ isPlaying: false });
    }
  },

  // 下载歌曲
  downloadSong: async function() {
    getApp().playClickSound();
    const currentSong = this.data.playlist[this.data.currentSongIndex] || {};
    let src = currentSong.audio_url || currentSong.media_url || '';
    const isVideo = !!currentSong.media_url && !currentSong.audio_url;
    if (!src) {
      wx.showToast({ title: '暂无可下载资源', icon: 'none' });
      return;
    }
    try {
      wx.showLoading({ title: '下载中...' });
      if (src.startsWith('http://')) {
        wx.hideLoading();
        wx.showToast({ title: '需HTTPS链接', icon: 'none' });
        return;
      }
      if (src.startsWith('cloud://')) {
        try {
          const c1 = new wx.cloud.Cloud({ resourceAppid: 'wx85d92d28575a70f4', resourceEnv: 'cloud1-1gsyt78b92c539ef' });
          await c1.init();
          const res = await c1.getTempFileURL({ fileList: [src] });
          if (res.fileList && res.fileList[0] && res.fileList[0].tempFileURL) {
            src = res.fileList[0].tempFileURL;
          }
        } catch (_) {
          try {
            const res2 = await wx.cloud.getTempFileURL({ fileList: [src] });
            if (res2.fileList && res2.fileList[0] && res2.fileList[0].tempFileURL) {
              src = res2.fileList[0].tempFileURL;
            }
          } catch (_) {}
        }
      }
      if (!/^https:\/\//.test(src)) {
        wx.hideLoading();
        wx.showToast({ title: '资源不可下载', icon: 'none' });
        return;
      }
      wx.downloadFile({
        url: src,
        success: (res) => {
          if (res.statusCode === 200) {
            wx.hideLoading();
            const tempPath = res.tempFilePath;
            if (isVideo) {
              wx.getSetting({
                success: (st) => {
                  const granted = !!(st.authSetting && st.authSetting['scope.writePhotosAlbum']);
                  const doSave = () => {
                    wx.saveVideoToPhotosAlbum({
                      filePath: tempPath,
                      success: () => wx.showToast({ title: '已保存到相册' }),
                      fail: () => wx.showToast({ title: '保存失败', icon: 'none' })
                    });
                  };
                  if (granted) {
                    doSave();
                  } else {
                    wx.authorize({
                      scope: 'scope.writePhotosAlbum',
                      success: doSave,
                      fail: () => {
                        wx.showModal({
                          title: '提示',
                          content: '需要相册权限才能保存视频',
                          success: (mres) => {
                            if (mres.confirm) wx.openSetting();
                          }
                        });
                      }
                    });
                  }
                }
              });
            } else {
              const fs = wx.getFileSystemManager();
              const extMatch = (src.split('?')[0] || '').match(/\.(mp3|m4a|aac|wav|flac|ogg)$/i);
              const ext = extMatch ? '.' + extMatch[1].toLowerCase() : '.mp3';
              const savePath = `${wx.env.USER_DATA_PATH}/spring_music_${Date.now()}${ext}`;
              try {
                fs.saveFile({
                  tempFilePath: tempPath,
                  filePath: savePath,
                  success: () => {
                    wx.showToast({ title: '已保存至本地缓存' });
                    wx.setClipboardData({
                      data: src,
                      success: () => wx.showModal({ title: '提示', content: '已复制下载链接，请在浏览器粘贴下载', showCancel: false, confirmText: '好的' })
                    });
                  },
                  fail: () => {
                    wx.showToast({ title: '保存失败', icon: 'none' });
                  }
                });
              } catch (_) {
                wx.showToast({ title: '保存失败', icon: 'none' });
              }
            }
          } else {
            wx.hideLoading();
            wx.showToast({ title: `下载失败(${res.statusCode})`, icon: 'none' });
          }
        },
        fail: (err) => {
          wx.hideLoading();
          const msg = (err && err.errMsg) ? err.errMsg : '下载失败';
          wx.showToast({ title: msg, icon: 'none' });
          try { 
            wx.setClipboardData({
              data: src,
              success: () => wx.showModal({ title: '提示', content: '已复制下载链接，请在浏览器粘贴下载', showCancel: false, confirmText: '好的' })
            }); 
          } catch(_) {}
        }
      });
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: '下载失败', icon: 'none' });
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
  changeSong: async function(index) {
    const base = this.data.playlist[index];

    this.pauseVipPreviewGate();
    this.vipPreviewLocked = false;

    const nextSong = await this.ensureCloudUrlsForSong(base);
    let nextLyrics = nextSong && nextSong.lyrics ? nextSong.lyrics : [];
    if ((!nextLyrics || nextLyrics.length === 0) && nextSong && nextSong.vtt && typeof nextSong.vtt === 'string' && nextSong.vtt.trim()) {
      nextLyrics = parseWebVttToLyrics(nextSong.vtt);
    }
    this.setData({
      currentSongIndex: index,
      currentSong: nextSong,
      progress: 0,
      currentTime: '0:00',
      totalTime: nextSong && nextSong.duration ? nextSong.duration : '0:00',
      lyrics: nextLyrics || [],
      currentLyricsIndex: 0,
      isFavorite: nextSong && nextSong.isFavorite ? nextSong.isFavorite : false,
      isPlaying: false
    }, () => {
      // 记录收听数据
      // 仅在用户点击播放时记录
      
      // setData 回调，确保视图更新后再操作视频上下文
      // 1. 如果有视频，自动播放视频
      if (nextSong.media_url) {
        const videoContext = wx.createVideoContext('myVideo');
        // 稍微延迟确保组件已挂载
        setTimeout(() => {
          getApp().stopBGM();
          videoContext.playbackRate(this.data.playbackRate); 
          videoContext.play();
          if (nextSong && nextSong.isVip && !this.isVipValid()) { this.startVipPreviewGate(); }
        }, 200);
      }
    });
    
    if (!nextSong.audio_url) {
      if (this.audioCtx) {
        try { this.audioCtx.stop(); } catch (_){ try { this.audioCtx.pause(); } catch(_){ } }
      }
    }
  },
  closeVipModal: function() {
    this.vipPreviewLocked = true;
    this.setData({ showVipModal: false });
  },
  goToVip: function() {
    this.vipPreviewLocked = true;
    wx.navigateTo({ url: '/pages/vip/vip' });
    this.setData({ showVipModal: false });
  },

  onVideoPlay: function() {
    getApp().stopBGM();
    this.setData({ isPlaying: true });
  },
  onVideoPause: function() {
    if (!this.data.currentSong.audio_url) {
      if (this._bgmResumeTimer) { try { clearTimeout(this._bgmResumeTimer); } catch (_){ } this._bgmResumeTimer = null; }
      if (!this._desiredPlaying) {
        getApp().releaseBGM();
        getApp().playBGM(true);
      }
    }
    this.setData({ isPlaying: false });
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
  onTypeChange: function(e) {
    const idx = e.detail.value;
    const opts = this.data.typeOptions || [];
    const text = opts[idx] || '类型';
    this.setData({
      typeIndex: idx,
      selectedTypeText: text,
      filterType: text === '类型' ? 'all' : text
    });
    this.filterPlaylist();
  },
  toggleTypeDropdown: function() {
    this.setData({
      showTypeDropdown: !this.data.showTypeDropdown
    });
  },
  togglePersonDropdown: function() {
    this.setData({
      showPersonDropdown: !this.data.showPersonDropdown
    });
  },
  selectPerson: function(e) {
    const text = (e.currentTarget.dataset.person || '').trim();
    const idx = (this.data.personOptions || []).indexOf(text);
    this.setData({
      selectedPersonText: text || '作者',
      filterPerson: (text === '作者') ? 'all' : text,
      personIndex: idx >= 0 ? idx : 0,
      showPersonDropdown: false
    });
    this.filterPlaylist();
  },
  selectType: function(e) {
    const text = (e.currentTarget.dataset.type || '').trim();
    const idx = (this.data.typeOptions || []).indexOf(text);
    this.setData({
      selectedTypeText: text || '类型',
      filterType: (text === '类型') ? 'all' : text,
      typeIndex: idx >= 0 ? idx : 0,
      showTypeDropdown: false
    });
    this.filterPlaylist();
  },
  toggleTopicDropdown: function() {
    this.setData({
      showTopicDropdown: !this.data.showTopicDropdown
    });
  },
  selectTopic: function(e) {
    const text = (e.currentTarget.dataset.topic || '').trim();
    const idx = (this.data.topicOptions || []).indexOf(text);
    this.setData({
      selectedTopicText: text || '专题',
      filterTopic: (text === '专题') ? 'all' : text,
      topicIndex: idx >= 0 ? idx : 0,
      showTopicDropdown: false
    });
    this.filterPlaylist();
  },
  onDateChange: function(e) {
    return
  },
  clearFilterDate: function() {
    return
  },
  resetFilters: function() {
    getApp().playClickSound();
    this.setData({
      searchQuery: '',
      filterFavorite: false,
      filterPerson: 'all',
      selectedTypeText: '类型',
      filterType: 'all',
      typeIndex: 0,
      showTypeDropdown: false,
      showPersonDropdown: false,
      showTopicDropdown: false,
      personIndex: 0,
      selectedPersonText: '作者',
      selectedTopicText: '专题',
      filterTopic: 'all',
      topicIndex: 0
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

  getFilteredPlaylist: function(playlist, searchQuery, filterFavorite) {
    const query = (searchQuery || '').toString().toLowerCase().trim();
    const filterType = this.data.filterType || 'all';
    const filterPerson = this.data.filterPerson || 'all';
    const filterTopic = this.data.filterTopic || 'all';

    return (playlist || []).map((item, index) => {
      return { ...item, originalIndex: index };
    }).filter(item => {
      const title = (item.title || '').toString().toLowerCase();
      const artist = (item.artist || '').toString().toLowerCase();
      
      const matchSearch = title.includes(query) || artist.includes(query);
      const matchFavorite = filterFavorite ? item.isFavorite : true;
      const typeVal = item.type;
      const matchType = filterType === 'all' ? true : (Array.isArray(typeVal) ? typeVal.includes(filterType) : (String(typeVal || '') === filterType));
      const matchPerson = filterPerson === 'all' ? true : ((item.artist || '') === filterPerson);
      const topicNorm = (item.topic || '').toString().trim();
      const matchTopic = filterTopic === 'all' ? true : (topicNorm === filterTopic);
      return matchSearch && matchFavorite && matchType && matchPerson && matchTopic;
    });
  },

  // 响应搜索和筛选操作 (UI交互入口)
  filterPlaylist: function() {
    const { playlist, searchQuery, filterFavorite } = this.data;
    const full = this.getFilteredPlaylist(playlist, searchQuery, filterFavorite);
    const limited = full.slice(0, this.data.displayLimit || full.length);

    console.log('Filter applied:', { query: searchQuery, filterFavorite, count: limited.length });
    
    this.setData({
      displayPlaylist: limited
    });
  },
  buildPersonOptions: function(list) {
    const set = new Set();
    (list || []).forEach(it => {
      const a = (it && it.artist) ? String(it.artist).trim() : '';
      if (a) set.add(a);
    });
    const arr = Array.from(set);
    arr.sort((a, b) => {
      const ia = this.getInitialLetter(a);
      const ib = this.getInitialLetter(b);
      if (ia === ib) return a.localeCompare(b);
      return ia.localeCompare(ib);
    });
    return ['作者', ...arr];
  },
  buildTypeOptions: function(list) {
    const set = new Set();
    (list || []).forEach(it => {
      const t = it && it.type;
      if (Array.isArray(t)) {
        t.forEach(x => {
          const v = String(x || '').trim();
          if (v) set.add(v);
        });
      } else {
        const v = String(t || '').trim();
        if (v) set.add(v);
      }
    });
    const arr = Array.from(set);
    arr.sort((a, b) => {
      const ia = this.getInitialLetter(a);
      const ib = this.getInitialLetter(b);
      if (ia === ib) return a.localeCompare(b);
      return ia.localeCompare(ib);
    });
    return ['类型', ...arr];
  },
  buildTopicOptions: function(list) {
    const set = new Set();
    (list || []).forEach(it => {
      const t = (it && it.topic) ? String(it.topic).trim() : '';
      if (t) set.add(t);
    });
    const arr = Array.from(set);
    arr.sort((a, b) => {
      const ia = this.getInitialLetter(a);
      const ib = this.getInitialLetter(b);
      if (ia === ib) return a.localeCompare(b);
      return ia.localeCompare(ib);
    });
    return ['专题', ...arr];
  },
  onScrollToLower: function() {
    const limit = this.data.displayLimit || 30;
    const inc = this.data.displayIncrement || 30;
    const total = this.getFilteredPlaylist(this.data.playlist, this.data.searchQuery, this.data.filterFavorite).length;
    const nextLimit = Math.min(limit + inc, total);
    if (nextLimit !== limit) {
      this.setData({ displayLimit: nextLimit });
      this.filterPlaylist();
    }
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
        try {
          videoContext.playbackRate(rate);
          if (this.data.isPlaying) {
            try { videoContext.pause(); } catch (_){}
            setTimeout(() => { try { videoContext.playbackRate(rate); videoContext.play(); } catch(_){ } }, 80);
          }
        } catch(_){}
    }
    
    if (currentSong.audio_url && this.audioCtx) {
      const supportsRate = (typeof this.audioCtx.playbackRate !== 'undefined');
      if (!supportsRate && !currentSong.media_url) {
        wx.showToast({ title: '后台播放不支持倍速', icon: 'none' });
      } else {
        try {
          this.audioCtx.playbackRate = rate;
          if (this.data.isPlaying) {
            try { this.audioCtx.play(); } catch (_){ }
          }
          setTimeout(() => { try { this.audioCtx.playbackRate = rate; } catch (_){ } }, 100);
        } catch (_){ }
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
  
  normalizeBoolean: function(v) {
    if (v === undefined || v === null) return null;
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v !== 0;
    const s = String(v).trim().toLowerCase();
    if (s === 'false' || s === '0' || s === 'no' || s === 'n' || s === '') return false;
    if (s === 'true' || s === '1' || s === 'yes' || s === 'y') return true;
    return !!v;
  },
  parseDateString: function(str) {
    if (!str || typeof str !== 'string') return null;
    let s = str.trim();
    if (/年|月|日/.test(s)) {
      s = s.replace('年', '-').replace('月', '-').replace('日', '');
    }
    s = s.replace(/\./g, '-').replace(/\//g, '-');
    const d = new Date(s);
    if (isNaN(d.getTime())) return null;
    return d;
  },
  isVipValid: function() {
    const info = wx.getStorageSync('userInfo') || {};
    const rawVip = (info && typeof info.isVip !== 'undefined') ? info.isVip : wx.getStorageSync('isVip');
    const isVip = this.normalizeBoolean(rawVip);
    if (!isVip) return false;
    const expiryStr = wx.getStorageSync('vipExpiry');
    if (!expiryStr) return true;
    const expiry = this.parseDateString(expiryStr);
    if (!expiry) return true;
    const now = new Date();
    return expiry.getTime() >= now.getTime();
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

  // 打开图片页
  openSongPrint: function(e) {
    getApp().playClickSound();
    const songId = e && e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.id;
    if (!songId) {
      wx.showToast({ title: '缺少歌曲ID', icon: 'none' });
      return;
    }
    wx.navigateTo({
      url: `/pages/music-print/music-print?songId=${songId}`
    });
  },

  startVipPreviewGate: function() {
    const now = Date.now();
    let left = 30000;
    if (this.vipPreviewDeadline && this.vipPreviewDeadline > now) {
      left = this.vipPreviewDeadline - now;
    } else {
      this.vipPreviewDeadline = now + 30000;
    }
    if (this.vipPreviewTimer) { try { clearTimeout(this.vipPreviewTimer); } catch (_){ } }
    this.vipPreviewTimer = setTimeout(() => { this.triggerVipGate(); }, Math.max(0, left));
  },
  pauseVipPreviewGate: function() {
    if (this.vipPreviewTimer) { try { clearTimeout(this.vipPreviewTimer); } catch (_){ } this.vipPreviewTimer = null; }
  },
  resetVipPreviewGate: function() {
    if (this.vipPreviewTimer) { try { clearTimeout(this.vipPreviewTimer); } catch (_){ } this.vipPreviewTimer = null; }
    this.vipPreviewDeadline = null;
  },
  triggerVipGate: function() {
    this.vipPreviewTimer = null;
    this.vipPreviewDeadline = null;
    this.vipPreviewLocked = true;
    try { if (this.audioCtx) this.audioCtx.pause(); } catch (_){}
    try { const vc = wx.createVideoContext('myVideo'); vc.pause(); } catch (_){}
    this.setData({ isPlaying: false, showVipModal: true });
  },
  // 记录收听数量
  recordListenCount: function() {
    const currentSong = this.data.currentSong;

    if (!currentSong) return;
    
    // 优先使用数据库ID，如果没有则降级使用 title-artist
    const songId = currentSong._id || `${currentSong.title}-${currentSong.artist}`;
    const dt = new Date();
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const d = String(dt.getDate()).padStart(2, '0');
    const today = `${y}/${m}/${d}`;
    
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

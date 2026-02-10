// pages/article-detail/article-detail.js
const favoriteManager = require('../../utils/favoriteManager');
const reminderManager = require('../../utils/reminderManager');

Page({

  /**
   * 页面的初始数据
   */
  data: {
    currentStyleIndex: 0, // 当前风格索引：0-main, 1-qa, 2-inspire, 3-fashion
    isFavorited: false, // 收藏状态
    fontSizeIndex: 1, // 字体大小索引：0-小，1-中，2-大
    currentStyleImage: '/assets/images/主体式.png', // 当前风格图片
    isSmallCard: false, // 是否为小卡片模式（A4区域）
    showTipLabel: false, // 是否显示提示便签
    currentAvatar: '',
    
    // 音频播放相关
    audioContext: null,
    isPlaying: false,
    playingType: '', // 'content', 'qa', 'inspire', 'dreamy'
    isPaused: false,
    sheepX: 0,
    sheepY: 0,
    sheepRotate: 0,
    sheepScaleX: 1,
    cardWidth: 0,
    cardHeight: 0,

    // 填色功能相关
    colors: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEEAD', '#D4A5A5', '#9B59B6', '#3498DB', '#E74C3C', '#2ECC71', '#F1C40F', '#FFFFFF'],
    selectedColor: '#FF6B6B',
    canvasHeight: 300, // 初始高度
    isCanvasLoading: false,
    canPaint: true,
    parentTaskPhoto: '',
    parentTaskSubmitted: false,
    parentBadgeEarned: false,
    parentBadgeAcquiredAtStr: '',
    quizSelected: '',
    treasureUnlocked: false,
    treasureMessage: '',
    mailboxInput: '',
    mailboxMessages: [],
    mailboxMessagesView: [],
    showQuizModal: false,
    quizBgSrc: '/assets/images/splash-bg.png',
    showTreasureCard: false,
    treasureCardType: '',
    showWorryModal: false,
    worryText: '',
    isRecording: false,
    recordTarget: '',
    isAnimating: false,
    fallingChars: [],
    plants: [],
    encouragingText: '',
    showEncouragingText: false,
    showAvatarTip: false,
    avatarTipText: '',
    treasureMessagesPool: [
      '愿你保持好奇，探索自然的奥秘',
      '微风与花香，都在为你加油',
      '今天的你，比昨天更勇敢一点',
      '把小小好奇装进行囊，继续出发',
      '山谷回声提醒：坚持让路更清晰',
      '每一次发现，都在点亮你的世界',
      '倾听自然，也倾听自己',
      '小步慢跑，也能到达远方',
      '相信自己，答案就在下一次尝试',
      '把笑容留给今天，把期待留给明天'
    ],
    showTreasureReady: false,
    successCardCloudId: 'cloud://cloud1-1gsyt78b92c539ef.636c-cloud1-1gsyt78b92c539ef-1370520707/mianyang/正确.jpg',
    errorCardCloudId: 'cloud://cloud1-1gsyt78b92c539ef.636c-cloud1-1gsyt78b92c539ef-1370520707/mianyang/错误.jpg',
    successCardUrl: '',
    errorCardUrl: '',
    topImageArticleCloudId: 'cloud://cloud1-1gsyt78b92c539ef.636c-cloud1-1gsyt78b92c539ef-1370520707/mianyang/春天图片1.jpg',
    topImageQaCloudId: 'cloud://cloud1-1gsyt78b92c539ef.636c-cloud1-1gsyt78b92c539ef-1370520707/mianyang/春天图片2.jpg',
    topImageInspireCloudId: 'cloud://cloud1-1gsyt78b92c539ef.636c-cloud1-1gsyt78b92c539ef-1370520707/mianyang/春天图片3.jpg',
    topImageFashionCloudId: 'cloud://cloud1-1gsyt78b92c539ef.636c-cloud1-1gsyt78b92c539ef-1370520707/mianyang/春天图片4.jpg',
    topImageSmallCardCloudId: 'cloud://cloud1-1gsyt78b92c539ef.636c-cloud1-1gsyt78b92c539ef-1370520707/mianyang/春天图片5.jpg',
    topImageArticleUrl: '',
    topImageQaUrl: '',
    topImageInspireUrl: '',
    topImageFashionUrl: '',
    topImageSmallCardUrl: '',
    newGoalText: '',
    goals: [],
    selectedDate: '',
    selectedTime: '',
    reminderContent: '',
    reminders: [],
    reminderTicker: null,

    article: {
      id: '',
      title: '',
      subtitle: '',
      category: '',
      date: '',
      cover: '',
      createdAt: '',
      content: '',
      // 问答式数据
      qaTitle: '',
      qaImage: '',
      qaContent: '',
      // 启发式数据
      inspireText: '',
      inspireAuthor: '',
      inspireAudio: '', // 默认音频
      // 梦幻式数据
      characterImage: '',
      fashionContent: '',
      dreamyAudio: '', // 默认音频
      signature: ''
    },
    medal: '',
    encouragingQuotes: [
      '烦恼是小乌云，吹一口气，就散成阳光啦！',
      '把烦恼轻轻放在手心，吹一口魔法气，它就化啦～',
      '烦恼画在沙滩上，浪一来，全被带走啦！',
      '烦恼变成小雪花，呼～落地就化啦～～',
      '把烦恼揉成纸团，投进垃圾桶，拜拜不见啦～',
      '烦恼是小灰尘，拿个小扫把，唰唰扫进垃圾桶～',
      '把烦恼揉成小纸团，啪嗒一下投进筐，满分！',
      '烦恼是小怪兽，给它喂颗甜甜的糖，它就会乖乖跑掉！'
    ]
  },
  openParentPhotoActions() {
    getApp().playClickSound();
    const id = this.data.article && this.data.article.id;
    const hasPhoto = !!this.data.parentTaskPhoto;
    if (!hasPhoto) return;
    wx.showActionSheet({
      itemList: ['删除照片'],
      success: (res) => {
        if (res.tapIndex === 0) {
          this.deleteParentPhoto(id);
        }
      }
    });
  },
  async deleteParentPhoto(articleId) {
    try {
      const fid = this.data.parentTaskPhotoFileId || wx.getStorageSync(`parent_task_photo_fileid_${articleId}`) || '';
      if (fid) {
        try { await wx.cloud.deleteFile({ fileList: [fid] }); } catch (_) {}
      }
      this.setData({ parentTaskPhoto: '', parentTaskPhotoFileId: '' });
      if (articleId) {
        try {
          wx.removeStorageSync(`parent_task_photo_fileid_${articleId}`);
          wx.removeStorageSync(`parent_task_photo_url_${articleId}`);
          wx.removeStorageSync(`parent_task_photo_${articleId}`);
        } catch (_) {}
      }
      wx.showToast({ title: '已删除', icon: 'success' });
    } catch (e) {
      wx.showToast({ title: '删除失败', icon: 'none' });
    }
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    const { articleId, isSmallCard } = options;

    this.setData({
      isSmallCard: isSmallCard === 'true'
    });

    if (articleId) {
      this.loadArticleDetail(articleId);
    }
    const avatar = wx.getStorageSync('currentAvatar') || '';
    if (avatar) this.setData({ currentAvatar: avatar });
    this.refreshVipFromCloud();
    this.initRecord();
  },
  onShow: function () {
    this.setData({
      parentTaskPhoto: '',
      mailboxInput: '',
      newGoalText: '',
      reminderContent: '',
      quizSelected: '',
      showQuizModal: false
    });
  },

  /**
   * 加载文章详情
   */
  loadArticleDetail: async function (articleId) {
    wx.showLoading({ title: '加载中...' });
    
    try {
      const cacheKey = `spring_article_cache_${articleId}`;
      try {
        const cached = wx.getStorageSync(cacheKey);
        if (cached && cached.article && cached.expiresAt && cached.expiresAt > Date.now()) {
          this.setData({
            article: cached.article,
            isFavorited: favoriteManager.isFavorite(cached.article.id, 'article', this.data.isSmallCard ? 'small' : 'main'),
            canPaint: cached.article.type === 'sketching',
            mailboxMessages: wx.getStorageSync(`mailbox_${cached.article.id}`) || [],
            goals: wx.getStorageSync(`goals_${cached.article.id}`) || [],
            reminders: []
          }, () => {
            this.updateMailboxView();
            this.loadReminders();
          });
        }
      } catch (_) {}
      // 初始化跨环境云实例
      const c1 = new wx.cloud.Cloud({
        resourceAppid: 'wx85d92d28575a70f4', // 资源方 AppID
        resourceEnv: 'cloud1-1gsyt78b92c539ef', // 资源方环境 ID
      });
      await c1.init();
      
      const db = c1.database();
      
      const res = await db.collection('spring_hoofprint_articles').doc(articleId).get();
      const data = res.data;
      
      // 处理图片链接
      let coverImage = data.cover_image || '';
      let a4Image = data.a4_image || '';
      
      const fileListToConvert = [];
      if (coverImage.startsWith('cloud://')) fileListToConvert.push(coverImage);
      if (a4Image.startsWith('cloud://')) fileListToConvert.push(a4Image);

      // 如果是云文件ID，换取临时链接
      if (fileListToConvert.length > 0) {
        try {
          const tempRes = await c1.getTempFileURL({
            fileList: fileListToConvert,
            config: { maxAge: 3 * 60 * 60 }
          });
          if (tempRes.fileList) {
             tempRes.fileList.forEach(item => {
               if (item.status === 0) {
                 if (item.fileID === coverImage) coverImage = item.tempFileURL;
                 if (item.fileID === a4Image) a4Image = item.tempFileURL;
               }
             });
          }
        } catch (imgErr) {
          console.error('图片链接转换失败', imgErr);
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
        return `${year}.${month}.${day}`;
      };
      const formatDateCn = (timestamp) => {
        if (!timestamp) return '';
        const d = new Date(timestamp);
        if (isNaN(d.getTime())) return '';
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}年${m}月${day}日`;
      };
      
      // 构建页面需要的文章对象
      const article = {
        id: data._id,
        title: data.title || '无标题',
        subtitle: data.subtitle || '',
        category: data.category || '未分类',
        date: formatDate(data.publish_date) || '',
        publishDateText: formatDateCn(data.publish_date) || '',
        cover: coverImage,
        createdAt: data.create_time ? new Date(data.create_time).toLocaleString() : '',
        level: data.level || 'low',
        type: data.type || 'sketching',
        content: data.content || '',
        contentPinyin: data.content_pinyin || '', // 拼音内容
        contentAudio: data.content_audio || '', // 主体式音频 (测试用默认值)
        isCarousel: this.normalizeBoolean(data.is_carousel),

        // 问答式数据
        qaTitle: data.qa_title || data.title || '关于本篇的思考',
        qaImage: data.qa_image || coverImage,
        qaContent: data.qa_content || data.content || '暂无问答内容',
        qaContentPinyin: data.qa_content_pinyin || '', // 问答拼音
        qaAudio: data.qa_audio || '', // 问答式音频 (测试用默认值)
        qaOptions: Array.isArray(data.qa_options) ? data.qa_options : (() => {
          if (typeof data.qa_options === 'string') {
            try {
              const arr = JSON.parse(data.qa_options);
              if (Array.isArray(arr)) return arr;
            } catch (_) {}
            const parts = String(data.qa_options).split(/\r?\n|;|\|/).map(s => String(s).trim()).filter(Boolean);
            return parts;
          }
          return [];
        })(),
        qaAnswer: (() => {
          const v = typeof data.qa_answer === 'number' ? data.qa_answer : parseInt(data.qa_answer, 10);
          if (isNaN(v)) return 0;
          if (v < 0) return 0;
          if (v > 3) return 3;
          return v;
        })(),

        // 启发式数据 (图片+正文)
        inspireImage: data.inspire_image || coverImage,
        inspireText: data.inspire_content || data.content || '暂无启发内容',
        inspireTextPinyin: data.inspire_content_pinyin || '', // 启发拼音
        inspireAuthor: data.inspire_author || '—— 一只绵羊的春天',
        inspireAudio: data.inspire_audio || '', // 加油式音频
        
        // 梦幻式数据 (图片+正文)
        dreamyImage: data.dreamy_image || coverImage,
        dreamyContent: data.dreamy_content || data.content || '暂无内容',
        dreamyContentPinyin: data.dreamy_content_pinyin || '', // 梦幻拼音
        dreamyAudio: data.dreamy_audio || '', // 梦幻式音频
        signature: '一只绵羊的春天',

        // A4图片
        a4Image: a4Image,
        medal: data.medal || ''
      };

      // 辅助函数：处理拼音和文字的一一对应
      const processPinyin = (content, contentPinyin) => {
        if (!content || !contentPinyin) return null;
        
        // 预处理：在标点符号周围添加空格，确保 split 能够正确分割
        // 常见中文标点和部分全角/半角标点
        const processedPinyinStr = contentPinyin.replace(/([，。！？；：“”‘’（）【】《》、…—\.,!\?;:\"'\[\]\(\)])/g, ' $1 ');
        
        const pinyinList = processedPinyinStr.trim().split(/\s+/);
        const charList = content.split('');
        const contentWithPinyin = [];
        let pinyinIndex = 0;
        let isNewParagraph = true; // 标记新段落
        
        // 判断是否为标点符号
        const isPunctuation = (char) => {
          return /[，。！？；：“”‘’（）【】《》、…—\.,!\?;:\"'\[\]\(\)]/.test(char);
        };

        for (let i = 0; i < charList.length; i++) {
          const char = charList[i];
          if (char.trim() === '' && char !== '\n') continue;
          
          let pinyin = '';
          let isLineBreak = false;

          if (char === '\n') {
             pinyin = '';
             isLineBreak = true; 
          } else {
            // 尝试匹配拼音列表
            if (pinyinIndex < pinyinList.length) {
              const currentPinyinItem = pinyinList[pinyinIndex];
              
              if (isPunctuation(char)) {
                // 如果当前字符是标点
                if (currentPinyinItem === char) {
                  // 拼音列表中也有这个标点，说明用户写了，消耗掉
                  // 通常标点不需要显示拼音，或者显示它自己
                  // pinyin = char; // 如果需要显示标点本身作为拼音，可以取消注释
                  pinyin = ''; 
                  pinyinIndex++;
                } else {
                  // 拼音列表中下一个不是这个标点（可能是下一个字的拼音）
                  // 说明用户没写这个标点的拼音，跳过消耗，默认无拼音
                  pinyin = '';
                }
              } else {
                // 是汉字或其他字符
                // 无论取出来的是什么，都认为是这个字的拼音
                // 如果取出来的是标点（说明错位了），也只能显示了
                pinyin = currentPinyinItem;
                pinyinIndex++;
              }
            }
          }
          
          const item = {
            char: char,
            pinyin: pinyin,
            isLineBreak: isLineBreak,
            isIndent: false
          };

          if (isLineBreak) {
            isNewParagraph = true;
          } else if (isNewParagraph) {
            item.isIndent = true;
            isNewParagraph = false;
          }
          
          contentWithPinyin.push(item);
        }
        return contentWithPinyin;
      };

      article.contentWithPinyin = processPinyin(article.content, article.contentPinyin);
      article.qaContentWithPinyin = processPinyin(article.qaContent, article.qaContentPinyin);
      article.inspireTextWithPinyin = processPinyin(article.inspireText, article.inspireTextPinyin);
      article.dreamyContentWithPinyin = processPinyin(article.dreamyContent, article.dreamyContentPinyin);

      const quizLabels = ['A', 'B', 'C', 'D'];
      const quizList = quizLabels.map((label, idx) => ({
        key: label,
        text: (article.qaOptions && article.qaOptions[idx]) ? article.qaOptions[idx] : label
      }));

      // 如果有图片链接需要转换（除了封面图外的其他图片）
      // 同时也处理音频链接转换
      const extraResources = [
        article.qaImage,
        article.inspireImage,
        article.dreamyImage,
        article.a4Image,
        article.contentAudio,
        article.qaAudio,
        article.inspireAudio,
        article.dreamyAudio,
        article.medal
      ].filter(res => res && res.startsWith('cloud://'));

      if (extraResources.length > 0) {
        try {
          const ttlMs = 2 * 60 * 60 * 1000;
          const urlMap = await this.convertTempUrlsWithCache(c1, extraResources, ttlMs);
          if (article.qaImage && urlMap[article.qaImage]) article.qaImage = urlMap[article.qaImage];
          if (article.inspireImage && urlMap[article.inspireImage]) article.inspireImage = urlMap[article.inspireImage];
          if (article.dreamyImage && urlMap[article.dreamyImage]) article.dreamyImage = urlMap[article.dreamyImage];
          if (article.a4Image && urlMap[article.a4Image]) article.a4Image = urlMap[article.a4Image];
          if (article.contentAudio && urlMap[article.contentAudio]) article.contentAudio = urlMap[article.contentAudio];
          if (article.qaAudio && urlMap[article.qaAudio]) article.qaAudio = urlMap[article.qaAudio];
          if (article.inspireAudio && urlMap[article.inspireAudio]) article.inspireAudio = urlMap[article.inspireAudio];
          if (article.dreamyAudio && urlMap[article.dreamyAudio]) article.dreamyAudio = urlMap[article.dreamyAudio];
          if (article.medal && urlMap[article.medal]) article.medal = urlMap[article.medal];
        } catch (extraErr) {
          console.error('其他资源链接转换失败', extraErr);
        }
      }

      this.setData({
        article: article,
        isFavorited: favoriteManager.isFavorite(article.id, 'article', this.data.isSmallCard ? 'small' : 'main'),
        canPaint: article.type === 'sketching',
        mailboxMessages: wx.getStorageSync(`mailbox_${article.id}`) || [],
        goals: wx.getStorageSync(`goals_${article.id}`) || [],
        reminders: [],
        quizOptionList: quizList,
        parentTaskSubmitted: !!wx.getStorageSync(`parent_task_submitted_${article.id}`),
        parentBadgeEarned: !!wx.getStorageSync(`parent_badge_${article.id}`),
        treasureUnlocked: !!wx.getStorageSync(`treasure_${article.id}`),
        treasureMessage: wx.getStorageSync(`treasure_msg_${article.id}`) || ''
      }, () => {
        this.updateMailboxView();
        this.loadReminders();
        this.loadParentMedalAcquiredAt();
      });
      try { wx.setStorageSync(cacheKey, { article, expiresAt: Date.now() + 10 * 60 * 1000 }); } catch (_) {}
      // 根据要求：重新进入页面不自动恢复照片预览

      try {
        const fileList = [
          this.data.topImageArticleCloudId,
          this.data.topImageQaCloudId,
          this.data.topImageInspireCloudId,
          this.data.topImageFashionCloudId,
          this.data.topImageSmallCardCloudId
        ].filter(fid => fid && fid.indexOf('cloud://') === 0);
        if (fileList.length) {
          const ttlMs = 2 * 60 * 60 * 1000;
          const m = await this.convertTempUrlsWithCache(c1, fileList, ttlMs);
          this.setData({
            topImageArticleUrl: m[this.data.topImageArticleCloudId] || '',
            topImageQaUrl: m[this.data.topImageQaCloudId] || '',
            topImageInspireUrl: m[this.data.topImageInspireCloudId] || '',
            topImageFashionUrl: m[this.data.topImageFashionCloudId] || '',
            topImageSmallCardUrl: m[this.data.topImageSmallCardCloudId] || ''
          });
        }
      } catch (_) {}

      wx.setNavigationBarTitle({
        title: this.data.isSmallCard ? '弹走烦恼，春暖花开' : article.title
      });
      
    } catch (err) {
      console.error('加载文章详情失败', err);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },
  async finalizeParentPhoto(localPath, articleId) {
    try {
      const ex = (String(localPath).split('.').pop() || '').toLowerCase();
      const ext = ex === 'png' ? 'png' : 'jpg';
      const cloudPath = `parent_tasks/${articleId || 'unknown'}/${Date.now()}.${ext}`;
      const up = await wx.cloud.uploadFile({ cloudPath, filePath: localPath });
      const fid = up && up.fileID ? up.fileID : '';
      if (!fid) {
        this.setData({ parentTaskPhoto: localPath });
        if (articleId) wx.setStorageSync(`parent_task_photo_${articleId}`, localPath);
        return;
      }
      let tempUrl = '';
      try {
        const urlRes = await wx.cloud.getTempFileURL({ fileList: [fid] });
        if (urlRes && urlRes.fileList && urlRes.fileList[0] && urlRes.fileList[0].status === 0) {
          tempUrl = urlRes.fileList[0].tempFileURL || '';
        }
      } catch (_) {}
      if (!tempUrl) {
        try {
          const c1 = new wx.cloud.Cloud({ resourceAppid: 'wx85d92d28575a70f4', resourceEnv: 'cloud1-1gsyt78b92c539ef' });
          await c1.init();
          const urlRes2 = await c1.getTempFileURL({ fileList: [fid] });
          if (urlRes2 && urlRes2.fileList && urlRes2.fileList[0] && urlRes2.fileList[0].status === 0) {
            tempUrl = urlRes2.fileList[0].tempFileURL || '';
          }
        } catch (_) {}
      }
      let previewUrl = tempUrl || localPath;
      try {
        await new Promise((resolve, reject) => {
          wx.getImageInfo({ src: previewUrl, success: resolve, fail: reject });
        });
      } catch (e1) {
        try {
          await new Promise((resolve, reject) => {
            wx.getImageInfo({ src: localPath, success: resolve, fail: reject });
          });
          previewUrl = localPath;
        } catch (e2) {
          // 保底：仍然使用云临时链接
        }
      }
      this.setData({ parentTaskPhoto: previewUrl, parentTaskPhotoFileId: fid });
      if (articleId) {
        wx.setStorageSync(`parent_task_photo_fileid_${articleId}`, fid);
        wx.setStorageSync(`parent_task_photo_url_${articleId}`, previewUrl);
        try { wx.removeStorageSync(`parent_task_photo_${articleId}`); } catch (_) {}
      }
    } catch (e) {
      this.setData({ parentTaskPhoto: localPath });
      if (articleId) wx.setStorageSync(`parent_task_photo_${articleId}`, localPath);
    }
  },
  onDateChange(e) {
    getApp().playClickSound();
    this.setData({ selectedDate: (e.detail && e.detail.value) || '' });
  },
  onReminderInput(e) {
    this.setData({ reminderContent: (e.detail && e.detail.value) || '' });
  },
  saveReminder: async function () {
    getApp().playClickSound();
    const d = (this.data.selectedDate || '').trim();
    const c = (this.data.reminderContent || '').trim();
    const article = this.data.article || {};
    const articleId = article.id || '';
    if (!d || !c) {
      wx.showToast({ title: '请填写完整', icon: 'none' });
      return;
    }
    const ds = d.split('-');
    const y = parseInt(ds[0], 10);
    const m = parseInt(ds[1], 10);
    const day = parseInt(ds[2], 10);
    const dueAt = new Date(y, m - 1, day, 0, 0, 0).getTime();
    if (isNaN(dueAt)) {
      wx.showToast({ title: '请选择有效日期', icon: 'none' });
      return;
    }
    const todayStart = (() => { const n = new Date(); n.setHours(0,0,0,0); return n.getTime(); })();
    if (dueAt < todayStart) {
      wx.showToast({ title: '请选择今天或之后的日期', icon: 'none' });
      return;
    }
    const id = `${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    const item = {
      id,
      content: c,
      dueAt,
      createdAt: Date.now(),
      notified: false
    };
    const key = `reminders_${articleId}`;
    const list = wx.getStorageSync(key) || [];
    list.push(item);
    wx.setStorageSync(key, list);
    reminderManager.add({ ...item, articleId });
    this.loadReminders();
    try {
      const c1 = new wx.cloud.Cloud({ resourceAppid: 'wx85d92d28575a70f4', resourceEnv: 'cloud1-1gsyt78b92c539ef' });
      await c1.init();
      const db = c1.database();
      await db.collection('spring_growth_reminders').add({ data: { ...item, articleId } });
    } catch (_) {}
    if (getApp && getApp().playClickSound) getApp().playClickSound();
    wx.showToast({ title: '已保存提醒', icon: 'success' });
    this.setData({ reminderContent: '' });
  },
  loadReminders() {
    const article = this.data.article || {};
    const articleId = article.id || '';
    if (!articleId) return;
    const key = `reminders_${articleId}`;
    const list = wx.getStorageSync(key) || [];
    const mapped = list
      .slice()
      .sort((a, b) => {
        const ax = typeof a.createdAt === 'number' ? a.createdAt : a.dueAt || 0;
        const bx = typeof b.createdAt === 'number' ? b.createdAt : b.dueAt || 0;
        return bx - ax; // 最新在上
      })
      .map(it => ({
        ...it,
        dueAtStr: (() => {
          const dNum = Number(it.dueAt);
          if (isFinite(dNum) && dNum > 0) return this.formatTimestamp(dNum);
          const cNum = Number(it.createdAt);
          if (isFinite(cNum) && cNum > 0) return this.formatTimestamp(cNum);
          return '';
        })(),
        createdAtStr: (() => {
          const cNum = Number(it.createdAt);
          if (isFinite(cNum) && cNum > 0) return this.formatTimestamp(cNum);
          return '';
        })()
      }));
    this.setData({ reminders: mapped });
  },
  removeReminder(e) {
    getApp().playClickSound();
    const article = this.data.article || {};
    const articleId = article.id || '';
    const id = e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.id;
    if (!articleId || !id) return;
    const key = `reminders_${articleId}`;
    const list = wx.getStorageSync(key) || [];
    const next = list.filter(it => it.id !== id);
    wx.setStorageSync(key, next);
    reminderManager.remove(id);
    this.loadReminders();
    if (getApp && getApp().playClickSound) getApp().playClickSound();
    wx.showToast({ title: '已删除', icon: 'none' });
  },
  startReminderTicker() {
    this.stopReminderTicker();
    this.reminderTicker = setInterval(() => {
      this.checkDueReminders();
    }, 60000);
  },
  stopReminderTicker() {
    if (this.reminderTicker) {
      clearInterval(this.reminderTicker);
      this.reminderTicker = null;
    }
  },
  checkDueReminders() {
    // 使用全局提醒管理器进行到期检查与弹窗记录
    reminderManager.checkAndNotify();
  },
  formatTimestamp(ts) {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
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
  async refreshVipFromCloud() {
    try {
      const c1 = new wx.cloud.Cloud({ resourceAppid: 'wx85d92d28575a70f4', resourceEnv: 'cloud1-1gsyt78b92c539ef' });
      await c1.init();
      const ret = await c1.callFunction({ name: 'spring_pay', data: { action: 'checkMemberStatus' } });
      const r = ret.result || {};
      const expiryStr = r.vipExpireTime ? new Date(r.vipExpireTime).toLocaleDateString('zh-CN') : '';
      wx.setStorageSync('isVip', !!r.isVip);
      wx.setStorageSync('vipExpiry', expiryStr);
    } catch (_) {}
  },
  chooseParentPhoto() {
    getApp().playClickSound();
    const id = this.data.article && this.data.article.id;
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['camera', 'album'],
      success: res => {
        const path =
          (res.tempFilePaths && res.tempFilePaths[0]) ||
          (res.tempFiles && res.tempFiles[0] && (res.tempFiles[0].tempFilePath || res.tempFiles[0].path)) ||
          '';
        if (!path) {
          wx.showToast({ title: '选择失败', icon: 'none' });
          return;
        }
        this.setData({ parentTaskPhoto: path });
        this.checkAndAcceptParentPhoto(path, id);
      }
    });
  },
  async compressImageForCheck(imagePath) {
    const ensureSizeBelow = async (path, attempts = []) => {
      try {
        const info = await new Promise((resolve) => {
          wx.getFileInfo({
            filePath: path,
            success: resolve,
            fail: () => resolve({ size: 0 })
          });
        });
        const size = info && typeof info.size === 'number' ? info.size : 0;
        if (size > 970 * 1024 && attempts.length) {
          const next = attempts.shift();
          const resized = await this.resizeImageWithCanvas(path, next.w, next.h, next.q);
          return ensureSizeBelow(resized, attempts);
        }
        return path;
      } catch (_) {
        return path;
      }
    };
    return new Promise((resolve) => {
      wx.compressImage({
        src: imagePath,
        quality: 50,
        success: async (res) => {
          try {
            const imgInfo = await new Promise((resolveImg) => {
              wx.getImageInfo({
                src: res.tempFilePath,
                success: resolveImg,
                fail: () => resolveImg(null)
              });
            });
            const maxWidth = 750;
            const maxHeight = 1334;
            let path = res.tempFilePath;
            if (imgInfo && (imgInfo.width > maxWidth || imgInfo.height > maxHeight)) {
              path = await this.resizeImageWithCanvas(res.tempFilePath, maxWidth, maxHeight, 0.6);
            }
            const finalPath = await ensureSizeBelow(path, [
              { w: 600, h: 1067, q: 0.6 },
              { w: 480, h: 854, q: 0.5 }
            ]);
            resolve(finalPath);
          } catch (_) {
            resolve(res.tempFilePath);
          }
        },
        fail: async () => {
          try {
            const resized = await this.resizeImageWithCanvas(imagePath, 750, 1334, 0.6);
            const finalPath = await ensureSizeBelow(resized, [
              { w: 600, h: 1067, q: 0.6 },
              { w: 480, h: 854, q: 0.5 }
            ]);
            resolve(finalPath);
          } catch (_) {
            resolve(imagePath);
          }
        }
      });
    });
  },
  async resizeImageWithCanvas(imagePath, maxWidth, maxHeight, quality = 0.6) {
    return new Promise((resolve, reject) => {
      wx.getImageInfo({
        src: imagePath,
        success: (imgInfo) => {
          const width = imgInfo.width;
          const height = imgInfo.height;
          let targetWidth = width;
          let targetHeight = height;
          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            targetWidth = Math.floor(width * ratio);
            targetHeight = Math.floor(height * ratio);
          }
          const query = wx.createSelectorQuery();
          query.select('#compressCanvas')
            .fields({ node: true, size: true })
            .exec((res) => {
              const node = res && res[0] && res[0].node;
              if (!node) {
                reject(new Error('canvas not found'));
                return;
              }
              const ctx = node.getContext('2d');
              let dpr = 2;
              try {
                const wi = (typeof wx.getWindowInfo === 'function') ? wx.getWindowInfo() : null;
                dpr = wi && wi.pixelRatio ? wi.pixelRatio : 2;
              } catch (_) {}
              node.width = targetWidth * dpr;
              node.height = targetHeight * dpr;
              const img = node.createImage();
              img.onload = () => {
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                ctx.scale(dpr, dpr);
                ctx.clearRect(0, 0, targetWidth, targetHeight);
                ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
                wx.canvasToTempFilePath({
                  canvas: node,
                  width: targetWidth,
                  height: targetHeight,
                  destWidth: targetWidth,
                  destHeight: targetHeight,
                  quality: quality,
                  fileType: 'jpg',
                  success: (resp) => {
                    resolve(resp.tempFilePath);
                  },
                  fail: reject
                });
              };
              img.onerror = reject;
              img.src = imagePath;
            });
        },
        fail: reject
      });
    });
  },
  async checkAndAcceptParentPhoto(tempFilePath, articleId) {
    try {
      wx.showLoading({ title: '内容检测中...' });
      const compressedPath = await this.compressImageForCheck(tempFilePath);
      let contentType = 'image/jpeg';
      try {
        const info = await new Promise((resolve, reject) => {
          wx.getImageInfo({ src: compressedPath, success: resolve, fail: reject });
        });
        const t = String(info.type || '').toLowerCase();
        contentType = t === 'png' ? 'image/png' : 'image/jpeg';
      } catch (_) {}
      let tempUrl = '';
      let tempUploadResult = null;
      try {
        tempUploadResult = await wx.cloud.uploadFile({
          cloudPath: `temp_check/${Date.now()}_parent.${contentType === 'image/png' ? 'png' : 'jpg'}`,
          filePath: compressedPath
        });
      } catch (_) {}
      if (!tempUploadResult || !tempUploadResult.fileID) {
        try {
          const fs = wx.getFileSystemManager();
          const base64 = fs.readFileSync(compressedPath, 'base64');
          let baseCheck = null;
          try {
            baseCheck = await wx.cloud.callFunction({
              name: 'secureImageCheck',
              data: {
                action: 'checkImage',
                imageBuffer: base64,
                contentType: contentType
              }
            });
          } catch (_) {}
          const ok = baseCheck && baseCheck.result && baseCheck.result.success;
          if (!ok) {
          const isRisky = !!(baseCheck && baseCheck.result && baseCheck.result.data && baseCheck.result.data.status === 'risky');
          if (isRisky) {
            wx.hideLoading();
            this.setData({ parentTaskPhoto: '' });
            wx.showToast({ title: '图片内容不合规', icon: 'none', duration: 2500 });
            return;
          }
          // 尝试跨环境调用已验证的 imageCheck 作为兜底
          try {
            const c1 = new wx.cloud.Cloud({ resourceAppid: 'wx85d92d28575a70f4', resourceEnv: 'cloud1-1gsyt78b92c539ef' });
            await c1.init();
            const alt = await c1.callFunction({
              name: 'imageCheck',
              data: { action: 'checkImage', imageBuffer: base64, contentType: contentType }
            });
            if (alt && alt.result && alt.result.data && alt.result.data.status === 'risky') {
              wx.hideLoading();
              this.setData({ parentTaskPhoto: '' });
              wx.showToast({ title: '图片内容不合规', icon: 'none', duration: 2500 });
              return;
            }
            if (alt && alt.result && alt.result.success) {
              wx.hideLoading();
              await this.finalizeParentPhoto(tempFilePath, articleId);
              wx.showToast({ title: '图片安全，已选择', icon: 'success' });
              return;
            }
          } catch (_) {}
          wx.hideLoading();
          const msg = (baseCheck && baseCheck.result && baseCheck.result.message) ? baseCheck.result.message : '内容检测失败';
          await this.handleParentContentCheckUnavailable(tempFilePath, articleId, msg);
          return;
        }
          wx.hideLoading();
          await this.finalizeParentPhoto(tempFilePath, articleId);
          wx.showToast({ title: '图片安全，已选择', icon: 'success' });
          return;
        } catch (e) {
          wx.hideLoading();
          await this.handleParentContentCheckUnavailable(tempFilePath, articleId, (e && e.message) ? e.message : '检测异常');
          return;
        }
      }
      let checkResult;
      try {
        let useUrl = false;
        let tempUrl = '';
        try {
          const urlRes = await wx.cloud.getTempFileURL({ fileList: [tempUploadResult.fileID] });
          if (urlRes && urlRes.fileList && urlRes.fileList.length > 0 && urlRes.fileList[0].status === 0) {
            tempUrl = urlRes.fileList[0].tempFileURL || '';
            useUrl = !!tempUrl;
          }
        } catch (_) {}
        const payload = useUrl
          ? { action: 'checkImage', imageUrl: tempUrl, contentType: 'image/jpeg' }
          : { action: 'checkImage', fileID: tempUploadResult.fileID, contentType: contentType };
        checkResult = await wx.cloud.callFunction({ name: 'secureImageCheck', data: payload });
      } catch (err) {
        wx.hideLoading();
        await this.handleParentContentCheckUnavailable(tempFilePath, articleId, (err && err.message) ? err.message : '云函数调用失败');
        return;
      }
      try {
        console.log('parentTask imageCheck result:', JSON.stringify(checkResult, null, 2));
        if (articleId) {
          const payload = checkResult && checkResult.result ? checkResult.result : checkResult;
          wx.setStorageSync(`parent_task_last_check_result_${articleId}`, JSON.stringify(payload));
        }
      } catch (_) {}
      try {
        await wx.cloud.deleteFile({ fileList: [tempUploadResult.fileID] });
      } catch (_) {}
      if (!checkResult.result || !checkResult.result.success) {
        if (checkResult.result && checkResult.result.data && checkResult.result.data.status === 'risky') {
          wx.hideLoading();
          this.setData({ parentTaskPhoto: '' });
          wx.showToast({ title: '图片内容不合规', icon: 'none', duration: 2500 });
          return;
        }
        wx.hideLoading();
        const rc = (checkResult.result && (checkResult.result.errCode || checkResult.result.error || checkResult.result.errMsg)) ? JSON.stringify({ errCode: checkResult.result.errCode, errMsg: checkResult.result.errMsg || checkResult.result.error }) : '';
        const reason = (checkResult.result && checkResult.result.message) ? checkResult.result.message : (rc || '内容检测失败');
        // 兜底：尝试跨环境调用 imageCheck
        try {
          const c1 = new wx.cloud.Cloud({ resourceAppid: 'wx85d92d28575a70f4', resourceEnv: 'cloud1-1gsyt78b92c539ef' });
          await c1.init();
          const alt = await c1.callFunction({ name: 'imageCheck', data: payload });
          if (alt && alt.result && alt.result.data && alt.result.data.status === 'risky') {
            wx.hideLoading();
            this.setData({ parentTaskPhoto: '' });
            wx.showToast({ title: '图片内容不合规', icon: 'none', duration: 2500 });
            return;
          }
          if (alt && alt.result && alt.result.success) {
            wx.hideLoading();
            await this.finalizeParentPhoto(tempFilePath, articleId);
            wx.showToast({ title: '图片安全，已选择', icon: 'success' });
            return;
          }
        } catch (_) {}
        await this.handleParentContentCheckUnavailable(tempFilePath, articleId, reason);
        return;
      }
      wx.hideLoading();
      await this.finalizeParentPhoto(tempFilePath, articleId);
      wx.showToast({ title: '图片安全，已选择', icon: 'success' });
    } catch (error) {
      wx.hideLoading();
      await this.handleParentContentCheckUnavailable(tempFilePath, articleId, (error && error.message) ? error.message : '检测异常');
    }
  },
  async handleParentContentCheckUnavailable(tempFilePath, articleId, reason) {
    return new Promise((resolve) => {
      let msg = reason || '服务暂不可用';
      if (typeof msg === 'string') {
        const r = msg.toLowerCase();
        if (r.includes('-604101') || r.includes('no permission') || r.includes('permission')) {
          msg = '云函数权限未配置或未重新部署';
        } else if (r.includes('function not found')) {
          msg = '云函数未上传或未部署';
        } else if (r.includes('invalid_env')) {
          msg = '云环境配置错误';
        } else if (r.includes('cannot read property') && r.includes('result')) {
          msg = '云函数返回为空，请检查部署或入参';
        }
      }
      wx.showModal({
        title: '内容检测不可用',
        content: msg ? ('服务暂不可用：' + msg + '。可稍后重试或跳过检测使用本地照片。') : '服务暂不可用，可稍后重试或跳过检测使用本地照片。',
        confirmText: '跳过检测',
        cancelText: '稍后重试',
        success: (res) => {
          if (res.confirm) {
            this.finalizeParentPhoto(tempFilePath, articleId);
            if (articleId) wx.setStorageSync(`parent_task_check_skipped_${articleId}`, 1);
            wx.showToast({ title: '已选择照片', icon: 'success' });
            resolve();
          } else {
            resolve();
          }
        }
      });
    });
  },
  async submitParentTask() {
    getApp().playClickSound();
    const id = this.data.article && this.data.article.id;
    if (!this.data.parentTaskPhoto) {
      wx.showToast({ title: '请先拍照打卡', icon: 'none' });
      return;
    }
    this.setData({ parentTaskSubmitted: true, parentBadgeEarned: true });
    if (id) {
      wx.setStorageSync(`parent_task_submitted_${id}`, 1);
      wx.setStorageSync(`parent_badge_${id}`, 1);
      try {
        const info = wx.getStorageSync('userInfo') || {};
        const userId = info && info.userId ? info.userId : '';
        if (userId) {
          const c1 = new wx.cloud.Cloud({ resourceAppid: 'wx85d92d28575a70f4', resourceEnv: 'cloud1-1gsyt78b92c539ef' });
          await c1.init();
          const db = c1.database();
          const exist = await db.collection('spring_user_medals').where({ userId, articleId: id }).limit(1).get();
          const found = exist && exist.data && exist.data.length > 0;
          if (!found) {
            await db.collection('spring_user_medals').add({
              data: {
                userId,
                articleId: id,
                articleTitle: (this.data.article && this.data.article.title) ? this.data.article.title : '',
                medal: (this.data.article && this.data.article.medal) ? this.data.article.medal : '',
                source: 'parent_task',
                acquiredAt: Date.now()
              }
            });
            this.setData({ parentBadgeAcquiredAtStr: this.formatTimestamp(Date.now()) });
          } else {
            const at = exist.data[0].acquiredAt || 0;
            this.setData({ parentBadgeAcquiredAtStr: this.formatTimestamp(at) });
          }
        }
      } catch (_) {}
    }
    // 移除提交成功提示
  },
  async loadParentMedalAcquiredAt() {
    try {
      const id = this.data.article && this.data.article.id;
      const info = wx.getStorageSync('userInfo') || {};
      const userId = info && info.userId ? info.userId : '';
      if (!id || !userId) return;
      const c1 = new wx.cloud.Cloud({ resourceAppid: 'wx85d92d28575a70f4', resourceEnv: 'cloud1-1gsyt78b92c539ef' });
      await c1.init();
      const db = c1.database();
      const res = await db.collection('spring_user_medals').where({ userId, articleId: id }).limit(1).get();
      const doc = res && res.data && res.data[0] ? res.data[0] : null;
      if (doc && doc.acquiredAt) {
        this.setData({ parentBadgeAcquiredAtStr: this.formatTimestamp(doc.acquiredAt) });
      }
    } catch (_) {}
  },
  selectQuizOption(e) {
    getApp().playClickSound();
    const v = e.currentTarget.dataset.value || '';
    this.setData({ quizSelected: v });
  },
  async submitQuiz() {
    getApp().playClickSound();
    const id = this.data.article && this.data.article.id;
    if (!this.data.quizSelected) {
      if (getApp && getApp().playClickSound) getApp().playClickSound();
      wx.showToast({ title: '请选择答案', icon: 'none' });
      return;
    }
    const answerIndex = (this.data.article && typeof this.data.article.qaAnswer !== 'undefined') ? this.data.article.qaAnswer : 0;
    const map = { A: 0, B: 1, C: 2, D: 3 };
    const sel = this.data.quizSelected;
    const correct = map.hasOwnProperty(sel) && map[sel] === answerIndex;
    if (correct) {
      this.setData({ showTreasureReady: true, showTreasureCard: false, treasureCardType: 'success' });
      if (getApp && getApp().playClickSound) getApp().playClickSound();
      wx.showToast({ title: '宝盒已开启', icon: 'success' });
      this.setData({ showQuizModal: false });
    } else {
      try {
        let url = this.data.errorCardUrl;
        const fid = this.data.errorCardCloudId || '';
        if (!url && fid && fid.indexOf('cloud://') === 0) {
          const c1 = new wx.cloud.Cloud({ resourceAppid: 'wx85d92d28575a70f4', resourceEnv: 'cloud1-1gsyt78b92c539ef' });
          await c1.init();
          const tmp = await c1.getTempFileURL({ fileList: [fid], config: { maxAge: 10800 } });
          const fl = tmp.fileList || [];
          if (fl.length && fl[0].status === 0) url = fl[0].tempFileURL;
        }
        this.setData({ errorCardUrl: url || '', treasureUnlocked: false, showTreasureCard: true, treasureCardType: 'fail' });
      } catch (e) {
        this.setData({ treasureUnlocked: false, showTreasureCard: true, treasureCardType: 'fail' });
      }
    }
  },
  startQuiz() {
    getApp().playClickSound();
    this.setData({ showQuizModal: true, quizSelected: '' });
  },
  closeQuiz() {
    getApp().playClickSound();
    this.setData({ showQuizModal: false });
  },
  async openTreasureBox() {
    getApp().playClickSound();
    if (this.data.treasureCardType === 'success') {
      try {
        let url = this.data.successCardUrl;
        const fid = this.data.successCardCloudId || '';
        if (!url && fid && fid.indexOf('cloud://') === 0) {
          const c1 = new wx.cloud.Cloud({ resourceAppid: 'wx85d92d28575a70f4', resourceEnv: 'cloud1-1gsyt78b92c539ef' });
          await c1.init();
          const tmp = await c1.getTempFileURL({ fileList: [fid], config: { maxAge: 10800 } });
          const fl = tmp.fileList || [];
          if (fl.length && fl[0].status === 0) url = fl[0].tempFileURL;
        }
        const id = this.data.article && this.data.article.id;
        this.setData({ successCardUrl: url || '', showTreasureReady: false, showTreasureCard: true, treasureUnlocked: true });
        if (id) {
          wx.setStorageSync(`treasure_${id}`, 1);
        }
      } catch (e) {
        this.setData({ showTreasureReady: false, showTreasureCard: true, treasureUnlocked: true });
      }
    }
  },
  closeTreasure() {
    getApp().playClickSound();
    this.setData({ showTreasureCard: false, showTreasureReady: false });
  },
  noop() {
    return;
  },
  onMailboxInput(e) {
    const val = (e.detail && e.detail.value) || '';
    if (val.length > 45) {
      wx.showToast({ title: '最多只能写45个字哦', icon: 'none' });
    }
    this.setData({ mailboxInput: val.substring(0, 45) });
  },
  addMailboxMessage() {
    getApp().playClickSound();
    const id = this.data.article && this.data.article.id;
    const val = (this.data.mailboxInput || '').trim();
    if (!val) {
      if (getApp && getApp().playClickSound) getApp().playClickSound();
      wx.showToast({ title: '请输入留言', icon: 'none' });
      return;
    }
    const list = (this.data.mailboxMessages || []).slice();
    list.unshift({ text: val, time: Date.now() });
    this.setData({ 
      mailboxMessages: list, 
      mailboxInput: '',
      hasCommented: true,
      myComment: list[0]
    });
    this.updateMailboxView();
    if (id) wx.setStorageSync(`mailbox_${id}`, list);
    
    // 保存到本地存储，供打印页使用
    wx.setStorageSync('userNote', val);

    if (getApp && getApp().playClickSound) getApp().playClickSound();
    wx.showToast({ title: '已留言', icon: 'success' });
  },
  updateMailboxView() {
    const list = (this.data.mailboxMessages || []).slice();
    const mapped = list.map(it => ({
      ...it,
      timeStr: this.formatTimestamp(it.time)
    }));
    this.setData({ mailboxMessagesView: mapped });
  },
  onGoalInput(e) {
    this.setData({ newGoalText: e.detail.value || '' });
  },
  addGoal() {
    getApp().playClickSound();
    const id = this.data.article && this.data.article.id;
    const val = (this.data.newGoalText || '').trim();
    if (!val) {
      if (getApp && getApp().playClickSound) getApp().playClickSound();
      wx.showToast({ title: '请输入目标', icon: 'none' });
      return;
    }
    const goals = (this.data.goals || []).slice();
    goals.unshift({ text: val, done: false, time: Date.now() });
    this.setData({ goals, newGoalText: '' });
    if (id) wx.setStorageSync(`goals_${id}`, goals);
    wx.showToast({ title: '目标已添加', icon: 'success' });
  },
  toggleGoalDone(e) {
    getApp().playClickSound();
    const idx = parseInt(e.currentTarget.dataset.index);
    const id = this.data.article && this.data.article.id;
    const goals = (this.data.goals || []).slice();
    if (isNaN(idx) || idx < 0 || idx >= goals.length) return;
    goals[idx].done = !goals[idx].done;
    this.setData({ goals });
    if (id) wx.setStorageSync(`goals_${id}`, goals);
  },

  /**
   * 初始化Canvas
   */
  initCanvas() {
     this.setData({ isCanvasLoading: true });
     const query = wx.createSelectorQuery();
     query.select('#coloringCanvas')
       .fields({ node: true, size: true })
       .exec((res) => {
         if (!res[0]) {
           console.error('Canvas node not found');
           this.setData({ isCanvasLoading: false });
           return;
         }
         
         const canvas = res[0].node;
         const ctx = canvas.getContext('2d');
         let dpr = 2;
         try {
           const wi = (typeof wx.getWindowInfo === 'function') ? wx.getWindowInfo() : null;
           dpr = wi && wi.pixelRatio ? wi.pixelRatio : 2;
         } catch (_) {}
         
         // 获取容器宽度
         const width = res[0].width;
         // 初始高度先设置一个值，后面会根据图片比例调整
         
         this.canvas = canvas;
         this.ctx = ctx;
         this.dpr = dpr;

         const img = canvas.createImage();
         img.onload = () => {
            console.log('Canvas image loaded successfully');
            // 计算图片宽高比
            const aspectRatio = img.height / img.width;
            const height = width * aspectRatio;
            
            // 设置Canvas物理尺寸
            canvas.width = width * dpr;
            canvas.height = height * dpr;
            
            // 更新Canvas显示高度
            this.setData({
              canvasHeight: height,
              isCanvasLoading: false
            });

            ctx.scale(dpr, dpr);
             ctx.drawImage(img, 0, 0, width, height);
             
             // 保存原始图像数据用于重置
             try {
               this.originalImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
             } catch (e) {
               console.error('Failed to getImageData, coloring might not work', e);
             }
          };
         img.onerror = (err) => {
           console.error('Canvas image load failed', err);
           this.setData({ isCanvasLoading: false });
           wx.showToast({
             title: '图片加载失败',
             icon: 'none'
           });
         };
         console.log('Loading image for canvas:', this.data.article.a4Image);
         img.src = this.data.article.a4Image;
       });
   },

  /**
   * 选择颜色
   */
  selectColor(e) {
    getApp().playClickSound();
    const color = e.currentTarget.dataset.color;
    this.setData({
      selectedColor: color
    });
  },

  /**
    * Canvas点击事件
    */
   onCanvasTap(e) {
    if (!this.data.canPaint) return;
    if (!this.canvas || !this.ctx) return;
    getApp().playClickSound();
     
     // 增加防抖，避免频繁点击导致性能问题
     const now = Date.now();
     if (this.lastTapTime && now - this.lastTapTime < 300) return;
     this.lastTapTime = now;

     console.log('Canvas tapped', e.detail);
     const x = e.detail.x;
     const y = e.detail.y;
     
     // 获取canvas在页面中的位置
     const query = wx.createSelectorQuery();
     query.select('#coloringCanvas').boundingClientRect(rect => {
       const touchX = (x - rect.left) * this.dpr;
       const touchY = (y - rect.top) * this.dpr;
       
       console.log('Touch pos (px):', x, y);
       console.log('Canvas pos (px):', touchX, touchY);
       
       this.floodFill(Math.round(touchX), Math.round(touchY), this.data.selectedColor);
     }).exec();
   },

   /**
    * 泛洪填充算法
    */
   floodFill(startX, startY, fillColorHex) {
     const ctx = this.ctx;
     const canvas = this.canvas;
     const width = canvas.width;
     const height = canvas.height;
     
     console.log('Start floodFill at:', startX, startY, 'Color:', fillColorHex);

     // 获取当前画布数据
     let imageData;
     try {
        imageData = ctx.getImageData(0, 0, width, height);
     } catch (e) {
        console.error('Failed to get image data for flood fill', e);
        wx.showToast({
          title: '无法获取画布数据',
          icon: 'none'
        });
        return;
     }
     
     const data = imageData.data;
     
     // 获取点击位置的颜色
     const startPos = (startY * width + startX) * 4;
     const startR = data[startPos];
     const startG = data[startPos + 1];
     const startB = data[startPos + 2];
     const startA = data[startPos + 3];
     
     console.log('Start color:', startR, startG, startB, startA);

     // 目标颜色
     const rgb = this.hexToRgb(fillColorHex);
     const fillR = rgb.r;
     const fillG = rgb.g;
     const fillB = rgb.b;
     const fillA = 255;

     // 如果点击颜色和填充颜色相同，或者点击的是黑色线条（假设阈值），则不填充
     if (startR === fillR && startG === fillG && startB === fillB) {
        console.log('Color is same, skip filling');
        return;
     }
     
     // 简单的颜色距离判断，如果是黑色或深色线条，则不填充
     // 调高一点阈值，避免某些灰色线条被填充
     if (startR < 100 && startG < 100 && startB < 100) {
        console.log('Clicked on dark line, skip filling');
        return;
     }

     const tolerance = 50; // 颜色容差
     
     const matchStartColor = (pos) => {
       const r = data[pos];
       const g = data[pos + 1];
       const b = data[pos + 2];
       return Math.abs(r - startR) < tolerance && 
              Math.abs(g - startG) < tolerance && 
              Math.abs(b - startB) < tolerance;
     };

     const colorPixel = (pos) => {
       data[pos] = fillR;
       data[pos + 1] = fillG;
       data[pos + 2] = fillB;
       data[pos + 3] = fillA;
     };

     const queue = [[startX, startY]];
     const visited = new Set(); 
     // 使用 Int32Array 优化 visited 检查 (width * height)
     // 但为了简化代码且 Canvas 通常不大，Set 也可以，或者直接用 data 标记（不可行因为要对比颜色）
     // 这里用 Set 存储 `${cx},${cy}` 字符串效率较低，改为一维索引
     const visitedArr = new Uint8Array(width * height);
     
     let count = 0;
     const maxPixels = width * height; // 防止死循环

     while (queue.length > 0) {
       const [cx, cy] = queue.shift();
       const pixelIndex = cy * width + cx;
       
       if (cx < 0 || cx >= width || cy < 0 || cy >= height) continue;
       if (visitedArr[pixelIndex]) continue;
       
       const pos = pixelIndex * 4;

       if (matchStartColor(pos)) {
         colorPixel(pos);
         visitedArr[pixelIndex] = 1;
         count++;
         
         if (count > maxPixels) break; 

         queue.push([cx + 1, cy]);
         queue.push([cx - 1, cy]);
         queue.push([cx, cy + 1]);
         queue.push([cx, cy - 1]);
       }
     }
     
     console.log('Filled pixels:', count);
     ctx.putImageData(imageData, 0, 0);
   },

  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload: function () {
    if (this.data.audioContext) {
      this.data.audioContext.stop();
      this.data.audioContext.destroy();
    }
    this.stopReminderTicker();
    if (this.data.isAnimating) {
      this.closeAnimation();
    }
    if (this.avatarTipTimer) {
      clearTimeout(this.avatarTipTimer);
      this.avatarTipTimer = null;
    }
  },

  /**
   * 播放音频
   */
  playAudio: function (e) {
    getApp().playClickSound();
    const { url, type } = e.currentTarget.dataset;
    if (!url) {
      wx.showToast({
        title: '暂无音频',
        icon: 'none'
      });
      return;
    }

    // 如果点击的是当前正在播放的音频
    if (this.data.playingType === type && this.data.audioContext) {
      if (this.data.isPlaying) {
        this.data.audioContext.pause();
        this.setData({ isPlaying: false, isPaused: true });
      } else {
        this.data.audioContext.play();
        this.setData({ isPlaying: true, isPaused: false });
      }
      return;
    }

    // 如果是新的音频，先销毁旧的（或者停止旧的）
    if (this.data.audioContext) {
      this.data.audioContext.stop();
    } else {
      // 首次创建
      this.data.audioContext = wx.createInnerAudioContext();
      this.data.audioContext.onPlay(() => {
        getApp().stopBGM();
        this.setData({ isPlaying: true, isPaused: false });
      });
      this.data.audioContext.onPause(() => {
        getApp().playBGM();
        this.setData({ isPlaying: false, isPaused: true });
      });
      this.data.audioContext.onStop(() => {
        getApp().playBGM();
        this.setData({ isPlaying: false, isPaused: false });
      });
      this.data.audioContext.onEnded(() => {
        getApp().playBGM();
        this.setData({ isPlaying: false, isPaused: false, sheepX: 0, sheepY: 0 });
      });
      this.data.audioContext.onError((res) => {
        getApp().playBGM();
        console.error('播放失败', res);
        this.setData({ isPlaying: false, isPaused: false });
        wx.showToast({
          title: '播放失败',
          icon: 'none'
        });
      });
      this.data.audioContext.onTimeUpdate(() => {
        if (this.data.playingType === 'qa') {
           const ctx = this.data.audioContext;
           if (ctx && ctx.duration > 0) {
               if (!this.data.cardWidth) {
                   this.getQaCardDimensions();
               }
               this.updateSheepPosition(ctx.currentTime / ctx.duration);
           }
        }
      });
    }

    // 播放新音频
    this.data.audioContext.src = url;
    this.data.audioContext.play();
    this.setData({
      playingType: type,
      isPlaying: true,
      isPaused: false
    });
    
    if (type === 'qa') {
        this.getQaCardDimensions();
    }
  },

  toggleQaAudio() {
    getApp().playClickSound();
    const audioUrl = this.data.article && this.data.article.contentAudio;
    if (!audioUrl) {
      wx.showToast({ title: '暂无音频', icon: 'none' });
      return;
    }
    if (this.data.isPlaying && this.data.playingType === 'qa') {
      this.data.audioContext.pause();
      this.setData({ isPlaying: false, isPaused: true });
    } else if (this.data.isPaused && this.data.playingType === 'qa') {
      this.data.audioContext.play();
      this.setData({ isPlaying: true, isPaused: false });
    } else {
      // 模拟事件对象调用 playAudio
      this.playAudio({ currentTarget: { dataset: { url: audioUrl, type: 'qa' } } });
    }
  },

  getQaCardDimensions() {
    const query = wx.createSelectorQuery();
    query.select('.qa-panel .qa-article-meta').boundingClientRect((rect) => {
      if (rect) {
        this.setData({
          cardWidth: rect.width,
          cardHeight: rect.height
        });
      }
    }).exec();
  },

  updateSheepPosition(progress) {
    const { cardWidth: w, cardHeight: h } = this.data;
    if (!w || !h) return;
    
    const perimeter = 2 * (w + h);
    const distance = progress * perimeter;
    
    let x = 0;
    let y = 0;
    let rotate = 0;
    let scaleX = 1;
    const offset = 8; // Distance from center to edge (px)
    
    if (distance <= w) {
      // Top edge: moving right
      x = distance;
      y = -offset;
      rotate = 0;
      scaleX = 1; // Normal
    } else if (distance <= w + h) {
      // Right edge: moving down
      x = w + offset;
      y = distance - w;
      rotate = 90;
      scaleX = 1;
    } else if (distance <= 2 * w + h) {
      // Bottom edge: moving left
      x = w - (distance - w - h);
      y = h + offset;
      rotate = 180;
      scaleX = 1;
    } else {
      // Left edge: moving up
      x = -offset;
      y = h - (distance - 2 * w - h);
      rotate = -90;
      scaleX = 1;
    }
    
    this.setData({ sheepX: x, sheepY: y, sheepRotate: rotate, sheepScaleX: scaleX });
  },

  /**
   * 切换风格
   */
  switchStyle: function (e) {
    getApp().playClickSound();
    const styleIndex = parseInt(e.currentTarget.dataset.index);
    const requiresVip = this.data.article && this.data.article.isCarousel === false;
    const isVip = this.isVipValid();
    if (requiresVip && !isVip && styleIndex !== 0) {
      this.showVipModal();
      this.setData({
        currentStyleIndex: 0
      });
      return;
    }

    this.setData({
      currentStyleIndex: styleIndex
    });

    if (styleIndex === 3) {
      const now = new Date();
      const yy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const curDate = `${yy}-${mm}-${dd}`;
      const cur = {};
      if (!this.data.selectedDate) cur.selectedDate = curDate;
      if (Object.keys(cur).length) this.setData(cur);
    }
  },

  /**
   * 切换字体大小
   */
  toggleFontSize: function () {
    getApp().playClickSound();
    const fontSizes = ['小', '中', '大'];
    const newFontSizeIndex = (this.data.fontSizeIndex + 1) % 3;
    this.setData({
      fontSizeIndex: newFontSizeIndex
    });

    wx.showToast({
      title: `字体大小：${fontSizes[newFontSizeIndex]}`,
      icon: 'none',
      duration: 1500
    });
  },

  /**
   * 切换收藏状态
   */
  toggleFavorite: function () {
    getApp().playClickSound();
    const article = this.data.article;
    if (!article || !article.id) return;

    // 注入 cardType 信息
    const cardType = this.data.isSmallCard ? 'small' : 'main';
    const articleToSave = {
      ...article,
      cardType: cardType
    };

    const isFavorited = favoriteManager.toggle(articleToSave, 'article');
    
    this.setData({
      isFavorited: isFavorited
    });

    wx.showToast({
      title: isFavorited ? '已收藏' : '已取消收藏',
      icon: 'none',
      duration: 1500
    });
  },
  normalizeBoolean(v) {
    if (v === undefined || v === null) return null;
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v !== 0;
    const s = String(v).trim().toLowerCase();
    if (s === 'false' || s === '0' || s === 'no' || s === 'n' || s === '') return false;
    if (s === 'true' || s === '1' || s === 'yes' || s === 'y') return true;
    return !!v;
  },
  isVipValid() {
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
  parseDateString(str) {
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
  showVipModal() {
    if (getApp && getApp().playClickSound) getApp().playClickSound();
    wx.showModal({
      title: '会员专属',
      content: '开通会员即可解锁全部内容与功能',
      confirmText: '去开通',
      cancelText: '再看看',
      success: (res) => {
        if (getApp && getApp().playClickSound) getApp().playClickSound();
        if (res.confirm) {
          this.goVip();
        }
      }
    });
  },
  goVip() {
    wx.navigateTo({
      url: '/pages/vip/vip'
    });
  },

  goToPrint: function () {
    getApp().playClickSound && getApp().playClickSound();
    const article = this.data.article;
    if (!article || !article.id) {
      if (getApp && getApp().playClickSound) getApp().playClickSound();
      wx.showToast({ title: '暂无文章', icon: 'none' });
      return;
    }
    const aid = article.id;
    const parentPhoto = this.data.parentTaskPhoto || wx.getStorageSync(`parent_task_photo_url_${aid}`) || wx.getStorageSync(`parent_task_photo_${aid}`) || this.data.parentTaskPhotoFileId || wx.getStorageSync(`parent_task_photo_fileid_${aid}`);
    if (!parentPhoto) {
      wx.showToast({ title: '请先完成亲子任务拍照打卡', icon: 'none' });
      return;
    }
    const mailbox = wx.getStorageSync(`mailbox_${aid}`) || [];
    const hasMailbox = (this.data.hasCommented && this.data.myComment && this.data.myComment.text) || (Array.isArray(mailbox) && mailbox.length > 0 && mailbox[0] && mailbox[0].text);
    if (!hasMailbox) {
      wx.showToast({ title: '请先在心语信箱留言', icon: 'none' });
      return;
    }
    const remindersLocal = this.data.reminders || [];
    const remindersStorage = wx.getStorageSync(`reminders_${aid}`) || [];
    const hasReminders = (Array.isArray(remindersLocal) && remindersLocal.length > 0) || (Array.isArray(remindersStorage) && remindersStorage.length > 0);
    if (!hasReminders) {
      wx.showToast({ title: '请先添加成长目标提醒', icon: 'none' });
      return;
    }
    // 传递封面链接
    const coverUrl = encodeURIComponent(article.cover || article.image || article.img || article.poster || '');
    wx.navigateTo({
      url: `/pages/print/print?articleId=${article.id}&coverUrl=${coverUrl}`
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
    const avatar = wx.getStorageSync('currentAvatar') || '';
    if (avatar && avatar !== this.data.currentAvatar) this.setData({ currentAvatar: avatar });
    this.loadReminders();
    this.startReminderTicker();
    this.updateMailboxView();
  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide: function () {
    if (this.data.audioContext) {
      this.data.audioContext.stop();
    }
    this.setData({ isPlaying: false });
    this.stopReminderTicker();
    if (this.data.isAnimating) {
      this.closeAnimation();
    }
    if (this.avatarTipTimer) {
      clearTimeout(this.avatarTipTimer);
      this.avatarTipTimer = null;
    }
  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload: function () {
    if (this.data.audioContext) {
      this.data.audioContext.stop();
      this.data.audioContext.destroy();
    }
    // 确保离开页面时背景音乐恢复
    getApp().playBGM();
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
   * 点击小卡片默认形象PNG
   */
  onDefaultImageTap: function () {
    getApp().playClickSound();
    console.log('Default image tapped, showing tip label');
    const that = this;
    this.setData({
      showTipLabel: true
    });

    // 3秒后自动隐藏便签
    setTimeout(function() {
      that.setData({
        showTipLabel: false
      });
    }, 3000);
  },

  openWorryModal: function () {
    getApp().playClickSound();
    if (this.avatarTipTimer) {
      clearTimeout(this.avatarTipTimer);
      this.avatarTipTimer = null;
    }
    this.setData({
      showWorryModal: true,
      worryText: '',
      showAvatarTip: false
    });
  },

  closeWorryModal: function () {
    getApp().playClickSound();
    this.setData({
      showWorryModal: false
    });
  },

  stopProp: function () {
    return;
  },

  onWorryInput: function (e) {
    this.setData({
      worryText: e.detail.value
    });
  },

  submitWorry: function () {
    getApp().playClickSound();
    const text = this.data.worryText;
    if (!text.trim()) {
      wx.showToast({
        title: '请写下你的烦恼...',
        icon: 'none'
      });
      return;
    }
    // 保存到本地存储，供打印页使用
    wx.setStorageSync('latestWorryText', text);
    
    this.closeWorryModal();
    this.startWorryAnimation(text);
  },

  startWorryAnimation: function (text) {
    const chars = text.split('');
    const totalChars = chars.length;
    const sheepAnimDuration = 12;
    const startLeft = -75;
    const endLeft = 120;
    const totalDist = endLeft - startLeft;
    const speed = totalDist / sheepAnimDuration;
    const startTime = 3.5;
    const endTime = 9.5;
    const timeWindow = endTime - startTime;

    const fallingChars = chars.map((char, index) => {
      const progress = index / totalChars;
      const impactTime = startTime + (progress * timeWindow) + (Math.random() * 0.5 - 0.25);
      const sheepLeft = startLeft + speed * impactTime;
      const textLeft = sheepLeft + 35;
      const duration = (Math.random() * 0.5 + 2).toFixed(2);
      const numDuration = parseFloat(duration);
      const fallTime = numDuration * 0.6;
      let delay = impactTime - fallTime;
      if (delay < 0) delay = 0;
      return {
        char: char,
        size: Math.floor(Math.random() * 40) + 30,
        left: textLeft.toFixed(2),
        duration: duration,
        delay: delay.toFixed(2),
        bounceDir: Math.random() > 0.5 ? 1 : -1
      };
    });

    const randomQuote = this.data.encouragingQuotes[Math.floor(Math.random() * this.data.encouragingQuotes.length)];

    if (this.worryAudio) {
      this.worryAudio.stop();
      this.worryAudio.destroy();
      this.worryAudio = null;
    }
    if (this.bounceTimers) {
      this.bounceTimers.forEach(t => clearTimeout(t));
    }
    this.bounceTimers = [];
    if (this.bounceAudios) {
      this.bounceAudios.forEach(ctx => ctx.destroy());
    }
    this.bounceAudios = [];

    fallingChars.forEach(item => {
      const duration = parseFloat(item.duration);
      const delay = parseFloat(item.delay);
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
      showEncouragingText: false
    });

    setTimeout(() => {
      if (this.worryAudio) {
        this.worryAudio.stop();
        this.worryAudio.destroy();
        this.worryAudio = null;
      }
      this.setData({
        showEncouragingText: true
      });
    }, sheepAnimDuration * 1000);

    setTimeout(() => {
      if (this.data.isAnimating) {
        this.closeAnimation();
      }
    }, 18000);
  },

  closeAnimation: function () {
    getApp().playClickSound && getApp().playClickSound();
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

  initRecord: function () {
    const that = this;
    try {
      const plugin = requirePlugin('WechatSI');
      const manager = plugin.getRecordRecognitionManager();
      manager.onStart = function () {
        if (getApp && getApp().playClickSound) getApp().playClickSound();
        wx.showToast({
          title: '正在聆听...',
          icon: 'none',
          duration: 30000
        });
      };
      manager.onRecognize = function () {};
      manager.onStop = function (res) {
        wx.hideToast();
        if (res.result) {
          const tgt = that.data.recordTarget || '';
          if (tgt === 'reminder') {
            const currentText = that.data.reminderContent || '';
            that.setData({
              reminderContent: currentText + res.result,
              isRecording: false
            });
          } else {
            const currentText = that.data.worryText || '';
            that.setData({
              worryText: currentText + res.result,
              isRecording: false
            });
          }
        } else {
          that.setData({ isRecording: false });
          if (getApp && getApp().playClickSound) getApp().playClickSound();
          wx.showToast({ title: '未识别到内容', icon: 'none' });
        }
      };
      manager.onError = function () {
        wx.hideToast();
        that.setData({ isRecording: false });
        if (getApp && getApp().playClickSound) getApp().playClickSound();
        wx.showToast({ title: '语音识别失败', icon: 'none' });
      };
      that.recordManager = manager;
    } catch (e) {
      wx.showToast({ title: '语音插件未加载', icon: 'none' });
    }
  },

  startRecord: function () {
    getApp().playClickSound();
    const that = this;
    this.setData({ recordTarget: 'worry' });
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
              });
            }
          });
        } else {
          that._startRecordAction();
        }
      }
    });
  },

  startReminderRecord: function () {
    getApp().playClickSound();
    const that = this;
    this.setData({ recordTarget: 'reminder' });
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
              });
            }
          });
        } else {
          that._startRecordAction();
        }
      }
    });
  },

  _startRecordAction: function () {
    if (this.data.isRecording) return;
    this.setData({ isRecording: true });
    if (this.recordManager) {
      try {
        this.recordManager.start({ duration: 30000, lang: 'zh_CN' });
      } catch (e) {
        this.setData({ isRecording: false });
      }
    } else {
      wx.showToast({ title: '语音插件未加载', icon: 'none' });
      this.setData({ isRecording: false });
    }
  },

  stopRecord: function () {
    getApp().playClickSound && getApp().playClickSound();
    if (!this.data.isRecording) return;
    if (this.recordManager) {
      try {
        this.recordManager.stop();
      } catch (e) {}
    }
    this.setData({ isRecording: false });
  },

  toggleReminderRecord: function () {
    if (this.data.isRecording) {
      this.stopRecord();
    } else {
      this.startReminderRecord();
    }
  },

  onCharacterTap: function () {
    if (getApp().playClickSound) getApp().playClickSound();
    const quotes = this.data.encouragingQuotes || [];
    const text = quotes.length ? quotes[Math.floor(Math.random() * quotes.length)] : '你好呀～';
    if (this.avatarTipTimer) {
      clearTimeout(this.avatarTipTimer);
      this.avatarTipTimer = null;
    }
    this.setData({
      showAvatarTip: true,
      avatarTipText: text
    });
    this.avatarTipTimer = setTimeout(() => {
      this.setData({ showAvatarTip: false });
      this.avatarTipTimer = null;
    }, 2500);
  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage: function () {

  }
})

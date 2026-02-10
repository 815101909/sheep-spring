Page({
  data: {
    songId: '',
    printImages: [],
    printCards: [],
    currentIndex: 0
  },
  onLoad: async function (options) {
    const songId = options.songId || '';
    if (!songId) {
      wx.showToast({ title: '缺少歌曲ID', icon: 'none' });
      return;
    }
    this.setData({ songId });
    wx.setNavigationBarTitle({ title: '打印预览' });
    await this.loadPrintImages(songId);
  },
  loadPrintImages: async function (songId) {
    wx.showLoading({ title: '加载中...' });
    try {
      const c1 = new wx.cloud.Cloud({
        resourceAppid: 'wx85d92d28575a70f4',
        resourceEnv: 'cloud1-1gsyt78b92c539ef',
      });
      await c1.init();
      const db = c1.database();
      const res = await db.collection('spring_music_library').doc(songId).get();
      const data = res.data || {};
      let images = [];
      if (Array.isArray(data.print)) {
        images = data.print.filter(Boolean);
      } else if (data.print) {
        images = [data.print];
      }
      const fileListToConvert = (images || []).filter(u => typeof u === 'string' && u.startsWith('cloud://'));
      if (fileListToConvert.length > 0) {
        try {
          const tempRes = await c1.getTempFileURL({
            fileList: fileListToConvert,
            config: { maxAge: 3 * 60 * 60 }
          });
          const map = {};
          (tempRes.fileList || []).forEach(item => {
            if (item.status === 0) map[item.fileID] = item.tempFileURL;
          });
          images = images.map(u => (map[u] ? map[u] : u));
        } catch (_) {}
      }
      const captions = ['Memory /  Srpingtime', 'Memory /  With you forever'];
      const cards = images.map((url, idx) => ({ url, caption: captions[idx % 2] }));
      this.setData({ printImages: images, printCards: cards, currentIndex: 0 });
    } catch (err) {
      console.error('加载图片失败', err);
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },
  previewImage: function (e) {
    const url = (e && e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.url);
    if (!url) return;
    const urls = (this.data.printImages && this.data.printImages.length) ? this.data.printImages : [url];
    wx.previewImage({ current: url, urls });
  },
  onPrev: function() {
    if (this.data.currentIndex > 0) {
      this.setData({
        currentIndex: this.data.currentIndex - 1
      });
    } else {
      wx.showToast({ title: '已经是第一张了', icon: 'none' });
    }
  },
  onNext: function() {
    if (this.data.currentIndex < this.data.printCards.length - 1) {
      this.setData({
        currentIndex: this.data.currentIndex + 1
      });
    } else {
      wx.showToast({ title: '已经是最后一张了', icon: 'none' });
    }
  }
})

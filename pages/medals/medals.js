Page({
  data: {
    loading: false,
    totalCount: 0,
    medals: []
  },
  onLoad: function () {
    this.loadMedals();
  },
  onShow: function () {
  },
  async loadMedals() {
    this.setData({ loading: true });
    try {
      const user = wx.getStorageSync('userInfo') || {};
      const uid = user && user.userId ? user.userId : '';
      if (!uid) {
        this.setData({ medals: [], totalCount: 0 });
        return;
      }
      const c1 = new wx.cloud.Cloud({ resourceAppid: 'wx85d92d28575a70f4', resourceEnv: 'cloud1-1gsyt78b92c539ef' });
      await c1.init();
      const db = c1.database();
      const res = await db.collection('spring_user_medals').where({ userId: uid }).orderBy('acquiredAt', 'desc').get();
      const docs = (res && res.data) ? res.data : [];
      const fileIds = [];
      for (let i = 0; i < docs.length; i++) {
        const m = docs[i];
        const fid = m.medal || '';
        if (typeof fid === 'string' && fid.indexOf('cloud://') === 0) fileIds.push(fid);
      }
      let urlMap = {};
      if (fileIds.length) {
        try {
          const tmp = await c1.getTempFileURL({ fileList: fileIds, config: { maxAge: 10800 } });
          const fl = (tmp && tmp.fileList) || [];
          urlMap = fl.reduce((acc, it) => {
            if (it && it.fileID) acc[it.fileID] = (it.status === 0 ? (it.tempFileURL || '') : '');
            return acc;
          }, {});
        } catch (_) {}
      }
      const formatDate = (ts) => {
        const n = Number(ts);
        if (!isFinite(n) || n <= 0) return '';
        const d = new Date(n);
        if (isNaN(d.getTime())) return '';
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return y + '年' + m + '月' + day + '日';
      };
      const list = docs.map(m => ({
        id: m.articleId,
        title: m.articleTitle || '未命名文章',
        medalUrl: (typeof m.medal === 'string' && m.medal.indexOf('cloud://') === 0) ? (urlMap[m.medal] || '/assets/images/会员.png') : (m.medal || '/assets/images/会员.png'),
        publishTs: Number(m.acquiredAt || 0) || 0,
        acquiredAtStr: formatDate(m.acquiredAt)
      }));
      this.setData({ medals: list, totalCount: docs.length });
    } catch (e) {
      this.setData({ medals: [], totalCount: 0 });
    } finally {
      this.setData({ loading: false });
    }
  },
  openArticle: function (e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: `/pages/article-detail/article-detail?articleId=${id}` });
  }
});

// pages/profile/profile.js
Page({
  data: {
    currentAvatar: '',
    userAvatar: '',
    userPhone: '138****8888', // 用户手机号
    userId: 'UID123456789', // 用户ID
    userName: '春小咩', // 默认用户名
    backgroundMusicEnabled: true, // 背景音乐开关状态
    isEditingName: false, // 是否正在编辑用户名
    tempUserName: '', // 临时用户名
    avatarList: []
  },

  onLoad: function (options) {
    this.loadUserInfo();
    this.loadAvatarChoices();
  },

  onShow: function () {
    // 每次显示页面时刷新数据
    this.loadUserInfo();
    this.loadAvatarChoices();
  },

  // 加载用户信息（资料头像来自 springuser.avatarUrl）
  loadUserInfo: async function () {
    const info = wx.getStorageSync('userInfo') || null;
    const userName = wx.getStorageSync('userName') || '春小咩';
    const userPhone = info && info.phone && String(info.phone).trim() ? info.phone : '未绑定';
    const userId = info && (info.userId || info.openid || info._id) ? (info.userId || info.openid || info._id) : '未登录';
    const backgroundMusicEnabled = wx.getStorageSync('backgroundMusicEnabled');
    // Default to true if not set (null or undefined)
    const bgMusicEnabled = (backgroundMusicEnabled === '' || backgroundMusicEnabled === null || backgroundMusicEnabled === undefined) ? true : backgroundMusicEnabled;

    let ua = (info && info.avatarUrl) ? info.avatarUrl : '';
    
    // 如果没有用户头像，从 spring_avatar 获取默认头像
    if (!ua) {
      try {
        const c1 = new wx.cloud.Cloud({ resourceAppid: 'wx85d92d28575a70f4', resourceEnv: 'cloud1-1gsyt78b92c539ef' });
        await c1.init();
        const db = c1.database();
        const res = await db.collection('spring_avatar').where({ isDefault: true }).limit(1).get();
        if (res.data && res.data.length > 0) {
          ua = res.data[0].avatar;
        }
      } catch (e) {
        console.error('获取默认头像失败', e);
      }
    }
    
    // 兜底默认头像
    if (!ua) ua = '/assets/images/default-avatar.png';

    if (typeof ua === 'string' && ua.indexOf('cloud://') === 0) {
      try {
        const c1 = new wx.cloud.Cloud({ resourceAppid: 'wx85d92d28575a70f4', resourceEnv: 'cloud1-1gsyt78b92c539ef' });
        await c1.init();
        const tmp = await c1.getTempFileURL({ fileList: [ua], config: { maxAge: 10800 } });
        const fl = tmp.fileList || [];
        if (fl.length && fl[0].status === 0) ua = fl[0].tempFileURL;
      } catch (e) {}
    }

    this.setData({
      userAvatar: ua,
      userName: userName,
      backgroundMusicEnabled: bgMusicEnabled,
      userPhone: userPhone,
      userId: userId
    });
  },

  // 加载头像候选列表（spring_avatar）
  loadAvatarChoices: async function () {
    try {
      const c1 = new wx.cloud.Cloud({
        resourceAppid: 'wx85d92d28575a70f4',
        resourceEnv: 'cloud1-1gsyt78b92c539ef',
      });
      await c1.init();

      const db = c1.database();
      const res = await db.collection('spring_avatar').where({}).get();
      const list = res.data || [];

      // 收集需要换取临时链接的文件ID
      const fileIDs = list
        .map(item => item.avatar)
        .filter(v => typeof v === 'string' && v.startsWith('cloud://'));

      const urlMap = {};
      if (fileIDs.length > 0) {
        try {
          const tmp = await c1.getTempFileURL({ fileList: fileIDs, config: { maxAge: 3 * 60 * 60 } });
          (tmp.fileList || []).forEach(f => { if (f.status === 0) urlMap[f.fileID] = f.tempFileURL; });
        } catch (e) {
          console.error('头像临时链接换取失败', e);
        }
      }

      const avatarList = list.map(item => ({
        isDefault: !!item.isDefault,
        avatarUrl: (typeof item.avatar === 'string' && item.avatar.startsWith('cloud://')) ? (urlMap[item.avatar] || '') : (item.avatar || ''),
      })).filter(x => x.avatarUrl);

      // 不再自动覆盖 currentAvatar，避免与资料头像混淆

      this.setData({ avatarList });
    } catch (err) {
      console.error('加载头像列表失败', err);
    }
  },

  // 修改头像
  onAvatarTap: function () {
    wx.showActionSheet({
      itemList: ['从相册选择', '拍照'],
      success: (res) => {
        if (res.tapIndex === 0) {
          this.chooseFromAlbum();
        } else if (res.tapIndex === 1) {
          this.takePhoto();
        }
      }
    });
  },

  // 从相册选择
  chooseFromAlbum: function () {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album'],
      success: (res) => {
        const tempFilePath = res.tempFilePaths[0];
        this.setData({
          'userInfo.avatar': tempFilePath
        });
        // 这里可以上传头像到服务器
        wx.showToast({
          title: '头像设置成功',
          icon: 'success'
        });
      }
    });
  },

  // 拍照
  takePhoto: function () {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['camera'],
      success: (res) => {
        const tempFilePath = res.tempFilePaths[0];
        this.setData({
          'userInfo.avatar': tempFilePath
        });
        wx.showToast({
          title: '头像设置成功',
          icon: 'success'
        });
      }
    });
  },

  // 开始编辑用户名
  onNameEdit: function () {
    this.setData({
      isEditingName: true,
      tempUserName: this.data.userInfo.name
    });
  },

  // 取消编辑用户名
  onNameCancel: function () {
    this.setData({
      isEditingName: false,
      tempUserName: ''
    });
  },

  // 确认编辑用户名
  onNameConfirm: function () {
    const newName = this.data.tempUserName.trim();
    if (!newName) {
      wx.showToast({
        title: '用户名不能为空',
        icon: 'none'
      });
      return;
    }

    // 保存用户名
    wx.setStorageSync('userName', newName);
    this.setData({
      'userInfo.name': newName,
      isEditingName: false,
      tempUserName: ''
    });

    wx.showToast({
      title: '用户名修改成功',
      icon: 'success'
    });
  },

  // 用户名输入
  onNameInput: function (e) {
    this.setData({
      tempUserName: e.detail.value
    });
  },

  // 账号设置
  onAccountSettings: function () {
    wx.showToast({
      title: '账号设置功能开发中',
      icon: 'none',
      duration: 2000
    });
  },

  // 退出登录
  onLogout: function () {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          // 清除登录状态
          wx.setStorageSync('isLoggedIn', false);
          wx.setStorageSync('userName', '');

          wx.showToast({
            title: '已退出登录',
            icon: 'success',
            duration: 1500
          });

          // 返回上一页
          setTimeout(() => {
            wx.navigateBack({
              delta: 1
            });
          }, 1500);
        }
      }
    });
  },

  // 绑定手机号
  onBindPhone: function () {
    wx.showToast({
      title: '绑定手机号功能开发中',
      icon: 'none',
      duration: 2000
    });
  },

  // 背景音乐开关
  // 选择头像（更新 springuser.avatarUrl 与页面资料头像）
  selectAvatar: async function (e) {
    const avatar = e.currentTarget.dataset.avatar;
    if (!avatar) return;
    this.setData({ userAvatar: avatar });
    try {
      const info = wx.getStorageSync('userInfo') || null;
      if (!info || !info._id) return;
      const c1 = new wx.cloud.Cloud({
        resourceAppid: 'wx85d92d28575a70f4',
        resourceEnv: 'cloud1-1gsyt78b92c539ef',
      });
      await c1.init();
      const db = c1.database();
      await db.collection('springuser').doc(info._id).update({
        data: { avatarUrl: avatar, updateTime: new Date() }
      });
      const updatedInfo = { ...info, avatarUrl: avatar };
      wx.setStorageSync('userInfo', updatedInfo);
      wx.showToast({ title: '头像已更新', icon: 'success' });
    } catch (err) {}
  },

  // 编辑用户名
  onNameEdit: function () {
    this.setData({
      isEditingName: true,
      tempUserName: this.data.userName
    });
  },

  // 用户名输入
  onNameInput: function (e) {
    this.setData({
      tempUserName: e.detail.value
    });
  },

  // 确认修改用户名
  onNameConfirm: function () {
    const newName = this.data.tempUserName.trim();
    if (newName && newName !== this.data.userName) {
      this.setData({
        userName: newName,
        isEditingName: false,
        tempUserName: ''
      });
      wx.setStorageSync('userName', newName);
      this.updateUserNameRemote(newName);
    } else {
      this.setData({
        isEditingName: false
      });
    }
  },

  updateUserNameRemote: async function (newName) {
    try {
      const info = wx.getStorageSync('userInfo') || null;
      if (!info || !info._id) return;
      const c1 = new wx.cloud.Cloud({
        resourceAppid: 'wx85d92d28575a70f4',
        resourceEnv: 'cloud1-1gsyt78b92c539ef',
      });
      await c1.init();
      const db = c1.database();
      await db.collection('springuser').doc(info._id).update({
        data: { nickName: newName, updateTime: new Date() }
      });
      const updatedInfo = { ...info, nickName: newName };
      wx.setStorageSync('userInfo', updatedInfo);
    } catch (e) {
      console.error('更新用户名到后台失败', e);
    }
  },

  onMusicToggle: function (e) {
    const isEnabled = e.detail.value;
    this.setData({
      backgroundMusicEnabled: isEnabled
    });

    // 保存设置
    wx.setStorageSync('backgroundMusicEnabled', isEnabled);
    
    // 控制音乐播放
    const app = getApp();
    if (isEnabled) {
      app.playBGM();
    } else {
      app.stopBGM();
    }
  },

  // 复制用户ID
  copyUserId: function() {
    const userId = this.data.userId;
    if (userId && userId !== '未登录') {
      wx.setClipboardData({
        data: userId,
        success: function () {
          wx.showToast({
            title: '用户ID已复制',
            icon: 'success',
            duration: 1500
          });
        }
      });
    } else {
      wx.showToast({
        title: '未登录无法复制',
        icon: 'none',
        duration: 1500
      });
    }
  }
});

// pages/service/service.js
Page({
  data: {

  },

  onLoad: function (options) {
    // 页面加载时的初始化
  },

  onShow: function () {
    // 页面显示时的操作
  },

  /**
   * 拨打电话
   */
  callPhone: function () {
    wx.makePhoneCall({
      phoneNumber: '4008888888',
      success: function () {
        console.log('拨打电话成功');
      },
      fail: function () {
        wx.showToast({
          title: '拨打电话失败',
          icon: 'none'
        });
      }
    });
  },

  /**
   * 复制微信号
   */
  copyWechat: function () {
    wx.setClipboardData({
      data: 'xiaovisiontogether',
      success: function () {
        wx.showToast({
          title: '微信号已复制',
          icon: 'success',
          duration: 1500
        });
      },
      fail: function () {
        wx.showToast({
          title: '复制失败',
          icon: 'none'
        });
      }
    });
  },

  /**
   * 复制邮箱
   */
  copyEmail: function () {
    wx.setClipboardData({
      data: 'xiaoxiaovision@foxmail.com',
      success: function () {
        wx.showToast({
          title: '邮箱已复制',
          icon: 'success',
          duration: 1500
        });
      },
      fail: function () {
        wx.showToast({
          title: '复制失败',
          icon: 'none'
        });
      }
    });
  },

  // 预览客服中心图片
  previewImage: function () {
    const imageUrl = '/assets/images/客服中心.png';
    wx.previewImage({
      current: imageUrl,
      urls: [imageUrl],
      success: function () {
        console.log('图片预览成功');
      },
      fail: function () {
        wx.showToast({
          title: '预览失败',
          icon: 'none'
        });
      }
    });
  },

  // 长按识别二维码
  onLongPressImage: function () {
    wx.showActionSheet({
      itemList: ['保存图片', '识别二维码'],
      success: (res) => {
        if (res.tapIndex === 0) {
          // 保存图片
          this.saveImage();
        } else if (res.tapIndex === 1) {
          // 识别二维码
          this.recognizeQRCode();
        }
      }
    });
  },

  // 保存图片
  saveImage: function () {
    wx.showLoading({
      title: '保存中...'
    });

    wx.downloadFile({
      url: '/assets/images/客服中心.png',
      success: (res) => {
        wx.hideLoading();
        if (res.statusCode === 200) {
          wx.saveImageToPhotosAlbum({
            filePath: res.tempFilePath,
            success: () => {
              wx.showToast({
                title: '保存成功',
                icon: 'success'
              });
            },
            fail: () => {
              wx.showToast({
                title: '保存失败',
                icon: 'none'
              });
            }
          });
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({
          title: '下载失败',
          icon: 'none'
        });
      }
    });
  },

  // 识别二维码
  recognizeQRCode: function () {
    wx.showLoading({
      title: '识别中...'
    });

    // 使用微信的扫码功能
    wx.scanCode({
      success: (res) => {
        wx.hideLoading();
        console.log('识别结果:', res);
        wx.showModal({
          title: '识别结果',
          content: `结果类型: ${res.scanType}\n内容: ${res.result}`,
          showCancel: false,
          confirmText: '知道了'
        });
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({
          title: '识别失败',
          icon: 'none'
        });
      }
    });
  }

});

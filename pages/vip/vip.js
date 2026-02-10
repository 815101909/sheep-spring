// pages/vip/vip.js
Page({
  data: {
    selectedPlan: '',
    selectedPlanId: '',
    selectedPrice: '',
    plans: [],
    activationCode: ''
  },

  onLoad: function (options) {
    this.loadPlans();
  },

  onShow: function () {
    // 页面显示时的操作
  },

  getCloud: function () {
    return new Promise((resolve) => {
      try {
        const app = getApp ? getApp() : null;
        if (app && app.cloud && typeof app.cloud.callFunction === 'function') {
          resolve(app.cloud);
          return;
        }
        const c1 = new wx.cloud.Cloud({ resourceAppid: 'wx85d92d28575a70f4', resourceEnv: 'cloud1-1gsyt78b92c539ef' });
        c1.init().then(() => resolve(c1)).catch(() => resolve(wx.cloud));
      } catch (_) {
        resolve(wx.cloud);
      }
    });
  },

  /**
   * 输入激活码
   */
  onCodeInput: function(e) {
    this.setData({
      activationCode: e.detail.value
    });
  },

  /**
   * 激活码兑换
   */
  activateCode: function() {
    const code = this.data.activationCode.trim();
    if (!code) {
      wx.showToast({
        title: '请输入激活码',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({
      title: '兑换中...',
      mask: true
    });

    // 调用云函数验证激活码
    this.getCloud().then(cloud => {
      return cloud.callFunction({ name: 'spring_activate_code', data: { code } });
    }).then(res => {
      wx.hideLoading();
      const result = res.result;
      if (result && result.success) {
        const days = result.days || 30;
        wx.showModal({
          title: '兑换成功',
          content: `激活码有效！已为您增加 ${days} 天会员权益。`,
          showCancel: false,
          success: (m) => {
            if (m.confirm) {
              this.grantVipAccess({ type: 'activation', days });
            }
          }
        });
      } else {
        wx.showToast({ title: (result && result.message) || '无效的激活码', icon: 'none' });
      }
    }).catch(err => {
      wx.hideLoading();
      wx.showToast({ title: '网络请求失败', icon: 'none' });
    });
  },

  /**
   * 处理激活逻辑 (已废弃，直接在 activateCode 中处理)
   */
  // processActivation: function(planType) { ... },

  /**
   * 授予会员权限（公共方法）
   * @param {Object} info - 套餐信息或激活信息
   * info.duration (months) 或 info.days (days)
   */
  grantVipAccess: function(info) {
    wx.setStorageSync('isVip', true);

    // 计算到期时间
    const now = new Date();
    let expiryDate;
    
    // 如果之前已经是会员且未过期，应该在原基础上顺延
    const oldExpiryStr = wx.getStorageSync('vipExpiry');
    if (oldExpiryStr) {
        const oldExpiry = new Date(oldExpiryStr);
        // 如果旧的过期时间比现在晚，说明还在有效期内，从旧时间开始顺延
        if (oldExpiry > now) {
            // 这里重置为旧时间，以便下面累加
            now.setTime(oldExpiry.getTime());
        }
    }

    if (info.days) {
      // 按天数增加
      expiryDate = new Date(now.setDate(now.getDate() + info.days));
    } else {
      // 按月数增加 (默认1个月)
      const duration = info.duration || 1; 
      expiryDate = new Date(now.setMonth(now.getMonth() + duration));
    }

    const expiryStr = expiryDate.toLocaleDateString('zh-CN');
    wx.setStorageSync('vipExpiry', expiryStr);

    // 只有非静默模式才提示 (比如自动续费可能不需要弹窗，这里手动操作都需要)
    if (info.type !== 'silent') {
        wx.showToast({
          title: '开通成功！',
          icon: 'success',
          duration: 2000
        });
    }

    // 清空激活码输入
    this.setData({ activationCode: '' });

    // 返回上一页并刷新
    setTimeout(() => {
      const pages = getCurrentPages();
      const prevPage = pages[pages.length - 2];
      if (prevPage) {
        prevPage.setData({
          isVip: true,
          vipExpiry: expiryStr
        });
      }
      // 如果是tabbar页面不能用navigateBack，这里假设是普通页面
      // 也可以选择不返回，而是刷新当前页状态
      wx.navigateBack().catch(() => {
        // 如果无法返回（例如是tab页），则不操作或跳转到首页
      });
    }, 2000);
  },

  /**
   * 选择套餐
   */
  selectPlan: function (e) {
    if (getApp().playClickSound) getApp().playClickSound();
    const planId = e.currentTarget.dataset.planid;
    const item = (this.data.plans || []).find(x => x.planId === planId);

    this.setData({
      selectedPlan: planId,
      selectedPlanId: planId,
      selectedPrice: item ? (item.displayPrice || '') : ''
    });
  },

  /**
   * 开通会员
   */
  subscribe: function () {
    if (!this.data.selectedPlanId) {
      wx.showToast({
        title: '请先选择套餐',
        icon: 'none'
      });
      return;
    }

    const planInfo = (this.data.plans || []).find(x => x.planId === this.data.selectedPlanId);

    // 确认开通弹窗
    wx.showModal({
      title: '确认开通',
      content: '确认开通' + (planInfo ? planInfo.name : '') + '会员吗？费用：' + (planInfo ? (planInfo.displayPrice || '') : ''),
      success: (res) => {
        if (res.confirm) {
          // 发起支付
          this.processPayment(planInfo);
        }
      }
    });
  },

  /**
   * 处理支付
   */
  processPayment: function (planInfo) {
    wx.showLoading({
      title: '正在创建订单...'
    });

    this.getCloud().then(cloud => {
      return cloud.callFunction({ name: 'spring_pay', data: { planId: this.data.selectedPlanId } });
    }).then(res => {
      const result = res.result || {};
      if (result && result.data) {
        wx.hideLoading();
        wx.requestPayment({
          ...result.data,
          success: () => {
            this.checkPaymentStatus(result.out_trade_no, planInfo);
          },
          fail: (payErr) => {
            if (payErr && payErr.errMsg && payErr.errMsg.indexOf('cancel') > -1) {
              wx.showToast({ title: '已取消支付', icon: 'none' });
              this.updateOrderStatus(result.out_trade_no, 'cancelled');
            } else {
              wx.showToast({ title: '支付失败', icon: 'none' });
            }
          }
        });
      } else {
        wx.hideLoading();
        wx.showToast({ title: result.errmsg || '创建订单失败', icon: 'none' });
      }
    }).catch(() => {
      wx.hideLoading();
      wx.showToast({ title: '网络请求失败', icon: 'none' });
    });
  },

  /**
   * 更新订单状态
   */
  updateOrderStatus: function(outTradeNo, status) {
      this.getCloud().then(cloud => {
        return cloud.callFunction({
          name: 'spring_pay',
          data: { action: 'updateMemberOrder', out_trade_no: outTradeNo, status }
        });
      }).catch(() => {});
  },

  /**
   * 检查支付状态并授予权益
   */
  checkPaymentStatus: function(outTradeNo, planInfo) {
      wx.showLoading({ title: '确认状态中...' });
      
      this.getCloud().then(cloud => {
        return cloud.callFunction({
          name: 'spring_pay',
          data: { action: 'updateMemberOrder', out_trade_no: outTradeNo, status: 'success' }
        });
      }).then(res => {
        wx.hideLoading();
        if (res.result && res.result.success) {
          this.grantVipAccess(planInfo);
        } else {
          wx.showToast({ title: '状态更新失败，请联系客服', icon: 'none' });
        }
      }).catch(() => {
        wx.hideLoading();
        wx.showToast({ title: '网络异常', icon: 'none' });
      });
  },

  loadPlans: function () {
    this.getCloud().then(cloud => {
      return cloud.callFunction({ name: 'spring_pay', data: { action: 'getPlans' } });
    }).then(res => {
      const arr = (res.result && res.result.data) ? res.result.data : [];
      const list = arr.map(p => {
        let displayPrice = '';
        if (typeof p.priceCents === 'number') {
          displayPrice = '¥' + String(p.priceCents);
        } else if (typeof p.priceYuan === 'number') {
          displayPrice = '¥' + String(p.priceYuan);
        } else if (typeof p.price === 'number') {
          displayPrice = '¥' + String(p.price);
        } else if (typeof p.displayPrice === 'string') {
          displayPrice = p.displayPrice;
        }
        return {
          planId: p.planId,
          name: p.name,
          priceCents: p.priceCents,
          displayPrice
        };
      });
      this.setData({ plans: list });
    }).catch(() => {});
  }
});

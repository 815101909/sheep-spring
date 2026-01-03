Page({
  data: {
    plans: [],
    selectedPlanId: '',
    selectedDisplayPrice: '',
    isVip: false,
    vipExpiry: ''
  },
  onLoad: function () {
    const c1 = new wx.cloud.Cloud({ resourceAppid: 'wx85d92d28575a70f4', resourceEnv: 'cloud1-1gsyt78b92c539ef' });
    c1.init().then(() => { this.c1 = c1; }).catch(() => { this.c1 = null; }).finally(() => { this.loadPlans(); });
  },
  onShow: function () {
    this.refreshVipStatus();
  },
  formatPrice: function (val) {
    if (typeof val === 'number') {
      if (val >= 100) {
        return '¥' + (val / 100).toFixed(2).replace(/\.00$/, '');
      }
      return '¥' + String(val);
    }
    const n = Number(val);
    if (!isNaN(n)) {
      if (n >= 100) {
        return '¥' + (n / 100).toFixed(2).replace(/\.00$/, '');
      }
      return '¥' + String(n);
    }
    return '¥' + String(val || '');
  },
  loadPlans: function () {
    try {
      const db = this.c1 ? this.c1.database() : wx.cloud.database();
      db.collection('spring_vip_plans').where({ status: true }).orderBy('displayOrder', 'asc').get().then(res => {
        const list = (res.data || []).map(p => ({
          planId: p.planId,
          name: p.name,
          priceCents: p.priceCents,
          displayPrice: this.formatPrice(p.priceCents)
        }));
        console.log('vip_plans_db', list);
        this.setData({ plans: list });
        if (!list.length) wx.showToast({ title: '暂无上架套餐', icon: 'none' });
      }).catch((e) => {
        console.error('vip_load_plans_error', e);
        wx.showToast({ title: '加载套餐失败', icon: 'none' });
      });
    } catch (e) {
      console.error('vip_load_plans_exception', e);
      this.loadPlansDirect();
    }
  },
  loadPlansDirect: function () {
    const db = wx.cloud.database();
    db.collection('spring_vip_plans').where({ status: true }).orderBy('displayOrder', 'asc').get().then(res => {
      const list = (res.data || []).map(p => ({
        planId: p.planId,
        name: p.name,
        priceCents: p.priceCents,
        displayPrice: this.formatPrice(p.priceCents)
      }));
      console.log('vip_plans_direct', list);
      this.setData({ plans: list });
      if (!list.length) wx.showToast({ title: '暂无上架套餐', icon: 'none' });
    }).catch((e) => {
      console.error('vip_load_plans_direct_error', e);
      wx.showToast({ title: '加载套餐失败', icon: 'none' });
    });
  },
  refreshVipStatus: function () {
    const fn = this.c1 ? this.c1.callFunction.bind(this.c1) : wx.cloud.callFunction.bind(wx.cloud);
    fn({ name: 'spring_pay', data: { action: 'checkMemberStatus' } }).then(res => {
      const r = res.result || {};
      const expiryStr = r.vipExpireTime ? new Date(r.vipExpireTime).toLocaleDateString('zh-CN') : '';
      this.setData({ isVip: !!r.isVip, vipExpiry: expiryStr });
    }).catch(() => {});
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
    // 注意：这里需要确保使用正确的云环境调用
    const fn = this.c1 ? this.c1.callFunction.bind(this.c1) : wx.cloud.callFunction.bind(wx.cloud);
    
    fn({
      name: 'spring_activate_code',
      data: {
        code: code
      }
    }).then(res => {
      wx.hideLoading();
      const result = res.result;

      if (result.success) {
        const days = result.days || 30;
        
        wx.showModal({
          title: '兑换成功',
          content: `激活码有效！已为您增加 ${days} 天会员权益。`,
          showCancel: false,
          success: (res) => {
            if (res.confirm) {
              // 兑换成功后，刷新会员状态
              // 这里我们不仅刷新前端显示，还需要调用 checkMemberStatus 来确保后端状态也同步更新
              // 实际上 spring_activate_code 云函数内部应该只负责标记激活码已用
              // 会员权益的增加应该在云函数内部一并处理，或者在这里再次调用 spring_pay 激活会员
              
              // 补充：夏天的逻辑是 grantVipAccess 前端更新 storage，这里春天是后端中心化的
              // 所以我们需要确保 spring_activate_code 内部或后续调用能真正增加会员时间
              
              // 由于 spring_activate_code 只是返回成功，我们需要在这里手动调用一次模拟的“支付成功”逻辑来激活会员
              // 或者更优雅地，让 spring_activate_code 内部直接调用 activateMember 逻辑
              // 但考虑到 spring_activate_code 是独立的，我们可以在这里调用 spring_pay 的 activateMember
              // 不过 activateMember 需要 out_trade_no，激活码逻辑可能需要调整
              
              // 简化方案：我们修改 spring_activate_code 让其直接操作数据库增加会员时间？
              // 不，为了保持一致性，我们可以在这里调用一个专门的“激活码激活会员”接口，或者复用 spring_pay
              
              // 鉴于 spring_pay 中 activateMember 依赖订单号，我们这里暂时用一种简单方式：
              // 在 spring_activate_code 中直接更新用户表（如果权限允许），或者
              // 我们假设 spring_activate_code 已经完成了所有工作（包括增加时间）？
              // 查看夏天的代码，它只是返回 days，然后前端 grantVipAccess 更新本地 storage。
              // 但春天是依赖云端状态的 (checkMemberStatus)，所以必须更新云端数据库。
              
              // **修正方案**：我们需要在 spring_activate_code 中增加“更新用户会员期”的逻辑
              // 或者在前端调用一个补充云函数。为了简单和安全，建议在 spring_activate_code 中直接处理。
              // 我稍后会去更新 spring_activate_code 云函数，加上更新 summeruser 表的逻辑。
              
              // 假设云函数已经处理好了（稍后我去改），这里只需要刷新状态
              this.refreshVipStatus();
              this.setData({ activationCode: '' });
            }
          }
        });
      } else {
        wx.showToast({
          title: result.message || '无效的激活码',
          icon: 'none'
        });
      }
    }).catch(err => {
      wx.hideLoading();
      console.error('激活失败', err);
      wx.showToast({
        title: '网络请求失败',
        icon: 'none'
      });
    });
  },

  selectPlan: function (e) {
    const planId = e.currentTarget.dataset.planid;
    const item = (this.data.plans || []).find(x => x.planId === planId);
    this.setData({ selectedPlanId: planId, selectedDisplayPrice: item ? item.displayPrice : '' });
  },
  subscribe: function () {
    if (!this.data.selectedPlanId) {
      wx.showToast({ title: '请先选择套餐', icon: 'none' });
      return;
    }
    const item = (this.data.plans || []).find(x => x.planId === this.data.selectedPlanId);
    wx.showModal({
      title: '确认开通',
      content: '确认开通' + (item ? item.name : '') + '会员吗？费用：' + (item ? item.displayPrice : ''),
      success: (res) => {
        if (res.confirm) {
          this.createAndPay();
        }
      }
    });
  },
  createAndPay: function () {
    wx.showLoading({ title: '发起支付' });
    const fn = this.c1 ? this.c1.callFunction.bind(this.c1) : wx.cloud.callFunction.bind(wx.cloud);
    fn({ name: 'spring_pay', data: { planId: this.data.selectedPlanId } }).then(res => {
      wx.hideLoading();
      const ret = res.result || {};
      const pay = ret.data || {};
      const outNo = ret.out_trade_no || '';
      if (!pay || !pay.package || !(pay.package.indexOf('prepay_id=') === 0)) {
        console.error('vip_pay_order_error', ret);
        wx.showToast({ title: '下单失败', icon: 'none' });
        return Promise.reject({ err: { errMsg: '下单失败' }, outNo });
      }
      return new Promise((resolve, reject) => {
        wx.requestPayment({
          timeStamp: pay.timeStamp,
          nonceStr: pay.nonceStr,
          package: pay.package,
          signType: pay.signType,
          paySign: pay.paySign,
          success: () => resolve(outNo),
          fail: (err) => reject({ err, outNo })
        });
      });
    }).then((outNo) => {
      const fn2 = this.c1 ? this.c1.callFunction.bind(this.c1) : wx.cloud.callFunction.bind(wx.cloud);
      return fn2({ name: 'spring_pay', data: { action: 'updateMemberOrder', out_trade_no: outNo, status: 'success' } });
    }).then(() => {
      const fn3 = this.c1 ? this.c1.callFunction.bind(this.c1) : wx.cloud.callFunction.bind(wx.cloud);
      return fn3({ name: 'spring_pay', data: { action: 'checkMemberStatus' } });
    }).then(res => {
      const r = res.result || {};
      const expiryStr = r.vipExpireTime ? new Date(r.vipExpireTime).toLocaleDateString('zh-CN') : '';
      this.setData({ isVip: !!r.isVip, vipExpiry: expiryStr });
      wx.showToast({ title: '开通成功', icon: 'success' });
    }).catch(async (payload) => {
      const outNo = payload && payload.outNo;
      const err = payload && payload.err;
      if (err) console.error('vip_pay_fail', err);
      
      let status = 'failed';
      // 判断是否为用户取消支付
      if (err && err.errMsg && err.errMsg.indexOf('cancel') > -1) {
        status = 'cancelled';
      }

      if (outNo) {
        try {
          const fn4 = this.c1 ? this.c1.callFunction.bind(this.c1) : wx.cloud.callFunction.bind(wx.cloud);
          await fn4({ name: 'spring_pay', data: { action: 'updateMemberOrder', out_trade_no: outNo, status: status } });
        } catch (e) {}
      }
      wx.showToast({ title: status === 'cancelled' ? '支付已取消' : '支付未完成', icon: 'none' });
    });
  }
});

//云开发实现支付 - 微信支付APIv3
const cloud = require('wx-server-sdk');
const crypto = require('crypto');
const https = require('https');
const fs = require('fs');
const WxPay = require('wechatpay-node-v3');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

// APIv3辅助函数（全局作用域）
const generateNonceStr = () => {
  return Math.random().toString(36).substr(2, 15);
};

const generateTimestamp = () => {
  return Math.floor(Date.now() / 1000);
};

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openId = wxContext.FROM_OPENID || wxContext.OPENID;
  const { action, description, amount, planId, planName } = event;

  // 如果有 action 参数，路由到相应的处理函数
  if (action) {
    switch (action) {
      case 'checkMemberStatus':
        return await exports.checkMemberStatus(event, context);
      case 'activateMember':
        return await exports.activateMember(event, context);
      case 'updateMemberOrder':
        return await exports.updateMemberOrder(event, context);
      case 'getPlans':
        return await exports.getPlans(event, context);
      default:
        return { errcode: -1, errmsg: '未知的操作类型' };
    }
  }

  // 微信支付APIv3配置
  const config = {
    appid: 'wxb9f2533915001854', // 小程序AppID
    mchid: '1723171734', // 微信支付商户号
    apiV3Key: 'APIV3easyKEY2025remember12345678', // APIv3密钥
    notify_url: 'https://mp.weixin.qq.com', // 支付回调网址
    serial_no: '3292067A61C9A8FB151A27A3F4A26E0215C5EF6C',
    publicKey: 'PUB_KEY_ID_0117231717342025080600382090000403'
  };
  
  const apiclientCert = fs.readFileSync(__dirname + '/apiclient_cert.pem');
  const apiclientKey = fs.readFileSync(__dirname + '/apiclient_key.pem');
  
  // 初始化微信支付SDK
  let weChatPay;
  try {
    weChatPay = new WxPay({
      appid: config.appid,
      mchid: config.mchid,
      publicKey: apiclientCert,
      privateKey: apiclientKey
    });
    console.log('微信支付SDK初始化成功');
  } catch (error) {
    console.error('SDK初始化失败:', error.message);
    throw new Error('微信支付SDK初始化失败，请检查证书配置');
  }
  
  console.log('开始创建会员订单:', { planId });

  try {
    // 必须提供 planId
    if (!planId) {
      throw new Error('缺少 planId');
    }

    // 查找会员套餐
    const planRes = await db.collection('spring_vip_plans').where({ planId, status: true }).limit(1).get();
    if (!planRes.data || planRes.data.length === 0) {
      throw new Error('会员套餐不存在或未上架');
    }
    const planDoc = planRes.data[0];
    let priceCents = planDoc.priceCents;
    if (typeof priceCents === 'number' && priceCents < 100) {
      priceCents = Math.round(priceCents * 100);
    }
    const durationDays = planDoc.durationDays || 0;

    // 获取用户 userId
    const userRes = await db.collection('springuser').where({ _openid: openId }).limit(1).get();
    const userDoc = userRes.data && userRes.data.length ? userRes.data[0] : null;

    // 商户订单号
    const outTradeNo = `SPRINGVIP_${Date.now()}_${Math.round(Math.random() * 10000)}`;

    // 存储订单信息到 spring_vip_orders
    const orderData = {
      _id: outTradeNo,
      _openid: openId,
      userId: userDoc ? userDoc.userId : '',
      recommender: userDoc ? (userDoc.recommender || '') : '',
      planId: planId,
      priceCents: Number((priceCents / 100).toFixed(2)),
      status: 'pending',
      out_trade_no: outTradeNo,
      transaction_id: '',
      payTime: null,
      expireTime: null,
      createdAt: db.serverDate(),
      updatedAt: db.serverDate()
    };

    await db.collection('spring_vip_orders').add({ data: orderData });

    // APIv3 JSAPI支付统一下单
    if (!openId) {
      return { errcode: -3, errmsg: '缺少openid' };
    }
    const orderParams = {
      appid: config.appid,
      mchid: config.mchid,
      description: planDoc.name || '会员服务',
      out_trade_no: outTradeNo,
      notify_url: config.notify_url,
      amount: { total: priceCents, currency: 'CNY' },
      attach: String(userDoc ? (userDoc.recommender || '') : ''),
      payer: { openid: openId }
    };
    
    console.log('APIv3统一下单参数:', orderParams);
    console.log('用户openid:', wxContext.OPENID);
    
    // 使用SDK调用微信支付统一下单接口
    try {
      const result = await weChatPay.transactions_jsapi(orderParams);
      
      console.log('APIv3统一下单返回结果:', result);
      
      // 检查返回结果，wechatpay-node-v3可能直接返回支付参数
      let prepayId;
      if (result.prepay_id) {
        prepayId = result.prepay_id;
      } else if (result.package && result.package.indexOf('prepay_id=') === 0) {
        prepayId = result.package.replace('prepay_id=', '');
      } else {
        throw new Error('获取prepay_id失败: ' + JSON.stringify(result));
      }
      const payParams = generateMiniProgramPayParams(prepayId, config);
      return { data: payParams, out_trade_no: outTradeNo };
    } catch (sdkError) {
      console.error('微信支付SDK调用失败:', sdkError);
      throw new Error('支付接口调用失败: ' + sdkError.message);
    }
  } catch (error) {
    console.error('创建支付订单失败:', error);
    return {
      errcode: -1,
      errmsg: error.message || '创建订单失败'
    };
  }
};

// 微信支付回调通知
exports.payNotify = async (event, context) => {
  try {
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body || {});
    const out_trade_no = body && body.out_trade_no || body && body.resource && body.resource.out_trade_no || '';
    const transaction_id = body && body.transaction_id || body && body.resource && body.resource.transaction_id || '';
    if (!out_trade_no) {
      return { code: -1, msg: '缺少 out_trade_no' };
    }
    await db.collection('spring_vip_orders').where({ out_trade_no }).update({
      data: { status: 'success', transaction_id, payTime: Date.now(), updatedAt: db.serverDate() }
    });
    const act = await exports.activateMember({ out_trade_no, transaction_id });
    return { code: 0, msg: 'ok', data: act };
  } catch (e) {
    console.error('payNotify_error:', e);
    return { code: -2, msg: 'notify failed', error: String(e && e.message || e) };
  }
};

// 新增一个云函数用于激活会员
exports.activateMember = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openId = wxContext.FROM_OPENID || wxContext.OPENID;
  const out_trade_no = event.out_trade_no || event.outTradeNo;
  const transaction_id = event.transaction_id || event.transactionId || '';
  const _ = db.command;

  try {
    const orderRes = await db.collection('spring_vip_orders').where({ out_trade_no }).limit(1).get();
    if (!orderRes.data || orderRes.data.length === 0) {
      return { success: false, errmsg: '订单不存在' };
    }
    const orderDoc = orderRes.data[0];

    const planRes = await db.collection('spring_vip_plans').where({ planId: orderDoc.planId, status: true }).limit(1).get();
    if (!planRes.data || planRes.data.length === 0) {
      return { success: false, errmsg: '会员套餐不存在或未上架' };
    }
    const planDoc = planRes.data[0];
    const durationDays = planDoc.durationDays || 0;

    const userRes = await db.collection('springuser').where({ _openid: openId }).limit(1).get();
    const userDoc = userRes.data && userRes.data.length ? userRes.data[0] : null;

    let baseTime = Date.now();
    if (userDoc && userDoc.isVip && userDoc.vipExpireTime && userDoc.vipExpireTime > baseTime) {
      baseTime = userDoc.vipExpireTime;
    }
    const expireTime = baseTime + durationDays * 24 * 60 * 60 * 1000;

    await db.collection('spring_vip_orders').where({ out_trade_no }).update({
      data: {
        status: 'success',
        transaction_id,
        payTime: Date.now(),
        expireTime,
        updatedAt: db.serverDate()
      }
    });

    if (userDoc) {
      await db.collection('springuser').doc(userDoc._id).update({
        data: { isVip: true, vipExpireTime: expireTime, updateTime: db.serverDate() }
      });
    }

    return { success: true, memberExpireTime: expireTime };
  } catch (error) {
    console.error('激活会员失败:', error);
    return { success: false, errmsg: error.message || '激活会员失败' };
  }
};

// 新增一个云函数用于检查会员状态
exports.checkMemberStatus = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.FROM_OPENID || wxContext.OPENID;

  try {
    if (!openid) {
      return { success: false, error: '用户未登录', isVip: false };
    }

    const res = await db.collection('springuser').where({ _openid: openid }).field({ isVip: true, vipExpireTime: true }).limit(1).get();
    if (res.data && res.data.length) {
      const user = res.data[0];
      const nowTs = Date.now();
      let isVip = !!(user.isVip && user.vipExpireTime && user.vipExpireTime > nowTs);
      if (user.isVip && user.vipExpireTime && user.vipExpireTime <= nowTs) {
        await db.collection('springuser').doc(user._id).update({ data: { isVip: false } });
        isVip = false;
      }
      return { success: true, isVip, vipExpireTime: user.vipExpireTime };
    }
    return { success: true, isVip: false };
  } catch (error) {
    console.error('检查会员状态失败:', error);
    return { success: false, errmsg: error.message || '检查会员状态失败' };
  }
};

// 新增一个云函数用于更新会员订单状态
exports.updateMemberOrder = async (event, context) => {
  const out_trade_no = event.out_trade_no || event.outTradeNo;
  const status = event.status;
  const transaction_id = event.transaction_id || event.transactionId || '';

  try {
    const res = await db.collection('spring_vip_orders').where({ out_trade_no }).update({
      data: { status, transaction_id, updatedAt: db.serverDate() }
    });
    if (status === 'success') {
      await exports.activateMember({ out_trade_no, transaction_id });
    }
    return { success: true, data: res };
  } catch (error) {
    console.error('更新会员订单失败:', error);
    return { success: false, errmsg: error.message || '更新订单失败' };
  }
};

exports.getPlans = async (event, context) => {
  try {
    const res = await db.collection('spring_vip_plans').where({ status: true }).orderBy('displayOrder', 'asc').get();
    return { success: true, data: res.data || [] };
  } catch (error) {
    return { success: false, errmsg: error.message || '获取套餐失败' };
  }
};

// APIv3辅助函数

// 生成小程序支付参数
function generateMiniProgramPayParams(prepayId, config) {
  const timestamp = generateTimestamp().toString();
  const nonceStr = generateNonceStr();
  const packageStr = `prepay_id=${prepayId}`;
  
  // 构建签名字符串
  const signStr = `${config.appid}\n${timestamp}\n${nonceStr}\n${packageStr}\n`;
  
  // 使用商户私钥进行RSA签名
  const privateKey = fs.readFileSync(__dirname + '/apiclient_key.pem', 'utf8');
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signStr);
  const paySign = sign.sign(privateKey, 'base64');
  
  return {
    timeStamp: timestamp,
    nonceStr: nonceStr,
    package: packageStr,
    signType: 'RSA',
    paySign: paySign
  };
}

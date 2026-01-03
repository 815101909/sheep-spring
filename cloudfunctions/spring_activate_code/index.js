// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  // 显式指定环境ID，确保操作的是同一个库
  env: 'cloud1-1gsyt78b92c539ef'
})

const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { OPENID, FROM_OPENID } = wxContext
  const userOpenid = FROM_OPENID || OPENID
  const { code } = event
  
  if (!code) {
    return {
      success: false,
      message: '激活码不能为空'
    }
  }

  // 使用 spring_codes 集合
  const collection = db.collection('spring_codes')
  const _ = db.command

  try {
    // 1. 查询激活码
    const res = await collection.where({
      code: code
    }).get()

    if (res.data.length === 0) {
      return {
        success: false,
        message: '激活码不存在'
      }
    }

    const codeRecord = res.data[0]

    // 2. 检查状态 (假设 0 或 false 或 'unused' 为未使用)
    // 兼容多种状态标识
    const isUsed = codeRecord.status === 1 || codeRecord.status === true || codeRecord.status === 'used' || (codeRecord.usedBy && codeRecord.usedBy.length > 0)
    
    if (isUsed) {
      return {
        success: false,
        message: '激活码已被使用'
      }
    }

    // 3. 执行激活 (原子操作更新)
    const updateRes = await collection.where({
      _id: codeRecord._id,
      // 确保更新时状态仍为未使用
      status: _.neq(1).and(_.neq(true)).and(_.neq('used')) 
    }).update({
      data: {
        status: 'used', // 标记为已使用
        usedBy: userOpenid,
        usedTime: db.serverDate()
      }
    })

    if (updateRes.stats.updated === 0) {
      return {
        success: false,
        message: '激活失败，请重试' // 可能是并发导致已被抢用
      }
    }

    // 4. 更新用户会员状态 (新增逻辑，确保春天版后端鉴权生效)
    const days = codeRecord.days || 30;
    const userCol = db.collection('springuser'); // 注意：春天项目也是用的 springuser 表
    
    // 获取当前用户信息
    const userRes = await userCol.where({ _openid: userOpenid }).limit(1).get();
    let userDoc = userRes.data[0];
    
    if (userDoc) {
        let baseTime = Date.now();
        // 如果已经是会员且未过期，从过期时间开始顺延
        if (userDoc.isVip && userDoc.vipExpireTime && userDoc.vipExpireTime > baseTime) {
            baseTime = userDoc.vipExpireTime;
        }
        
        const expireTime = baseTime + days * 24 * 60 * 60 * 1000;
        
        await userCol.doc(userDoc._id).update({
            data: {
                isVip: true,
                vipExpireTime: expireTime,
                updateTime: db.serverDate()
            }
        });
    } else {
        // 如果用户不存在（理论上已登录应该存在，但防万一），可能需要先注册或报错
        // 这里暂时忽略，或者返回提示
        console.warn('激活码已核销但未找到用户信息', userOpenid);
    }

    return {
      success: true,
      message: '激活成功',
      days: days,
      type: codeRecord.type || 'activation'
    }

  } catch (err) {
    console.error(err)
    return {
      success: false,
      message: '系统错误',
      error: err
    }
  }
}
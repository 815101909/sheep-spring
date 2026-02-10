// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
async function generateUniqueUserId() {
  const collection = db.collection('springuser')
  for (let i = 0; i < 50; i++) {
    const num = Math.floor(Math.random() * 90000000) + 10000000 // 8位数字，首位非0
    const candidate = `spring_${num}`
    const exists = await collection.where({ userId: candidate }).get()
    if (!exists.data || exists.data.length === 0) {
      return candidate
    }
  }
  throw new Error('Failed to generate unique userId')
}

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { OPENID, UNIONID, FROM_OPENID } = wxContext
  const openid = FROM_OPENID || OPENID
  
  // 集合名称 springuser
  const collectionName = 'springuser'
  
  try {
    // 查询用户是否存在
    // 注意：在云函数中查询时，如果 collection 的权限设置是“仅创建者可读写”，
    // 这里的 where 条件其实是多余的，因为默认只能查到自己的。
    // 但如果是“所有用户可读”，则需要加上 _openid 过滤。
    // 为了保险起见，显式加上 _openid 条件。
    const userRes = await db.collection(collectionName).where({
      _openid: openid
    }).get()
    
    if (userRes.data.length > 0) {
      // 用户已存在，返回用户信息
      return {
        code: 0,
        msg: 'login success',
        data: userRes.data[0],
        isNew: false
      }
    } else {
      // 用户不存在，创建新用户
      let defaultAvatar = 'cloud://cloud1-1gsyt78b92c539ef.636c-cloud1-1gsyt78b92c539ef-1370520707/weda-uploader/9df2842430a3ba5e5800fa4517e46d30-默认头像.jpg';
      try {
        const avatarRes = await db.collection('spring_avatar').where({ isDefault: true }).limit(1).get();
        if (avatarRes.data && avatarRes.data.length > 0) {
          defaultAvatar = avatarRes.data[0].avatar;
        }
      } catch (e) {
        console.error('Failed to fetch default avatar', e);
      }

      const userData = {
        _openid: openid,
        openid: openid,
        nickName: event.userInfo?.nickName || '春小咩',
        avatarUrl: event.userInfo?.avatarUrl || defaultAvatar,
        phone: '', // 手机号
        userId: await generateUniqueUserId(),
        
        // 会员信息
        isVip: false,
        vipExpireTime: null,
        
        // 资产与签到
        points: 0, // 积分
        checkinDays: 0, // 连续签到天数
        totalCheckins: 0, // 累计签到天数
        lastCheckinDate: null, // 上次签到日期
        unlockedImages: 0, // 解锁形象数量
        
        // 推荐信息
        recommender: event.recommender || '', // 推荐人
        
        
        createTime: Date.now(),
        updateTime: Date.now(),
        // 如果前端传来了其他用户信息，合并进去
        ...(event.userInfo || {})
      }
      const bonusDays = 3
      const expireTime = Date.now() + bonusDays * 24 * 60 * 60 * 1000
      userData.isVip = true
      userData.vipExpireTime = expireTime
      
      const addRes = await db.collection(collectionName).add({
        data: userData
      })
      
      return {
        code: 0,
        msg: 'register success',
        data: {
          ...userData,
          _id: addRes._id
        },
        isNew: true
      }
    }
  } catch (err) {
    console.error(err)
    return {
      code: -1,
      msg: 'login failed',
      error: err
    }
  }
}

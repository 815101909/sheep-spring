// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  // 显式指定环境ID，确保查的是同一个库
  env: 'cloud1-1gsyt78b92c539ef'
})

const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { OPENID, FROM_OPENID } = wxContext
  const userOpenid = FROM_OPENID || OPENID
  
  const CLOUD_COLLECTION = 'spring_user_favorites'

  try {
    // 获取当前用户的收藏数据
    // 注意：如果数据量大，需要分页。这里假设不超过100条或简单处理
    const res = await db.collection(CLOUD_COLLECTION)
      .where({
        _openid: userOpenid // 在云函数中强制过滤
      })
      .orderBy('created_at', 'desc')
      .limit(100)
      .get()

    return {
      success: true,
      data: res.data,
      openid: userOpenid // 返回openid供调试验证
    }
  } catch (err) {
    console.error(err)
    return {
      success: false,
      error: err,
      openid: userOpenid
    }
  }
}
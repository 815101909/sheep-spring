// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  
  // 集合名称
  const collectionName = 'spring_hoofprint_articles'
  
  try {
    // 1. 并行查询：获取所有文章（用于时间线）和轮播文章
    // 注意：如果文章数量很大，后续需要改为分页加载
    // 目前假设文章数量在 100 以内，一次性拉取
    const articlesRes = await db.collection(collectionName)
      .where({ status: true })
      .orderBy('publish_date', 'desc') // 按发布日期倒序
      .orderBy('sort_order', 'asc')    // 同一天的按排序权重升序
      .limit(100)
      .get()
      
    const allArticles = articlesRes.data
    
    // 2. 处理轮播数据 (is_carousel = true)
    const carouselItems = allArticles
      .filter(item => item.is_carousel)
      .map(item => ({
        id: item._id,
        title: item.title,
        cover: item.cover_image,
        date: item.publish_date,
        category: item.category,
        level: item.level || 'low',
        subtitle: item.subtitle || '',
        a4Image: item.a4_image || ''
      }))
      
    // 3. 处理时间线数据 (按日期分组)
    // 目标格式：[{ date: "2025年12月15日", articles: [...] }, ...]
    const timelineMap = new Map()
    
    allArticles.forEach(item => {
      const date = item.publish_date
      if (!timelineMap.has(date)) {
        timelineMap.set(date, [])
      }
      
      timelineMap.get(date).push({
        id: item._id,
        category: item.category,
        titleCn: item.title,
        cover: item.cover_image,
        subtitle: item.subtitle || '',
        a4Image: item.a4_image || '',
        level: item.level || 'low',
        selected: false
      })
    })
    
    // 转换为数组
    const timelineData = []
    timelineMap.forEach((articles, date) => {
      timelineData.push({
        date: date,
        articles: articles
      })
    })
    
    // 4. 返回结果
    return {
      code: 0,
      msg: 'success',
      data: {
        carouselItems: carouselItems,
        timelineData: timelineData
      }
    }
    
  } catch (err) {
    console.error(err)
    return {
      code: -1,
      msg: '获取文章列表失败',
      error: err
    }
  }
}

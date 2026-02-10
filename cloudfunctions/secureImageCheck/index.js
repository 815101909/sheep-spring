const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

exports.main = async (event, context) => {
  const action = event && event.action
  try {
    if (action === 'checkImage') {
      return await checkImage(event)
    }
    if (action === 'test') {
      return { success: true, message: 'ok', timestamp: new Date().toISOString() }
    }
    return { success: false, message: '未知操作' }
  } catch (error) {
    return { success: false, message: '内容检测服务暂时不可用', error: error.message }
  }
}

async function checkImage(event) {
  const fileID = event && event.fileID
  const imageBuffer = event && event.imageBuffer
  const imageUrl = event && event.imageUrl
  let contentType = (event && event.contentType) || 'image/jpeg'
  if (!fileID && !imageBuffer && !imageUrl) {
    return { success: false, message: '文件ID、图片数据或图片URL不能为空' }
  }
  try {
    let buffer
    if (fileID) {
      const dl = await cloud.downloadFile({ fileID })
      if (!dl || !dl.buffer) {
        return { success: false, message: '下载图片失败：没有获取到文件数据' }
      }
      buffer = dl.buffer
    } else if (imageUrl) {
      const https = require('https')
      const http = require('http')
      buffer = await new Promise((resolve, reject) => {
        const client = String(imageUrl).startsWith('https:') ? https : http
        client
          .get(imageUrl, (res) => {
            if (res.statusCode !== 200) {
              reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`))
              return
            }
            const chunks = []
            res.on('data', (c) => chunks.push(c))
            res.on('end', () => resolve(Buffer.concat(chunks)))
            res.on('error', reject)
          })
          .on('error', reject)
      })
    } else {
      if (typeof imageBuffer === 'string') {
        const base64Data = imageBuffer.replace(/^data:image\/[a-z]+;base64,/, '')
        buffer = Buffer.from(base64Data, 'base64')
      } else {
        buffer = Buffer.from(imageBuffer)
      }
    }
    if (!buffer || buffer.length === 0) {
      return { success: false, message: '图片数据为空' }
    }
    // 自动检测 MIME 类型，避免 contentType 与实际不一致
    if (buffer.length >= 4) {
      if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
        contentType = 'image/jpeg'
      } else if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
        contentType = 'image/png'
      }
    }
    const result = await cloud.openapi.security.imgSecCheck({
      media: { contentType, value: buffer }
    })
    if (result && result.errCode === 0) {
      return { success: true, data: { status: 'pass' } }
    }
    if (result && result.errCode === 87014) {
      return { success: false, data: { status: 'risky', message: '图片内容可能存在风险' } }
    }
    return {
      success: false,
      message: `内容检测失败: ${result ? (result.errMsg || '未知错误') : '无响应'}`,
      errCode: result ? result.errCode : undefined
    }
  } catch (error) {
    if (error && error.errCode === 87014) {
      return { success: false, data: { status: 'risky', message: '图片内容可能存在风险' } }
    }
    const msg = (error && error.message) || '暂不可用'
    if (msg.includes('permission')) {
      return { success: false, message: '内容检测权限未开通，请配置权限后重试' }
    }
    if (msg.includes('timeout') || msg.includes('network')) {
      return { success: false, message: '网络连接超时，请重试' }
    }
    return { success: false, message: '内容检测服务暂时不可用，请稍后重试', error: msg }
  }
}

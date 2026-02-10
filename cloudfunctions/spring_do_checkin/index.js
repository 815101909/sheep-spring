// 云函数：spring_do_checkin
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

function formatDateYYYYMMDD(d) {
  const t = new Date(d.getTime() + 8 * 60 * 60 * 1000)
  const year = t.getUTCFullYear()
  const month = String(t.getUTCMonth() + 1).padStart(2, '0')
  const day = String(t.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function toDateStrFromTs(ts) {
  const d = new Date(ts + 8 * 60 * 60 * 1000)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getCnDayRange(dateStr) {
  const parts = String(dateStr).split('-')
  const y = Number(parts[0])
  const m = Number(parts[1])
  const dNum = Number(parts[2])
  const start = Date.UTC(y, m - 1, dNum) - 8 * 60 * 60 * 1000
  const end = start + 24 * 60 * 60 * 1000
  return { start, end }
}

async function getUserByOpenId(openid) {
  const res = await db.collection('springuser').where({ _openid: openid }).get()
  return res.data && res.data.length ? res.data[0] : null
}

async function getDailyAvatar(date) {
  try {
    const col = db.collection('spring_daily_avatar')
    const res1 = await col.where({ date }).limit(1).get()
    console.log('spring_do_checkin:daily_match_equal', { count: res1 && res1.data ? res1.data.length : 0 })
    if (res1.data && res1.data.length) return res1.data[0]
  } catch (e1) {
    console.log('spring_do_checkin:daily_query_date_eq_error', e1)
  }
  try {
    const { start, end } = getCnDayRange(date)
    // 优先使用 date 为 13 位时间戳的区间判断
    const resDateTs = await db.collection('spring_daily_avatar').where({ date: _.gte(start).lt(end) }).limit(1).get()
    console.log('spring_do_checkin:daily_match_date_ts', { start, end, count: resDateTs && resDateTs.data ? resDateTs.data.length : 0 })
    if (resDateTs.data && resDateTs.data.length) return resDateTs.data[0]
    // 兼容 dateTs 字段
    const res2 = await db.collection('spring_daily_avatar').where({ dateTs: _.gte(start).lt(end) }).limit(1).get()
    console.log('spring_do_checkin:daily_match_dateTs', { start, end, count: res2 && res2.data ? res2.data.length : 0 })
    if (res2.data && res2.data.length) return res2.data[0]
  } catch (e2) {
    console.log('spring_do_checkin:daily_query_dateTs_range_error', e2)
  }
  try {
    const { start, end } = getCnDayRange(date)
    const res3 = await db.collection('spring_daily_avatar').where({ publish_date: _.gte(start).lt(end) }).limit(1).get()
    console.log('spring_do_checkin:daily_match_publish_date', { start, end, count: res3 && res3.data ? res3.data.length : 0 })
    if (res3.data && res3.data.length) return res3.data[0]
  } catch (e3) {
    console.log('spring_do_checkin:daily_query_publish_date_range_error', e3)
  }
  return null
}

async function getDailyAvatarDebug(date) {
  let doc = null
  let matchKey = ''
  const stats = {
    eq: 0,
    dateRangeMs: 0,
    dateRangeSec: 0,
    dateTsMs: 0,
    dateTsSec: 0,
    publishMs: 0,
    publishSec: 0,
    publishDateMs: 0,
    publishDateSec: 0
  }
  const candidates = []
  try {
    const col = db.collection('spring_daily_avatar')
    const r1 = await col.where({ date }).limit(1).get()
    stats.eq = r1 && r1.data ? r1.data.length : 0
    if (stats.eq) { doc = r1.data[0]; matchKey = 'date_eq' }
  } catch (e) {}
  try {
    const { start, end } = getCnDayRange(date)
    if (!doc) {
      const r2 = await db.collection('spring_daily_avatar').where({ date: _.gte(start).lt(end) }).limit(20).get()
      stats.dateRangeMs = r2 && r2.data ? r2.data.length : 0
      if (stats.dateRangeMs) candidates.push(...r2.data)
    }
    const r3 = await db.collection('spring_daily_avatar').where({ dateTs: _.gte(start).lt(end) }).limit(20).get()
    stats.dateTsMs = r3 && r3.data ? r3.data.length : 0
    if (stats.dateTsMs) candidates.push(...r3.data)
    const r4 = await db.collection('spring_daily_avatar').where({ publish_date: _.gte(start).lt(end) }).limit(20).get()
    stats.publishMs = r4 && r4.data ? r4.data.length : 0
    if (stats.publishMs) candidates.push(...r4.data)
    const r5 = await db.collection('spring_daily_avatar').where({ date: _.gte(start / 1000).lt(end / 1000) }).limit(20).get()
    stats.dateRangeSec = r5 && r5.data ? r5.data.length : 0
    if (stats.dateRangeSec) candidates.push(...r5.data)
    const r6 = await db.collection('spring_daily_avatar').where({ dateTs: _.gte(start / 1000).lt(end / 1000) }).limit(20).get()
    stats.dateTsSec = r6 && r6.data ? r6.data.length : 0
    if (stats.dateTsSec) candidates.push(...r6.data)
    const r7 = await db.collection('spring_daily_avatar').where({ publish_date: _.gte(start / 1000).lt(end / 1000) }).limit(20).get()
    stats.publishSec = r7 && r7.data ? r7.data.length : 0
    if (stats.publishSec) candidates.push(...r7.data)
    const r8 = await db.collection('spring_daily_avatar').where({ publishDate: _.gte(start).lt(end) }).limit(20).get()
    stats.publishDateMs = r8 && r8.data ? r8.data.length : 0
    if (stats.publishDateMs) candidates.push(...r8.data)
    const r9 = await db.collection('spring_daily_avatar').where({ publishDate: _.gte(start / 1000).lt(end / 1000) }).limit(20).get()
    stats.publishDateSec = r9 && r9.data ? r9.data.length : 0
    if (stats.publishDateSec) candidates.push(...r9.data)
  } catch (e2) {}
  if (!doc) {
    if (candidates.length) { doc = candidates[0]; matchKey = 'first_candidate' }
  }
  if (!doc) {
    try {
      const r5 = await db.collection('spring_daily_avatar').orderBy('date', 'desc').limit(1).get()
      const cnt = r5 && r5.data ? r5.data.length : 0
      if (cnt) {
        const last = r5.data[0]
        const ds = toDateStrFromTs(last.date)
        if (ds === date) { doc = last; matchKey = 'date_orderby_fallback' }
      }
    } catch (e3) {}
  }
  return { doc, stats, matchKey }
}

async function ensureUnlockByDate(userId, openid, avatarUrl, checkinId, date, dailyAvatarId) {
  try {
    const unlockId = `spring_${userId}_${date}`
    const exists = await db.collection('spring_avatar_unlock').where({ _id: unlockId }).get()
    if (!exists.data || exists.data.length === 0) {
      await db.collection('spring_avatar_unlock').add({
        data: {
          _id: unlockId,
          _openid: openid,
          userId,
          avatarUrl: avatarUrl || '',
          unlockedAt: Date.now(),
          source: 'daily',
          checkinId,
          checkinDate: date,
          dailyAvatarId: dailyAvatarId || ''
        }
      })
    }
  } catch (e) {
    console.log('spring_do_checkin:ensureUnlock_error', e)
  }
}

async function updateUserStats(user, date) {
  // 统计连续天数：查询最近1000条打卡记录计算
  let continuousDays = 0
  try {
    const recRes = await db.collection('spring_checkin').where({ userId: user.userId }).orderBy('checkedAt', 'desc').limit(1000).get()
    const set = new Set((recRes.data || []).map(x => x.date))
    const today = new Date(date)
    for (let i = 0; i < 365; i++) {
      const t = new Date(today)
      t.setDate(today.getDate() - i)
      const ds = formatDateYYYYMMDD(t)
      if (set.has(ds)) continuousDays++
      else break
    }
    const total = (recRes.data || []).length
    await db.collection('springuser').doc(user._id).update({
      data: {
        checkinDays: continuousDays,
        totalCheckins: total,
        lastCheckinDate: Date.now(),
        updateTime: Date.now()
      }
    })
  } catch (e) {
    // 忽略统计失败
  }
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { OPENID, FROM_OPENID } = wxContext
  const openid = FROM_OPENID || OPENID

  const now = new Date()
  const date = formatDateYYYYMMDD(now)

  try {
    console.log('spring_do_checkin:start', { openid, date, event })
    const user = await getUserByOpenId(openid)
    console.log('spring_do_checkin:user', { found: !!user, userId: user && user.userId, _id: user && user._id })
    if (!user || !user.userId) {
      console.log('spring_do_checkin:no_user')
      return { code: -2, msg: 'user not found or userId missing' }
    }

    const checkinId = `spring_${user.userId}_${date}`
    let existed = null
    try {
      existed = await db.collection('spring_checkin').where({ _id: checkinId }).get()
    } catch (e) {
      console.log('spring_do_checkin:checkin_collection_query_error', e)
    }
    console.log('spring_do_checkin:existed', { count: existed && existed.data && existed.data.length })
    if (existed && existed.data && existed.data.length) {
      console.log('spring_do_checkin:already_checked')
      return { code: 1, msg: 'already checked', data: existed.data[0] }
    }

    const dailyInfo = await getDailyAvatarDebug(date)
    const daily = dailyInfo.doc
    console.log('spring_do_checkin:daily', { exists: !!daily, avatarId: daily && daily.avatarId, matchKey: dailyInfo.matchKey, stats: dailyInfo.stats })
    const hasAvatar = !!daily
    let rewardStatus = hasAvatar ? 'success' : 'fail'
    let rewardAvatarId = ''
    let rewardAvatarUrl = hasAvatar ? (daily.avatarUrl || '') : ''

    const writeDoc = {
      _id: checkinId,
      _openid: openid,
      userId: user.userId,
      date,
      checkedAt: Date.now(),
      rewardStatus,
      hasAvatar,
      rewardAvatarId,
      rewardAvatarUrl,
      dailyAvatarId: daily ? daily._id || '' : '' ,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    let addRes
    try {
      addRes = await db.collection('spring_checkin').add({ data: writeDoc })
      console.log('spring_do_checkin:added', { _id: addRes && addRes._id })
    } catch (e) {
      console.error('spring_do_checkin:checkin_collection_add_error', e)
      return { code: -5, msg: 'collection missing: spring_checkin', error: String(e && e.message || e) }
    }

    if (hasAvatar) {
      await ensureUnlockByDate(user.userId, openid, rewardAvatarUrl, checkinId, date, daily ? daily._id || '' : '')
      console.log('spring_do_checkin:ensureUnlock_done', { date })
    }

    await updateUserStats(user, date)
    console.log('spring_do_checkin:updateUserStats_done')

    return { code: 0, msg: 'checkin success', data: writeDoc, debug: { daily: dailyInfo } }
  } catch (err) {
    console.error('spring_do_checkin:error', err)
    return { code: -1, msg: 'checkin failed', error: String(err && err.message || err) }
  }
}

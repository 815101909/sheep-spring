const favoriteManager = require('./favoriteManager')

const STORAGE_KEY = 'global_reminders'
const LAST_SHOWN_KEY = 'global_reminder_last_shown'

function load() {
  return wx.getStorageSync(STORAGE_KEY) || []
}

function save(list) {
  wx.setStorageSync(STORAGE_KEY, list || [])
}

function add(item) {
  if (!item || !item.id) return
  const list = load()
  const existsIndex = list.findIndex(x => x.id === item.id)
  if (existsIndex >= 0) {
    list[existsIndex] = { ...list[existsIndex], ...item, result: item.result || list[existsIndex].result || null }
  } else {
    list.push({ ...item, favorited: !!item.favorited, result: null })
  }
  save(list)
}

function remove(id) {
  if (!id) return
  const list = load().filter(x => x.id !== id)
  save(list)
}

function markNotified(id) {
  const list = load()
  const idx = list.findIndex(x => x.id === id)
  if (idx >= 0) {
    list[idx].notified = true
    save(list)
    const aid = list[idx].articleId || ''
    if (aid) {
      const key = `reminders_${aid}`
      const local = wx.getStorageSync(key) || []
      const i2 = local.findIndex(x => x.id === id)
      if (i2 >= 0) {
        local[i2].notified = true
        wx.setStorageSync(key, local)
      }
    }
  }
}

function markResult(id, result) {
  const list = load()
  const idx = list.findIndex(x => x.id === id)
  if (idx >= 0) {
    list[idx].result = result || null
    list[idx].completedAt = Date.now()
    list[idx].notified = true
    save(list)
    const aid = list[idx].articleId || ''
    if (aid) {
      const key = `reminders_${aid}`
      const local = wx.getStorageSync(key) || []
      const i2 = local.findIndex(x => x.id === id)
      if (i2 >= 0) {
        local[i2].result = result || null
        local[i2].completedAt = list[idx].completedAt
        local[i2].notified = true
        wx.setStorageSync(key, local)
      }
    }
  }
}

function markFavorited(id) {
  const list = load()
  const idx = list.findIndex(x => x.id === id)
  if (idx >= 0) {
    list[idx].favorited = true
    save(list)
  }
}

function checkAndNotify() {
  const list = load()
  const now = Date.now()
  const lastShown = wx.getStorageSync(LAST_SHOWN_KEY) || ''
  for (let i = 0; i < list.length; i++) {
    const it = list[i]
    if (!it.notified && it.dueAt <= now) {
      const rid = it.id
      if (lastShown === rid) return
      wx.setStorageSync(LAST_SHOWN_KEY, rid)
      try {
        const app = getApp && getApp();
        if (app && app.playClickSound) app.playClickSound();
      } catch (_) {}
      wx.showModal({
        title: '目标到期',
        content: String(it.content || ''),
        confirmText: '完成',
        cancelText: '未完成',
        success: (res) => {
          try {
            const app = getApp && getApp();
            if (app && app.playClickSound) setTimeout(() => app.playClickSound(), 50);
          } catch (_) {}
          if (res.confirm) {
            markResult(rid, 'done')
          } else {
            markResult(rid, 'missed')
          }
        }
      })
      return
    }
  }
}

module.exports = {
  add,
  remove,
  markNotified,
  markResult,
  markFavorited,
  checkAndNotify
}

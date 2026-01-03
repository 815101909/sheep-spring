// utils/favoriteManager.js

/**
 * 统一收藏管理器
 * 用于管理音乐和文章的收藏，实现“一个数据集”的设计理念。
 * 数据存储在本地缓存 'unified_favorites' 中，并同步到云数据库 'spring_user_favorites'。
 */

const STORAGE_KEY = 'unified_favorites';
const CLOUD_COLLECTION = 'spring_user_favorites';
const CLOUD_ENV = 'cloud1-1gsyt78b92c539ef';
const CLOUD_APPID = 'wx85d92d28575a70f4';

class FavoriteManager {
  constructor() {
    this._favorites = this._load();
    this._deduplicate(); // 初始化时去重
    this._initCloud();
  }

  /**
   * 去重逻辑
   * 确保同一类型下 ID 唯一
   */
  _deduplicate() {
    const uniqueMap = new Map();
    const uniqueFavorites = [];
    
    // 保留最新的记录（因为是 unshift 添加，前面的可能是新的，也可能是旧的，取决于加载顺序）
    // 假设 _favorites 顺序是：最新在最前（因为 add 是 unshift）
    // 我们遍历时，如果遇到已存在的 ID，就跳过（保留第一个，即最新的）
    
    for (const item of this._favorites) {
      const ct = item && item.data && item.data.cardType ? item.data.cardType : null;
      const key = ct ? `${item.type}_${item.id}_${ct}` : `${item.type}_${item.id}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, true);
        uniqueFavorites.push(item);
      }
    }
    
    if (uniqueFavorites.length !== this._favorites.length) {
      console.log(`FavoriteManager: Cleaned up ${this._favorites.length - uniqueFavorites.length} duplicate items.`);
      this._favorites = uniqueFavorites;
      this._save();
    }
  }

  async _initCloud() {
    if (this._cloudInitialized) return;
    try {
      this.c1 = new wx.cloud.Cloud({
        resourceAppid: CLOUD_APPID,
        resourceEnv: CLOUD_ENV,
      });
      await this.c1.init();
      this.db = this.c1.database();
      this._cloudInitialized = true;
      console.log('FavoriteManager: Cloud initialized');
      // 初始化后，可以考虑静默同步一次
      // this._syncFromCloud(); 
    } catch (e) {
      console.error('FavoriteManager: Cloud init failed', e);
    }
  }

  _load() {
    try {
      return wx.getStorageSync(STORAGE_KEY) || [];
    } catch (e) {
      console.error('加载收藏数据失败', e);
      return [];
    }
  }

  _save() {
    try {
      wx.setStorageSync(STORAGE_KEY, this._favorites);
    } catch (e) {
      console.error('保存收藏数据失败', e);
    }
  }

  /**
   * 添加收藏
   * @param {Object} item - 收藏对象
   * @param {string} type - 类型 ('music' | 'article')
   */
  async add(item, type) {
    if (!item || !item.id) return;

    // 检查是否已存在
    const ct = item.cardType || (item.data && item.data.cardType) || null;
    if (ct ? this.isFavorite(item.id, type, ct) : this.isFavorite(item.id, type)) return;

    const newItem = {
      id: item.id,
      type: type,
      title: item.title || item.titleCn || '未知标题',
      subtitle: item.artist || item.category || '', // 音乐存歌手，文章存分类
      cover: item.cover || item.image || item.poster || '', // 统一封面字段
      data: item, // 保存原始数据，以便恢复
      createdAt: Date.now()
    };

    // 1. 本地更新
    this._favorites.unshift(newItem); // 添加到开头
    this._save();

    // 2. 云端异步更新
    this._addToCloud(newItem);
  }

  /**
   * 移除收藏
   * (注意：这里保留旧的 remove 签名作为重载入口，实际逻辑在下面)
   */
  
  /**
   * 切换收藏状态
   * @param {Object} item - 收藏对象
   * @param {string} type - 类型
   * @returns {boolean} - 新的收藏状态 (true: 已收藏, false: 未收藏)
   */
  toggle(item, type) {
    // 获取 item 中的 cardType，如果没有则默认为 null
    const cardType = item.cardType || (item.data && item.data.cardType) || null;
    
    // 使用新的匹配逻辑：如果 item 有 cardType，就精确匹配；否则模糊匹配
    const isFav = cardType ? this.isFavorite(item.id, type, cardType) : this.isFavorite(item.id, type);

    if (isFav) {
      // 移除时也要精确匹配
      this.remove(item.id, type, cardType);
      return false;
    } else {
      this.add(item, type);
      return true;
    }
  }
  
  /**
   * 移除收藏
   * @param {string|number} id - 对象ID
   * @param {string} type - 类型
   * @param {string} cardType - 可选
   */
  async remove(id, type, cardType = null) {
    const initialLength = this._favorites.length;
    
    this._favorites = this._favorites.filter(f => {
      // 如果需要匹配 cardType
      if (cardType) {
        // 如果 ID 和 Type 匹配，且 cardType 也匹配，则移除（返回 false）
        const isMatch = f.id == id && f.type === type && f.data && f.data.cardType === cardType;
        return !isMatch; 
      }
      // 否则只匹配 ID 和 Type
      return !(f.id == id && f.type === type);
    });
    
    if (this._favorites.length !== initialLength) {
      // 1. 本地更新
      this._save();
      // 2. 云端异步更新
      this._removeFromCloud(id, type, cardType);
    }
  }

  isFavorite(id, type, cardType = null) {
    if (cardType) {
      return this._favorites.some(f => f.id == id && f.type === type && f.data && f.data.cardType === cardType);
    }
    return this._favorites.some(f => f.id == id && f.type === type);
  }

  getAll(type = 'all') {
    if (type === 'all') {
      return this._favorites;
    }
    return this._favorites.filter(f => f.type === type);
  }

  // --- 云端操作私有方法 ---

  async _addToCloud(item) {
    if (!this._cloudInitialized) await this._initCloud();
    if (!this.db) return;

    try {
      await this.db.collection(CLOUD_COLLECTION).add({
        data: {
          target_id: item.id,
          type: item.type,
          data: item.data, // 存储快照
          created_at: this.db.serverDate()
        }
      });
      console.log('Added to cloud:', item.id);
    } catch (e) {
      console.error('Failed to add to cloud:', e);
    }
  }

  async _removeFromCloud(id, type, cardType = null) {
    if (!this._cloudInitialized) await this._initCloud();
    if (!this.db) return;

    try {
      // 构建查询条件
      const whereCondition = {
        target_id: id,
        type: type
      };
      
      // 如果指定了 cardType，则需要在 data 字段中查找匹配的 cardType
      // 注意：云开发查询嵌套对象可能需要用 data.cardType
      if (cardType) {
        whereCondition['data.cardType'] = cardType;
      }

      const res = await this.db.collection(CLOUD_COLLECTION).where(whereCondition).get();

      if (res.data.length > 0) {
        const deletePromises = res.data.map(doc => 
          this.db.collection(CLOUD_COLLECTION).doc(doc._id).remove()
        );
        await Promise.all(deletePromises);
        console.log('Removed from cloud:', id, cardType);
      } else {
        console.log('No cloud record found to remove:', id, type, cardType);
      }
    } catch (e) {
      console.error('Failed to remove from cloud:', e);
    }
  }

  /**
   * 从云端同步数据 (通常在App启动或Collection页面加载时调用)
   */
  async syncFromCloud() {
    if (!this._cloudInitialized) await this._initCloud();
    if (!this.db) return [];

    try {
      // 使用云函数获取，确保安全过滤 openid
      // 调用 Spring 项目下的云函数 (使用默认 wx.cloud)
      // 注意：需要显式指定环境 ID，否则可能默认调用到不存在的环境
      // 这里的环境 ID 应该是 "一只绵羊的春天" 这个小程序所绑定的云环境
      // 根据之前的代码，资源方环境是 cloud1-1gsyt78b92c539ef
      // 如果 spring_get_favorites 部署在这个环境里，我们需要初始化一个对应环境的 cloud 实例来调用
      
      let cloudInstance = wx.cloud;
      
      // 如果默认环境不是目标环境，或者跨环境调用失败，我们尝试显式指定
      // 但 wx.cloud.callFunction 通常调用的是当前小程序环境下的云函数
      // 错误提示 env not exists 说明当前上下文找不到对应的环境
      
      // 尝试使用 c1 实例调用（如果 c1 初始化的就是这个环境）
      // 之前初始化 c1 用的是: resourceEnv: CLOUD_ENV ('cloud1-1gsyt78b92c539ef')
      if (this.c1) {
          cloudInstance = this.c1;
      }
      
      const res = await cloudInstance.callFunction({
        name: 'spring_get_favorites',
        data: {}
      });

      if (!res.result.success) {
        console.error('Cloud function fetch failed:', res.result.error);
        return this._favorites;
      }
      
      const cloudData = res.result.data;
      console.log('Cloud fetch result (via function):', cloudData); 

      // 转换为本地格式
      const formattedData = cloudData.map(item => {
        const raw = item.data || {};
        return {
          id: item.target_id,
          type: item.type,
          title: raw.title || raw.titleCn || '未知标题',
          subtitle: raw.artist || raw.category || '',
          cover: raw.cover || raw.image || raw.poster || '',
          data: raw,
          createdAt: item.created_at ? new Date(item.created_at).getTime() : Date.now()
        };
      });

      // 更新本地缓存 (简单覆盖或合并，这里选择覆盖以云端为准)
      this._favorites = formattedData;
      this._save();
      console.log('Synced from cloud:', formattedData.length);
      return this._favorites;
    } catch (e) {
      let appId = '';
      try { const info = wx.getAccountInfoSync(); appId = info && info.miniProgram && info.miniProgram.appId || ''; } catch(_) {}
      if (appId === 'wx3a62e1a7b032e0f9') {
        try {
          const res2 = await this.db.collection('summer_user_favorites')
            .where({ _openid: '{openid}' })
            .orderBy('created_at', 'desc')
            .limit(100)
            .get();
          const cloudData2 = res2.data || [];
          const formattedData2 = cloudData2.map(item => {
            const raw = item.data || {};
            return {
              id: item.target_id,
              type: item.type,
              title: raw.title || raw.titleCn || '未知标题',
              subtitle: raw.artist || raw.category || '',
              cover: raw.cover || raw.image || raw.poster || '',
              data: raw,
              createdAt: item.created_at ? new Date(item.created_at).getTime() : Date.now()
            };
          });
          this._favorites = formattedData2;
          this._save();
          return this._favorites;
        } catch(_) { return this._favorites; }
      }
      return this._favorites;
    }
  }
}

// 导出单例
module.exports = new FavoriteManager();

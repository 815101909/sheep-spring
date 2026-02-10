Page({
  data: {
    articleId: '',
    printImage: '',
    printImages: []
  },
  onLoad: async function (options) {
    const articleId = options.articleId || '';
    const coverUrl = options.coverUrl ? decodeURIComponent(options.coverUrl) : '';
    if (!articleId) {
      wx.showToast({ title: '缺少文章ID', icon: 'none' });
      return;
    }
    this.setData({ articleId, optionsCoverUrl: coverUrl });
    wx.setNavigationBarTitle({ title: '打印预览' });
    await this.loadPrintImage(articleId);
  },
  loadPrintImage: async function (articleId) {
    wx.showLoading({ title: '加载中...' });
    try {
      const c1 = new wx.cloud.Cloud({
        resourceAppid: 'wx85d92d28575a70f4',
        resourceEnv: 'cloud1-1gsyt78b92c539ef',
      });
      await c1.init();
      const db = c1.database();
      const res = await db.collection('spring_hoofprint_articles').doc(articleId).get();
      const data = res.data || {};
      // FIXED: 使用固定的打印页图片，不再从数据库读取 data.print
      let images = ['cloud://cloud1-1gsyt78b92c539ef.636c-cloud1-1gsyt78b92c539ef-1370520707/mianyang/春区域图.png'];
      
      const fileListToConvert = (images || []).filter(u => typeof u === 'string' && u.startsWith('cloud://'));
      if (fileListToConvert.length > 0) {
        try {
          const tempRes = await c1.getTempFileURL({
            fileList: fileListToConvert,
            config: { maxAge: 3 * 60 * 60 }
          });
          const map = {};
          (tempRes.fileList || []).forEach(item => {
            if (item.status === 0) map[item.fileID] = item.tempFileURL;
          });
          images = images.map(u => (map[u] ? map[u] : u));
        } catch (_) {}
      }
      this.setData({ printImages: images, printImage: images[0] || '' });
      // 图片加载完成后，开始合成文字
      if (images.length > 0) {
        this.processImagesWithText(images, articleId, data);
      }
    } catch (err) {
      console.error('加载打印图片失败', err);
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },
  previewImage: function () {
    const url = this.data.printImage
    if (!url) return
    wx.previewImage({ current: url, urls: [url] })
  },
  previewImage: function (e) {
    const url = (e && e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.url) || this.data.printImage
    if (!url) return
    const urls = (this.data.printImages && this.data.printImages.length) ? this.data.printImages : [url]
    wx.previewImage({ current: url, urls })
  },

  /**
   * 合成图片与文字
   * 将用户信息、日期等绘制到图片各个区域
   */
  processImagesWithText: async function(images, articleId, articleData) {
    const that = this;
    const query = wx.createSelectorQuery();
    query.select('#printCanvas')
      .fields({ node: true, size: true })
      .exec(async (res) => {
        if (!res[0] || !res[0].node) return;
        
        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        const processedImages = [];

        // --- 1. 准备数据 ---
        
        // (1) 日期
        const pd = articleData.publish_date;
        let d;
        if (pd !== undefined && pd !== null) {
            if (typeof pd === 'number') {
                d = new Date(pd > 1e12 ? pd : pd * 1000);
            } else if (typeof pd === 'string') {
                const n = Number(pd);
                d = !isNaN(n) ? new Date(n > 1e12 ? n : n * 1000) : new Date(pd);
            } else if (pd && typeof pd === 'object') {
                if (Object.prototype.toString.call(pd) === '[object Date]') {
                    d = pd;
                } else if ('time' in pd && typeof pd.time === 'number') {
                    d = new Date(pd.time > 1e12 ? pd.time : pd.time * 1000);
                } else {
                    d = new Date();
                }
            } else {
                d = new Date();
            }
        } else {
            d = new Date();
        }
        const dateStr = `${d.getFullYear()}.${(d.getMonth() + 1).toString().padStart(2, '0')}.${d.getDate().toString().padStart(2, '0')}`;
        
        // (2) 标题
        const title = articleData.title || '无标题';
        
        // (3) 封面图 (需转链接)
        // 尝试多个字段名，防止字段不匹配
        let coverUrl = that.data.optionsCoverUrl || articleData.cover_image || articleData.cover || articleData.image || articleData.img || articleData.poster || '';
        
        // (4) 知识探秘文字
        const content = articleData.content || '暂无内容';
        
        // (5) 打卡的图片 (亲子同行)
        // 优先取 fileId，其次 url，最后本地路径
        let parentPhotoUrl = 
          wx.getStorageSync(`parent_task_photo_url_${articleId}`) || 
          wx.getStorageSync(`parent_task_photo_${articleId}`) || 
          '';
        const parentPhotoFileId = wx.getStorageSync(`parent_task_photo_fileid_${articleId}`);
        if (parentPhotoFileId) parentPhotoUrl = parentPhotoFileId;

        // (6) 想说的话 (左下角)
        // 优先取 mailbox，其次 userNote (旧逻辑)
        const mailbox = wx.getStorageSync(`mailbox_${articleId}`) || [];
        const userNote = (mailbox.length > 0 ? mailbox[0].text : '') || wx.getStorageSync('userNote') || '愿你的每一天都充满阳光与温暖。';

        // (7) 写给未来的自己 (右下角)
        const reminders = wx.getStorageSync(`reminders_${articleId}`) || [];
        // 取最新的一条
        let futureNote = '';
        let futureDateStr = '';
        if (reminders.length > 0) {
            // 排序找最新的
            reminders.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            const r = reminders[0];
            futureNote = r.content || '';
            if (r.dueAt) {
                const d = new Date(r.dueAt);
                futureDateStr = `${d.getFullYear()}.${(d.getMonth() + 1).toString().padStart(2, '0')}.${d.getDate().toString().padStart(2, '0')}`;
            }
        }
        if (!futureNote) futureNote = '记得给未来的自己写封信哦';
        if (!futureDateStr) futureDateStr = dateStr;

        // --- 批量转换云链接 ---
        const urlsToConvert = [];
        if (coverUrl && coverUrl.startsWith('cloud://')) urlsToConvert.push(coverUrl);
        if (parentPhotoUrl && parentPhotoUrl.startsWith('cloud://')) urlsToConvert.push(parentPhotoUrl);
        
        if (urlsToConvert.length > 0) {
           try {
              const c1 = new wx.cloud.Cloud({
                resourceAppid: 'wx85d92d28575a70f4',
                resourceEnv: 'cloud1-1gsyt78b92c539ef',
              });
              await c1.init();
              const tempRes = await c1.getTempFileURL({
                fileList: urlsToConvert,
                config: { maxAge: 3 * 60 * 60 }
              });
              if (tempRes.fileList) {
                  tempRes.fileList.forEach(item => {
                      if (item.status === 0) {
                          if (item.fileID === coverUrl) coverUrl = item.tempFileURL;
                          if (item.fileID === parentPhotoUrl) parentPhotoUrl = item.tempFileURL;
                      }
                  });
              }
           } catch (e) {
               console.error('链接转换失败', e);
           }
        }

        const printData = {
            date: dateStr,
            title: title,
            cover: coverUrl,
            content: content,
            parentPhoto: parentPhotoUrl,
            userNote: userNote,
            futureNote: futureNote,
            futureDate: futureDateStr
        };

        wx.showLoading({ title: '生成打印稿...' });

        for (let i = 0; i < images.length; i++) {
          const src = images[i];
          try {
            const newPath = await that.drawTextOnImage(canvas, ctx, src, printData);
            processedImages.push(newPath);
          } catch (e) {
            console.error('图片处理失败', e);
            processedImages.push(src); // 失败则保留原图
          }
        }

        that.setData({
          printImages: processedImages,
          printImage: processedImages[0] || ''
        });
        
        wx.hideLoading();
      });
  },

  drawTextOnImage: function(canvas, ctx, bgSrc, data) {
    return new Promise((resolve, reject) => {
      const img = canvas.createImage();
      img.src = bgSrc;
      img.onload = async () => {
        const width = img.width;
        const height = img.height;
        
        // 限制最大尺寸
        let drawWidth = width;
        let drawHeight = height;
        const maxSize = 2000;
        if (width > maxSize || height > maxSize) {
            const ratio = width / height;
            if (width > height) {
                drawWidth = maxSize;
                drawHeight = maxSize / ratio;
            } else {
                drawHeight = maxSize;
                drawWidth = maxSize * ratio;
            }
        }

        canvas.width = drawWidth;
        canvas.height = drawHeight;

        // 绘制背景图
        ctx.drawImage(img, 0, 0, drawWidth, drawHeight);

        // --- 绘制各个区域 ---
        
        // 1. 日期 (右上角蓝色标签)
        // 坐标估算: x=72%, y=11.5%
        ctx.fillStyle = '#000000';
        const dateFontSize = Math.floor(drawWidth * 0.025);
        ctx.font = `bold ${dateFontSize}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(data.date, drawWidth * 0.73, drawHeight * 0.13);

        // 2. 标题 (左上中红色气泡)
        // 坐标估算: x=42%, y=20%
        ctx.fillStyle = '#000000';
        const titleFontSize = Math.floor(drawWidth * 0.025); // 字体调小
        ctx.font = `bold ${titleFontSize}px sans-serif`;
        ctx.textAlign = 'center';
        // 换行显示，不再截断
        this.wrapText(ctx, data.title, drawWidth * 0.42, drawHeight * 0.21, drawWidth * 0.18, titleFontSize * 1.2, 1000, true);

        // 3. 封面图 (右上角框内)
        // 坐标估算: x=63%, y=17.5%, w=25%, h=12% (大概比例)
        if (data.cover) {
            await this.drawImageInRect(canvas, ctx, data.cover, 
                drawWidth * 0.63, drawHeight * 0.175, drawWidth * 0.30, drawHeight * 0.13);
        }

        // 4. 知识探秘文字 (左侧虚线框)
        // 坐标估算: x=9%, y=28%, w=36%, h=40%
        ctx.fillStyle = '#555555';
        const contentFontSize = Math.floor(drawWidth * 0.022);
        ctx.font = `${contentFontSize}px sans-serif`;
        ctx.textAlign = 'left';
        this.wrapText(ctx, data.content, drawWidth * 0.09, drawHeight * 0.30, drawWidth * 0.36, contentFontSize * 1.5, drawHeight * 0.40);

        // 5. 打卡的图片 (右侧中间框)
        // 坐标估算: x=60%, y=42%, w=28%, h=15%
        if (data.parentPhoto) {
            await this.drawImageInRect(canvas, ctx, data.parentPhoto,
                drawWidth * 0.60, drawHeight * 0.42, drawWidth * 0.34, drawHeight * 0.16);
        }

        // 6. 想说的话 (左下云朵)
        // 坐标估算: x=16%, y=85%, w=22%
        ctx.fillStyle = '#333333';
        const heartDateSize = Math.floor(drawWidth * 0.018);
        ctx.font = `${heartDateSize}px sans-serif`;
        ctx.textAlign = 'left';
        ctx.fillText(`${data.date}`, drawWidth * 0.29, drawHeight * 0.736);
        ctx.fillStyle = '#008000'; 
        // 原图是深蓝色气泡背景，白色字。如果是用户自己填的“想说的话”气泡，可能是白色背景。
        // 根据截图，左下角是“想对爸爸妈妈说的话”蓝色气泡和下面的红色气泡。
        // 假设填在下方的红色气泡里？截图里写着“想说的话”在红色区域。
        // 坐标: x=18%, y=89%, w=20%
        const noteFontSize = Math.floor(drawWidth * 0.020); // 调小字体以适应云朵
        ctx.font = `${noteFontSize}px sans-serif`;
        ctx.textAlign = 'left'; // 改为左对齐
        // 调整位置适配云朵: 上移, 变窄, 居中
        // 使用自定义形状换行逻辑
        // x 从 0.23 左移一点到 0.16 以适应左对齐起始位置
        // 用户要求下移: y 从 0.83 -> 0.85
        this.wrapTextInCloud(ctx, data.userNote, drawWidth * 0.16, drawHeight * 0.85, noteFontSize * 1.2); 
        // 居中换行比较麻烦，这里简单处理，或者用 left 对齐

        // 7. 写给未来的自己 (右下信纸)
        // 坐标: x=62%, y=78%, w=25%
        ctx.fillStyle = '#333333';
        ctx.textAlign = 'left';
        // 红色区域写“写给自己的话”
        // 截图显示红色区域是内容。
        // 坐标: x=63%, y=81%, w=25%
        ctx.fillStyle = '#494747ff';
        this.wrapText(ctx, data.futureNote, drawWidth * 0.63, drawHeight * 0.82, drawWidth * 0.25, noteFontSize * 1.4, drawHeight * 0.1);

        // 8. 信纸日期 (右下两个小框)
        // 写信日期 (上): x=78%, y=66.5%
        ctx.fillStyle = '#000000';
        const smallDateSize = Math.floor(drawWidth * 0.018);
        ctx.font = `${smallDateSize}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(data.date, drawWidth * 0.80, drawHeight * 0.675);
        
        // 收信日期 (下): x=78%, y=71.5%
        ctx.fillText(data.futureDate, drawWidth * 0.80, drawHeight * 0.714);


        // --- 导出图片 ---
        wx.canvasToTempFilePath({
          canvas: canvas,
          fileType: 'jpg',
          quality: 0.9,
          success: (res) => {
            resolve(res.tempFilePath);
          },
          fail: (err) => {
            reject(err);
          }
        });
      };
      img.onerror = (e) => {
        reject(e);
      };
    });
  },

  // 辅助：在指定区域绘制图片（裁剪/缩放）
  async drawImageInRect(canvas, ctx, src, x, y, w, h) {
      if (!src) return;
      try {
          const img = canvas.createImage();
          img.src = src;
          await new Promise((resolve, reject) => {
              img.onload = resolve;
              img.onerror = reject;
          });
          
          // 计算 cover 模式
          const imgRatio = img.width / img.height;
          const rectRatio = w / h;
          
          let sx, sy, sw, sh;
          
          if (imgRatio > rectRatio) {
              // 图片更宽，裁掉两边
              sh = img.height;
              sw = sh * rectRatio;
              sy = 0;
              sx = (img.width - sw) / 2;
          } else {
              // 图片更高，裁掉上下
              sw = img.width;
              sh = sw / rectRatio;
              sx = 0;
              sy = (img.height - sh) / 2;
          }
          
          ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
      } catch (e) {
          console.error('绘制子图失败', e);
      }
  },

  wrapTextInCloud: function(ctx, text, x, startY, lineHeight) {
    // 云朵形状限制：每行允许的字符数
    // 严格按照用户要求：6, 6, 9, 9, 10, 6
     // 去除所有偏移，完全左对齐
     const lineConfig = [
         { limit: 6, offset: 0 },
         { limit: 6, offset: 0 }, 
         { limit: 9, offset: 0 },
         { limit: 9, offset: 0 }, 
         { limit: 10, offset: 0 },
         { limit: 6, offset: 0 }
     ];
    
    const chars = text.split('');
    let charIndex = 0;
    const fontSize = parseInt(ctx.font, 10);
    
    for (let i = 0; i < lineConfig.length; i++) {
        if (charIndex >= chars.length) break;
        
        const config = lineConfig[i];
        const limit = config.limit;
        let lineStr = '';
        
        // 截取指定数量的字符
        for (let j = 0; j < limit; j++) {
            if (charIndex < chars.length) {
                lineStr += chars[charIndex];
                charIndex++;
            }
        }
        
        // 左对齐绘制，加上行的偏移量
        const xOffset = config.offset * fontSize; 
        ctx.fillText(lineStr, x + xOffset, startY + (i * lineHeight));
    }
  },

  wrapText: function(ctx, text, x, y, maxWidth, lineHeight, maxHeight, center = false) {
    // 支持换行符与高度限制的文本换行
    const norm = String(text || '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n');
    const paragraphs = norm.split('\n');
    let currentY = y;
    const startY = y;
    for (let p = 0; p < paragraphs.length; p++) {
      const chars = paragraphs[p].split('');
      let line = '';
      for (let n = 0; n < chars.length; n++) {
        const ch = chars[n];
        const testLine = line + ch;
        const testWidth = ctx.measureText(testLine).width;
        if (testWidth > maxWidth && line.length > 0) {
          if (center) ctx.fillText(line, x, currentY);
          else ctx.fillText(line, x, currentY);
          line = ch;
          currentY += lineHeight;
          if (maxHeight && (currentY - startY > maxHeight)) return currentY;
        } else {
          line = testLine;
        }
      }
      if (line.length > 0) {
        if (center) ctx.fillText(line, x, currentY);
        else ctx.fillText(line, x, currentY);
        currentY += lineHeight;
        if (maxHeight && (currentY - startY > maxHeight)) return currentY;
      }
    }
    return currentY;
  }
})

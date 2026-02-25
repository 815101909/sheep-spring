// pages/sheep-chat/sheep-chat.js
Page({
  data: {
    messages: [
      {
        id: 1,
        text: "你好呀！我是你的小绵羊朋友，有什么想和我分享的吗？",
        isUser: false,
        timestamp: new Date()
      }
    ],
    inputValue: '',
    isInputFocused: false,
    // 三个功能选项
    features: [
      {
        id: 1,
        title: "倾诉心事",
        icon: "💬",
        desc: "把心里的话都说给我听",
        color: "#ff9eb5"
      },
      {
        id: 2,
        title: "寻求建议",
        icon: "💡",
        desc: "迷茫时让我为你点亮方向",
        color: "#87ceeb"
      },
      {
        id: 3,
        title: "弹走烦恼",
        icon: "✨",
        desc: "一起把烦恼都抛到九霄云外",
        color: "#98fb98"
      }
    ],
    currentFeature: null,
    showFeatureOptions: true
  },

  onLoad() {
    // 页面加载时的初始化
  },

  onShow() {
    // 页面显示时的逻辑
    // 手动更新 tabBar 选中状态
    if (this.getTabBar && typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({
        selected: 3
      });
    }
  },

  // 选择功能
  onSelectFeature(e) {
    const featureId = e.currentTarget.dataset.id;
    const feature = this.data.features.find(f => f.id === featureId);
    
    // 添加轻微的震动反馈
    wx.vibrateShort({ type: 'light' });
    
    this.setData({
      currentFeature: feature,
      showFeatureOptions: false
    });

    // 添加欢迎消息
    this.addMessage(`欢迎来到${feature.title}！${this.getWelcomeMessage(featureId)}`, false);
  },

  // 获取欢迎消息
  getWelcomeMessage(featureId) {
    const messages = {
      1: "我会认真倾听你的每一句话，这里是一个安全的港湾。",
      2: "无论遇到什么困惑，我都会尽力为你提供温暖的建议。",
      3: "让我们一起把那些小烦恼都变成天空中的云朵，随风飘散吧！"
    };
    return messages[featureId] || "";
  },

  // 发送消息
  onSendMessage() {
    const text = this.data.inputValue.trim();
    if (!text) return;

    // 添加用户消息
    this.addMessage(text, true);
    
    // 清空输入框
    this.setData({
      inputValue: ''
    });

    // 模拟绵羊回复（可以根据不同功能定制回复）
    setTimeout(() => {
      this.generateSheepResponse(text);
    }, 1000);
  },

  // 添加消息到聊天记录
  addMessage(text, isUser) {
    const newMessage = {
      id: Date.now(),
      text: text,
      isUser: isUser,
      timestamp: new Date()
    };

    this.setData({
      messages: [...this.data.messages, newMessage]
    });

    // 滚动到底部
    this.scrollToBottom();
  },

  // 生成绵羊回复
  generateSheepResponse(userMessage) {
    let response = '';
    const featureId = this.data.currentFeature && this.data.currentFeature.id;

    // 根据不同功能生成不同的回复
    switch (featureId) {
      case 1: // 倾诉心事
        response = this.getListeningResponse(userMessage);
        break;
      case 2: // 寻求建议
        response = this.getAdviceResponse(userMessage);
        break;
      case 3: // 弹走烦恼
        response = this.getWorryResponse(userMessage);
        break;
      default:
        response = '咩～我在认真听你说呢...';
    }

    this.addMessage(response, false);
  },

  // 倾诉心事的回复
  getListeningResponse(message) {
    const responses = [
      "我能感受到你的心情呢...",
      "谢谢你愿意和我分享这些。",
      "你的感受我很理解。",
      "说出来会好受一些吗？",
      "我在这里陪着你。"
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  },

  // 寻求建议的回复
  getAdviceResponse(message) {
    const responses = [
      "我觉得你可以试着换个角度思考这个问题...",
      "不妨先深呼吸一下，让心情平静下来再决定。",
      "你的想法很有道理呢，相信自己的判断。",
      "有时候慢一点反而能走得更远。",
      "记住，你并不孤单，我会一直支持你。"
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  },

  // 弹走烦恼的回复
  getWorryResponse(message) {
    const responses = [
      "呼～让我们一起把烦恼吹走吧！✨",
      "这些小烦恼就像云朵一样，会慢慢飘散的～",
      "深呼吸，想象烦恼正在远离你...",
      "你比你想象的更坚强呢！",
      "让我们把注意力转向美好的事物吧～"
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  },

  // 返回功能选择
  onBackToFeatures() {
    // 添加返回的震动反馈
    wx.vibrateShort({ type: 'light' });
    
    this.setData({
      showFeatureOptions: true,
      currentFeature: null,
      messages: [
        {
          id: 1,
          text: '你好呀！我是你的小绵羊朋友，有什么想和我分享的吗？',
          isUser: false,
          timestamp: new Date()
        }
      ]
    });
  },

  // 输入框聚焦
  onInputFocus() {
    this.setData({
      isInputFocused: true
    });
    this.scrollToBottom();
  },

  // 输入框失焦
  onInputBlur() {
    this.setData({
      isInputFocused: false
    });
  },

  // 输入内容变化
  onInput(e) {
    this.setData({
      inputValue: e.detail.value
    });
  },

  // 滚动到底部
  scrollToBottom() {
    wx.createSelectorQuery()
      .select('.chat-container')
      .boundingClientRect()
      .selectViewport()
      .scrollOffset()
      .exec(res => {
        wx.pageScrollTo({
          scrollTop: res[0].height,
          duration: 300
        });
      });
  }
});
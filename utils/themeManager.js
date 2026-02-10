const STORAGE_KEY = 'spring_theme_mode';
const DEFAULT_MODE = 'system';

function getSystemTheme() {
  try {
    const info = typeof wx.getAppBaseInfo === 'function' ? wx.getAppBaseInfo() : null;
    const theme = info && info.theme;
    if (theme === 'dark' || theme === 'light') return theme;
  } catch (e) {
  }
  return 'light';
}

function getMode() {
  const mode = wx.getStorageSync(STORAGE_KEY);
  if (!mode) return DEFAULT_MODE;
  if (mode === 'light' || mode === 'dark' || mode === 'system') return mode;
  return DEFAULT_MODE;
}

function isDark() {
  const m = getMode();
  if (m === 'dark') return true;
  if (m === 'light') return false;
  return getSystemTheme() === 'dark';
}

function setMode(mode) {
  const m = mode === 'light' || mode === 'dark' || mode === 'system' ? mode : DEFAULT_MODE;
  try { wx.setStorageSync(STORAGE_KEY, m); } catch (_) {}
}

function applyNavigation() {
  const dark = isDark();
  const frontColor = dark ? '#ffffff' : '#000000';
  const backgroundColor = dark ? '#111111' : '#ffffff';
  try {
    wx.setNavigationBarColor({
      frontColor,
      backgroundColor,
      animation: { duration: 200, timingFunc: 'easeInOut' }
    });
  } catch (_) {}
}

function applyBackground() {
  const dark = isDark();
  const backgroundColor = dark ? '#121212' : '#f8f9fa';
  try {
    wx.setBackgroundColor({
      backgroundColor,
      backgroundColorTop: backgroundColor,
      backgroundColorBottom: backgroundColor
    });
    wx.setBackgroundTextStyle({ textStyle: dark ? 'dark' : 'light' });
  } catch (_) {}
}

function applyToCurrentPage() {
  try {
    const pages = getCurrentPages();
    if (!pages || !pages.length) return;
    const current = pages[pages.length - 1];
    if (typeof current.setData === 'function') {
      current.setData({ themeClass: isDark() ? 'dark' : 'light' });
    }
  } catch (_) {}
}

function applyToCurrentTabBar() {
  try {
    const pages = getCurrentPages();
    if (!pages || !pages.length) return;
    const current = pages[pages.length - 1];
    if (typeof current.getTabBar === 'function') {
      const tb = current.getTabBar();
      if (tb) {
        tb.setData({ themeClass: isDark() ? 'dark' : 'light' });
      }
    }
  } catch (_) {}
}

function applyTheme() {
  applyNavigation();
  applyBackground();
  applyToCurrentTabBar();
  applyToCurrentPage();
}

function applyToPage(page) {
  const dark = isDark();
  if (page && typeof page.setData === 'function') {
    page.setData({ themeClass: dark ? 'dark' : 'light' });
  }
  applyNavigation();
  applyBackground();
  applyToCurrentTabBar();
}

function init() {
  const mode = getMode();
  if (mode === 'system' && typeof wx.onThemeChange === 'function') {
    wx.onThemeChange(function (res) {
      applyTheme();
    });
  }
  applyTheme();
}

module.exports = {
  getMode,
  setMode,
  isDark,
  applyTheme,
  applyToPage,
  init
};

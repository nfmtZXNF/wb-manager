// 酒馆助手 / 酒馆本体接口适配层
const TH = () => {
  const th = window.TavernHelper;
  if (!th)
    throw new Error(
      "需要安装并启用「酒馆助手」扩展（没有检测到 window.TavernHelper）",
    );
  return th;
};

// 补全主窗口 SillyTavern 对象（部分酒馆版本只有精简版）
const LULU_ST_LAZY_PROPS = [
  "characters",
  "chat",
  "chatMetadata",
  "powerUserSettings",
  "extensionSettings",
  "groups",
  "tags",
  "name1",
  "name2",
  "characterId",
  "groupId",
  "onlineStatus",
  "mainApi",
  "menuType",
  "maxContext",
];
export const ensureSillyTavernCompat = () => {
  try {
    const st = window.SillyTavern;
    if (!st || typeof st.getContext !== "function") return false;
    if (
      typeof st.callGenericPopup === "function" &&
      st.Popup &&
      st.POPUP_TYPE &&
      st.POPUP_RESULT
    )
      return true; // 已经是完整版（官方酒馆较新版本），不用补
    const ctx = st.getContext();
    if (!ctx || typeof ctx !== "object") return false;
    for (const [key, value] of Object.entries(ctx)) {
      if (st[key] !== undefined) continue;
      if (LULU_ST_LAZY_PROPS.includes(key)) {
        try {
          Object.defineProperty(st, key, {
            configurable: true,
            get: () => window.SillyTavern.getContext()[key],
          });
        } catch (e) {}
      } else {
        st[key] = value;
      }
    }
    return true;
  } catch (e) {
    return false;
  }
};
ensureSillyTavernCompat();

// 统一包装：调用前检查接口是否存在，缺失时给出可读的报错（而不是 "xxx is not a function"）
const thCall = (name) => (...args) => {
  const th = TH();
  if (typeof th[name] !== "function")
    throw new Error(`酒馆助手缺少 ${name} 接口，请把「酒馆助手」更新到最新版~`);
  return th[name](...args);
};

// —— 酒馆助手：变量系统 ——
export const getVariables = thCall("getVariables");
export const updateVariablesWith = thCall("updateVariablesWith");

// —— 酒馆助手：世界书 ——
export const getWorldbook = thCall("getWorldbook");
export const replaceWorldbook = thCall("replaceWorldbook");
export const createWorldbook = thCall("createWorldbook");
export const deleteWorldbook = thCall("deleteWorldbook");
export const getWorldbookNames = thCall("getWorldbookNames");
export const getCharWorldbookNames = thCall("getCharWorldbookNames");
export const rebindCharWorldbooks = thCall("rebindCharWorldbooks");
export const getGlobalWorldbookNames = thCall("getGlobalWorldbookNames");
export const rebindGlobalWorldbooks = thCall("rebindGlobalWorldbooks");

// —— 酒馆助手：角色 ——
export const getCurrentCharacterName = thCall("getCurrentCharacterName");

// —— 酒馆本体主窗口接口 ——
export const getContext = () => window.SillyTavern.getContext();
export const saveMetadata = async () => {
  const ctx = getContext();
  if (typeof ctx.saveMetadata === "function") return ctx.saveMetadata();
};
export const saveSettingsDebounced = () => {
  const ctx = getContext();
  if (typeof ctx.saveSettingsDebounced === "function")
    return ctx.saveSettingsDebounced();
};

// Token 计算：优先用酒馆主窗口暴露的 getTokenCountAsync，拿不到就用字符数估算
export const getTokenCount = async (text) => {
  if (
    window.SillyTavern &&
    typeof window.SillyTavern.getTokenCountAsync === "function"
  )
    return window.SillyTavern.getTokenCountAsync(text);
  return Math.ceil((text || "").length / 2.5);
};

// 脚本按钮为脚本环境专属，此处为空操作
export const replaceScriptButtons = () => {};

// 等待酒馆助手加载
export const waitForTavernHelper = (timeoutMs = 30000) =>
  new Promise((resolve) => {
    const t0 = Date.now();
    const timer = setInterval(() => {
      if (window.TavernHelper) {
        clearInterval(timer);
        resolve(true);
      } else if (Date.now() - t0 > timeoutMs) {
        clearInterval(timer);
        resolve(false);
      }
    }, 500);
  });

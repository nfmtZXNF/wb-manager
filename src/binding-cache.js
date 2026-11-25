import { luluGetGlobalVars, luluUpdateGlobalVars } from "./state.js";

const loadBindingCache = () => {
  let vars = luluGetGlobalVars();
  return vars.lulu_wb_binding_cache || null;
};
const saveBindingCache = (cacheObj) => {
  luluUpdateGlobalVars(
    (v) => {
      v.lulu_wb_binding_cache = cacheObj;
      return v;
    },
    { type: "global" },
  );
};
// ✨ 已扫描角色名单：记录哪些角色卡的绑定已经进过缓存
// 开面板时只补扫名单之外的新卡片，不用每次全量重扫
const loadScannedAvatarList = () => {
  let vars = luluGetGlobalVars();
  return Array.isArray(vars.lulu_wb_scanned_avatars)
    ? vars.lulu_wb_scanned_avatars
    : null;
};
const saveScannedAvatarList = (arr) => {
  luluUpdateGlobalVars(
    (v) => {
      v.lulu_wb_scanned_avatars = arr;
      return v;
    },
    { type: "global" },
  );
};

export { loadBindingCache, saveBindingCache, loadScannedAvatarList, saveScannedAvatarList };

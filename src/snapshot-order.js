import { luluGetGlobalVars, luluUpdateGlobalVars } from "./state.js";

// ========== 【功能8：快照排序】工具函数 开始 ==========
const getSnapshotOrder = () => {
  let vars = luluGetGlobalVars();
  let order = vars.wb_snapshot_order;
  if (typeof order === "string") {
    try {
      order = JSON.parse(order);
    } catch (e) {
      order = [];
    }
  }
  return Array.isArray(order) ? [...order] : [];
};
const setSnapshotOrder = (arr) => {
  luluUpdateGlobalVars(
    (v) => {
      v.wb_snapshot_order = arr;
      return v;
    },
    { type: "global" },
  );
};
// 按顺序数组给快照名排序，新出现的排最后
const sortSnapshotNames = (names) => {
  let order = getSnapshotOrder();
  let changed = false;
  names.forEach((n) => {
    if (!order.includes(n)) {
      order.push(n);
      changed = true;
    }
  });
  if (changed) setSnapshotOrder(order);
  return [...names].sort((a, b) => {
    let ia = order.indexOf(a);
    let ib = order.indexOf(b);
    if (ia === -1) ia = 9999;
    if (ib === -1) ib = 9999;
    return ia - ib;
  });
};
// 角色快照顺序：按角色名分开存
const getCharSnapshotOrder = (charName) => {
  let vars = luluGetGlobalVars();
  let allOrder = vars.wb_char_snapshot_order;
  if (typeof allOrder === "string") {
    try {
      allOrder = JSON.parse(allOrder);
    } catch (e) {
      allOrder = {};
    }
  }
  if (!allOrder || typeof allOrder !== "object" || Array.isArray(allOrder))
    allOrder = {};
  return Array.isArray(allOrder[charName]) ? [...allOrder[charName]] : [];
};
const setCharSnapshotOrder = (charName, arr) => {
  luluUpdateGlobalVars(
    (v) => {
      let allOrder = v.wb_char_snapshot_order;
      if (typeof allOrder === "string") {
        try {
          allOrder = JSON.parse(allOrder);
        } catch (e) {
          allOrder = {};
        }
      }
      if (!allOrder || typeof allOrder !== "object" || Array.isArray(allOrder))
        allOrder = {};
      allOrder[charName] = arr;
      v.wb_char_snapshot_order = allOrder;
      return v;
    },
    { type: "global" },
  );
};
const sortCharSnapshotNames = (charName, names) => {
  let order = getCharSnapshotOrder(charName);
  let changed = false;
  names.forEach((n) => {
    if (!order.includes(n)) {
      order.push(n);
      changed = true;
    }
  });
  if (changed) setCharSnapshotOrder(charName, order);
  return [...names].sort((a, b) => {
    let ia = order.indexOf(a);
    let ib = order.indexOf(b);
    if (ia === -1) ia = 9999;
    if (ib === -1) ib = 9999;
    return ia - ib;
  });
};
// ========== 【功能8：快照排序】工具函数 结束 ==========


export { getSnapshotOrder, setSnapshotOrder, sortSnapshotNames, getCharSnapshotOrder, setCharSnapshotOrder, sortCharSnapshotNames };

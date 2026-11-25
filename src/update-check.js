// 更新检测与一键更新
import { getContext } from "./compat.js";

const EXT_SHORT_NAME = "wb-manager"; // 扩展文件夹名（= GitHub 仓库名）
const REMOTE_MANIFEST_URL = `https://raw.githubusercontent.com/nfmtZXNF/${EXT_SHORT_NAME}/main/manifest.json`;
const CACHE_KEY = "gwbm_update_check_cache";
const CACHE_TTL = 60 * 1000; // 只防同一次加载里的重复调用；每次开页面都会重新检查

const getRequestHeaders = () => {
  try {
    return getContext().getRequestHeaders();
  } catch (e) {
    return { "Content-Type": "application/json" };
  }
};

// 本地版本：直接读自己目录里的 manifest.json
export const getLocalVersion = async () => {
  try {
    const res = await fetch(new URL("../manifest.json", import.meta.url));
    if (res.ok) return (await res.json()).version || "";
  } catch (e) {}
  return "";
};

// 远程版本号（仅用于徽标上展示，拿不到也不影响更新判断）
const getRemoteVersion = async () => {
  try {
    const res = await fetch(`${REMOTE_MANIFEST_URL}?t=${Date.now()}`);
    if (res.ok) return (await res.json()).version || "";
  } catch (e) {}
  return "";
};

// 发现本扩展在酒馆里的完整目录名与安装类型（global/local）
const discoverSelf = async () => {
  const res = await fetch("/api/extensions/discover", {
    headers: getRequestHeaders(),
  });
  if (!res.ok) return null;
  const list = await res.json();
  const me = (Array.isArray(list) ? list : []).find(
    (e) =>
      e && typeof e.name === "string" && e.name.endsWith(EXT_SHORT_NAME),
  );
  if (!me) return null;
  return { extensionName: me.name, global: me.type === "global" };
};

// 让服务端用 git 检查是否有更新
const checkServerUpdate = async () => {
  const self = await discoverSelf();
  if (!self) return null;
  const res = await fetch("/api/extensions/version", {
    method: "POST",
    headers: getRequestHeaders(),
    body: JSON.stringify({
      extensionName: self.extensionName,
      global: self.global,
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return { ...self, isUpToDate: Boolean(data.isUpToDate) };
};

// 检查更新（带 60 秒防重复缓存；force=true 强制重新检查）
export const checkForUpdates = async (force = false) => {
  if (!force) {
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
      if (cached && Date.now() - cached.time < CACHE_TTL) return cached.result;
    } catch (e) {}
  }
  const result = {
    hasUpdate: false,
    localVer: await getLocalVersion(),
    remoteVer: "",
    server: null,
  };
  const server = await checkServerUpdate().catch(() => null);
  result.server = server;
  if (server && !server.isUpToDate) {
    result.hasUpdate = true;
    result.remoteVer = await getRemoteVersion().catch(() => "");
  }
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ time: Date.now(), result }),
    );
  } catch (e) {}
  return result;
};

// 一键更新：调用酒馆的扩展更新接口（服务端执行 git pull）
export const performUpdate = async (serverInfo) => {
  const attempts = [
    serverInfo, // 先用发现接口拿到的完整目录名
    { extensionName: `third-party/${EXT_SHORT_NAME}`, global: true },
    { extensionName: EXT_SHORT_NAME, global: true },
  ].filter(Boolean);
  let lastError = null;
  for (const info of attempts) {
    try {
      const res = await fetch("/api/extensions/update", {
        method: "POST",
        headers: getRequestHeaders(),
        body: JSON.stringify({
          extensionName: info.extensionName,
          global: info.global !== false,
        }),
      });
      if (!res.ok) {
        lastError = new Error((await res.text()) || res.statusText);
        continue;
      }
      return await res.json(); // { isUpToDate, shortCommitHash }
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError || new Error("更新接口调用失败");
};

// 更新成功后清掉缓存，下次检查重新来
export const clearUpdateCache = () => {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch (e) {}
};

// 读取 CHANGELOG.md 中比本地版本新的条目（最新在前）
const compareVersions = (v1, v2) => {
  const p1 = String(v1 || "").replace(/^v/, "").split(".").map(Number);
  const p2 = String(v2 || "").replace(/^v/, "").split(".").map(Number);
  for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
    const n1 = p1[i] || 0;
    const n2 = p2[i] || 0;
    if (n1 > n2) return 1;
    if (n1 < n2) return -1;
  }
  return 0;
};
export const getChangelog = async (localVer) => {
  try {
    const res = await fetch(
      `https://raw.githubusercontent.com/nfmtZXNF/${EXT_SHORT_NAME}/main/CHANGELOG.md?t=${Date.now()}`,
    );
    if (!res.ok) return [];
    const md = await res.text();
    const entries = [];
    let current = null;
    for (const line of md.split("\n")) {
      const h = line.match(/^##\s+v?(\d+\.\d+\.\d+)/);
      if (h) {
        current = h[1];
        continue;
      }
      const item = line.match(/^-\s+(.+)/);
      if (item && current && compareVersions(current, localVer) > 0) {
        entries.push(item[1].trim());
      }
    }
    return entries.slice(0, 12);
  } catch (e) {
    return [];
  }
};

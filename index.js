// 扩展入口
import { initErrorCapture } from "./src/feedback.js";
import { ensureSillyTavernCompat, waitForTavernHelper } from "./src/compat.js";

initErrorCapture();

(async () => {
  // 等待酒馆助手接口就绪
  const ok = await waitForTavernHelper();
  if (!ok) {
    const msg =
      "「全局世界书管理」需要安装并启用【酒馆助手】扩展才能工作哦~";
    console.error("Lulu WB Manager:", msg);
    try {
      if (typeof toastr !== "undefined") toastr.error(msg);
    } catch (e) {}
    return;
  }
  ensureSillyTavernCompat();
  await import("./src/app.js");
  try {
    console.log("全局世界书管理：扩展加载完成~");
  } catch (e) {}
})();

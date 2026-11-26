# 反馈接收服务部署指南（小白版）

这是跑在你自己 VPS 上的小服务：接收扩展用户发来的反馈（文字/日志/图片），存到文件里；你用浏览器打开「反馈箱」网页就能查看，并可以把处理过的条目标记为已完成。零第三方依赖，只要 Node.js 18+。

---

## 方法一：一键脚本（推荐）

在 FinalShell（或任意 SSH 终端）里，用 **root** 登录 VPS，粘贴这一行：

```bash
curl -fsSL https://cdn.jsdelivr.net/gh/nfmtZXNF/wb-manager@main/server/deploy.sh | bash
```

脚本会自动：装 Node 20（国内镜像）→ 下载服务端文件 → 生成配置 → 注册 systemd 开机自启并启动。

跑完之后**只剩一件脚本替你做不了的事**：

- **腾讯云防火墙**：轻量应用服务器 → 点你的服务器 →「防火墙」→ 添加规则，放通 `TCP` 端口 **8437**。

验证：浏览器打开 `http://你的IP:8437/?token=4a3d80e2e77ce903595b61bc0b08cf0d8579`，能看到「反馈箱」页面 = 成功。

## 反馈箱的使用

- 每条反馈右上角有「标记完成」按钮，处理完点一下就会变灰沉底，再点「恢复」可还原；旁边的「删除」按钮会**连同配图一起彻底删除**（不可恢复，适合清理测试数据）；
- 每条反馈底部有「回复」输入框：写内容点回复后，**对方打开自己的酒馆时会收到提示**，回复内容显示在扩展的「建议 & Bug 反馈」弹窗里——只有发送者本人能看到（凭发送时服务端下发的随机 ID 领取，旁人无法查看）；早期没有 ID 的反馈无法回复；
- 页面顶部显示「N 条待处理 / 共 M 条」，只保留最近 14 天的记录；
- 反馈内容和图片都存在 VPS 的 `/opt/wb-feedback/data/` 里，可以定期清理。

### 服务端升级（比如扩展更新日志里提到反馈服务有更新时）

在 FinalShell 里重新跑一遍一键脚本即可，配置和已有反馈数据都会保留：

```bash
curl -fsSL https://cdn.jsdelivr.net/gh/nfmtZXNF/wb-manager@main/server/deploy.sh | bash
```

> 如果刚推送完新版本脚本拉到的还是旧文件，是 jsdelivr 缓存导致的：浏览器打开
> `https://purge.jsdelivr.net/gh/nfmtZXNF/wb-manager@main/server/feedback-server.js`
> 清一下缓存再重跑即可。

常用维护命令：

```bash
systemctl status wb-feedback     # 看状态
journalctl -u wb-feedback -f     # 看日志（Ctrl+C 退出）
systemctl restart wb-feedback    # 重启
```

---

## 方法二：手动部署（脚本失败时的备选）

<details>
<summary>点开看手动步骤</summary>

1. 腾讯云控制台防火墙放通 TCP 8437；系统若开了 ufw 也放通：
   `sudo ufw allow 8437/tcp`
2. 装 Node：
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt install -y nodejs git
   ```
3. 拉代码：
   ```bash
   git clone https://github.com/nfmtZXNF/wb-manager.git
   cd wb-manager/server
   ```
4. 写配置：
   ```bash
   cp config.example.json config.json
   nano config.json   # token 保持与扩展代码 src/feedback.js 里的 FEEDBACK_TOKEN 一致
   ```
5. 启动常驻：
   ```bash
   sudo npm install -g pm2
   pm2 start feedback-server.js --name wb-feedback
   pm2 save && pm2 startup
   ```

</details>

## 安全建议（有空做一下）

- SSH 改用密钥登录并关掉密码登录（腾讯云控制台可以注入密钥）。
- 防火墙只放通你真正用的端口（22、8437）。
- 令牌虽然公开在扩展代码里（没法避免），但服务端有按 IP 限速（每分钟 5 条）和 10MB 大小上限，乱刷刷不动。

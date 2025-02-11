# NodeGo 全自动交互bot

NodeGo 平台的自动化运行机器人。

## 安装和设置

1. 安装依赖:
```bash
npm install
```

2. 配置环境变量:
   - 打开 `.env` 文件
   - 设置代理配置，格式为: `http://user:password@ip:port` 如不需要代理，可以不用设置
   - 设置你的注册域名列表，格式为: `域名1,域名2,域名3`
   - 设置你的Anticaptcha Key
## 使用教程

1. 注册账号:
```bash
node Register.js
```
注册成功后，账号token将保存在 `token.txt` 文件中

2. 启动机器人:
```bash
npm run start
```

注意：在启动机器人之前，必须先注册账号。账号token会自动保存在 `token.txt` 文件中。请确保在运行机器人之前正确配置 `.env` 文件中的环境变量。

## 代理配置
- 格式: `http://user:password@ip:port`
- 在 `.env` 文件中配置你的代理设置

## 提示
1. 必须先使用 `Register.js` 注册账号
2. 确认token已正确保存在 `token.txt` 中
3. 运行前检查 `.env` 文件的配置
4. 使用 `npm run start` 启动机器人


## 故障排除
常见问题和解决方案：
1. 代理连接错误：
   - 检查代理格式是否正确
   - 确保代理支持HTTPS连接
2. 限速：
   - 程序自动处理限速，ping之间的延迟为3秒
   - 如果遇到限速，请考虑增加延迟



## 免责声明
本机程序仅用于教育目的，请自行承担风险。
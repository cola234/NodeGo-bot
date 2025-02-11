import fs from 'fs';
import axios from 'axios';
import { URL } from 'url';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { HttpProxyAgent } from 'http-proxy-agent';
import chalk from 'chalk';
import fakeUa from 'fake-useragent';

class NodeGoPinger {
    constructor(token, proxyUrl = null) {
        this.apiBaseUrl = 'https://nodego.ai/api';
        this.bearerToken = token;
        this.agent = proxyUrl ? this.createProxyAgent(proxyUrl) : null;
        this.lastPingTimestamp = 0;
    }

    createProxyAgent(proxyUrl) {
        try {
            // 支持 http://user:password@ip:port 格式
            let finalProxyUrl = proxyUrl;
            if (!proxyUrl.includes('://')) {
                // 如果没有协议，检查是否包含用户名密码
                if (proxyUrl.includes('@')) {
                    finalProxyUrl = `http://${proxyUrl}`;
                } else {
                    finalProxyUrl = `http://${proxyUrl}`;
                }
            }
            
            const parsedUrl = new URL(finalProxyUrl);
            
            // 处理不同的代理协议
            if (finalProxyUrl.startsWith('socks')) {
                return new SocksProxyAgent(parsedUrl);
            } else {
                // 默认使用HTTP/HTTPS代理
                return {
                    httpAgent: new HttpProxyAgent(parsedUrl),
                    httpsAgent: new HttpsProxyAgent(parsedUrl)
                };
            }
        } catch (error) {
            console.error(chalk.red(`[${new Date().toLocaleString()}] [ERROR]`), '无效的代理URL:', error.message);
            return null;
        }
    }

    async getUserInfo() {
        try {
            const response = await this.makeRequest('GET', '/user/me');
            const metadata = response.data.metadata;
            return {
                username: metadata.username,
                email: metadata.email,
                totalPoint: metadata.rewardPoint,
                nodes: metadata.nodes.map(node => ({
                    id: node.id,
                    totalPoint: node.totalPoint,
                    todayPoint: node.todayPoint,
                    isActive: node.isActive
                }))
            };
        } catch (error) {
            console.error(chalk.red(`[${new Date().toLocaleString()}] [ERROR]`), '获取用户信息失败:', error.message);
            throw error;
        }
    }

    async makeRequest(method, endpoint, data = null) {
        const config = {
            method,
            url: `${this.apiBaseUrl}${endpoint}`,
            headers: {
                'Authorization': `Bearer ${this.bearerToken}`,
                'Content-Type': 'application/json',
                'Accept': '*/*',
                'User-Agent': fakeUa()
            },
            ...(data && { data }),
            timeout: 30000 // 30秒超时
        };

        if (this.agent) {
            if (this.agent.httpAgent) {
                // 用于HTTP/HTTPS代理
                config.httpAgent = this.agent.httpAgent;
                config.httpsAgent = this.agent.httpsAgent;
            } else {
                // 用于SOCKS代理
                config.httpAgent = this.agent;
                config.httpsAgent = this.agent;
            }
        }

        try {
            return await axios(config);
        } catch (error) {
            if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
                throw new Error(`代理连接失败: ${error.message}`);
            }
            throw error;
        }
    }

    async ping() {
        try {
            const currentTime = Date.now();
            
            // 确保ping之间至少有3秒的间隔
            if (currentTime - this.lastPingTimestamp < 3000) {
                await new Promise(resolve => setTimeout(resolve, 3000 - (currentTime - this.lastPingTimestamp)));
            }

            const response = await this.makeRequest('POST', '/user/nodes/ping', { type: 'extension' });
            
            this.lastPingTimestamp = Date.now();
            
            return {
                statusCode: response.data.statusCode,
                message: response.data.message,
                metadataId: response.data.metadata.id
            };
        } catch (error) {
            console.error(chalk.red(`[${new Date().toLocaleString()}] [ERROR]`), 'Ping失败:', error.message);
            throw error;
        }
    }
}

class MultiAccountPinger {
    constructor() {
        this.accounts = this.loadAccounts();
        this.isRunning = true;
    }

    loadAccounts() {
        try {
            const accountData = fs.readFileSync('token.txt', 'utf8')
                .split('\n')
                .filter(line => line.trim());
            
            const proxyData = fs.existsSync('proxy.list') 
                ? fs.readFileSync('proxy.list', 'utf8')
                    .split('\n')
                    .filter(line => line.trim())
                : [];
            
            return accountData.map((token, index) => ({
                token: token.trim(),
                proxy: proxyData[index] || null
            }));
        } catch (error) {
            console.error(chalk.red(`[${new Date().toLocaleString()}] [ERROR]`), '读取账户时出错:', error);
            process.exit(1);
        }
    }

    async processSingleAccount(account) {
        const pinger = new NodeGoPinger(account.token, account.proxy);
        
        try {
            const userInfo = await pinger.getUserInfo();
            if (!userInfo) return;

            const pingResponse = await pinger.ping();

            console.log(chalk.green(`[${new Date().toLocaleString()}] [INFO]`), chalk.green(`${userInfo.username} (${userInfo.email})`));
            
            userInfo.nodes.forEach((node, index) => {
                console.log(chalk.green(`[${new Date().toLocaleString()}] [INFO]`), chalk.green(`节点${index + 1}: ${node.id} | 积分:${node.totalPoint} | 当前状态:${node.isActive ? '活跃' : '不活跃'}`));
            });
            
            console.log(chalk.green(`[${new Date().toLocaleString()}] [INFO]`), chalk.green(`Ping:${pingResponse.message} | ID:${pingResponse.metadataId}`));
            console.log(''); // 添加一个空行分隔不同账户
        } catch (error) {
            console.error(chalk.red(`[${new Date().toLocaleString()}] [ERROR]`), `处理账户时出错: ${error.message}`);
        }
    }

    async runPinger() {
        // 启动信息
        const timestamp = `[${new Date().toLocaleString()}]`;
        console.log(chalk.green(`${timestamp} [INFO]`), chalk.green('='.repeat(50)));
        console.log(chalk.green(`${timestamp} [INFO]`), chalk.green('NodeGo Auto Bot 自动任务脚本'));
        console.log(chalk.green(`${timestamp} [INFO]`), chalk.green('作者: 北月'));
        console.log(chalk.green(`${timestamp} [INFO]`), chalk.green('推特: https://x.com/beiyue66'));
        console.log(chalk.yellow(`${timestamp} [WARN]`), chalk.yellow('注意: 使用此脚本请自行创建新账户。'));
        console.log(chalk.yellow(`${timestamp} [WARN]`), chalk.yellow('      作者不对因使用此脚本造成的任何损失负责。'));
        console.log(chalk.green(`${timestamp} [INFO]`), chalk.green('='.repeat(50)));
        
        // 处理优雅关闭
        process.on('SIGINT', () => {
            console.log(chalk.green(`[${new Date().toLocaleString()}] [INFO]`), chalk.green('关闭...'));
            this.isRunning = false;
            setTimeout(() => process.exit(0), 1000);
        });

        while (this.isRunning) {
            console.log(chalk.green(`[${new Date().toLocaleString()}] [INFO]`), chalk.green('程序正在运行中'));
            
            for (const account of this.accounts) {
                if (!this.isRunning) break;
                await this.processSingleAccount(account);
            }

            if (this.isRunning) {
                await new Promise(resolve => setTimeout(resolve, 15000)); // 15秒延迟
            }
        }
    }
}

// 运行多账户Ping
const multiPinger = new MultiAccountPinger();
multiPinger.runPinger();
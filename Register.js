import fs from 'fs';
import axios from 'axios';
import ac from '@antiadmin/anticaptchaofficial';
import chalk from 'chalk';
import { HttpsProxyAgent } from 'https-proxy-agent';
import dotenv from 'dotenv';
import readlineSync from 'readline-sync';

// 加载环境变量
dotenv.config();

// 验证必要的环境变量
if (!process.env.ANTICAPTCHA_KEY || !process.env.DOMAINS) {
    console.error(chalk.red(`[${new Date().toLocaleString()}] [ERROR]`), '请在.env文件中设置必要的环境变量');
    process.exit(1);
}

// 配置
const CONFIG = {
    REGISTER_URL: process.env.REGISTER_URL || 'https://nodego.ai/api/auth/register',
    TURNSTILE_KEY: process.env.TURNSTILE_KEY || '0x4AAAAAAA4zgfgCoYChIZf4',
    REGISTER_PAGE: process.env.REGISTER_PAGE || 'https://app.nodego.ai/register',
    PASSWORD: process.env.PASSWORD || '123456test',
    MAX_RETRIES: parseInt(process.env.MAX_RETRIES || '3'),
    REF_BY: process.env.REF_BY || 'NODEEDDE6E6179C5'  // 添加推荐码
};

// 从环境变量获取域名列表
const DOMAINS = process.env.DOMAINS.split(',').map(domain => domain.trim());

// 日志级别和颜色配置
const LOG_LEVELS = {
    INFO: { color: chalk.green, prefix: 'INFO' },
    WARN: { color: chalk.yellow, prefix: 'WARN' },
    ERROR: { color: chalk.red, prefix: 'ERROR' },
    DEBUG: { color: chalk.blue, prefix: 'DEBUG' },
    SUCCESS: { color: chalk.green, prefix: 'SUCCESS' }
};

// 格式化日志输出
function log(level, message, data = null) {
    const { color, prefix } = LOG_LEVELS[level];
    const timestamp = new Date().toLocaleString();
    const logMessage = `[${timestamp}] [${prefix}] ${message}`;
    console.log(color(logMessage));
    if (data) {
        console.log(color('[DATA]'), data);
    }
}

// 生成指定长度范围的随机字符串
function generateRandomString(min, max) {
    const length = Math.floor(Math.random() * (max - min + 1)) + min;
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// 生成注册凭证
function generateCredentials(domains) {
    const username = generateRandomString(4, 6);
    const emailUser = generateRandomString(6, 8);
    const domain = domains[Math.floor(Math.random() * domains.length)];
    const email = `${emailUser}@${domain}`;

    return {
        username,
        email,
        password: CONFIG.PASSWORD
    };
}

// 解决验证码
async function solveCaptcha(sitekey, pageUrl) {
    try {
        log('INFO', '开始解决验证码');
        const result = await ac.solveTurnstileProxyless(
            pageUrl,  // 第一个参数是网站URL
            sitekey   // 第二个参数是sitekey
        );
        
        if (result) {
            log('INFO', '验证码解决成功');
            return result;
        } else {
            throw new Error('验证码解决失败');
        }
    } catch (error) {
        log('ERROR', '验证码解决失败:', error.message);
        throw error;
    }
}

// 保存token
function saveToken(token) {
    try {
        fs.appendFileSync('token.txt', token + '\n');
        log('INFO', 'Token已保存到token.txt');
    } catch (error) {
        log('ERROR', '保存Token失败:', error);
        throw error;
    }
}

// 解析代理字符串
function parseProxy(proxyStr) {
    try {
        // 格式：http://username:password@ip:port
        const match = proxyStr.match(/^http:\/\/(?:([^:]+):([^@]+)@)?([^:]+):(\d+)$/);
        if (!match) return null;

        const [, username, password, host, port] = match;
        return {
            host,
            port: parseInt(port),
            auth: username && password ? {
                username,
                password
            } : undefined
        };
    } catch (error) {
        log('ERROR', '代理解析失败:', proxyStr);
        return null;
    }
}

// 注册账号
async function registerAccount(credentials, proxy = null, captchaToken) {
    try {
        const config = {
            maxRedirects: 0,
            timeout: 10000,
            validateStatus: function (status) {
                return status >= 200 && status < 500;
            },
            headers: {
                'accept': 'application/json, text/plain, */*',
                'accept-language': 'zh-CN,zh;q=0.9',
                'content-type': 'application/json',
                'origin': 'https://app.nodego.ai',
                'priority': 'u=1, i',
                'referer': 'https://app.nodego.ai/',
                'sec-ch-ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'same-site',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
            }
        };

        // 如果有代理，添加代理配置
        if (proxy) {
            // 创建代理URL
            const proxyUrl = proxy.auth 
                ? `http://${proxy.auth.username}:${proxy.auth.password}@${proxy.host}:${proxy.port}`
                : `http://${proxy.host}:${proxy.port}`;
            
            // 使用HttpsProxyAgent
            config.httpsAgent = new HttpsProxyAgent(proxyUrl);
        }

        const data = {
            username: credentials.username,
            email: credentials.email,
            password: credentials.password,
            refBy: CONFIG.REF_BY,
            captcha: captchaToken
        };

        const response = await axios.post(CONFIG.REGISTER_URL, data, config);

        if (response.data.statusCode === 201 && response.data.metadata?.accessToken) {
            log('INFO', '注册成功');
            // 保存账号信息到account.txt
            const accountInfo = {
                email: credentials.email,
                password: credentials.password,
                refBy: CONFIG.REF_BY,
                token: response.data.metadata.accessToken
            };
            fs.appendFileSync('account.txt', JSON.stringify(accountInfo) + '\n');
            log('INFO', '账号信息已保存到account.txt');
            return response.data.metadata.accessToken;
        } else {
            throw new Error(response.data.message || '注册响应异常');
        }
    } catch (error) {
        if (error.response) {
            log('ERROR', '注册失败:', 
                error.response.data?.message || error.response.statusText || error.message);
            log('DEBUG', '错误详情:', {
                status: error.response.status,
                statusText: error.response.statusText,
                data: error.response.data,
                headers: error.response.headers
            });
        } else {
            log('ERROR', '注册失败:', error.message);
        }
        throw error;
    }
}

// 代理黑名单和频率限制
const proxyBlacklist = new Set();
const RATE_LIMIT = {
    minInterval: 5000,
    lastRequestTime: 0
};

// 等待频率限制
async function waitForRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - RATE_LIMIT.lastRequestTime;
    if (timeSinceLastRequest < RATE_LIMIT.minInterval) {
        const waitTime = RATE_LIMIT.minInterval - timeSinceLastRequest;
        await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    RATE_LIMIT.lastRequestTime = Date.now();
}

// 处理代理切换
function handleProxyRotation(proxies, currentProxyIndex, error = null) {
    if (!proxies.length) return { proxy: null, index: 0 };

    // 如果是因为错误而切换代理
    if (error && error.response) {
        const status = error.response.status;
        if ([520, 521, 522].includes(status)) {
            const currentProxy = proxies[currentProxyIndex];
            const proxyKey = `${currentProxy.host}:${currentProxy.port}`;
            proxyBlacklist.add(proxyKey);
            log('WARN', `代理 ${proxyKey} 因状态码 ${status} 被加入黑名单`);
        }
    }

    // 寻找下一个可用代理
    let newIndex = currentProxyIndex;
    let attempts = 0;
    while (attempts < proxies.length) {
        newIndex = (newIndex + 1) % proxies.length;
        const proxy = proxies[newIndex];
        const proxyKey = `${proxy.host}:${proxy.port}`;
        if (!proxyBlacklist.has(proxyKey)) {
            return { proxy, index: newIndex };
        }
        attempts++;
    }

    // 如果所有代理都在黑名单中，重置黑名单
    log('WARN', '所有代理均已被列入黑名单，重置黑名单');
    proxyBlacklist.clear();
    return { proxy: proxies[0], index: 0 };
}

// 主函数
async function main() {
    log('INFO', '开始注册流程');

    try {
        if (DOMAINS.length === 0) {
            throw new Error('请在.env文件中设置DOMAINS环境变量');
        }

        const accountCount = readlineSync.questionInt(chalk.blue(`[${new Date().toLocaleString()}] [INPUT]`) + ' 请输入要注册的账户数量: ');
        log('INFO', `将注册 ${accountCount} 个账户`);

        // 读取代理列表
        const proxies = fs.existsSync('proxy.list') 
            ? fs.readFileSync('proxy.list', 'utf8')
                .split('\n')
                .map(line => line.trim())
                .filter(Boolean)
                .map(parseProxy)
                .filter(Boolean)
            : [];

        let currentProxyIndex = 0;
        let successCount = 0;
        let totalAttempts = 0;

        while (successCount < accountCount && totalAttempts < accountCount * 3) {
            totalAttempts++;
            const credentials = generateCredentials(DOMAINS);
            
            // 获取当前代理
            const { proxy: currentProxy, index: newIndex } = handleProxyRotation(proxies, currentProxyIndex);
            currentProxyIndex = newIndex;

            if (currentProxy) {
                log('INFO', `使用代理 ${currentProxy.host}:${currentProxy.port}`);
            }

            log('INFO', `注册账号 ${credentials.username} (${credentials.email}) - 进度: ${successCount + 1}/${accountCount}`);

            let retryCount = 0;
            while (retryCount < CONFIG.MAX_RETRIES) {
                try {
                    // 等待频率限制
                    await waitForRateLimit();

                    // 获取新的验证码
                    const captchaToken = await solveCaptcha(CONFIG.TURNSTILE_KEY, CONFIG.REGISTER_PAGE);
                    log('DEBUG', '获取验证码成功', captchaToken.substring(0, 30) + '...');

                    // 尝试注册
                    const token = await registerAccount(credentials, currentProxy, captchaToken);
                    saveToken(token);
                    successCount++;
                    log('SUCCESS', `账号 ${credentials.username} 注册成功`);
                    break;
                } catch (error) {
                    retryCount++;
                    
                    // 处理特定错误
                    if (error.response) {
                        const status = error.response.status;
                        if ([520, 521, 522].includes(status) && proxies.length > 0) {
                            const { proxy, index } = handleProxyRotation(proxies, currentProxyIndex, error);
                            currentProxyIndex = index;
                            if (proxy) {
                                log('WARN', `遇到错误 ${status}，切换到新代理 ${proxy.host}:${proxy.port}`);
                                break;
                            }
                        }
                    }

                    if (retryCount < CONFIG.MAX_RETRIES) {
                        const waitTime = Math.min(Math.pow(2, retryCount) * 1000, 30000);
                        log('WARN', `注册失败，${waitTime/1000}秒后重试 (${retryCount}/${CONFIG.MAX_RETRIES})`, 
                            error.response?.data || error.message);
                        await new Promise(resolve => setTimeout(resolve, waitTime));
                    } else {
                        log('ERROR', '达到最大重试次数，跳过当前账号', error.message);
                        break;
                    }
                }
            }
        }

        if (successCount === accountCount) {
            log('SUCCESS', `注册完成！成功注册 ${successCount} 个账户`);
        } else {
            log('WARN', `注册部分完成。成功: ${successCount}/${accountCount}`);
        }
        process.exit(successCount > 0 ? 0 : 1);
    } catch (error) {
        log('ERROR', '程序异常', error.message);
        process.exit(1);
    }
}

// 设置Anti-Captcha
ac.setAPIKey(process.env.ANTICAPTCHA_KEY);
ac.setSoftId(0);

// 启动程序
main();

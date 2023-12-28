import { NowRequest, NowResponse } from '@vercel/node';
import https from 'https'
import axios from 'axios';
import crypto from 'crypto';
import { Readable } from 'stream';


interface JsonData {
    Messages: { role: string; content: string }[];
    Model: string;
    Temperature: number;
    TopP: number;
    N: number;
    Stream: boolean;
    Intent: boolean;
    OneTimeReturn: boolean;
}

const tokenCache: { [key: string]: string } = {};

function getCopilotToken(githubToken) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.github.com',
            path: '/copilot_internal/v2/token',
            method: 'GET',
            headers: {
                authorization: `token ${githubToken}`,
                'Host': 'api.github.com',
                'editor-version': 'JetBrains-IU/232.10203.10',
                'editor-plugin-version': 'copilot-intellij/1.3.3.3572',
                'user-agent': 'GithubCopilot/1.129.0',
                'accept': '*/*'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                const response = JSON.parse(data);
                const copilotToken = response.token;
                resolve(copilotToken);
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.end();
    });
}

function genHexStr(length: number): string {
    const bytes = crypto.randomBytes(length / 2);
    return bytes.toString('hex');
}

async function FakeRequest(content: JsonData, copilotToken) {
    const url = 'https://api.githubcopilot.com/chat/completions';
    const headers: Record<string, string> = {
        'Authorization': 'Bearer ' + copilotToken,
        'X-Request-Id':
            genHexStr(8) +
            '-' +
            genHexStr(4) +
            '-' +
            genHexStr(4) +
            '-' +
            genHexStr(4) +
            '-' +
            genHexStr(12),
        'Vscode-Sessionid':
            genHexStr(8) +
            '-' +
            genHexStr(4) +
            '-' +
            genHexStr(4) +
            '-' +
            genHexStr(4) +
            '-' +
            genHexStr(25),
        'Vscode-Machineid': genHexStr(64),
        'Editor-Version': 'vscode/1.83.1',
        'Editor-Plugin-Version': 'copilot-chat/0.8.0',
        'Openai-Organization': 'github-copilot',
        'Openai-Intent': 'conversation-panel',
        'Content-Type': 'text/event-stream; charset=utf-8',
        'User-Agent': 'GitHubCopilotChat/0.8.0',
        'Accept': '*/*',
        'Accept-Encoding': 'gzip,deflate,br',
        'Connection': 'close',
    };
    const jsonBody: JsonData = content

    try {
        const response = await axios.post(url, jsonBody, {
            headers,
        });
        const { data } = response;
        const stream = new Readable();
        stream._read = () => {};
        const lines: string[] = data.split('\n');
        for (const line of lines) {
          stream.push(line + '\n');
        }
        stream.push(null);
        return stream;
    } catch (error) {
        console.error('发送请求错误', error);
        throw error;
    }
}

export default (req: NowRequest, res: NowResponse) => {
    const authHeader = req.headers.Authorization;

    if (authHeader) {
        const githubToken = authHeader.split(' ')[1];
        let copilotToken = tokenCache[githubToken];
        if (!copilotToken) {
            // 在缓存中没有token, 获取token并缓存
            getCopilotToken(githubToken)
                .then((t) => {
                    copilotToken = t as string;
                    tokenCache[githubToken] = copilotToken
                })
                .catch((e) => {
                    console.log(e);
                });
        }
        try {
            const result = FakeRequest(req.jsonBody, copilotToken);
            return result;
        } catch (e) {

        }
        return '';
    } else {
        res.status(404).json({ error: '未找到token' });
    }

};

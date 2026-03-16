import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Utility to handle __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface Bookmark {
    title: string;
    url: string;
    line: number;
}

interface FavoriteFile {
    filename: string;
    path: string;
    content: string;
    sha: string;
    tree: any[];
}

interface BackupData {
    config: any;
    files: FavoriteFile[];
    exportDate: string;
}

function extractLinks(content: string): Bookmark[] {
    const links: Bookmark[] = [];
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Match standard markdown links: [Title](URL)
        // Improved regex to handle URLs with parentheses better by stopping at the last ) that is followed by end of line or space
        const match = line.match(/\[(.*?)\]\((https?:\/\/[^\s\)]+)\)/);
        if (match) {
            links.push({
                title: match[1],
                url: match[2],
                line: i
            });
        }
    }
    return links;
}

async function checkLink(url: string): Promise<{ ok: boolean; status?: number; error?: string }> {
    // 微信公众号链接通常有防爬措施，且容易误报，统一视为成功
    if (url.includes('mp.weixin.qq.com')) {
        return { ok: true };
    }

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000); // Increased to 30s timeout
        const res = await fetch(url, { 
            method: 'GET',
            signal: controller.signal,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
        });
        clearTimeout(timeout);
        
        // 只有 404, 500, 或未响应（抛出异常）才认为是失败
        // 其他状态（如 403, 401, 302 等）通常意味着链接本身还是存在的
        const isFailureStatus = res.status === 404 || res.status === 500;
        return { ok: !isFailureStatus, status: res.status };
    } catch (err: any) {
        if (err.name === 'AbortError') return { ok: false, error: 'Timeout' };
        // 网络错误或未响应
        return { ok: false, error: err.message };
    }
}

async function findAlternative(title: string, oldUrl: string, config: { apiKey?: string; baseUrl?: string; model?: string }): Promise<string | null> {
    const apiKey = config.apiKey || process.env.OPENAI_API_KEY;
    const baseUrl = config.baseUrl || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
    const model = config.model || process.env.OPENAI_MODEL || 'gpt-3.5-turbo';

    if (!apiKey) return null;

    try {
        const response = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    { role: 'system', content: 'You are a helpful assistant that finds alternative links for broken bookmarks.' },
                    { role: 'user', content: `The bookmark "${title}" with URL "${oldUrl}" is dead. Please find 1-2 alternative working URLs for this content. Respond ONLY with the best URL you found, or "NOT_FOUND" if you cannot find one.` }
                ],
                temperature: 0.3
            })
        });

        if (!response.ok) return null;

        const data: any = await response.json();
        const result = data.choices?.[0]?.message?.content?.trim();
        if (result && result.startsWith('http')) {
            // 验证 AI 找到的链接
            const check = await checkLink(result);
            if (check.ok) return result;
            
            // AI 找到的链接可能也需要 Jina 挽救
            const jinaCheck = await checkWithJina(result);
            if (jinaCheck.ok) return result;
        }
        return null;
    } catch (err) {
        return null;
    }
}

// Simple markdown parser to regenerate tree
function parseMarkdown(text: string): any[] {
    const lines = text.split('\n');
    const root: any[] = [];
    const stack: { level: number; children: any[] }[] = [
        { level: 0, children: root },
    ];

    for (const line of lines) {
        // Match standard markdown links: * [Title](URL)
        const match = line.match(/^((?:\*\s+)+)\[(.*?)\]\((https?:\/\/[^\s\)]+|dir)\)/);
        if (!match) continue;

        const [, starGroup, title, content] = match;
        const level = (starGroup.match(/\*/g) || []).length;

        while (stack.length > 1 && stack[stack.length - 1].level >= level) {
            stack.pop();
        }

        const parent = stack[stack.length - 1];

        if (content === 'dir') {
            const dir: any = {
                id: Math.random().toString(36).substring(2, 11),
                title,
                level,
                children: [],
            };
            parent.children.push(dir);
            stack.push({ level, children: dir.children });
        } else {
            const bookmark: any = {
                id: Math.random().toString(36).substring(2, 11),
                title,
                url: content,
                level,
            };
            parent.children.push(bookmark);
        }
    }

    return root;
}

async function checkWithJina(url: string): Promise<{ ok: boolean }> {
    try {
        const jinaUrl = `https://r.jina.ai/${url}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);
        const res = await fetch(jinaUrl, {
            method: 'GET',
            signal: controller.signal,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
        });
        clearTimeout(timeout);
        
        // 如果 Jina 能返回 200，说明网页大概率还是可以被爬取的（即存活）
        return { ok: res.status === 200 };
    } catch (err) {
        return { ok: false };
    }
}

async function processBackupFile(filePath: string) {
    if (!fs.existsSync(filePath)) {
        console.error(`Error: Backup file ${filePath} does not exist.`);
        return;
    }

    console.log(`Loading backup file: ${filePath}`);
    const backupData: BackupData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    
    // Extract config from backup
    const aiConfig = {
        apiKey: backupData.config?.openaiKey,
        baseUrl: backupData.config?.openaiBaseUrl,
        model: backupData.config?.openaiModel
    };

    // 1. Create Backup of the JSON file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(process.cwd(), '.backup', timestamp);
    fs.mkdirSync(backupDir, { recursive: true });
    const backupPath = path.join(backupDir, path.basename(filePath));
    fs.copyFileSync(filePath, backupPath);
    console.log(`Original backup file backed up to: ${backupPath}`);

    const report = {
        timestamp,
        filesProcessed: 0,
        totalLinks: 0,
        deadLinks: 0,
        replacedLinks: 0,
        deletedLinks: 0,
        details: [] as any[]
    };

    // 2. Process each file in the backup
    for (let fIdx = 0; fIdx < backupData.files.length; fIdx++) {
        const file = backupData.files[fIdx];
        console.log(`\n[${fIdx + 1}/${backupData.files.length}] Processing file: ${file.filename}`);
        const links = extractLinks(file.content);
        const lines = file.content.split('\n');
        
        if (links.length === 0) {
            console.log(`  No links found in this file.`);
            report.filesProcessed++;
            continue;
        }

        console.log(`  Found ${links.length} links. Checking...`);
        
        // We process from bottom up to handle splicing lines later
        const sortedLinks = [...links].sort((a, b) => b.line - a.line);
        
        let fileDead = 0, fileReplaced = 0, fileDeleted = 0;
        const concurrencyLimit = 10; // Slightly lower for better stability
        const linkResults: { link: Bookmark; status: any; alternative?: string | null; verifiedByJina?: boolean }[] = [];
        
        for (let i = 0; i < sortedLinks.length; i += concurrencyLimit) {
            const batch = sortedLinks.slice(i, i + concurrencyLimit);
            const batchProgress = Math.min(i + concurrencyLimit, sortedLinks.length);
            console.log(`  Progress: ${batchProgress}/${sortedLinks.length} links checked...`);

            await Promise.all(batch.map(async (link) => {
                try {
                    const status = await checkLink(link.url);
                    let alternative: string | null = null;
                    let verifiedByJina = false;

                    if (!status.ok) {
                        // 第一步：常规检查失败，立即尝试用 Jina 挽救原链接
                        const jinaCheck = await checkWithJina(link.url);
                        if (jinaCheck.ok) {
                            verifiedByJina = true;
                        } else {
                            // 第二步：Jina 也无法访问原链接，尝试用 AI 寻找替代链接
                            // findAlternative 内部现在也会用 Jina 验证它找到的新链接
                            alternative = await findAlternative(link.title, link.url, aiConfig);
                            
                            // 如果 AI 也找不到替代链接，那么 alternative 为 null，verifiedByJina 为 false
                            // 这种情况下，在随后的循环中该链接会被标记为 DEAD 并最终删除。
                            // 这符合“有问题的链接再用 jina 跑一次，再出错（Jina 失败且 AI 没找到替代）才删除”的逻辑。
                        }
                    }
                    linkResults.push({ link, status, alternative, verifiedByJina });
                } catch (err) {
                    linkResults.push({ link, status: { ok: false, error: 'Internal Error' }, alternative: null, verifiedByJina: false });
                }
            }));
        }

        // Apply changes from bottom to top
        const sortedResults = linkResults.sort((a, b) => b.link.line - a.link.line);
        for (const res of sortedResults) {
            if (res.status.ok || res.verifiedByJina) {
                if (res.verifiedByJina) {
                    console.log(`  VERIFIED via Jina: [${res.link.title}]`);
                }
                continue;
            }

            console.log(`  DEAD: [${res.link.title}] (${res.status.error || res.status.status})`);
            fileDead++;

            if (res.alternative) {
                console.log(`    Found alternative: ${res.alternative}`);
                lines[res.link.line] = lines[res.link.line].replace(res.link.url, res.alternative);
                fileReplaced++;
                report.details.push({ file: file.filename, title: res.link.title, oldUrl: res.link.url, newUrl: res.alternative, action: 'replaced' });
            } else {
                console.log(`    No alternative found. Deleting.`);
                lines.splice(res.link.line, 1);
                fileDeleted++;
                report.details.push({ file: file.filename, title: res.link.title, url: res.link.url, action: 'deleted' });
            }
        }

        file.content = lines.join('\n');
        file.tree = parseMarkdown(file.content);
        report.filesProcessed++;
        report.totalLinks += links.length;
        report.deadLinks += fileDead;
        report.replacedLinks += fileReplaced;
        report.deletedLinks += fileDeleted;
    }

    // 3. Save modified backup
    const outputPath = filePath.replace('.json', `-processed-${timestamp}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(backupData, null, 2));

    // 4. Save Markdown Report
    const mdReportPath = path.join(process.cwd(), `report-backup-${timestamp}.md`);
    let mdReport = `# Backup Processing Report - ${timestamp}\n\n`;
    mdReport += `## Summary\n`;
    mdReport += `- Backup File: ${filePath}\n`;
    mdReport += `- Files in Backup: ${report.filesProcessed}\n`;
    mdReport += `- Total Links: ${report.totalLinks}\n`;
    mdReport += `- Dead Links: ${report.deadLinks}\n`;
    mdReport += `  - Replaced: ${report.replacedLinks}\n`;
    mdReport += `  - Deleted: ${report.deletedLinks}\n\n`;
    mdReport += `## Details\n`;
    if (report.details.length === 0) {
        mdReport += `No changes made. All links are healthy.\n`;
    } else {
        report.details.forEach(d => {
            if (d.action === 'replaced') {
                mdReport += `- [${d.file}] [Replaced] **${d.title}**: ${d.oldUrl} -> ${d.newUrl}\n`;
            } else {
                mdReport += `- [${d.file}] [Deleted] **${d.title}**: ${d.url}\n`;
            }
        });
    }
    fs.writeFileSync(mdReportPath, mdReport);

    console.log('\nProcessing Complete!');
    console.log(`Processed Backup: ${outputPath}`);
    console.log(`Markdown Report: ${mdReportPath}`);
    if (!process.env.OPENAI_API_KEY) {
        console.log('\nTip: Set OPENAI_API_KEY environment variable to enable automatic alternative finding.');
    }
}

async function main() {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        console.error('Usage: npm run process-backup <path-to-backup-json>');
        process.exit(1);
    }
    await processBackupFile(args[0]);
}

main().catch(err => {
    console.error('Fatal Error:', err);
    process.exit(1);
});

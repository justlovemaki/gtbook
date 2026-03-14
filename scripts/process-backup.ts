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
        const match = line.match(/\[(.*?)\]\((https?:\/\/.*?)\)/);
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

async function findAlternative(title: string, oldUrl: string): Promise<string | null> {
    const apiKey = process.env.OPENAI_API_KEY;
    const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
    const model = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';

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

        const data: any = await response.json();
        const result = data.choices[0].message.content.trim();
        if (result && result.startsWith('http')) {
            const check = await checkLink(result);
            if (check.ok) return result;
        }
        return null;
    } catch (err) {
        return null;
    }
}

async function processBackupFile(filePath: string) {
    if (!fs.existsSync(filePath)) {
        console.error(`Error: Backup file ${filePath} does not exist.`);
        return;
    }

    console.log(`Loading backup file: ${filePath}`);
    const backupData: BackupData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    
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
    for (const file of backupData.files) {
        console.log(`\nProcessing file: ${file.filename}`);
        const links = extractLinks(file.content);
        const lines = file.content.split('\n');
        const sortedLinks = [...links].sort((a, b) => b.line - a.line);
        
        let fileDead = 0, fileReplaced = 0, fileDeleted = 0;

        for (const link of sortedLinks) {
            process.stdout.write(`  Checking [${link.title}]... `);
            const status = await checkLink(link.url);
            
            if (status.ok) {
                console.log('OK');
                continue;
            }

            console.log(`DEAD (${status.error || status.status})`);
            fileDead++;

            const alternative = await findAlternative(link.title, link.url);
            if (alternative) {
                console.log(`    Found alternative: ${alternative}`);
                lines[link.line] = lines[link.line].replace(link.url, alternative);
                fileReplaced++;
                report.details.push({ file: file.filename, title: link.title, oldUrl: link.url, newUrl: alternative, action: 'replaced' });
            } else {
                console.log(`    No alternative found. Deleting.`);
                lines.splice(link.line, 1);
                fileDeleted++;
                report.details.push({ file: file.filename, title: link.title, url: link.url, action: 'deleted' });
            }
        }

        file.content = lines.join('\n');
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

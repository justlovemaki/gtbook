import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Utility to handle __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple link parser since we might not want to depend on the whole app's TS config for a simple script
function extractLinks(content: string) {
    const links: { title: string; url: string; line: number; fullMatch: string }[] = [];
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Match standard markdown links: * [Title](URL)
        const match = line.match(/\[(.*?)\]\((https?:\/\/.*?)\)/);
        if (match) {
            links.push({
                title: match[1],
                url: match[2],
                line: i,
                fullMatch: match[0]
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
        const isFailureStatus = res.status === 404 || res.status === 500;
        return { ok: !isFailureStatus, status: res.status };
    } catch (err: any) {
        if (err.name === 'AbortError') return { ok: false, error: 'Timeout' };
        return { ok: false, error: err.message };
    }
}

async function findAlternative(title: string, oldUrl: string): Promise<string | null> {
    const apiKey = process.env.OPENAI_API_KEY;
    const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
    const model = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';

    if (!apiKey) {
        // Fallback: If no API key, we can't easily find alternatives automatically.
        // In a more advanced version, we could scrape DuckDuckGo.
        return null;
    }

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
            // Validate the new link
            const check = await checkLink(result);
            if (check.ok) return result;
        }
        return null;
    } catch (err) {
        console.error(`  Error calling AI for alternative: ${err}`);
        return null;
    }
}

async function processFile(filePath: string) {
    console.log(`\nProcessing ${filePath}...`);
    let content = fs.readFileSync(filePath, 'utf-8');
    const links = extractLinks(content);
    const results = {
        total: links.length,
        dead: 0,
        replaced: 0,
        deleted: 0,
        details: [] as any[]
    };

    const lines = content.split('\n');
    // We process from bottom to top to avoid line index shifts if we delete lines
    // But since we are replacing lines or deleting them, we should be careful with the original `links` indexes.
    // Let's use a copy of lines and update by finding the match again or using the index if we go bottom-up.
    
    // Bottom-up processing to safely delete lines
    const sortedLinks = [...links].sort((a, b) => b.line - a.line);

    for (const link of sortedLinks) {
        process.stdout.write(`  Checking [${link.title}]... `);
        const status = await checkLink(link.url);
        
        if (status.ok) {
            console.log('OK');
            continue;
        }

        console.log(`DEAD (${status.error || status.status})`);
        results.dead++;

        const alternative = await findAlternative(link.title, link.url);
        if (alternative) {
            console.log(`  Found alternative: ${alternative}`);
            lines[link.line] = lines[link.line].replace(link.url, alternative);
            results.replaced++;
            results.details.push({ title: link.title, oldUrl: link.url, newUrl: alternative, action: 'replaced' });
        } else {
            console.log(`  No alternative found. Deleting.`);
            lines.splice(link.line, 1);
            results.deleted++;
            results.details.push({ title: link.title, url: link.url, action: 'deleted' });
        }
    }

    fs.writeFileSync(filePath, lines.join('\n'));
    return results;
}

async function main() {
    const args = process.argv.slice(2);
    const targetDir = args[0] || 'data/bookmarks';

    if (!fs.existsSync(targetDir)) {
        console.error(`Error: Directory ${targetDir} does not exist.`);
        process.exit(1);
    }

    // 1. Backup
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(process.cwd(), '.backup', timestamp);
    fs.mkdirSync(backupDir, { recursive: true });
    
    console.log(`Creating backup in ${backupDir}...`);
    const files = fs.readdirSync(targetDir).filter(f => f.endsWith('.md'));
    for (const file of files) {
        fs.copyFileSync(path.join(targetDir, file), path.join(backupDir, file));
    }

    // 2. Process
    const report = {
        timestamp,
        filesProcessed: 0,
        totalLinks: 0,
        deadLinks: 0,
        replacedLinks: 0,
        deletedLinks: 0,
        fileReports: {} as any
    };

    for (const file of files) {
        const filePath = path.join(targetDir, file);
        const fileResult = await processFile(filePath);
        report.filesProcessed++;
        report.totalLinks += fileResult.total;
        report.deadLinks += fileResult.dead;
        report.replacedLinks += fileResult.replaced;
        report.deletedLinks += fileResult.deleted;
        report.fileReports[file] = fileResult;
    }

    // 3. Save Report
    const reportPath = path.join(process.cwd(), `report-${timestamp}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    const mdReportPath = path.join(process.cwd(), `report-${timestamp}.md`);
    let mdReport = `# Batch Processing Report - ${timestamp}\n\n`;
    mdReport += `## Summary\n`;
    mdReport += `- Files Processed: ${report.filesProcessed}\n`;
    mdReport += `- Total Links: ${report.totalLinks}\n`;
    mdReport += `- Dead Links: ${report.deadLinks}\n`;
    mdReport += `  - Replaced: ${report.replacedLinks}\n`;
    mdReport += `  - Deleted: ${report.deletedLinks}\n\n`;
    mdReport += `## Details\n`;
    for (const [file, res] of Object.entries(report.fileReports)) {
        const fileRes = res as any;
        if (fileRes.details.length > 0) {
            mdReport += `### ${file}\n`;
            fileRes.details.forEach((d: any) => {
                if (d.action === 'replaced') {
                    mdReport += `- [Replaced] **${d.title}**: ${d.oldUrl} -> ${d.newUrl}\n`;
                } else {
                    mdReport += `- [Deleted] **${d.title}**: ${d.url}\n`;
                }
            });
            mdReport += `\n`;
        }
    }
    fs.writeFileSync(mdReportPath, mdReport);

    console.log('\nProcessing Complete!');
    console.log(`Files Processed: ${report.filesProcessed}`);
    console.log(`Total Links: ${report.totalLinks}`);
    console.log(`Dead Links: ${report.deadLinks}`);
    console.log(`  - Replaced: ${report.replacedLinks}`);
    console.log(`  - Deleted: ${report.deletedLinks}`);
    console.log(`\nBackup: ${backupDir}`);
    console.log(`JSON Report: ${reportPath}`);
    console.log(`Markdown Report: ${mdReportPath}`);

    if (!process.env.OPENAI_API_KEY) {
        console.log('\nTip: Set OPENAI_API_KEY environment variable to enable automatic alternative finding.');
    }
}

main().catch(err => {
    console.error('Fatal Error:', err);
    process.exit(1);
});

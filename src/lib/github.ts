import type { AppConfig, FavoriteFile } from './types';
import { parseMarkdown } from './markdown';

export class GitHubService {
  private config: AppConfig;
  private baseUrl = 'https://api.github.com';

  constructor(config: AppConfig) {
    this.config = config;
  }

  private async request(path: string, options: RequestInit = {}, forceRefresh: boolean = false) {
    // Ensure path starts with /
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const url = new URL(`${this.baseUrl}${cleanPath}`);
    
    // Only add cache buster if explicitly requested
    if (forceRefresh && (!options.method || options.method === 'GET')) {
      url.searchParams.set('t', Date.now().toString());
    }

    const response = await fetch(url.toString(), {
      ...options,
      headers: {
        'Authorization': `token ${this.config.githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `GitHub API error: ${response.statusText}`);
    }

    return response.json();
  }

  async fetchFiles(forceRefresh: boolean = false): Promise<FavoriteFile[]> {
    // Clean base path: remove leading/trailing slashes
    const basePath = this.config.path.replace(/^\/+|\/+$/g, '');
    const path = `/repos/${this.config.owner}/${this.config.repo}/contents/${basePath}`;
    
    const contents = await this.request(path, {}, forceRefresh);

    if (!Array.isArray(contents)) return [];

    const mdFiles = contents
      .filter((f: any) => f.name.endsWith('.md'))
      .sort((a: any, b: any) => a.name.localeCompare(b.name));

    // 并发获取所有文件内容
    return Promise.all(mdFiles.map(async (file: any) => {
      const fileData = await this.request(`/repos/${this.config.owner}/${this.config.repo}/contents/${file.path}`, {}, forceRefresh);

      if (fileData.content) {
        // 使用更现代且支持 UTF-8 的解码方式
        const content = new TextDecoder().decode(
          Uint8Array.from(atob(fileData.content.replace(/\n/g, '')), c => c.charCodeAt(0))
        );
        
        return {
          filename: file.name,
          path: file.path,
          content,
          sha: fileData.sha,
          tree: parseMarkdown(content),
        };
      }
      throw new Error(`Failed to load content for ${file.name}`);
    }));
  }

  async getFileRawContent(path: string): Promise<{ content: string, sha: string }> {
    // Writing/Updating always needs the absolute latest, so we use forceRefresh here
    const fileData = await this.request(`/repos/${this.config.owner}/${this.config.repo}/contents/${path}`, {}, true);
    if (!fileData.content) throw new Error("No content found");
    
    const content = new TextDecoder().decode(
      Uint8Array.from(atob(fileData.content.replace(/\n/g, '')), c => c.charCodeAt(0))
    );

    return {
      content,
      sha: fileData.sha
    };
  }

  async updateFile(file: FavoriteFile, newContent: string): Promise<string> {
    const path = `/repos/${this.config.owner}/${this.config.repo}/contents/${file.path}`;
    
    // 获取线上最新的 SHA 进行冲突检测
    const latest = await this.getFileRawContent(file.path);
    if (latest.sha !== file.sha) {
      throw new Error("CONFLICT");
    }

    // 使用更现代且支持 UTF-8 的编码方式
    const base64Content = btoa(
      Array.from(new TextEncoder().encode(newContent), byte => String.fromCharCode(byte)).join('')
    );

    const data = await this.request(path, {
      method: 'PUT',
      body: JSON.stringify({
        message: `Update ${file.filename} via gtbook`,
        content: base64Content,
        sha: file.sha,
      }),
    });

    return data.content?.sha || '';
  }

  async fetchFileByPath(path: string): Promise<FavoriteFile> {
    const fileData = await this.request(`/repos/${this.config.owner}/${this.config.repo}/contents/${path}`, {}, true);
    if (!fileData.content) throw new Error("No content found");
    
    const content = new TextDecoder().decode(
      Uint8Array.from(atob(fileData.content.replace(/\n/g, '')), c => c.charCodeAt(0))
    );

    return {
      filename: fileData.name,
      path: fileData.path,
      content,
      sha: fileData.sha,
      tree: parseMarkdown(content),
    };
  }

  async createFile(filename: string): Promise<FavoriteFile> {
    const basePath = this.config.path.replace(/^\/+|\/+$/g, '');
    const path = `${basePath}/${filename}`;
    
    await this.request(`/repos/${this.config.owner}/${this.config.repo}/contents/${path}`, {
      method: 'PUT',
      body: JSON.stringify({
        message: `Create ${filename} via gtbook`,
        content: btoa('\n'),
      }),
    });

    return this.fetchFileByPath(path);
  }

  async deleteFile(file: FavoriteFile): Promise<void> {
    const path = `/repos/${this.config.owner}/${this.config.repo}/contents/${file.path}`;
    await this.request(path, {
      method: 'DELETE',
      body: JSON.stringify({
        message: `Delete ${file.filename} via gtbook`,
        sha: file.sha,
      }),
    });
  }

  async renameFile(file: FavoriteFile, newFilename: string): Promise<FavoriteFile> {
    const basePath = this.config.path.replace(/^\/+|\/+$/g, '');
    const newPath = `${basePath}/${newFilename}`;
    
    // 1. Create new file with old content
    const createPath = `/repos/${this.config.owner}/${this.config.repo}/contents/${newPath}`;
    
    const base64Content = btoa(
      Array.from(new TextEncoder().encode(file.content), byte => String.fromCharCode(byte)).join('')
    );

    await this.request(createPath, {
      method: 'PUT',
      body: JSON.stringify({
        message: `Rename ${file.filename} to ${newFilename} via gtbook`,
        content: base64Content,
      }),
    });

    // 2. Delete old file
    await this.deleteFile(file);

    // 3. Fetch new file details
    return this.fetchFileByPath(newPath);
  }
}

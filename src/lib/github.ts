import { Octokit } from 'octokit';
import type { AppConfig, FavoriteFile } from './types';
import { parseMarkdown } from './markdown';

export class GitHubService {
  private octokit: Octokit;
  private config: AppConfig;

  constructor(config: AppConfig) {
    this.config = config;
    this.octokit = new Octokit({ auth: config.githubToken });
  }

  async fetchFiles(): Promise<FavoriteFile[]> {
    const { data: contents } = await this.octokit.rest.repos.getContent({
      owner: this.config.owner,
      repo: this.config.repo,
      path: this.config.path,
    });

    if (!Array.isArray(contents)) return [];

    const mdFiles = contents
      .filter((f) => f.name.endsWith('.md'))
      .sort((a, b) => a.name.localeCompare(b.name));

    const files: FavoriteFile[] = [];

    for (const file of mdFiles) {
      const { data: fileData } = await this.octokit.rest.repos.getContent({
        owner: this.config.owner,
        repo: this.config.repo,
        path: file.path,
      });

      if ('content' in fileData) {
        const content = decodeURIComponent(escape(atob(fileData.content.replace(/\n/g, ''))));
        files.push({
          filename: file.name,
          path: file.path,
          content,
          sha: fileData.sha,
          tree: parseMarkdown(content),
        });
      }
    }

    return files;
  }

  async updateFile(file: FavoriteFile, newContent: string): Promise<string> {
    const { data } = await this.octokit.rest.repos.createOrUpdateFileContents({
      owner: this.config.owner,
      repo: this.config.repo,
      path: file.path,
      message: `Update ${file.filename} via MGR`,
      content: btoa(unescape(encodeURIComponent(newContent))),
      sha: file.sha,
    });

    return data.content?.sha || '';
  }
}

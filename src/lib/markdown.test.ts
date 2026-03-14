import { describe, it, expect } from 'vitest';
import { 
  parseMarkdown, 
  insertLinkToMarkdown, 
  updateBookmarkInMarkdown, 
  deleteFromMarkdown,
  insertDirectoryToMarkdown
} from './markdown';

describe('Markdown Lib', () => {
  const sampleMarkdown = `* [Google](https://google.com)
* [Search](dir)
* * [Baidu](https://baidu.com)
* [Social](dir)
* * [Twitter](https://twitter.com)`;

  it('should parse markdown correctly', () => {
    const tree = parseMarkdown(sampleMarkdown);
    expect(tree).toHaveLength(3);
    expect(tree[0].title).toBe('Google');
    expect(tree[1].title).toBe('Search');
    expect('children' in tree[1] && tree[1].children).toHaveLength(1);
    expect('children' in tree[1] && tree[1].children[0].title).toBe('Baidu');
  });

  it('should insert link to root', () => {
    const updated = insertLinkToMarkdown(sampleMarkdown, 'root', 'GitHub', 'https://github.com');
    expect(updated).toContain('* [GitHub](https://github.com)');
  });

  it('should insert link to directory', () => {
    const updated = insertLinkToMarkdown(sampleMarkdown, 'Search', 'Bing', 'https://bing.com');
    const lines = updated.split('\n');
    const searchIdx = lines.findIndex(l => l.includes('[Search](dir)'));
    expect(lines[searchIdx + 1]).toContain('* * [Baidu]');
    expect(lines[searchIdx + 2]).toContain('* * [Bing](https://bing.com)');
  });

  it('should update bookmark', () => {
    const updated = updateBookmarkInMarkdown(sampleMarkdown, 'Google', 'Google New', 'https://google.com', 'https://google.com/new');
    expect(updated).toContain('* [Google New](https://google.com/new)');
    expect(updated).not.toContain('* [Google](https://google.com)');
  });

  it('should delete bookmark', () => {
    const updated = deleteFromMarkdown(sampleMarkdown, 'Google', 'https://google.com');
    expect(updated).not.toContain('* [Google](https://google.com)');
  });

  it('should insert directory', () => {
    const updated = insertDirectoryToMarkdown(sampleMarkdown, 'root', 'New Dir');
    expect(updated).toContain('* [New Dir](dir)');
  });
});

import type { Bookmark, Directory } from './types';

export function parseMarkdown(text: string): (Bookmark | Directory)[] {
  const lines = text.split('\n');
  const root: (Bookmark | Directory)[] = [];
  const stack: { level: number; children: (Bookmark | Directory)[] }[] = [
    { level: 0, children: root },
  ];

  for (const line of lines) {
    const match = line.match(/^(\*\s+)+\[(.*?)\]\((.*?)\)/);
    if (!match) continue;

    const [, starGroup, title, content] = match;
    const level = starGroup.split('*').length - 1;

    // Pop stack until we find the parent level
    while (stack.length > 1 && stack[stack.length - 1].level >= level) {
      stack.pop();
    }

    const parent = stack[stack.length - 1];

    if (content === 'dir') {
      const dir: Directory = {
        id: Math.random().toString(36).substr(2, 9),
        title,
        level,
        children: [],
      };
      parent.children.push(dir);
      stack.push({ level, children: dir.children });
    } else {
      const bookmark: Bookmark = {
        id: Math.random().toString(36).substr(2, 9),
        title,
        url: content,
        level,
      };
      parent.children.push(bookmark);
    }
  }

  return root;
}

export function stringifyMarkdown(tree: (Bookmark | Directory)[]): string {
  let output = '';

  function traverse(items: (Bookmark | Directory)[]) {
    for (const item of items) {
      const stars = '* '.repeat(item.level).trim();
      if ('children' in item) {
        output += `${stars} [${item.title}](dir)\n`;
        traverse(item.children);
      } else {
        output += `${stars} [${item.title}](${item.url})\n`;
      }
    }
  }

  traverse(tree);
  return output;
}

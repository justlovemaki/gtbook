import type { Bookmark, Directory } from './types';

export function parseMarkdown(text: string): (Bookmark | Directory)[] {
  const lines = text.split('\n');
  const root: (Bookmark | Directory)[] = [];
  const stack: { level: number; children: (Bookmark | Directory)[] }[] = [
    { level: 0, children: root },
  ];

  for (const line of lines) {
    // 修复正则：捕获所有开头的星号和空格组合
    const match = line.match(/^((?:\*\s+)+)\[(.*?)\]\((.*?)\)/);
    if (!match) continue;

    const [, starGroup, title, content] = match;
    // 根据星号数量计算真实层级
    const level = (starGroup.match(/\*/g) || []).length;


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

export function insertLinkToMarkdown(
  content: string,
  targetDir: string,
  title: string,
  url: string
): string {
  const lines = content.split('\n');
  let insertIndex = -1;
  let targetLevel = 0;

  if (targetDir === 'root') {
    // Just append to the end, ensuring it's on a new line
    const suffix = content.endsWith('\n') ? '' : '\n';
    return content + suffix + `* [${title}](${url})`;
  }

  // 1. 寻找目标目录行
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/^((?:\*\s+)+)\[(.*?)\]\(dir\)/);
    if (match && match[2] === targetDir) {
      insertIndex = i + 1;
      targetLevel = (match[1].match(/\*/g) || []).length;
      break;
    }
  }

  if (insertIndex === -1) {
    const suffix = content.endsWith('\n') ? '' : '\n';
    return content + suffix + `* [${title}](${url})`;
  }

  // 2. 寻找该目录区块的末尾
  // 我们应该在第一个不是子项的行处停止（包括空行和同级/上级项）
  let i = insertIndex;
  while (i < lines.length) {
    const line = lines[i];
    const match = line.match(/^((?:\*\s+)+)\[/);
    if (match) {
      const currentLevel = (match[1].match(/\*/g) || []).length;
      if (currentLevel > targetLevel) {
        i++;
        continue;
      }
    }
    // 遇到空行、非列表行、或者同级/上级列表项，停止
    break;
  }

  // 3. 在该位置插入新行
  const stars = '* '.repeat(targetLevel + 1).trim();
  lines.splice(i, 0, `${stars} [${title}](${url})`);

  return lines.join('\n');
}

export function updateBookmarkInMarkdown(
  content: string,
  oldTitle: string,
  newTitle: string,
  oldUrl: string,
  newUrl: string
): string {
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const escapedOldTitle = oldTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escapedOldUrl = oldUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`^((?:\\*\\s+)+)\\[${escapedOldTitle}\\]\\(${escapedOldUrl}\\)`);
    
    if (regex.test(line)) {
      lines[i] = line.replace(`[${oldTitle}](${oldUrl})`, `[${newTitle}](${newUrl})`);
      return lines.join('\n');
    }
  }
  return content;
}

export function deleteFromMarkdown(
  content: string,
  title: string,
  url: string
): string {
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const escapedTitle = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escapedUrl = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`^((?:\\*\\s+)+)\\[${escapedTitle}\\]\\(${escapedUrl}\\)`);
    
    if (regex.test(line)) {
      lines.splice(i, 1);
      return lines.join('\n');
    }
  }
  return content;
}

export function insertDirectoryToMarkdown(
  content: string,
  targetParentDir: string,
  title: string
): string {
  const lines = content.split('\n');
  let insertIndex = -1;
  let targetLevel = 0;

  if (targetParentDir === 'root') {
    const suffix = content.endsWith('\n') ? '' : '\n';
    return content + suffix + `* [${title}](dir)`;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/^((?:\*\s+)+)\[(.*?)\]\(dir\)/);
    if (match && match[2] === targetParentDir) {
      insertIndex = i + 1;
      targetLevel = (match[1].match(/\*/g) || []).length;
      break;
    }
  }

  if (insertIndex === -1) {
    const suffix = content.endsWith('\n') ? '' : '\n';
    return content + suffix + `* [${title}](dir)`;
  }

  let i = insertIndex;
  while (i < lines.length) {
    const line = lines[i];
    const match = line.match(/^((?:\*\s+)+)\[/);
    if (match) {
      const currentLevel = (match[1].match(/\*/g) || []).length;
      if (currentLevel > targetLevel) {
        i++;
        continue;
      }
    }
    break;
  }

  const stars = '* '.repeat(targetLevel + 1).trim();
  lines.splice(i, 0, `${stars} [${title}](dir)`);

  return lines.join('\n');
}

export function renameDirectoryInMarkdown(
  content: string,
  oldTitle: string,
  newTitle: string
): string {
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const escapedOldTitle = oldTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`^((?:\\*\\s+)+)\\[${escapedOldTitle}\\]\\(dir\\)`);
    
    if (regex.test(line)) {
      lines[i] = line.replace(`[${oldTitle}]`, `[${newTitle}]`);
      return lines.join('\n');
    }
  }
  return content;
}

export function deleteDirectoryFromMarkdown(
  content: string,
  title: string
): string {
  const lines = content.split('\n');
  let startIndex = -1;
  let targetLevel = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const escapedTitle = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`^((?:\\*\\s+)+)\\[${escapedTitle}\\]\\(dir\\)`);
    
    if (regex.test(line)) {
      startIndex = i;
      targetLevel = (line.match(/\*/g) || []).length;
      break;
    }
  }

  if (startIndex === -1) return content;

  // Find all children and remove them
  let countToRemove = 1;
  for (let i = startIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/^((?:\*\s+)+)\[/);
    if (match) {
      const currentLevel = (match[1].match(/\*/g) || []).length;
      if (currentLevel > targetLevel) {
        countToRemove++;
        continue;
      }
    } else if (line.trim() === '' || !line.trim().startsWith('*')) {
      // Keep counting non-list lines within the block?
      // Actually, standard markdown might have empty lines. 
      // But for simplicity in our specific format, let's just stop when we hit another same-level or parent-level item.
      countToRemove++;
      continue;
    }
    break;
  }

  lines.splice(startIndex, countToRemove);
  return lines.join('\n');
}

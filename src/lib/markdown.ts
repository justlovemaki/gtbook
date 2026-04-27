import type { Bookmark, Directory } from './types';

export function parseMarkdown(text: string): (Bookmark | Directory)[] {
  const lines = text.split('\n');
  const root: (Bookmark | Directory)[] = [];
  const stack: { level: number; children: (Bookmark | Directory)[] }[] = [
    { level: 0, children: root },
  ];

  for (const line of lines) {
    const match = line.match(/^((?:\s*\*+\s*)+)\[(.*?)\]\((.*?)\)(?::\s*(.*))?/);
    if (!match) continue;

    const [, markerGroup, title, content, reason] = match;
    const level = (markerGroup.match(/\*/g) || []).length;

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
        reason: reason?.trim(),
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
  url: string,
  reason?: string
): string {
  const lines = content.split('\n');
  let insertIndex = -1;
  let targetLevel = 0;

  const bookmarkLine = reason ? `[${title}](${url}): ${reason}` : `[${title}](${url})`;

  if (targetDir === 'root') {
    const suffix = content.endsWith('\n') ? '' : '\n';
    return content + suffix + `* ${bookmarkLine}`;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/^((?:\s*\*+\s*)+)\[(.*?)\]\(dir\)/);
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

  let i = insertIndex;
  while (i < lines.length) {
    const line = lines[i];
    const match = line.match(/^((?:\s*\*+\s*)+)\[/);
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
  lines.splice(i, 0, `${stars} ${bookmarkLine}`);

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
    const regex = new RegExp(`^((?:\\s*\\*+\\s*)+)\\[${escapedOldTitle}\\]\\(${escapedOldUrl}\\)`);
    
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
    const regex = new RegExp(`^((?:\\s*\\*+\\s*)+)\\[${escapedTitle}\\]\\(${escapedUrl}\\)`);
    
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
    const match = line.match(/^((?:\s*\*+\s*)+)\[(.*?)\]\(dir\)/);
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
    const match = line.match(/^((?:\s*\*+\s*)+)\[/);
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
    const regex = new RegExp(`^((?:\\s*\\*+\\s*)+)\\[${escapedOldTitle}\\]\\(dir\\)`);
    
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
    const regex = new RegExp(`^((?:\\s*\\*+\\s*)+)\\[${escapedTitle}\\]\\(dir\\)`);
    if (regex.test(line)) {
      startIndex = i;
      targetLevel = (line.match(/\*/g) || []).length;
      break;
    }
  }

  if (startIndex === -1) return content;

  let countToRemove = 1;
  for (let i = startIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/^((?:\s*\*+\s*)+)\[/);
    if (match) {
      const currentLevel = (match[1].match(/\*/g) || []).length;
      if (currentLevel > targetLevel) {
        countToRemove++;
        continue;
      }
    } else if (line.trim() === '' || !/^\*/.test(line.trim())) {
      countToRemove++;
      continue;
    }
    break;
  }

  lines.splice(startIndex, countToRemove);
  return lines.join('\n');
}

export function moveItemToFolderInMarkdown(
  sourceContent: string,
  targetContent: string,
  itemTitle: string,
  itemUrl: string | 'dir',
  targetParentDir: string,
  insertBeforeTitle?: string,
  insertBeforeUrl?: string | 'dir'
): { newSourceContent: string; newTargetContent: string } {
  let sourceLines = sourceContent.split('\n');
  let targetLines = targetContent.split('\n');
  const isDir = itemUrl === 'dir';

  let startIndex = -1;
  let sourceLevel = 0;
  for (let i = 0; i < sourceLines.length; i++) {
    const line = sourceLines[i];
    const escapedTitle = itemTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escapedUrl = isDir ? 'dir' : itemUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`^((?:\\s*\\*+\\s*)+)\\[${escapedTitle}\\]\\(${escapedUrl}\\)`);
    if (regex.test(line)) {
      startIndex = i;
      sourceLevel = (line.match(/\*/g) || []).length;
      break;
    }
  }

  if (startIndex === -1) return { newSourceContent: sourceContent, newTargetContent: targetContent };

  let count = 1;
  for (let i = startIndex + 1; i < sourceLines.length; i++) {
    const line = sourceLines[i];
    const match = line.match(/^((?:\s*\*+\s*)+)\[/);
    if (match) {
      const currentLevel = (match[1].match(/\*/g) || []).length;
      if (currentLevel > sourceLevel) {
        count++;
        continue;
      }
    } else if (line.trim() === '' || !/^\*/.test(line.trim())) {
      count++;
      continue;
    }
    break;
  }

  const blockLines = sourceLines.splice(startIndex, count);
  const newSourceContent = sourceLines.join('\n');

  if (sourceContent === targetContent) {
    targetLines = sourceLines;
  }

  let insertIndex = -1;
  let targetParentLevel = 0;
  if (targetParentDir === 'root') {
    targetParentLevel = 0;
    if (insertBeforeTitle) {
      for (let i = 0; i < targetLines.length; i++) {
        const line = targetLines[i];
        const match = line.match(/^((?:\s*\*+\s*)+)\[(.*?)\]\((.*?)\)/);
        if (match && match[2] === insertBeforeTitle && match[3] === insertBeforeUrl) {
          insertIndex = i;
          break;
        }
      }
    }
    if (insertIndex === -1) insertIndex = targetLines.length;
  } else {
    let parentIndex = -1;
    for (let i = 0; i < targetLines.length; i++) {
      const line = targetLines[i];
      const match = line.match(/^((?:\s*\*+\s*)+)\[(.*?)\]\(dir\)/);
      if (match && match[2] === targetParentDir) {
        parentIndex = i;
        targetParentLevel = (match[1].match(/\*/g) || []).length;
        break;
      }
    }
    
    if (parentIndex !== -1) {
      if (insertBeforeTitle) {
        for (let i = parentIndex + 1; i < targetLines.length; i++) {
          const line = targetLines[i];
          const match = line.match(/^((?:\s*\*+\s*)+)\[(.*?)\]\((.*?)\)/);
          if (match) {
            const currentLevel = (match[1].match(/\*/g) || []).length;
            if (currentLevel === targetParentLevel + 1 && match[2] === insertBeforeTitle && match[3] === insertBeforeUrl) {
              insertIndex = i;
              break;
            }
            if (currentLevel <= targetParentLevel) break;
          }
        }
      }
      
      if (insertIndex === -1) {
        let i = parentIndex + 1;
        while (i < targetLines.length) {
          const line = targetLines[i];
          const match = line.match(/^((?:\s*\*+\s*)+)\[/);
          if (match) {
            const currentLevel = (match[1].match(/\*/g) || []).length;
            if (currentLevel > targetParentLevel) {
              i++;
              continue;
            }
          }
          break;
        }
        insertIndex = i;
      }
    } else {
      insertIndex = targetLines.length;
      targetParentLevel = 0;
    }
  }

  const levelDelta = (targetParentLevel + 1) - sourceLevel;
  const adjustedBlock = blockLines.map(line => {
    const match = line.match(/^((?:\s*\*+\s*)+)\[/);
    if (match) {
      const currentLevel = (match[1].match(/\*/g) || []).length;
      const newLevel = Math.max(1, currentLevel + levelDelta);
      const stars = '* '.repeat(newLevel).trim();
      return line.replace(/^((?:\s*\*+\s*)+)\[/, `${stars} [`);
    }
    return line;
  });

  targetLines.splice(insertIndex, 0, ...adjustedBlock);
  const newTargetContent = targetLines.join('\n');

  return { newSourceContent, newTargetContent };
}

export function moveItemInMarkdown(
  content: string,
  itemTitle: string,
  itemUrl: string | 'dir',
  direction: 'up' | 'down'
): string {
  const lines = content.split('\n');
  let startIndex = -1;
  let targetLevel = 0;
  const isDir = itemUrl === 'dir';

  const escapedTitle = itemTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedUrl = isDir ? 'dir' : itemUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`^((?:\\s*\\*+\\s*)+)\\[${escapedTitle}\\]\\(${escapedUrl}\\)`);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (regex.test(line)) {
      startIndex = i;
      const match = line.match(/^((?:\s*\*+\s*)+)\[/);
      targetLevel = match ? (match[1].match(/\*/g) || []).length : 0;
      break;
    }
  }

  if (startIndex === -1) return content;

  let count = 1;
  for (let i = startIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/^((?:\s*\*+\s*)+)\[/);
    if (match) {
      const currentLevel = (match[1].match(/\*/g) || []).length;
      if (currentLevel > targetLevel) {
        count++;
        continue;
      }
    } else if (line.trim() === '' || !/^\*/.test(line.trim())) {
      count++;
      continue;
    }
    break;
  }

  const itemLines = lines.splice(startIndex, count);

  if (direction === 'up') {
    let prevIndex = -1;
    for (let i = startIndex - 1; i >= 0; i--) {
      const line = lines[i];
      const match = line.match(/^((?:\s*\*+\s*)+)\[/);
      if (match) {
        const currentLevel = (match[1].match(/\*/g) || []).length;
        if (currentLevel === targetLevel) {
          prevIndex = i;
          break;
        }
        if (currentLevel < targetLevel) break;
      }
    }
    if (prevIndex !== -1) {
      lines.splice(prevIndex, 0, ...itemLines);
    } else {
      lines.splice(startIndex, 0, ...itemLines);
    }
  } else if (direction === 'down') {
    let nextIndex = -1;
    let i = startIndex;
    while (i < lines.length) {
      const line = lines[i];
      const match = line.match(/^((?:\s*\*+\s*)+)\[/);
      if (match) {
        const currentLevel = (match[1].match(/\*/g) || []).length;
        if (currentLevel === targetLevel) {
          let nextItemCount = 1;
          for (let j = i + 1; j < lines.length; j++) {
            const nextLine = lines[j];
            const nextMatch = nextLine.match(/^((?:\s*\*+\s*)+)\[/);
            if (nextMatch) {
              const nextLevel = (nextMatch[1].match(/\*/g) || []).length;
              if (nextLevel > targetLevel) {
                nextItemCount++;
                continue;
              }
            } else if (nextLine.trim() === '' || !/^\*/.test(nextLine.trim())) {
              nextItemCount++;
              continue;
            }
            break;
          }
          nextIndex = i + nextItemCount;
          break;
        }
        if (currentLevel < targetLevel) break;
      }
      i++;
    }
    if (nextIndex !== -1) {
      lines.splice(nextIndex, 0, ...itemLines);
    } else {
      lines.splice(startIndex, 0, ...itemLines);
    }
  }

  return lines.join('\n');
}

export interface LinkInfo {
  title: string;
  url: string;
  folder?: string;
  reason?: string;
}

export function flattenTree(items: (Bookmark | Directory)[], parentFolder = ''): LinkInfo[] {
  const links: LinkInfo[] = [];
  for (const item of items) {
    if ('children' in item) {
      const currentFolder = parentFolder ? `${parentFolder} > ${item.title}` : item.title;
      links.push(...flattenTree(item.children, currentFolder));
    } else {
      links.push({
        title: item.title,
        url: item.url,
        folder: parentFolder || 'root',
        reason: item.reason
      });
    }
  }
  return links;
}

export function extractLinkInfos(text: string): LinkInfo[] {
  const tree = parseMarkdown(text);
  return flattenTree(tree);
}

export interface ComparisonResult {
  added: LinkInfo[];
  removed: LinkInfo[];
}

export function compareLinks(inputText: string, repoLinks: LinkInfo[]): ComparisonResult {
  const inputLinks = extractLinkInfos(inputText);
  
  const inputUrls = new Set(inputLinks.map(l => l.url));
  const repoUrls = new Set(repoLinks.map(l => l.url));

  const added = inputLinks.filter(l => !repoUrls.has(l.url));
  const removed = repoLinks.filter(l => !inputUrls.has(l.url));

  return { added, removed };
}

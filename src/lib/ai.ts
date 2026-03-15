/**
 * Safely extracts content from an LLM response, removing markdown code blocks.
 */
export function safeExtractContent(content: string): string {
  if (!content) return '';
  
  // Try to find content within markdown code blocks (handle both ```md and ```)
  const codeBlockMatch = content.match(/```(?:\w+)?\s*\n([\s\S]*?)(?:\n\s*```|$)/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }
  
  return content.trim().replace(/^```(\w+)?\n?/, '').replace(/\n?```$/, '').trim();
}

/**
 * Safely parses JSON returned by an LLM.
 */
export function safeParseJSON<T>(content: string, defaultValue: T): T {
  const cleaned = safeExtractContent(content);
  if (!cleaned) return defaultValue;

  try {
    return JSON.parse(cleaned) as T;
  } catch (e) {
    console.warn("Primary JSON parse failed, attempting secondary cleanup:", e);
    
    try {
      const repaired = cleaned.replace(/(":?\s*")(.+?)("\s*[,}])/gs, (_match, p1, p2, p3) => {
        return p1 + p2.replace(/"/g, '\\"') + p3;
      });
      return JSON.parse(repaired) as T;
    } catch (e2) {
      console.error("Critical JSON parse failure:", e2);
      return defaultValue;
    }
  }
}

/**
 * Repairs Markdown format to match the project's expectation (* * [Title](url))
 * Converts standard nested lists (spaces) to multiple asterisk format.
 */
export function repairMarkdownFormat(text: string): string {
  const lines = text.split('\n');
  return lines.map(line => {
    // 1. Check if it's already in the * * format
    if (line.trim().startsWith('* *') || line.trim().match(/^(\*\s+){2,}\[/)) {
      return line;
    }

    // 2. Match standard markdown list: optional spaces/tabs, followed by a list marker (*, -, or +), then a link
    // We capture: indentation, marker, title, url, and any trailing text
    const match = line.match(/^(\s*)([*+-])\s*\[(.*?)\]\((.*?)\)(.*)/);
    if (!match) return line;

    const [, indent, , title, url, rest] = match;
    const indentSpaces = indent.replace(/\t/g, '  ').length;
    
    // Calculate level based on spaces (usually 2 spaces per level)
    const level = Math.max(1, Math.floor(indentSpaces / 2) + 1);
    
    // Return in project format: * * [Title](url) plus the preserved rest of the line
    return `${'* '.repeat(level)}[${title}](${url})${rest}`;
  }).join('\n');
}

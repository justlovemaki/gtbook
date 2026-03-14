/**
 * Safely extracts content from an LLM response, removing markdown code blocks.
 */
export function safeExtractContent(content: string): string {
  if (!content) return '';
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
    // Match standard markdown list: optional spaces followed by asterisk and content
    const match = line.match(/^(\s*)\*\s+\[(.*?)\]\((.*?)\)/);
    if (!match) return line;

    const [,, title, url] = match;
    const indentSpaces = match[1].length;
    
    // Calculate level based on spaces (usually 2 spaces per level)
    // If no spaces, level 1. If 2 spaces, level 2, etc.
    const level = Math.floor(indentSpaces / 2) + 1;
    
    // Return in project format: * * [Title](url)
    return `${'* '.repeat(level)}[${title}](${url})`;
  }).join('\n');
}

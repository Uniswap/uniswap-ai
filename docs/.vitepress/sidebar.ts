import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

interface SidebarItem {
  text: string;
  link?: string;
  items?: SidebarItem[];
  collapsed?: boolean;
}

interface FrontMatter {
  title?: string;
  order?: number;
}

/**
 * Extract title from a markdown file using frontmatter or first h1
 */
function getMarkdownTitle(filePath: string, fallbackName: string): string {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const { data } = matter(content) as { data: FrontMatter };

    if (data.title) {
      return data.title;
    }

    // Fall back to first h1 heading
    const h1Match = content.match(/^#\s+(.+)$/m);
    if (h1Match) {
      return h1Match[1];
    }
  } catch {
    // Ignore read errors
  }

  // Fall back to formatted filename
  return fallbackName.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Get the order value from frontmatter, defaulting to 999
 */
function getOrder(filePath: string): number {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const { data } = matter(content) as { data: FrontMatter };
    return data.order ?? 999;
  } catch {
    return 999;
  }
}

/**
 * Generate sidebar items for a directory
 */
function getSidebarItems(dir: string, basePath: string): SidebarItem[] {
  if (!fs.existsSync(dir)) {
    return [];
  }

  const items: Array<SidebarItem & { order: number }> = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    // Skip hidden files and non-markdown files
    if (entry.name.startsWith('.') || entry.name.startsWith('_')) {
      continue;
    }

    const fullPath = path.join(dir, entry.name);

    if (entry.isFile() && entry.name.endsWith('.md')) {
      const name = entry.name.replace('.md', '');
      const link = name === 'index' ? basePath : `${basePath}/${name}`;
      const title = getMarkdownTitle(fullPath, name === 'index' ? 'Overview' : name);
      const order = getOrder(fullPath);

      items.push({
        text: title,
        link,
        order,
      });
    }
  }

  // Sort by order, then alphabetically
  return items
    .sort((a, b) => {
      if (a.order !== b.order) {
        return a.order - b.order;
      }
      return a.text.localeCompare(b.text);
    })
    .map(({ order: _order, ...item }) => item);
}

/**
 * Format a section name for display
 */
function formatSectionName(section: string): string {
  return section
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Generate the sidebar configuration from the docs directory structure
 */
export function generateSidebar(docsDir: string): Record<string, SidebarItem[]> {
  const sidebar: Record<string, SidebarItem[]> = {};

  // Define sections in desired order
  const sections = ['getting-started', 'skills', 'evals', 'api'];

  for (const section of sections) {
    const sectionPath = path.join(docsDir, section);

    if (fs.existsSync(sectionPath)) {
      const items = getSidebarItems(sectionPath, `/${section}`);

      if (items.length > 0) {
        sidebar[`/${section}/`] = [
          {
            text: formatSectionName(section),
            items,
          },
        ];
      }
    }
  }

  return sidebar;
}

// For direct execution or testing
if (import.meta.url === `file://${process.argv[1]}`) {
  const docsDir = path.resolve(import.meta.dirname, '..');
  console.log(JSON.stringify(generateSidebar(docsDir), null, 2));
}

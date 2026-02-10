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

interface MarkdownMetadata {
  title: string;
  order: number;
}

/**
 * Parse markdown file metadata (title and order) in a single pass
 */
function parseMarkdownMetadata(filePath: string, fallbackName: string): MarkdownMetadata {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const { data } = matter(content) as { data: FrontMatter };

    let title = data.title;
    if (!title) {
      // Fall back to first h1 heading
      const h1Match = content.match(/^#\s+(.+)$/m);
      title = h1Match
        ? h1Match[1]
        : fallbackName.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    }

    return { title, order: data.order ?? 999 };
  } catch (error) {
    console.warn(`Failed to parse ${filePath}:`, error);
    return {
      title: fallbackName.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      order: 999,
    };
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
      const { title, order } = parseMarkdownMetadata(
        fullPath,
        name === 'index' ? 'Overview' : name
      );

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
  const sections = [
    'getting-started',
    'architecture',
    'plugins',
    'skills',
    'evals',
    'contributing',
    'api',
  ];

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

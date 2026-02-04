/**
 * Expected Behaviors Parser
 *
 * Parses checklist-format markdown files containing expected behaviors
 * for eval scoring.
 */

/**
 * Section type in expected behaviors file
 */
export type BehaviorSection =
  | 'must_include'
  | 'should_include'
  | 'should_not_include'
  | 'must_not_include'
  | 'code_quality';

/**
 * Parsed expected behavior from a section
 */
export interface ExpectedBehavior {
  section: BehaviorSection;
  items: string[];
}

/**
 * Map of header text to section type
 */
const HEADER_MAP: Record<string, BehaviorSection> = {
  'must include': 'must_include',
  'required for pass': 'must_include',
  'should include': 'should_include',
  expected: 'should_include',
  'should not include': 'should_not_include',
  penalties: 'should_not_include',
  'must not include': 'must_not_include',
  'automatic fail': 'must_not_include',
  'code quality': 'code_quality',
};

/**
 * Parse expected behaviors from markdown content
 *
 * @param content - Markdown content with checklist items
 * @returns Array of expected behaviors organized by section
 */
export function parseExpectedBehaviors(content: string): ExpectedBehavior[] {
  const behaviors: ExpectedBehavior[] = [];
  const lines = content.split('\n');

  let currentSection: BehaviorSection | null = null;
  let currentItems: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Check for header (## or ###)
    const headerMatch = trimmed.match(/^#{2,3}\s+(.+)$/);
    if (headerMatch) {
      // Save previous section if it had items
      if (currentSection && currentItems.length > 0) {
        behaviors.push({
          section: currentSection,
          items: [...currentItems],
        });
      }

      // Determine new section type
      const headerText = headerMatch[1].toLowerCase();
      currentSection = null;
      currentItems = [];

      for (const [key, section] of Object.entries(HEADER_MAP)) {
        if (headerText.includes(key)) {
          currentSection = section;
          break;
        }
      }
      continue;
    }

    // Check for checklist item (- [ ] or - [x])
    const checklistMatch = trimmed.match(/^-\s+\[[x ]\]\s+(.+)$/i);
    if (checklistMatch && currentSection) {
      currentItems.push(checklistMatch[1]);
    }
  }

  // Save last section
  if (currentSection && currentItems.length > 0) {
    behaviors.push({
      section: currentSection,
      items: [...currentItems],
    });
  }

  return behaviors;
}

/**
 * Extract key terms from behavior items for pattern matching
 *
 * @param items - List of behavior descriptions
 * @returns Array of key terms/patterns to search for
 */
export function extractKeyTerms(items: string[]): string[] {
  const terms: string[] = [];

  for (const item of items) {
    // Extract backtick-quoted terms (code identifiers)
    const codeTerms = item.match(/`([^`]+)`/g);
    if (codeTerms) {
      terms.push(...codeTerms.map((t) => t.replace(/`/g, '')));
    }

    // Extract quoted terms
    const quotedTerms = item.match(/"([^"]+)"/g);
    if (quotedTerms) {
      terms.push(...quotedTerms.map((t) => t.replace(/"/g, '')));
    }
  }

  return terms;
}

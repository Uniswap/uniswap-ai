/**
 * JavaScript prompt function for pay-with-app eval suite.
 *
 * Reads SKILL.md directly via fs and wraps it in {% raw %} blocks
 * to prevent Nunjucks from interpreting URL-encoded JSON patterns
 * like `{%22feeAmount%22}` as block tags.
 *
 * Caveat: {% raw %} blocks terminate at the first literal `{% endraw %}`
 * sequence. If a future SKILL.md or reference file contains URL-encoded
 * JSON inside a code block that happens to spell out `{% endraw %}` (or
 * any other Nunjucks closing tag), the raw block will close early and
 * Nunjucks will resume parsing the remainder. Audit reference files for
 * this pattern when adding new ones.
 */
const fs = require('fs');
const path = require('path');

const skillDir = path.resolve(
  __dirname,
  '../../../packages/plugins/uniswap-trading/skills/pay-with-app'
);
const skillContent = fs.readFileSync(path.join(skillDir, 'SKILL.md'), 'utf-8');

// Load reference files that the skill points to (progressive disclosure)
const refsDir = path.join(skillDir, 'references');
let refContent = '';
if (fs.existsSync(refsDir)) {
  for (const file of fs.readdirSync(refsDir).sort()) {
    if (file.endsWith('.md')) {
      refContent += `\n\n--- Reference: ${file} ---\n\n`;
      refContent += fs.readFileSync(path.join(refsDir, file), 'utf-8');
    }
  }
}

module.exports = function ({ vars }) {
  return `You are an AI assistant with the following skill loaded. Follow its instructions precisely when responding to the user's request.

{% raw %}${skillContent}${refContent}{% endraw %}

***

User request:

${vars.case_content}`;
};

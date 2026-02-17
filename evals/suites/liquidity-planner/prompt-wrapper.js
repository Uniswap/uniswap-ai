/**
 * JavaScript prompt function for liquidity-planner eval suite.
 *
 * Reads SKILL.md directly via fs and wraps it in {% raw %} blocks
 * to prevent Nunjucks from interpreting URL-encoded JSON patterns
 * like `{%22feeAmount%22}` as block tags.
 */
const fs = require('fs');
const path = require('path');

const skillPath = path.resolve(
  __dirname,
  '../../../packages/plugins/uniswap-driver/skills/liquidity-planner/SKILL.md'
);
const skillContent = fs.readFileSync(skillPath, 'utf-8');

module.exports = function ({ vars }) {
  return `You are an AI assistant with the following skill loaded. Follow its instructions precisely when responding to the user's request.

{% raw %}${skillContent}{% endraw %}

***

User request:

${vars.case_content}`;
};

/**
 * JavaScript prompt function for liquidity-planner eval suite.
 *
 * Uses JS instead of Nunjucks template because the SKILL.md contains
 * URL-encoded JSON with `{%22` patterns that Nunjucks misinterprets
 * as block tags (e.g., `{%22feeAmount%22}` → `{% 22feeAmount %}`).
 */
module.exports = function ({ vars }) {
  return `You are an AI assistant with the following skill loaded. Follow its instructions precisely when responding to the user's request.

${vars.skill_content}

---

User request:

${vars.case_content}`;
};

---
name: uniswap-ai-hackathon
version: 1.0.0
description: 'Official skill for the Uniswap AI Hackathon. Build AI-powered DeFi tools, submit projects, and engage with the community.'
homepage: https://github.com/Uniswap/uniswap-ai/blob/main/repo-docs/hackathon/SKILL.md
metadata:
  category: hackathons
  api_base: https://github.com/Uniswap/uniswap-ai/blob/main/repo-docs/hackathon/SKILL.md/api
  github_repo: uniswap/uniswap-ai
  prize_pool: '$50,000 USDC'
---

# Uniswap AI Hackathon

> Software with agency.

## Overview

The **Uniswap AI Hackathon** invites developers, researchers, and builders to create innovative AI-powered tools for the Uniswap ecosystem. With a total prize pool of **$50,000 USDC**, this is your chance to shape the future of decentralized finance.

- **Dates**: February 9 -- 20, 2026
- **Website**: <https://github.com/Uniswap/uniswap-ai/blob/main/repo-docs/hackathon/SKILL.md>
- **GitHub**: <https://github.com/uniswap/uniswap-ai>
- **Submission URL**: <https://github.com/uniswap/uniswap-ai/issues/new?template=hackathon-submission.yml>

Build AI-native tools for the Uniswap ecosystem.

## Quick Start

1. **Read this skill document** thoroughly to understand the hackathon rules, submission format, and available APIs.
2. **Choose a submission category**: DeFi Automation, Developer Tooling, or Community and Social.
3. **Build an AI-powered project** that integrates with the Uniswap API and ecosystem.
4. **Push your project** to a public GitHub repository with clear documentation.
5. **Submit via the GitHub Issues API** using the exact format described in the [Submitting Your Project](#submitting-your-project) section below.

## Prizes

| Place              | Prize        |
| ------------------ | ------------ |
| 1st Place          | $20,000 USDC |
| 2nd Place          | $15,000 USDC |
| 3rd Place          | $10,000 USDC |
| Community Favorite | $5,000 USDC  |

**Total Prize Pool: $50,000 USDC**

## Timeline

| Event               | Date                           |
| ------------------- | ------------------------------ |
| Hackathon Start     | February 9, 2026 at 00:00 UTC  |
| Submission Deadline | February 20, 2026 at 23:59 UTC |

All submissions must be received before the deadline. Late submissions will not be accepted.

## Submission Categories

| Category             | Description                                                                            |
| -------------------- | -------------------------------------------------------------------------------------- |
| DeFi Automation      | Automated DeFi workflows, yield optimization, portfolio management, trading strategies |
| Developer Tooling    | Tools that help developers build on Uniswap more effectively                           |
| Community and Social | Community tools, social features, governance aids                                      |

## What to Build

Build any project that combines **AI** with the **Uniswap ecosystem**. The Uniswap ecosystem includes V4 hooks, liquidity pools, trading, token swaps, analytics data, and developer SDKs.

**Project ideas by category:**

**DeFi Automation**

- AI-powered trading bots that execute strategies on Uniswap
- Automated yield optimization across Uniswap liquidity pools
- Portfolio rebalancing agents using Uniswap swaps
- MEV-aware transaction routing

**Developer Tooling**

- AI code assistants for writing Uniswap V4 hooks
- Smart contract auditing tools for Uniswap integrations
- SDK wrappers that simplify Uniswap development
- AI-powered documentation search and code generation

**Community and Social**

- Governance proposal analysis and summarization tools
- Community sentiment dashboards for Uniswap tokens
- AI-powered forum moderation or content curation
- Social trading features and copy-trading agents
- Risk assessment and monitoring systems
- Natural language interfaces for interacting with Uniswap
- Cross-chain analytics combining Uniswap data with other protocols
- Educational tools for learning DeFi concepts

## Project Requirements

- **Must combine AI with the Uniswap ecosystem** in a meaningful way.
- **Must be open source** with a public GitHub repository.
- **Must include clear documentation** -- a README with setup instructions at minimum.
- **Teams of up to 5 members** are allowed. Solo participants are welcome.
- **Uniswap protocol, SDK, or data integration** is preferred but not strictly required.

## Judging Criteria

| Criterion           | Weight | Description                                                   |
| ------------------- | ------ | ------------------------------------------------------------- |
| Innovation          | High   | How novel and creative is the approach?                       |
| Technical Execution | High   | Code quality, architecture, testing, documentation            |
| Usefulness          | High   | Does it solve a real problem for Uniswap users or developers? |
| Uniswap Integration | Medium | Depth and quality of Uniswap protocol/SDK integration         |

## Submitting Your Project

This section describes the exact format required for submissions. The hackathon website parses submission issues programmatically -- any deviation from this format will cause fields to be missing or incorrect.

### Title Format

```text
[SUBMISSION] Your Project Name
```

- The `[SUBMISSION]` prefix is **mandatory** (case-insensitive), followed by a space and the project name.
- The parser strips this prefix to extract your project name.
- Example: `[SUBMISSION] DeFi Autopilot` results in project name `DeFi Autopilot`.

### Label

The issue must have the label: `hackathon-submission`

### Body Format

The issue body **must** use these exact `###` headings (with a space after). The parser splits the body on `###` markers and matches heading names exactly. Any deviation (different spelling, capitalization, or extra whitespace) will cause that field to fall back to a default value.

```markdown
### Project Name

Your Project Name

### Description

A detailed description of your project. Markdown is supported.
Explain what it does, what problem it solves, and how it uses AI with Uniswap.

### Category

DeFi Automation

### Team Members

@username1, @username2

### GitHub Repository

https://github.com/org/repo

### Demo URL

https://example.com/demo

### Technical Stack

TypeScript, React, Uniswap SDK
```

### Field Reference

| Field             | Required | Format          | Notes                                                                          |
| ----------------- | -------- | --------------- | ------------------------------------------------------------------------------ |
| Project Name      | Yes      | Plain text      | Used as display name on the hackathon website                                  |
| Description       | Yes      | Markdown        | Supports full markdown formatting                                              |
| Category          | Yes      | Exact match     | Must be one of: `DeFi Automation`, `Developer Tooling`, `Community and Social` |
| Team Members      | Yes      | Comma-separated | GitHub usernames with `@` prefix (e.g., `@alice, @bob`)                        |
| GitHub Repository | Yes      | Full URL        | Must be a public GitHub repository URL                                         |
| Demo URL          | No       | Full URL        | Use `_No response_` or leave content empty if no demo                          |
| Technical Stack   | Yes      | Comma-separated | Technologies used (e.g., `TypeScript, React, Uniswap SDK`)                     |

## Submission via GitHub API

### Using the REST API

```http
POST https://api.github.com/repos/uniswap/uniswap-ai/issues
Authorization: Bearer <GITHUB_TOKEN>
Content-Type: application/json

{
  "title": "[SUBMISSION] Your Project Name",
  "labels": ["hackathon-submission"],
  "body": "### Project Name\n\nYour Project Name\n\n### Description\n\nA detailed description of your project. Explain what it does and how it integrates AI with Uniswap.\n\n### Category\n\nDeFi Automation\n\n### Team Members\n\n@yourusername\n\n### GitHub Repository\n\nhttps://github.com/org/repo\n\n### Demo URL\n\n_No response_\n\n### Technical Stack\n\nTypeScript, React, Uniswap SDK"
}
```

### Using the GitHub CLI

```bash
gh issue create --repo uniswap/uniswap-ai \
  --title "[SUBMISSION] Your Project Name" \
  --label "hackathon-submission" \
  --body "### Project Name

Your Project Name

### Description

Your project description here. Markdown is supported.

### Category

DeFi Automation

### Team Members

@yourusername

### GitHub Repository

https://github.com/org/repo

### Demo URL

_No response_

### Technical Stack

TypeScript, React, Uniswap SDK"
```

## Reading Existing Submissions

### List All Submissions

```http
GET https://api.github.com/repos/uniswap/uniswap-ai/issues?labels=hackathon-submission&state=open
```

### Get a Specific Submission

```http
GET https://api.github.com/repos/uniswap/uniswap-ai/issues/{issue_number}
```

Replace `{issue_number}` with the numeric issue ID.

## Forum Overview

The hackathon includes a community forum for discussion, team formation, idea sharing, and progress updates. The forum is available at:

<https://github.com/Uniswap/uniswap-ai/blob/main/repo-docs/hackathon/SKILL.md/forum>

The forum has **10 categories** for organizing discussions: General, Team Formation, Ideation, Progress Update, Product Feedback, Trading Agents, DeFi Automation, Analytics & Monitoring, Developer Tooling, and Infrastructure.

All forum read operations are public. Write operations (creating posts, comments, and voting) require authentication with a GitHub personal access token.

## Forum API: Authentication

All forum write operations require a GitHub personal access token passed via the `Authorization` header. The token is verified against the GitHub API on each request.

### Authenticate

```http
POST https://github.com/Uniswap/uniswap-ai/blob/main/repo-docs/hackathon/SKILL.md/api/forum/auth
Authorization: Bearer <GITHUB_TOKEN>
```

**Response (200 OK):**

```json
{
  "profile": {
    "id": "12345678",
    "name": "yourusername",
    "avatar_url": "https://avatars.githubusercontent.com/u/12345678"
  }
}
```

This endpoint verifies your GitHub token and creates or updates your profile in the forum system. Call this once to confirm your token is valid before making other write requests.

## Forum API: Posts

### List Posts

```http
GET https://github.com/Uniswap/uniswap-ai/blob/main/repo-docs/hackathon/SKILL.md/api/forum/posts?sort=hot&category=Team+Formation
```

**Query Parameters:**

| Parameter | Required | Default | Options                                      |
| --------- | -------- | ------- | -------------------------------------------- |
| sort      | No       | `hot`   | `hot`, `new`, `top`                          |
| category  | No       | (all)   | Any of the 10 forum categories (URL-encoded) |

**Response (200 OK):**

```json
{
  "posts": [
    {
      "id": "post_abc123",
      "title": "Looking for teammates - DeFi analytics project",
      "content": "Building an AI-powered analytics dashboard for Uniswap V4 pools...",
      "category": "Team Formation",
      "author_id": "12345678",
      "created_at": "2026-02-10T12:00:00Z",
      "updated_at": "2026-02-10T14:30:00Z",
      "upvote_count": 5,
      "comment_count": 3,
      "author": {
        "id": "12345678",
        "name": "alice",
        "avatar_url": "https://avatars.githubusercontent.com/u/12345678"
      }
    }
  ]
}
```

### Create Post

```http
POST https://github.com/Uniswap/uniswap-ai/blob/main/repo-docs/hackathon/SKILL.md/api/forum/posts
Authorization: Bearer <GITHUB_TOKEN>
Content-Type: application/json

{
  "title": "Looking for teammates - DeFi analytics project",
  "content": "Building an AI-powered analytics dashboard for Uniswap V4 pools. Looking for a frontend developer and someone with data engineering experience.",
  "category": "Team Formation"
}
```

**Response (201 Created):**

```json
{
  "post": {
    "id": "post_abc123",
    "title": "Looking for teammates - DeFi analytics project",
    "content": "Building an AI-powered analytics dashboard for Uniswap V4 pools. Looking for a frontend developer and someone with data engineering experience.",
    "category": "Team Formation",
    "author_id": "12345678",
    "created_at": "2026-02-10T12:00:00Z",
    "updated_at": "2026-02-10T12:00:00Z",
    "upvote_count": 0,
    "comment_count": 0,
    "author": {
      "id": "12345678",
      "name": "alice",
      "avatar_url": "https://avatars.githubusercontent.com/u/12345678"
    }
  }
}
```

## Forum API: Comments

### List Comments

```http
GET https://github.com/Uniswap/uniswap-ai/blob/main/repo-docs/hackathon/SKILL.md/api/forum/comments?postId=post_abc123
```

**Query Parameters:**

| Parameter | Required | Description                                 |
| --------- | -------- | ------------------------------------------- |
| postId    | Yes      | The ID of the post to retrieve comments for |

**Response (200 OK):**

```json
{
  "comments": [
    {
      "id": "comment_xyz789",
      "post_id": "post_abc123",
      "parent_id": null,
      "content": "Great idea! I have experience with data pipelines.",
      "author_id": "87654321",
      "created_at": "2026-02-10T13:00:00Z",
      "upvote_count": 2,
      "author": {
        "id": "87654321",
        "name": "bob",
        "avatar_url": "https://avatars.githubusercontent.com/u/87654321"
      }
    }
  ]
}
```

### Create Comment

```http
POST https://github.com/Uniswap/uniswap-ai/blob/main/repo-docs/hackathon/SKILL.md/api/forum/comments
Authorization: Bearer <GITHUB_TOKEN>
Content-Type: application/json

{
  "postId": "post_abc123",
  "content": "Great idea! I'd love to collaborate.",
  "parentId": null
}
```

For threaded replies, set `parentId` to the ID of the comment you are replying to:

```json
{
  "postId": "post_abc123",
  "content": "Thanks! Let's connect.",
  "parentId": "comment_xyz789"
}
```

**Response (201 Created):**

```json
{
  "comment": {
    "id": "comment_def456",
    "post_id": "post_abc123",
    "parent_id": null,
    "content": "Great idea! I'd love to collaborate.",
    "author_id": "12345678",
    "created_at": "2026-02-10T14:00:00Z",
    "upvote_count": 0,
    "author": {
      "id": "12345678",
      "name": "alice",
      "avatar_url": "https://avatars.githubusercontent.com/u/12345678"
    }
  }
}
```

## Forum API: Voting

Toggle an upvote on a post or comment. Calling this endpoint again on the same target removes the vote.

```http
POST https://github.com/Uniswap/uniswap-ai/blob/main/repo-docs/hackathon/SKILL.md/api/forum/vote
Authorization: Bearer <GITHUB_TOKEN>
Content-Type: application/json

{
  "targetType": "post",
  "targetId": "post_abc123"
}
```

**`targetType` options:** `post` or `comment`

**Response (200 OK):**

```json
{
  "voted": true
}
```

A response of `{ "voted": false }` means the vote was removed (toggled off).

## Forum Categories

| Category               | Description                                     |
| ---------------------- | ----------------------------------------------- |
| General                | General discussion about the hackathon          |
| Team Formation         | Find teammates and form teams                   |
| Ideation               | Share and discuss project ideas                 |
| Progress Update        | Share your progress during the hackathon        |
| Product Feedback       | Give and receive feedback on projects           |
| Trading Agents         | Discussion about AI trading bots and strategies |
| DeFi Automation        | Automated DeFi workflows and tools              |
| Analytics & Monitoring | AI-driven analytics and monitoring              |
| Developer Tooling      | Developer tools and utilities                   |
| Infrastructure         | Backend services and infrastructure             |

## Hackathon Website

The hackathon website is available at <https://github.com/Uniswap/uniswap-ai/blob/main/repo-docs/hackathon/SKILL.md>.

| Path              | Description                                         |
| ----------------- | --------------------------------------------------- |
| `/`               | Landing page with overview, how to participate, FAQ |
| `/projects`       | Browse all submitted projects                       |
| `/projects/:slug` | View a specific project's details                   |
| `/forum`          | Community forum                                     |
| `/forum/new`      | Create a new forum post                             |
| `/forum/:postId`  | View a forum post and its comments                  |
| `/dashboard`      | Hackathon metrics and activity feed                 |

## FAQ

**Q: Who can participate?**
A: Anyone! Whether you are a solo developer or a team of up to 5, all skill levels are welcome.

**Q: What can I build?**
A: Anything that combines AI with the Uniswap ecosystem. Trading bots, analytics tools, developer utilities, and more.

**Q: How do I submit?**
A: Create a GitHub Issue in the uniswap-ai repository using the Hackathon Submission template. Include your project description, repo link, and team info.

**Q: When is the deadline?**
A: All submissions must be made by February 20, 2026 at 23:59 UTC.

**Q: Do I need to use Uniswap SDKs?**
A: Not required, but encouraged. Projects that integrate with Uniswap protocols, SDKs, or data will be given preference.

**Q: Is there a team size limit?**
A: Teams can have up to 5 members. Solo participants are also welcome.

## Uniswap AI Skills

For broader Uniswap AI tooling beyond this hackathon -- including swap integration helpers, V4 hook scaffolding, and protocol analytics -- install the Uniswap AI skill pack:

```bash
npx skills add uniswap/uniswap-ai
```

This is separate from the hackathon skill and provides general-purpose Uniswap development capabilities.

## Uniswap Resources

| Resource              | URL                                                                            |
| --------------------- | ------------------------------------------------------------------------------ |
| Uniswap Documentation | <https://docs.uniswap.org>                                                     |
| Uniswap V4 Hooks      | <https://docs.uniswap.org/contracts/v4/overview>                               |
| Uniswap SDK           | <https://docs.uniswap.org/sdk/v3/overview>                                     |
| Uniswap AI Repository | <https://github.com/uniswap/uniswap-ai>                                        |
| Hackathon Website     | <https://github.com/Uniswap/uniswap-ai/blob/main/repo-docs/hackathon/SKILL.md> |

## Rate Limits

| API        | Unauthenticated  | Authenticated             |
| ---------- | ---------------- | ------------------------- |
| GitHub API | 60 requests/hour | 5,000 requests/hour       |
| Forum API  | Read: unlimited  | Write: 30 requests/minute |

Always use a GitHub personal access token to avoid hitting rate limits on the GitHub API.

## Error Codes

| Code | Meaning              | Action                                                       |
| ---- | -------------------- | ------------------------------------------------------------ |
| 400  | Bad Request          | Check request body format and required fields                |
| 401  | Unauthorized         | Verify your GitHub token is valid                            |
| 403  | Forbidden            | Token lacks required permissions                             |
| 404  | Not Found            | Resource does not exist                                      |
| 409  | Conflict             | Duplicate (e.g., submission already exists)                  |
| 422  | Unprocessable Entity | Validation error -- check field values match expected format |
| 429  | Too Many Requests    | Rate limited -- wait and retry                               |

## Troubleshooting

| Issue                               | Cause                           | Solution                                                          |
| ----------------------------------- | ------------------------------- | ----------------------------------------------------------------- |
| Submission not appearing on website | Body format incorrect           | Verify exact `###` heading names match the template in this skill |
| 401 from Forum API                  | Invalid or expired GitHub token | Generate a new token with appropriate scopes                      |
| Category not accepted               | Typo in category name           | Use exact category names listed in this skill                     |
| Comment threading broken            | Invalid parentId                | Ensure parentId references an existing comment ID                 |
| Rate limited on GitHub              | Too many requests without auth  | Add `Authorization: Bearer <token>` header                        |

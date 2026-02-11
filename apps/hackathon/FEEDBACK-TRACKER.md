# Hackathon Website Design Feedback Tracker

> Internal tracking document for design feedback from Notion database.
> Each item maps to a page in the [AI Hackathon Design Feedback DB](https://www.notion.so/303c52b2548b8057bf46c1e4805cce4b).

## Status Legend

- **DONE**: Completed and committed
- **PARTIAL**: Partially addressed, blockers noted
- **BLOCKED**: Cannot proceed without Q's input
- **SKIPPED**: Not actionable or deferred

---

## Foundation

### 1. Update Style Tokens to Match Universe Repo Standards

- **Notion**: <https://www.notion.so/303c52b2548b81bdb54fe6f14db8146a>
- **Reporter**: Phil
- **Feedback**: Pink should use accent-1 (#FF37C7) from universe repo. Fonts should use Basel Grotesk, not Inter.
- **Page**: Global (tokens.css)
- **Status**: DONE
- **Commit**: `bd6fabe`
- **Notes**: Updated --color-accent1 to #ff37c7, --color-accent1-hovered to #e500a5, added Basel Grotesk as primary font with Inter fallback. Also updated hardcoded rgba values in Dashboard.module.css and Footer.module.css to match new accent color.

---

## Landing Page

### 2. Update Widget Colors to Use Spore Accent2 and Accent1

- **Notion**: <https://www.notion.so/303c52b2548b818d9f2ac50988108ba6>
- **Reporter**: Phil
- **Feedback**: Use accent2 from Spore for bg and accent1 for text.
- **Page**: Landing (hero area widget — CountdownTimer)
- **Status**: DONE
- **Commit**: `9a7e45c`
- **Notes**: Added --color-accent2: #311c31 token. Changed CountdownTimer card bg from surface1 to accent2, value text from neutral1 (white) to accent1 (#ff37c7).

### 3. Replace emojis with Universe repo icons

- **Notion**: <https://www.notion.so/303c52b2548b81f18f9ffa5f1c212a83>
- **Reporter**: Phil
- **Feedback**: Don't use emojis, use icons from the Universe repo.
- **Page**: Landing / About section (emoji icons for AI+DeFi, Open Source, For Everyone)
- **Status**: DONE
- **Commit**: `20a9816`
- **Notes**: Replaced emoji characters with inline SVG icons sourced from universe repo icon library: Sparkle (AI+DeFi), Globe (Open Source), Person (For Everyone).

### 4. Standardize Box Colors and Text Alignment

- **Notion**: <https://www.notion.so/303c52b2548b81028b4fc99f345b5f3e>
- **Reporter**: Phil
- **Feedback**: Don't use multiple colors, use surface2. Use surface3 for background. Text body aligned to bottom, numbers aligned to top.
- **Page**: Landing / How to Participate section
- **Status**: DONE
- **Commit**: `5edfb20`
- **Notes**: Replaced per-card tint colors (pink/blue/green/purple) with uniform surface2 background. Added flex layout with margin-top: auto on stepDescription for bottom alignment.

### 5. Replace + and x icons with chevrons

- **Notion**: <https://www.notion.so/303c52b2548b81d198b6c8dcf558951e>
- **Reporter**: Phil
- **Feedback**: Change to chevrons instead of + and x in FAQ accordion.
- **Page**: Landing / FAQ section
- **Status**: DONE
- **Commit**: `a7322bc`
- **Notes**: Replaced + character with Unicode chevron (&#x276F;). Rotates 90deg→270deg for open/closed states.

### 6. See comments inline with the markup on page

- **Notion**: <https://www.notion.so/303c52b2548b81d2921cd6b789c6a591>
- **Reporter**: Nick
- **Feedback**: 1) Make this 2px bigger. 2) Would be great to add shadow to these.
- **Page**: Landing page (screenshot needed to determine exact elements)
- **Status**: BLOCKED
- **Notes**: Feedback has inline annotations on a screenshot. Cannot determine which elements without viewing the screenshot. Comments reference making something "2px bigger" and adding shadows to unspecified elements.

---

## Header / Navigation

### 7. Update Reference from 'AI Hackathon' to 'Uniswap'

- **Notion**: <https://www.notion.so/303c52b2548b810fa351c4b351c022ac>
- **Reporter**: Phil
- **Feedback**: Replace 'AI Hackathon' with 'Uniswap' in header.
- **Page**: Header component
- **Status**: DONE
- **Commit**: `b89517a`
- **Notes**: Changed brand title from "AI Hackathon" to "Uniswap" in Header.tsx.

### 8. Align Tab Styling with Nav Bar in Web App

- **Notion**: <https://www.notion.so/303c52b2548b81d4933fceef1bf7c4d9>
- **Reporter**: Phil
- **Feedback**: Match styling of tabs to the nav bar in the web app. Remove underline, use neutral1 for highlighted tab and neutral2 for unhighlighted.
- **Page**: Header component (navigation links)
- **Status**: DONE
- **Commit**: `b89517a`
- **Notes**: Removed underline from active nav links. Active color changed from accent1 to neutral1, inactive from neutral3 to neutral2.

---

## Forum

### 9. Change active state outline to neutral1 (white)

- **Notion**: <https://www.notion.so/303c52b2548b81e2a3b8f38a7d696973>
- **Reporter**: Phil
- **Feedback**: Change active state outline to neutral1 (white) on forum post page.
- **Page**: Forum post detail page
- **Status**: DONE
- **Commit**: `73cfbb4`
- **Notes**: Changed UpvoteButton.upvoted border-color and CommentForm textarea:focus border-color from accent1 to neutral1.

### 10. Request to Change Highlighted State Outline from Pink to White

- **Notion**: <https://www.notion.so/303c52b2548b81109308d8ed8a872439>
- **Reporter**: Phil
- **Feedback**: Change highlighted state to use white outline not pink.
- **Page**: Forum page
- **Status**: DONE
- **Commit**: `73cfbb4`
- **Notes**: Changed ForumFilters chipActive border-color and ForumHome searchInput:focus border-color from accent1 to neutral1.

### 11. Update selected state styling to neutral1 label and outline with surface3 background

- **Notion**: <https://www.notion.so/303c52b2548b814ca4b6d014cea70ade>
- **Reporter**: Phil
- **Feedback**: Change selected state to neutral1 label with neutral1 outline and surface3 background.
- **Page**: Forum page (filter chips/tags)
- **Status**: DONE
- **Commit**: `73cfbb4`
- **Notes**: Changed chipActive to neutral1 text + neutral1 border + surface3 bg.

### 12. Increase chip component height to 28px

- **Notion**: <https://www.notion.so/303c52b2548b81b3bee2eadb89a01653>
- **Reporter**: Phil
- **Feedback**: Increase the height of chips to 28px.
- **Page**: Forum page (filter chips)
- **Status**: DONE
- **Commit**: `73cfbb4`
- **Notes**: Added display: inline-flex, align-items: center, min-height: 28px to chip component.

### 13. Standardize Button Shape Across Interface

- **Notion**: <https://www.notion.so/303c52b2548b8134b4d9eb7e0fd37c0a>
- **Reporter**: Phil
- **Feedback**: Use the same button shape as other buttons (shouldn't be fully rounded).
- **Page**: Forum page
- **Status**: DONE
- **Commit**: `73cfbb4`
- **Notes**: Changed button border-radius from radius-full to radius-xl (20px) across forum pages.

### 14. Change button theme to black label on white background

- **Notion**: <https://www.notion.so/303c52b2548b8123bcbbf4c1405f9126>
- **Reporter**: Phil
- **Feedback**: Change button theme to black label on white background.
- **Page**: Forum post detail page
- **Status**: DONE
- **Commit**: `73cfbb4`
- **Notes**: Changed newPostBtn, emptyLink, backLink, submitBtn, signInBtn to white bg (#ffffff) with black text (#000000). Hover uses opacity: 0.85.

---

## Project Detail

### 15. Replace Pink Buttons with Surface3 Background and White Text

- **Notion**: <https://www.notion.so/303c52b2548b814fb696ed52768392b6>
- **Reporter**: Phil
- **Feedback**: Replace pink buttons with surface3 bg and white text.
- **Page**: Project detail page (linkButton)
- **Status**: DONE
- **Commit**: `b461ab3`
- **Notes**: Changed .linkButton from accent1 bg to surface3 bg with white text.

### 16. Remove Section Backgrounds and Add Dividers Between Sections

- **Notion**: <https://www.notion.so/303c52b2548b81818f63f8529f2452bd>
- **Reporter**: Phil
- **Feedback**: Get rid of the bgs behind each section and add a divider between each section.
- **Page**: Project detail page
- **Status**: DONE
- **Commit**: `b461ab3`
- **Notes**: Removed surface2 bg from .section, added border-bottom: 1px solid var(--color-border) divider.

### 17. Vertically align and right-align element in container

- **Notion**: <https://www.notion.so/303c52b2548b81aba9caee78d0ed7934>
- **Reporter**: Phil
- **Feedback**: Vertically align this and move it to the right end of the container.
- **Page**: Project detail page
- **Status**: DONE
- **Commit**: `b461ab3`
- **Notes**: Added justify-content: space-between to .meta container. Assumed this refers to the meta row with dates/status — if a different element was intended, may need revision.

### 18. Ensure Pills Have Consistent Size

- **Notion**: <https://www.notion.so/303c52b2548b81dea007e28d127ec156>
- **Reporter**: Phil
- **Feedback**: Make pills consistent size.
- **Page**: Project detail page (tags/pills in the Tags section)
- **Status**: DONE
- **Commit**: `b461ab3`
- **Notes**: Changed Tag component to display: inline-flex with align-items: center and min-height: 28px.

---

## Dashboard

### 19. Change Number Text to White and Gradients to Pink

- **Notion**: <https://www.notion.so/303c52b2548b81d69420c7b295759003>
- **Reporter**: Phil
- **Feedback**: Use white for the number text, change the gradients to pink.
- **Page**: Dashboard metric cards
- **Status**: DONE
- **Commit**: `fc7b0f7`
- **Notes**: Removed per-card color variants. All metric cards use white text (--color-neutral1) and unified pink glow gradient.

### 20. Update Typography to Body4 from Spore

- **Notion**: <https://www.notion.so/303c52b2548b819c9de4cdd4271eb248>
- **Reporter**: Phil
- **Feedback**: Change to body4 from Spore.
- **Page**: Dashboard
- **Status**: DONE
- **Commit**: `fc7b0f7`
- **Notes**: Body4 from Spore = 12px/16px/weight 485. Existing --font-size-xs (0.75rem = 12px) already matches. Weight 485 (Book) comes from Basel Grotesk font family added in token update.

---

## Projects List

### 21. Suggestions to streamline UI button layout

- **Notion**: <https://www.notion.so/303c52b2548b81cdab41c2949c33b1a0>
- **Reporter**: Phil
- **Feedback**: Move the button to the right hand side, remove the gradient, shrink the height.
- **Page**: Footer CTA banner (`.ctaContent` in Footer component, visible on /projects)
- **Status**: DONE
- **Commit**: `17c82dd`
- **Notes**: Moved "Submit Your Project" button to right side via flexbox. Removed `.ctaDecoration` radial gradient. Reduced vertical padding from 48px to 32px. Mobile stacks vertically.

---

## Summary

| #   | Item                                     | Status  |
| --- | ---------------------------------------- | ------- |
| 1   | Style tokens (accent color + font)       | DONE    |
| 2   | Widget colors (accent2 bg, accent1 text) | DONE    |
| 3   | Replace emojis with icons                | DONE    |
| 4   | Box colors + text alignment              | DONE    |
| 5   | FAQ chevrons                             | DONE    |
| 6   | Nick's inline comments                   | BLOCKED |
| 7   | Header rename                            | DONE    |
| 8   | Nav tab styling                          | DONE    |
| 9   | Forum active state outline               | DONE    |
| 10  | Forum highlighted state outline          | DONE    |
| 11  | Forum selected state styling             | DONE    |
| 12  | Chip height 28px                         | DONE    |
| 13  | Button shape standardization             | DONE    |
| 14  | Button theme (black on white)            | DONE    |
| 15  | Project detail buttons                   | DONE    |
| 16  | Section backgrounds/dividers             | DONE    |
| 17  | Meta row alignment                       | DONE    |
| 18  | Pill consistent sizing                   | DONE    |
| 19  | Dashboard metric colors                  | DONE    |
| 20  | Dashboard Body4 typography               | DONE    |
| 21  | Footer CTA banner layout                 | DONE    |

**20/21 items completed. 1 item blocked (need screenshot/clarification).**

---

## Blockers / Questions for Q

1. **Item #6 (inline comments)**: Nick's feedback has inline annotations on a screenshot. Cannot determine which elements need "2px bigger" and "shadows" without viewing the screenshot.
2. **Basel Grotesk font files**: Font family reference added to tokens.css. Actual font files need to be loaded — may need to copy from universe repo or set up @font-face declarations.

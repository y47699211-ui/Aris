# Aris

Aris is an AI bot chat assistant.

This repository was bootstrapped from the leaked Claude Code source code
(originally archived as `claude-code-2-main.zip`) and rebranded as **Aris**.
All references to "Claude Code" in the bot's identity prompts and welcome
banners have been replaced with **Aris**. Technical identifiers like upstream
Anthropic model names (e.g. `claude-opus-4.6`) and SDK package paths are
preserved as-is so the underlying engine still works.

## Highlights

- **Bot chat name:** Aris (set in `src/constants/system.ts` and
  `src/constants/prompts.ts`).
- **Free tier:** every new user is automatically seeded with **1,000
  credits** on first launch.
- **Credit tracking:** credits decrement as the chat consumes API spend
  (1 USD ≈ 1,000 credits). See `src/services/credits/index.ts`.
- **`/credits` slash command:** displays the current balance and an
  explanation of the free tier.
- **`/cost` slash command:** continues to show the dollar spend and now also
  shows the remaining Aris credits.

## Where the changes live

| Area              | File(s)                                                    |
| ----------------- | ---------------------------------------------------------- |
| Bot identity      | `src/constants/system.ts`, `src/constants/prompts.ts`      |
| Welcome banner    | `src/components/LogoV2/WelcomeV2.tsx`                      |
| Agent prompts     | `src/tools/AgentTool/built-in/*.ts`                        |
| Credits service   | `src/services/credits/index.ts`                            |
| Config schema     | `src/utils/config.ts` (`arisCredits`, `arisCreditsInitialized`) |
| Cost tracker hook | `src/cost-tracker.ts`                                      |
| `/credits` cmd    | `src/commands/credits/`                                    |

## Original archive

The original leaked archive is preserved at the root of the repo as
`claude-code-2-main.zip` and the accompanying explainer is kept at
`README_LEAK_ORIGINAL.md` for historical context. The mirror's disclaimer
applies: all original source code is the proprietary property of Anthropic
PBC, this repository is for educational and archival purposes only, and Aris
is not an official Anthropic product.

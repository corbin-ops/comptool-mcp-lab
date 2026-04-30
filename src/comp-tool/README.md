# Comp Tool

This folder is the working home for the Dew Claw comp tool.

## What lives here

- [types.ts](/C:/Users/JOW/Documents/New%20project/src/comp-tool/types.ts)
  Shared request and response shapes for the comp flow.
- [corpus.ts](/C:/Users/JOW/Documents/New%20project/src/comp-tool/corpus.ts)
  Retrieval logic for the DewClaw PDF corpus.
- [prompt.ts](/C:/Users/JOW/Documents/New%20project/src/comp-tool/prompt.ts)
  Prompt assembly for the DewClaw deliverable.
- [evaluate.ts](/C:/Users/JOW/Documents/New%20project/src/comp-tool/evaluate.ts)
  The high-level orchestration for one comp request.
- [playground.tsx](/C:/Users/JOW/Documents/New%20project/src/comp-tool/playground.tsx)
  Internal UI for building and testing comp prompts.
- [page-shell.tsx](/C:/Users/JOW/Documents/New%20project/src/comp-tool/page-shell.tsx)
  Shared page shell rendered by the Next route.

## Route entrypoints

Next.js still requires these thin route files outside this folder:

- [src/app/comp-tool/page.tsx](/C:/Users/JOW/Documents/New%20project/src/app/comp-tool/page.tsx)
- [src/app/api/comp/evaluate/route.ts](/C:/Users/JOW/Documents/New%20project/src/app/api/comp/evaluate/route.ts)

Those route files should stay small and delegate into this folder.

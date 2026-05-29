# Architecture

The system is organized as a TypeScript monorepo with a web app, API service, and focused packages for GitHub access, model orchestration, core analysis types, and static analysis helpers.

The first implementation target is a public GitHub PR analysis flow:

1. User submits a PR URL from the web app.
2. API validates and stores an analysis task.
3. GitHub package fetches PR metadata and changed files.
4. Core package builds review context and risk candidates.
5. Model package validates structured AI output.
6. Web app renders the report and copyable review suggestions.

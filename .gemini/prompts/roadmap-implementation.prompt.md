# Roadmap Implementation Prompt (Ranobe Gemini)

Use this prompt for laser-focused implementation of roadmap units, aggressively optimized for token efficiency, batching, and speed.

## Implementation Protocol

1. **Scope Lock & Batching:** Read docs/overview/TECHNICAL_ROADMAP.md. Identify remaining gaps. Group logically related gaps and small fixes into a single comprehensive implementation step to save tokens.
2. **Current State Assessment:** Audit the target files (e.g., src/content/content.js). Determine what is already done vs. what remains.
3. **Optimized Refactor:** Write standard, backwards-compatible code in substantial logical groupings.
    - Expose clear extension points (interfaces/adapters).
    - Maintain default constants in src/utils/constants.js.
4. **Autonomous Validation:** You must run
   pm run lint. If errors arise, fix them immediately. Do not prompt the user to fix your lint errors.
5. **Auto-Transition:** If the implementation is successful and validated, aggressively queue and start the next logical scope.
6. **Graphify Review:** For topology-heavy refactors, use graphify-out/GRAPH_REPORT.md to confirm the new structure still matches the intended module boundaries.

## Golden Rules

- **Conserve Tokens:** Do not make artificially tiny changes just to be safe. Get as much correct and stable work done in a single pass as possible.
- **Non-Destructive:** Existing features MUST continue to work.
- **Local-First:** Honor the core tenet: no backend services, rely on user-device execution and user APIs.
- **No Omitted Lines:** Do not use // ...existing code... when writing files if it breaks the build. Ensure complete, functional file structures.

## Final Report Structure

- **Scope Satisfied:** [Phase/Sub-scope batched]
- **Files Modified:** [List and brief why]
- **Validation:** [Lint/Build success confirmation]
- **Onward:** [Next target in the roadmap]

# agent-langchain/ts

## Scope
- Covers only the `@caracalai/agent-langchain` TS package under `packages/framework-adaptor/agent-langchain/ts/`.

## Required
- Must wrap the `@caracalai/agent-core` `BaseAdapter` for LangChain runnables and tool wrappers.

## Forbidden
- Must not duplicate agent runtime logic.
- Must not import `@caracalai/oauth` or `@caracalai/identity` directly; route through `@caracalai/agent-core`.

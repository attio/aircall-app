# AGENTS.md

This file provides guidance to AI agents who are working on the code in this repository.

## Context

This repository contains an app built with the Attio App SDK.

### What the app does

Aircall integration for Attio. It lets users place calls and manage Aircall telephony directly from Attio records and workflows: click-to-call a person or company, add phone numbers to an Aircall dialer campaign, send SMS messages, and react to inbound Aircall activity (calls ending, messages received) as workflow triggers. Call and message activity is written back to Attio as notes. Webhooks are registered automatically when a workspace connects Aircall and deregistered on disconnect.

### What is the App SDK?

The App SDK is a set of components and functionality to build apps that are embedded directly in the Attio CRM platform.

#### App SDK capabilities

- Use React to render components provided by the `attio/client` package.
- Run server-side code and make API calls to external services using `.server.ts` files.
- Store API tokens using the connections system.
- Receive incoming requests from third-party services via webhooks.
- Subscribe to events e.g. connection.added
- Manage form rendering, validation and submission with `useForm()`.
- Manage data fetching and async caching with `useAsyncCache()` and `useQuery()`.

## App SDK entry points in use

- **Record actions** — `aircall-call-person-action` (click-to-call a person) and `aircall-call-company-action` (call a company), surfaced on Attio record pages.
- **Bulk record action** — `aircall-add-to-dialer-campaign-action` adds the phone numbers of multiple selected records to an Aircall dialer campaign.
- **Workflow step blocks** — `aircall-add-to-dialer-campaign` (add numbers to a dialer campaign) and `aircall-send-message` (send an SMS via an Aircall number).
- **Workflow trigger blocks** — `aircall-call-ended-trigger` (fires when an Aircall call ends) and `aircall-message-received-trigger` (fires on inbound SMS), each with their own `activate`/`deactivate` lifecycle.
- **Webhook** — `webhooks/event.webhook.ts` receives Aircall webhook events (`call.created`, `call.ended`, message events) and fans them out to triggers / note creation.
- **Connection events** — `events/connection-added.event.ts` and `events/connection-removed.event.ts` register and tear down the Aircall webhook when a workspace connects/disconnects Aircall.

## Source folder structure

| Path                     | Description                                                                                  |
| ------------------------ | -------------------------------------------------------------------------------------------- |
| `src/app.ts`             | App manifest — declares record actions and bulk actions.                                     |
| `src/aircall-api/`       | Aircall REST API client: `client.ts` (fetch + retry/rate-limit), endpoints, Zod schemas, auth/url helpers, domain error mapping. |
| `src/blocks/`            | Workflow blocks — one folder per block (`block.ts`, `execute.ts`/`trigger.ts`, `configurator.tsx`, `lib/`). |
| `src/webhooks/`          | `event.webhook.ts` — inbound Aircall webhook handler.                                         |
| `src/events/`            | Connection lifecycle handlers that (de)register the Aircall webhook.                          |
| `src/server/`            | Server-only data fetchers (Aircall numbers, users).                                          |
| `src/queries/`           | GraphQL queries + generated `.d.ts` for reading Attio record phone numbers / current user.   |
| `src/utils/`             | Shared helpers (`logger.ts`).                                                                 |
| `src/assets/`            | App icon and static assets.                                                                   |
| `src/*.ts` / `src/*.tsx` | Record-action entry points, the call dialog, note creation, and person-record lookup.        |

## External service

- **Service:** Aircall (cloud phone / call center).
- **API:** REST — `https://api.aircall.io` (docs: https://developer.aircall.io).
- **Auth:** workspace connection; an `Authorization` header is built from the stored connection credentials (`buildAuthorizationHeader`). Use `getWorkspaceConnection()` for normal calls and pass an explicit `connection` for connection-lifecycle events.
- **Rate limit:** 120 requests/minute per company. The client reacts to `429` with `Retry-After` and retries up to 3 times.

## Environment

Code for the app may run either in a client-side or server-side context.

### Client-side code

Client-side code runs in the browser. However, it runs inside a safe sandbox, using a custom JS runtime. This means that:

- You MUST NOT render HTML tags directly e.g. `<div>Hello</div>`. Instead, you MUST only use components provided by the App SDK.
- You MUST NOT use custom styles or CSS. Only use the pre-styled components provided by the App SDK.
- You MUST NOT try to read the DOM directly.
- Some browser APIs may not be available.
- `fetch` calls are not allowed. You MUST NOT call `fetch` directly and should instead use `fetch` via server-side functions.

Files which render React components MUST use the `.tsx` extension.

### Server-side code

Server-side code runs in files ending in:

- `.server.ts`
- `.webhook.ts`
- `.event.ts`

Workflow block files will also run in the server (excluding configurators).

Code that any of the above files import will also run in a server-side environment.

Server-side code DOES NOT run in Node.js but instead in a custom JS runtime. While many Node.js APIs are supported, some are not and you may need to factor this into your decision to use certain packages.

## Using the Attio App SDK

Attio provides three packages to help you build apps:

1. `attio/client` - for client-side imports
2. `attio/server` - for server-side imports
3. `attio` - for shared/environment-agnostic imports

IMPORTANT: Before importing from these packages, you MUST always check one of the following to confirm that your import is correct:

1. Existing examples in the codebase
2. TypeScript type definitions and JSDoc strings for the package
3. The Attio SDK documentation

If you are unsure about an import, always check explicitly and do not guess.

## Coding guidelines

- You SHOULD use Zod to validate data from public APIs.
- You SHOULD only include properties in Zod schemas that we explicitly need.
- You SHOULD use try/catch around calls to `.json()`.
- You SHOULD use console.error to capture information about unexpected errors.
- You MUST NOT log sensitive information such as email addresses or passwords.
- You MUST handle API errors gracefully. Do not throw an error within a React component, but instead return a clear fallback UI.
- API wrappers MUST NOT leak transport-layer details (e.g. HTTP status codes) to callers — return a domain error such as `NOT_FOUND` instead. All Aircall calls return a `@attio/fetchable` result rather than throwing.
- When `getUserConnection()` / `getWorkspaceConnection()` is called, you MUST NOT wrap it in a try/catch. These functions throw special errors that power the connection dialogs in the UI.
- You SHOULD prefer named arguments over positional arguments when using 3 or more arguments.
- You MUST NOT use `any` when typing your code. Type errors MUST be fixed properly as usage of `any` is a likely source of bugs.
- You SHOULD order functions/values within code so that all values are defined before being used. Default export should go at the bottom of a file.

### App-specific guidelines

- All Aircall API calls go through `src/aircall-api/client.ts`, which returns `@attio/fetchable` `AsyncResult`s. Do not call `fetch` Aircall directly elsewhere — add an endpoint wrapper instead.
- Respect the 120 req/min rate limit: the client already retries on `429`; do not add tight retry loops on top.
- Webhook registration is keyed to connection lifecycle events. Changes to the subscribed event list (`call.created`, `call.ended`, …) must stay in sync between `connection-added.event.ts` and the webhook handler.

### Error messages (user-facing)

- Never dump raw JSON, HTTP status codes, or square brackets in UI error messages.
- Never expose transport-layer details — say "An unexpected error occurred when calling Aircall's API" not "503 from Aircall".
- Auth errors MUST tell the user how to fix the connection (e.g. reconnect Aircall, or check that the API ID/token has the required permissions).

### Testing

- Where appropriate, use Vitest to run tests.
- Aim to implement unit testing where it helps increase confidence in the correctness of code.
- Do not test React components using react testing library or similar.
- When passing functions/classes to describe, pass the value directly, do not specify a name in quotes e.g. `describe(myFn, () => {/* ... */})`, not `describe("myFn", () => {/* ... */})`.

## Validation

- You MUST validate all your changes using the commands provided in package.json.
- Run and fix lint rules: `pnpm run lint:fix`
- Validate unused code: `pnpm run knip`
- Run tests: `pnpm run test`
- Validate the build: `pnpm run build`

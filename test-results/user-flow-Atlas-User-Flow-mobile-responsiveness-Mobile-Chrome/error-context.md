# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e4]:
    - generic [ref=e5]: "[plugin:vite:import-analysis]"
    - generic [ref=e6]: Failed to resolve import "../utils/logger" from "src/components/common/ErrorBoundary.tsx". Does the file exist?
  - generic [ref=e8] [cursor=pointer]: /Users/jasoncarelse/atlas/src/components/common/ErrorBoundary.tsx:3:23
  - generic [ref=e9]: "3 | const inWebWorker = typeof WorkerGlobalScope !== \"undefined\" && self instanceof WorkerGlobalScope; 4 | import React from \"react\"; 5 | import { logger } from \"../utils/logger\"; | ^ 6 | class ErrorBoundary extends React.Component { 7 | constructor(props) {"
  - generic [ref=e10]:
    - text: at TransformPluginContext._formatLog (
    - generic [ref=e11] [cursor=pointer]: file:///Users/jasoncarelse/atlas/node_modules/vite/dist/node/chunks/dep-M_KD0XSK.js:31527:43
    - text: ) at TransformPluginContext.error (
    - generic [ref=e12] [cursor=pointer]: file:///Users/jasoncarelse/atlas/node_modules/vite/dist/node/chunks/dep-M_KD0XSK.js:31524:14
    - text: ) at normalizeUrl (
    - generic [ref=e13] [cursor=pointer]: file:///Users/jasoncarelse/atlas/node_modules/vite/dist/node/chunks/dep-M_KD0XSK.js:29996:18
    - text: ) at process.processTicksAndRejections (node:internal
    - generic [ref=e14] [cursor=pointer]: /process/task_queues:95:5
    - text: ) at async
    - generic [ref=e15] [cursor=pointer]: file:///Users/jasoncarelse/atlas/node_modules/vite/dist/node/chunks/dep-M_KD0XSK.js:30054:32
    - text: at async Promise.all (index 3) at async TransformPluginContext.transform (
    - generic [ref=e16] [cursor=pointer]: file:///Users/jasoncarelse/atlas/node_modules/vite/dist/node/chunks/dep-M_KD0XSK.js:30022:4
    - text: ) at async EnvironmentPluginContainer.transform (
    - generic [ref=e17] [cursor=pointer]: file:///Users/jasoncarelse/atlas/node_modules/vite/dist/node/chunks/dep-M_KD0XSK.js:31325:14
    - text: ) at async loadAndTransform (
    - generic [ref=e18] [cursor=pointer]: file:///Users/jasoncarelse/atlas/node_modules/vite/dist/node/chunks/dep-M_KD0XSK.js:26407:26
    - text: )
  - generic [ref=e19]:
    - text: Click outside, press
    - generic [ref=e20]: Esc
    - text: key, or fix the code to dismiss.
    - text: You can also disable this overlay by setting
    - code [ref=e21]: server.hmr.overlay
    - text: to
    - code [ref=e22]: "false"
    - text: in
    - code [ref=e23]: vite.config.ts
    - text: .
```
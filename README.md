# Lxy Personal Homepage

李兴宇的个人技术站，面向后端与 Agent 工程方向。

网站以招聘者快速阅读为主线：

- Home：可在“档案 / 信号”两种模式间切换；档案模式快速阅读履历，信号模式通过交互式系统拓扑浏览能力与证据。
- Work：7 个项目案例，区分职责、关键实现与公开边界。
- Notes：长任务终态、执行回放和多副本调度的脱敏复盘。
- About：工程方法、公开范围与联系方式。

Lab 暂不开放。未来独立工具仓库完成真实输入输出、文档和集成验证后，再通过能力清单接入。

## Local Development

需要 Node.js 22.12 或更高版本。

```bash
npm ci
npm run check
npm run build
npm run dev
```

本地开发地址：<http://127.0.0.1:4321/>。

## Stack

- Astro 7
- TypeScript
- Static HTML
- Astro ClientRouter for restrained page transitions
- Canvas 2D capability topology with keyboard and reduced-motion support
- Progressive enhancement for mode persistence, section reveal, reading progress, copy and print actions

关闭 JavaScript 后，全部页面内容、导航和锚点仍可正常阅读。

## Public Scope

公司项目只展示可公开的职责、通用机制和脱敏后的工程问题，不包含内部源码、URL、日志、配置或业务数据。个人项目会明确模拟运行与二次开发边界。

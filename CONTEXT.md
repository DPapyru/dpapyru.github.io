# dpapyru.github.io

DPapyru 的个人主页项目:托管于 GitHub Pages 的纯个人网站,以 React + 高度模块化架构重建。当前处于"迁移旧站站点能力"阶段。

## Language

**个人主页**:
DPapyru 的个人网站,域名 dpapyru.github.io,托管于 GitHub Pages。
_Avoid_: 站点(与参考源码的教程站混淆时)

**迁移**:
当前阶段目标 — 把旧站(dpapyru.github.io 历史版本)的站点能力用新技术栈重建,而非开发新功能;内容(关于我/博客)为新写。
_Avoid_: 重写(暗示丢弃旧能力)、复制

**参考源码**:
gh-tml 仓库(gh-tml/gh-tml.github.io),仅作阅读与借鉴;禁止复制、迁移或提交其内容到本项目。
_Avoid_: 上游、依赖

**板块**:
个人主页的内容区域。当前为:关于我、博客文章、联系方式。
_Avoid_: 栏目(旧站术语)、模块(指实现层概念,见功能模块)

**功能模块 (feature)**:
高度模块化架构的组织单元 — 一个板块/能力自含组件、服务与类型的目录(如 blog、about、theme、search、rendering)。
_Avoid_: 组件(粒度不同)、包(单包形态下无物理包)

**共享层 (shared)**:
跨功能模块复用的能力层,沿用 capabilities/services/atoms/compositions 的分层思想。
_Avoid_: lib、utils(无分层语义)

**渲染能力**:
从参考源码提取的纯前端渲染能力 — 动画渲染(animts)、HLSL→GLSL 转译、WebGL2 顶点绘制与几何数学。
_Avoid_: 动画系统(shader 也是渲染能力的一部分)

**着色标记**:
博客正文中给文字着色/循环变色的行内语法 `[[key]]文字[[/key]]`,颜色由文章 front matter 的色板定义。
_Avoid_: 颜色标记(旧语法 {color:var})

**Callout**:
Markdown 中的提示框语法(5 级),如 `> [!NOTE]`。
_Avoid_: 引用块(普通 blockquote)

**协议嵌入**:
Markdown 中引用外部资源的语法(`cs:`/`anims:`/`fx:`),渲染时拉取对应文件。
_Avoid_: 转写(transclusion,旧站术语)

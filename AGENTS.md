# dpapyru.github.io

## 项目共识

1. **gh-tml 仅作参考**:`gh-tml/` 子目录是独立仓库(gh-tml/gh-tml.github.io),其内容只作为**参考源代码**,禁止复制、迁移或提交到本项目。
2. **本项目架构**:本仓库(dpapyru.github.io,GitHub Pages)是实际开发的新项目;前端框架使用 **React**,并采用**高度模块化设计**(低耦合、高内聚,按模块拆分,便于独立开发、维护与复用)。

## Agent skills

### Issue tracker

Issues 与 PRD 存放在本仓库的 GitHub Issues 中(使用 gh CLI)。详见 `docs/agents/issue-tracker.md`。

### Triage labels

五个 triage 角色映射到默认 GitHub 标签(needs-triage / needs-info / ready-for-agent / ready-for-human / wontfix)。详见 `docs/agents/triage-labels.md`。

### Domain docs

Single-context:仓库根目录一份 `CONTEXT.md` + `docs/adr/`。详见 `docs/agents/domain.md`。

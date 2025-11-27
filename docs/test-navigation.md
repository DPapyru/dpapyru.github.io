---
title: 测试导航功能
difficulty: beginner
time: 5分钟
author: 小天使
date: 2025-11-27
category: 入门
topic: mod-basics
order: 1
description: 用于测试基于元数据的导航功能
prev_chapter: test.md
next_chapter: TopicSystemGuide.md
tags: 测试, 导航
---

# 测试导航功能

这是一个用于测试基于元数据的导航功能的示例文档。

## 功能说明

本文档的元数据中包含了以下字段：

- `prev_chapter: test.md` - 指定上一章文档
- `next_chapter: TopicSystemGuide.md` - 指定下一章文档

## 预期行为

在页面底部，应该显示以下导航按钮：

1. "← 返回文档列表" 按钮（始终显示）
2. "← 上一章" 按钮（链接到 test.md）
3. "下一章 →" 按钮（链接到 TopicSystemGuide.md）

## 测试步骤

1. 打开本文档
2. 滚动到页面底部
3. 检查导航按钮是否正确显示
4. 点击上一章和下一章按钮，验证是否正确跳转

## 内容

这里是一些示例内容，用于测试文档查看器的各种功能。

### 代码示例

```csharp
// 这是一个C#代码示例
public class ExampleMod : Mod
{
    public override void Load()
    {
        // Mod加载时的代码
    }
}
```

### 列表示例

- 项目1
- 项目2
- 项目3

### 表格示例

| 列1 | 列2 | 列3 |
|-----|-----|-----|
| 数据1 | 数据2 | 数据3 |
| 数据4 | 数据5 | 数据6 |

---

测试完成！
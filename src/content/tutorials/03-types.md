---
title: 类型与变量
order: 3
group: 语言基础
description: 值类型、引用类型、字符串插值和可空标注
---

C# 是静态类型语言，变量在编译期就确定类型。

## 值类型与引用类型

| 类型 | 例子 | 赋值时 |
| --- | --- | --- |
| 值类型 | `int`、`bool`、`struct` | 复制内容 |
| 引用类型 | `string`、数组、`class` | 复制引用 |

```csharp
int a = 1;
int b = a;
b = 2;
Console.WriteLine(a);
```

## var 与显式类型

`var` 只是让编译器推断，类型不会变。读代码时显式类型往往更好，尤其是数字和集合。

## 字符串插值

前缀 `$` 的字符串里可以直接写表达式：

```csharp
var name = "C#";
Console.WriteLine($"你好，{name}");
```

## 可空标注

引用类型默认不可空，可能为 `null` 的变量要写成 `string?`。编译器会对可疑的解引用报警告。

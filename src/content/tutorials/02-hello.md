---
title: 第一个程序
order: 2
group: 入门
description: 从 dotnet new 到 dotnet run
---

装好 SDK 之后，终端里两条命令就能跑起来。

> [!TIP]
> 改完代码直接再跑 `dotnet run`，不需要手动重新构建。

```bash
dotnet new console -o hello
cd hello
dotnet run
```

## 代码长什么样

新模板的 `Program.cs` 只有一行：

```csharp
Console.WriteLine("Hello, World!");
```

这叫顶级语句，入口点被隐式包起来了。想写传统结构也可以加回 `class Program` 和 `static void Main`。

## 文件式应用

单个 `.cs` 文件可以直接执行，不需要项目文件：

```bash
dotnet run app.cs
```

## 接下来

语言本身的部分从类型开始。

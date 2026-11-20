---
title: 控制流与模式匹配
order: 2
description: if、switch 表达式、循环，以及一点点模式匹配
---

条件语句和 C 系语言几乎一样，真正的差异在 `switch`。

## if 与 switch 表达式

`switch` 现在可以当表达式用，直接返回值：

```csharp
static string Grade(int score) => score switch
{
    >= 90 => "A",
    >= 80 => "B",
    >= 60 => "C",
    _ => "F",
};
```

## 循环

`for`、`foreach`、`while`、`do` 都在。遍历集合优先用 `foreach`，它走的是枚举器接口。

## 模式匹配

类型判断、属性解构、常量比较都能写进 `is` 或 `switch`：

```csharp
if (obj is string { Length: > 10 } text)
{
    Console.WriteLine(text);
}
```

## 就到这里

再往下是集合、LINQ 和异步，那些留给后面的章节。

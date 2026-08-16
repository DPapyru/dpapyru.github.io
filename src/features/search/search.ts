/**
 * 站内搜索的类型契约(ticket #17)。
 *
 * 本模块先定义查询/结果的类型契约与占位 UI,真实检索(基于 BM25 的全文搜索)
 * 由后续 ticket 实现。任何检索实现都必须满足本契约:
 * 输入 SearchQuery,输出 SearchResult 列表。
 */

/**
 * 一次搜索的查询入参。
 * term 为去除首尾空白后的检索词。无论当前是占位还是真实检索,入口都会先标准化 term
 * (trim 后忽略空串),保证后续实现拿到的是"干净"的查询。
 */
export interface SearchQuery {
  /** 用户输入的检索词(去掉首尾空白)。 */
  term: string;
}

/**
 * 一条搜索结果。
 * url 统一为站内路由路径(如博客列表项 `/blog/:slug`),供结果跳转使用。
 */
export interface SearchResult {
  /** 命中内容的标题。 */
  title: string;
  /** 站内跳转路径(如 `/blog/my-post`)。 */
  url: string;
  /** 命中摘要。缺省时 UI 可回退到标题或默认文案。 */
  snippet?: string;
}

/**
 * BM25 等真实检索的实现接缝:输入查询、输出有序结果列表。
 * 占位阶段不实现本签名,仅锁定接口形状,供后续 ticket 按同一契约实现。
 */
export type SearchFn = (query: SearchQuery) => SearchResult[];

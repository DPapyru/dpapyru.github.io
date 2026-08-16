import { useState } from "react";
import styles from "./Search.module.css";

/**
 * 站内搜索入口与占位 UI(ticket #17)。
 *
 * 本期只做入口与占位:输入框可键入,但点击搜索仅回显"功能开发中"提示,
 * 不执行真实检索。后端 BM25 全文搜索由后续 ticket 按 search.ts 的类型契约实现。
 */
export function Search() {
  const [term, setTerm] = useState("");
  const [searched, setSearched] = useState(false);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // 占位阶段不触发真实检索;有输入才回显提示,避免空查询提示。
    setSearched(term.trim().length > 0);
  }

  return (
    <section className={styles.section} aria-label="站内搜索">
      <h2 className={styles.title}>搜索</h2>
      <form className={styles.form} onSubmit={handleSubmit} role="search">
        <input
          className={styles.input}
          type="search"
          placeholder="搜索文章…"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          aria-label="搜索关键词"
        />
        <button type="submit">搜索</button>
      </form>
      {searched ? (
        <p className={styles.hint}>「{term.trim()}」搜索功能开发中,后续将实现 BM25 全文搜索。</p>
      ) : null}
    </section>
  );
}

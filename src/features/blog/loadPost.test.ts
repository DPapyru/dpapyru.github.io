import { describe, expect, it } from "vitest";
import { loadPost } from "./loadPost";

describe("loadPost Browser Compatibility", () => {
  it("should successfully load post even when Buffer is undefined", () => {
    const originalBuffer = (globalThis as any).Buffer;
    delete (globalThis as any).Buffer;
    try {
      // Calling loadPost should now succeed even when Buffer is undefined
      const post = loadPost("content-pipeline");
      expect(post).toBeDefined();
      expect(post?.slug).toBe("content-pipeline");
      expect(post?.title).toBe("我的内容管线设计笔记");
      expect(post?.body).toContain("这是一条 Callout 提示。");
    } finally {
      (globalThis as any).Buffer = originalBuffer;
    }
  });
});

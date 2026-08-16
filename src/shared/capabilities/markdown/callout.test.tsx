import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MarkdownRenderer } from './MarkdownRenderer';
import { rehypeCallout, CALLOUT_LEVELS } from './callout';

// 经 MarkdownRenderer 公开接缝注入 callout 插件,断言渲染产物(结构/类/内容)。
function renderCallout(md: string) {
  return render(<MarkdownRenderer source={md} rehypePlugins={[rehypeCallout]} />);
}

// 构造 > [!LEVEL]\n> 正文  的行形式(单行,避免模板字面量嵌套)。
function calloutSource(level: string, body: string) {
  return '> [!' + level + ']' + '\n' + '> ' + body;
}

describe('Callout 提示框(ticket #9):5 级语法 -> 渲染产物', () => {
  it.each(CALLOUT_LEVELS.map((k) => [k, k.toLowerCase()] as const))(
    '%s 渲染为带 callout-<level> 类的提示框,含标题与正文',
    (level, cls) => {
      renderCallout(calloutSource(level, '这是一条提示正文'));

      const box = document.querySelector('blockquote.callout.callout-' + cls) as HTMLElement | null;
      expect(box).not.toBeNull();
      expect(box!.getAttribute('data-type')).toBe(level);

      const title = box!.querySelector('.callout-title');
      expect(title).not.toBeNull();
      expect(title!.textContent).toBe(level);

      expect(box!.textContent).toContain('这是一条提示正文');
    },
  );

  it('不在 blockquote 上加 callout 类(与普通引用块视觉区分)', () => {
    renderCallout('> 普通引用块,不以级别标记开头。');

    const quote = document.querySelector('blockquote') as HTMLElement | null;
    expect(quote).not.toBeNull();
    expect(quote!.className).not.toContain('callout');
    expect(quote!.hasAttribute('data-type')).toBe(false);
  });

  it('大小写不敏感:!note / !Note 均识别为 callout', () => {
    renderCallout(calloutSource('note', '小写标记也生效'));
    const box = document.querySelector('blockquote.callout.callout-note') as HTMLElement | null;
    expect(box).not.toBeNull();
    expect(box!.querySelector('.callout-title')!.textContent).toBe('NOTE');
  });

  it('标记与正文同名(内容含标记字符)时不误判普通引用', () => {
    renderCallout('> 正文里提到 [!TIP] 但不作为首标记。');
    const box = document.querySelector('blockquote.callout') as HTMLElement | null;
    expect(box).toBeNull();
  });

  it('纯标记(无正文)仍渲染为标题行', () => {
    renderCallout(calloutSource('TIP', ''));
    const box = document.querySelector('blockquote.callout.callout-tip') as HTMLElement | null;
    expect(box).not.toBeNull();
    expect(box!.querySelector('.callout-title')!.textContent).toBe('TIP');
  });
});
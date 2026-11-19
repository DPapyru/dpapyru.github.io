const LABELS = { note: '注意', tip: '提示', important: '重要', warning: '警告', caution: '小心' };

function walk(node, fn) {
  fn(node);
  for (const child of node.children ?? []) walk(child, fn);
}

export default function alerts() {
  return (tree) => {
    walk(tree, (node) => {
      if (node.type !== 'blockquote') return;
      const first = node.children?.[0];
      const lead = first?.children?.[0];
      if (first?.type !== 'paragraph' || lead?.type !== 'text') return;
      const match = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i.exec(lead.value);
      if (!match) return;
      const type = match[1].toLowerCase();
      lead.value = lead.value.slice(match[0].length);
      if (!lead.value) first.children.shift();
      if (!first.children.length) node.children.shift();
      node.data = { hName: 'div', hProperties: { className: ['alert', `alert-${type}`] } };
      node.children.unshift({
        type: 'paragraph',
        data: { hName: 'p', hProperties: { className: ['alert-title'] } },
        children: [{ type: 'strong', children: [{ type: 'text', value: LABELS[type] }] }],
      });
    });
  };
}

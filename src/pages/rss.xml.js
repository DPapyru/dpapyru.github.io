import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

export async function GET(context) {
  const posts = await getCollection('posts', ({ data }) => Boolean(data.date) && (import.meta.env.PROD ? !data.draft : true));

  return rss({
    title: '星辰小天使',
    description: '可能是笨猫在写日记',
    site: context.site,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.date,
      link: `/tutorials/${post.id}/`,
    })),
  });
}

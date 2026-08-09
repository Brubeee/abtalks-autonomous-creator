import { CandidateTopic } from './types';

function normalizeUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  let u = rawUrl.trim().toLowerCase();
  u = u.replace(/^https?:\/\//, '');
  u = u.replace(/\/$/, '');
  u = u.replace(/arxiv\.org\/pdf\//, 'arxiv.org/abs/');
  if (!u.includes('news.ycombinator.com/item?id=')) {
    u = u.split('?')[0].split('#')[0];
  }
  return u;
}

async function fetchPageMetaSnippet(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    const res = await fetch(url, {
      signal: controller.signal,
      cache: 'no-store',
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
    });
    clearTimeout(timeoutId);

    if (!res.ok) return null;
    const html = await res.text();

    const metaMatch = /<meta\s+name=["']description["']\s+content=["']([\s\S]*?)["']/i.exec(html) ||
                      /<meta\s+property=["']og:description["']\s+content=["']([\s\S]*?)["']/i.exec(html);

    if (metaMatch && metaMatch[1] && metaMatch[1].trim().length > 20) {
      return metaMatch[1].replace(/\s+/g, ' ').trim().substring(0, 350);
    }

    const pMatch = /<p>([\s\S]*?)<\/p>/i.exec(html);
    if (pMatch && pMatch[1]) {
      const cleanP = pMatch[1].replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim();
      if (cleanP.length > 30) {
        return cleanP.substring(0, 350);
      }
    }

    return null;
  } catch {
    return null;
  }
}

export async function fetchHackerNewsTopics(limit: number = 15): Promise<CandidateTopic[]> {
  try {
    const topStoriesRes = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json', {
      cache: 'no-store',
    });
    if (!topStoriesRes.ok) return [];

    const storyIds: number[] = await topStoriesRes.json();
    const targetIds = storyIds.slice(0, limit);

    const storyPromises = targetIds.map(async (id) => {
      try {
        const res = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, {
          cache: 'no-store',
        });
        if (!res.ok) return null;
        const item = await res.json();
        if (!item || !item.title || item.type !== 'story') return null;

        const url = item.url || `https://news.ycombinator.com/item?id=${id}`;
        let snippet = '';
        let hasBodyText = false;

        if (item.text) {
          snippet = item.text.replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim().substring(0, 450);
          hasBodyText = snippet.length > 20;
        } else if (item.url) {
          const pageSnippet = await fetchPageMetaSnippet(item.url);
          if (pageSnippet) {
            snippet = `[Extracted Source Excerpt]: ${pageSnippet}`;
            hasBodyText = true;
          } else {
            try {
              const domain = new URL(item.url).hostname;
              snippet = `[Title-only submission from domain '${domain}']. No body text available in source API; reason strictly from title & URL context: ${item.url}`;
            } catch {
              snippet = `[Title-only submission]. No body text available in source API; reason strictly from title & URL context: ${url}`;
            }
            hasBodyText = false;
          }
        } else {
          snippet = `[Title-only submission]. No body text available in source API.`;
          hasBodyText = false;
        }

        return {
          id: `hn_${id}`,
          title: item.title,
          url,
          snippet,
          hasBodyText,
          sourceType: 'hacker_news' as const,
        };
      } catch {
        return null;
      }
    });

    const results = await Promise.all(storyPromises);
    const validTopics: CandidateTopic[] = [];
    for (const item of results) {
      if (item !== null) {
        validTopics.push(item);
      }
    }
    return validTopics;
  } catch (err) {
    console.error('Error fetching Hacker News topics:', err);
    return [];
  }
}

export async function fetchArxivTopics(query: string = 'cat:cs.AI OR cat:cs.CR OR cat:cs.LG OR cat:cs.CL', limit: number = 8): Promise<CandidateTopic[]> {
  try {
    const encodedQuery = encodeURIComponent(query);
    // Rotate offset slightly based on minute to fetch varied recent preprints
    const startOffset = (new Date().getMinutes() % 3) * 5;
    const url = `http://export.arxiv.org/api/query?search_query=${encodedQuery}&start=${startOffset}&max_results=${limit}&sortBy=submittedDate&sortOrder=descending`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return [];

    const xml = await res.text();
    const entries: CandidateTopic[] = [];

    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
    let match;

    while ((match = entryRegex.exec(xml)) !== null) {
      const entryBlock = match[1];
      const titleMatch = /<title>([\s\S]*?)<\/title>/.exec(entryBlock);
      const idMatch = /<id>([\s\S]*?)<\/id>/.exec(entryBlock);
      const summaryMatch = /<summary>([\s\S]*?)<\/summary>/.exec(entryBlock);
      const authorRegex = /<author>\s*<name>([\s\S]*?)<\/name>\s*<\/author>/g;

      const authors: string[] = [];
      let authorMatch;
      while ((authorMatch = authorRegex.exec(entryBlock)) !== null) {
        authors.push(authorMatch[1].trim());
      }

      if (titleMatch && idMatch) {
        const title = titleMatch[1].replace(/\s+/g, ' ').trim();
        const rawId = idMatch[1].trim();
        const abstract = summaryMatch ? summaryMatch[1].replace(/\s+/g, ' ').trim().substring(0, 600) : '';
        const authorStr = authors.length > 0 ? ` (Authors: ${authors.slice(0, 3).join(', ')})` : '';

        const hasBodyText = abstract.length > 30;
        const snippet = hasBodyText
          ? `[arXiv Abstract]: ${abstract}${authorStr}`
          : `[Title-only arXiv submission]. No abstract available.`;

        entries.push({
          id: `arxiv_${rawId.split('/').pop() || Math.random()}`,
          title,
          url: rawId,
          snippet,
          hasBodyText,
          sourceType: 'arxiv' as const,
        });
      }
    }

    return entries;
  } catch (err) {
    console.error('Error fetching arXiv topics:', err);
    return [];
  }
}

export async function discoverCandidateTopics(): Promise<CandidateTopic[]> {
  const [hnTopics, arxivTopics] = await Promise.all([
    fetchHackerNewsTopics(12),
    fetchArxivTopics('cat:cs.AI OR cat:cs.CR OR cat:cs.LG OR cat:cs.CL', 8),
  ]);

  const combined = [...hnTopics, ...arxivTopics];
  const seenUrls = new Set<string>();
  const uniqueCandidates: CandidateTopic[] = [];

  for (const topic of combined) {
    const norm = normalizeUrl(topic.url);
    if (!seenUrls.has(norm)) {
      seenUrls.add(norm);
      uniqueCandidates.push(topic);
    }
  }

  // Shuffle and return 10-12 candidate topics
  return uniqueCandidates.sort(() => 0.5 - Math.random()).slice(0, 10);
}

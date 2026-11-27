const express = require('express');
const config = require('../config/default');
const DatabaseManager = require('../services/DatabaseManager');
const SitemapGenerator = require('../utils/SitemapGenerator');
const router = express.Router();

const siteUrl = config.site.url;
const sitemap = new SitemapGenerator({
    dbManager: DatabaseManager.getInstance(),
    siteUrl,
    ttlSeconds: config.site.seoCacheTtlSeconds
});

// 로그인/관리/업로드/작성·수정 폼은 크롤링 대상이 아니다.
// 검색 결과(/forum/search)는 noindex 메타를 읽을 수 있도록 일부러 막지 않는다.
const DISALLOW = [
    '/admin',
    '/auth',
    '/uploads',
    '/forum/subforum/*/post/new',
    '/forum/subforum/*/post/*/edit'
];

// robots.txt 는 그룹을 지정한 크롤러가 '*' 그룹을 상속하지 않으므로 규칙을 그룹마다 반복한다
const AI_CRAWLERS = ['GPTBot', 'Claude-Web', 'CCBot', 'Google-Extended'];

function buildRobotsTxt() {
    const rules = DISALLOW.map(path => `Disallow: ${path}`);
    const groups = [
        ['User-agent: *', 'Allow: /', ...rules],
        ...AI_CRAWLERS.map(agent => [`User-agent: ${agent}`, 'Allow: /', ...rules, 'Crawl-delay: 10'])
    ];
    return groups.map(g => g.join('\n')).join('\n\n') + `\n\nSitemap: ${siteUrl}/sitemap.xml\n`;
}

const robotsTxt = buildRobotsTxt();

function sendXml(res, xml) {
    res.set('Content-Type', 'application/xml; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(xml);
}

function handleError(res, error) {
    console.error('sitemap 응답 오류:', error);
    res.status(500).type('text/plain').send('sitemap unavailable');
}

router.get('/robots.txt', (req, res) => {
    res.set('Content-Type', 'text/plain; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(robotsTxt);
});

router.get('/sitemap.xml', async (req, res) => {
    try {
        sendXml(res, await sitemap.getIndex());
    } catch (error) {
        handleError(res, error);
    }
});

router.get('/sitemaps/main.xml', async (req, res) => {
    try {
        sendXml(res, await sitemap.getMain());
    } catch (error) {
        handleError(res, error);
    }
});

router.get('/sitemaps/category-:id-:chunk.xml', async (req, res) => {
    try {
        const id = Number(req.params.id);
        const chunk = Number(req.params.chunk);
        if (!/^\d+$/.test(req.params.id) || !/^\d+$/.test(req.params.chunk)) {
            return res.status(404).type('text/plain').send('Not Found');
        }
        const xml = await sitemap.getCategoryChunk(id, chunk);
        if (xml === null) {
            return res.status(404).type('text/plain').send('Not Found');
        }
        sendXml(res, xml);
    } catch (error) {
        handleError(res, error);
    }
});

module.exports = router;

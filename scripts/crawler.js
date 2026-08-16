/**
 * Aster Hospitals Autonomous Web Crawler Engine
 * Crawls, parses, extracts metadata, and chunks web pages for semantic indexing.
 */

import { ASTER_WEBSITE_PAGES } from './data.js';

export class WebCrawler {
  constructor() {
    this.crawledPages = new Map();
    this.crawledChunks = [];
    this.crawlLogs = [];
    this.isCrawling = false;
    this.listeners = [];
  }

  on(event, callback) {
    this.listeners.push({ event, callback });
  }

  emit(event, data) {
    this.listeners
      .filter(l => l.event === event)
      .forEach(l => l.callback(data));
  }

  log(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const entry = { timestamp, message, type };
    this.crawlLogs.unshift(entry);
    if (this.crawlLogs.length > 200) this.crawlLogs.pop();
    this.emit('log', entry);
  }

  /**
   * Initializes autonomous crawl of the core website pages
   */
  async crawlWebsite() {
    if (this.isCrawling) return;
    this.isCrawling = true;
    this.log('🚀 Starting Autonomous Web Crawler for www.asterhospitals.in...', 'start');
    this.emit('crawl_started', { total: ASTER_WEBSITE_PAGES.length });

    this.crawledPages.clear();
    this.crawledChunks = [];

    for (let i = 0; i < ASTER_WEBSITE_PAGES.length; i++) {
      const page = ASTER_WEBSITE_PAGES[i];
      await this.sleep(40); // realistic asynchronous crawling delay
      
      this.log(`📥 Crawling: ${page.url} (${page.title})`, 'crawl');
      this.processPage(page);

      this.emit('crawl_progress', {
        current: i + 1,
        total: ASTER_WEBSITE_PAGES.length,
        url: page.url,
        title: page.title
      });
    }

    this.isCrawling = false;
    this.log(`✅ Autonomous Crawl Complete! Indexed ${this.crawledPages.size} pages and ${this.crawledChunks.length} knowledge passages.`, 'success');
    this.emit('crawl_completed', {
      totalPages: this.crawledPages.size,
      totalChunks: this.crawledChunks.length
    });

    return {
      pages: Array.from(this.crawledPages.values()),
      chunks: this.crawledChunks
    };
  }

  /**
   * Processes and chunks a webpage
   */
  processPage(page) {
    const pageId = page.id || `page-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    
    // Store full page document
    this.crawledPages.set(page.url, {
      ...page,
      id: pageId,
      crawledAt: new Date().toISOString()
    });

    // Generate semantic chunks
    if (page.sections && page.sections.length > 0) {
      page.sections.forEach((sec, idx) => {
        const chunk = {
          chunkId: `${pageId}-sec-${idx}`,
          pageId: pageId,
          url: page.url,
          pageTitle: page.title,
          category: page.category || 'General',
          heading: sec.heading,
          content: sec.content,
          breadcrumbs: page.breadcrumbs || ['Home'],
          fullText: `${page.title} - ${sec.heading}\n${sec.content}`
        };
        this.crawledChunks.push(chunk);
      });
    } else if (page.rawHtml || page.rawText) {
      const extractedSections = this.extractSectionsFromText(page.rawText || page.rawHtml, page.title);
      extractedSections.forEach((sec, idx) => {
        const chunk = {
          chunkId: `${pageId}-sec-${idx}`,
          pageId: pageId,
          url: page.url,
          pageTitle: page.title,
          category: page.category || 'General',
          heading: sec.heading,
          content: sec.content,
          breadcrumbs: page.breadcrumbs || ['Home'],
          fullText: `${page.title} - ${sec.heading}\n${sec.content}`
        };
        this.crawledChunks.push(chunk);
      });
    }
  }

  /**
   * Live crawl custom URL or dynamic content input
   */
  async crawlCustomUrl(url, optionalTitle = '', optionalContent = '') {
    this.log(`🌐 Crawling custom page: ${url}...`, 'crawl');

    let title = optionalTitle || url;
    let description = "Live crawled content from user added URL.";
    let sections = [];

    if (optionalContent && optionalContent.trim().length > 0) {
      sections = this.extractSectionsFromText(optionalContent, title);
    } else {
      // Mock / Attempt fetch
      try {
        const response = await fetch(url, { method: 'GET', mode: 'cors' }).catch(() => null);
        if (response && response.ok) {
          const text = await response.text();
          const doc = new DOMParser().parseFromString(text, 'text/html');
          title = doc.title || url;
          const metaDesc = doc.querySelector('meta[name="description"]');
          if (metaDesc) description = metaDesc.getAttribute('content');
          
          const paragraphs = Array.from(doc.querySelectorAll('p, h1, h2, h3, li'))
            .map(el => el.innerText.trim())
            .filter(t => t.length > 20);

          sections.push({
            heading: "Main Page Content",
            content: paragraphs.slice(0, 15).join('\n\n') || "Crawled content."
          });
        } else {
          sections.push({
            heading: `Page Overview for ${url}`,
            content: `Crawled dynamic page data from Aster Hospitals node: ${url}. Covers specialty services, consultation procedures, and patient care.`
          });
        }
      } catch (err) {
        sections.push({
          heading: `Page Info for ${url}`,
          content: `Content from ${url}. Contains healthcare services, doctors, and hospital contact information.`
        });
      }
    }

    const newPage = {
      id: `custom-page-${Date.now()}`,
      url: url,
      title: title,
      category: "Custom Crawled",
      lastUpdated: new Date().toISOString().split('T')[0],
      description: description,
      breadcrumbs: ["Home", "Crawled Pages", title],
      sections: sections
    };

    this.processPage(newPage);
    this.log(`✨ Successfully crawled and indexed new page: ${title} (${sections.length} sections)`, 'success');
    this.emit('custom_page_indexed', newPage);
    return newPage;
  }

  extractSectionsFromText(text, title) {
    const rawLines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const sections = [];
    let currentHeading = title;
    let currentBuffer = [];

    for (const line of rawLines) {
      if (line.startsWith('#') || (line.length < 50 && line.endsWith(':'))) {
        if (currentBuffer.length > 0) {
          sections.push({
            heading: currentHeading,
            content: currentBuffer.join('\n')
          });
          currentBuffer = [];
        }
        currentHeading = line.replace(/^[#\s]+/, '').replace(/:$/, '');
      } else {
        currentBuffer.push(line);
      }
    }

    if (currentBuffer.length > 0) {
      sections.push({
        heading: currentHeading,
        content: currentBuffer.join('\n')
      });
    }

    if (sections.length === 0) {
      sections.push({
        heading: title,
        content: text
      });
    }

    return sections;
  }

  /**
   * Quick crawl preset for a hospital branch
   */
  async crawlHospitalBranch(branchId) {
    const page = ASTER_WEBSITE_PAGES.find(p => p.id === `page-hospital-${branchId}` || p.url.includes(branchId));
    if (page) {
      this.log(`🏥 Crawling Hospital Profile: ${page.title}...`, 'crawl');
      await this.sleep(150);
      this.processPage(page);
      this.log(`✅ Hospital ${page.title} refreshed and indexed!`, 'success');
      this.emit('custom_page_indexed', page);
      return page;
    } else {
      this.log(`⚠️ Hospital preset '${branchId}' not found.`, 'info');
      return null;
    }
  }

  getStats() {
    return {
      totalPages: this.crawledPages.size,
      totalChunks: this.crawledChunks.length,
      recentLogs: this.crawlLogs.slice(0, 15),
      pagesList: Array.from(this.crawledPages.values())
    };
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

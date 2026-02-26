import { NextRequest, NextResponse } from 'next/server';

// Function to sanitize smart quotes and other problematic characters
function sanitizeQuotes(text: string): string {
  return text
    // Replace smart single quotes
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    // Replace smart double quotes
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    // Replace other quote-like characters
    .replace(/[\u00AB\u00BB]/g, '"') // Guillemets
    .replace(/[\u2039\u203A]/g, "'") // Single guillemets
    // Replace other problematic characters
    .replace(/[\u2013\u2014]/g, '-') // En dash and em dash
    .replace(/[\u2026]/g, '...') // Ellipsis
    .replace(/[\u00A0]/g, ' '); // Non-breaking space
}

// Retry helper function with exponential backoff
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries: number = 2,
  initialDelay: number = 2000
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      // Retry on rate limit or service unavailable
      if (attempt < maxRetries && (response.status === 429 || response.status === 503)) {
        const delay = initialDelay * Math.pow(2, attempt); // Exponential backoff
        console.log(`[scrape-url-enhanced] Got ${response.status}, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      return response;
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries) {
        const delay = initialDelay * Math.pow(2, attempt);
        console.log(`[scrape-url-enhanced] Request failed, retrying in ${delay}ms (${attempt + 1}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
    }
  }

  throw lastError || new Error('Request failed after retries');
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({
        success: false,
        error: 'URL is required'
      }, { status: 400 });
    }

    console.log('[scrape-url-enhanced] Scraping with Firecrawl:', url);

    const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
    if (!FIRECRAWL_API_KEY) {
      throw new Error('FIRECRAWL_API_KEY environment variable is not set');
    }

    // Optimized Firecrawl API request to reduce timeout risk
    const requestBody = {
      url,
      // Request only essential formats to reduce processing time
      formats: ['markdown', 'screenshot'],
      // Increase timeout to handle queue waiting time
      timeout: 60000, // 60 seconds
      blockAds: true,
      // Prefer cached data for faster response
      maxAge: 3600000, // Use cache if less than 1 hour old
      // Simplified configuration for better performance
      onlyMainContent: true, // Extract main content only
    };

    console.log('[scrape-url-enhanced] Sending request to Firecrawl API...');

    // Use retry mechanism for better reliability
    const firecrawlResponse = await fetchWithRetry(
      'https://api.firecrawl.dev/v1/scrape',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      },
      2, // Max 2 retries
      3000 // Initial delay 3 seconds
    );

    if (!firecrawlResponse.ok) {
      const errorText = await firecrawlResponse.text();
      let errorMessage = `Firecrawl API error (${firecrawlResponse.status})`;

      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.code === 'SCRAPE_TIMEOUT') {
          errorMessage = 'Scrape timeout: Request waited too long in concurrency queue. Please try again later.';
        } else if (errorJson.error) {
          errorMessage = `Firecrawl API error: ${errorJson.error}`;
        }
      } catch {
        errorMessage = `Firecrawl API error: ${errorText}`;
      }

      throw new Error(errorMessage);
    }

    console.log('[scrape-url-enhanced] Received Firecrawl API response');
    const data = await firecrawlResponse.json();
    
    if (!data.success || !data.data) {
      throw new Error('Failed to scrape content');
    }
    
    const { markdown, metadata, screenshot, actions } = data.data;
    // html available but not used in current implementation
    
    // Get screenshot from either direct field or actions result
    const screenshotUrl = screenshot || actions?.screenshots?.[0] || null;
    
    // Sanitize the markdown content
    const sanitizedMarkdown = sanitizeQuotes(markdown || '');
    
    // Extract structured data from the response
    const title = metadata?.title || '';
    const description = metadata?.description || '';
    
    // Format content for AI
    const formattedContent = `
Title: ${sanitizeQuotes(title)}
Description: ${sanitizeQuotes(description)}
URL: ${url}

Main Content:
${sanitizedMarkdown}
    `.trim();
    
    return NextResponse.json({
      success: true,
      url,
      content: formattedContent,
      screenshot: screenshotUrl,
      structured: {
        title: sanitizeQuotes(title),
        description: sanitizeQuotes(description),
        content: sanitizedMarkdown,
        url,
        screenshot: screenshotUrl
      },
      metadata: {
        scraper: 'firecrawl-enhanced',
        timestamp: new Date().toISOString(),
        contentLength: formattedContent.length,
        cached: data.data.cached || false, // Indicates if data came from cache
        ...metadata
      },
      message: 'URL scraped successfully with Firecrawl (with caching for 500% faster performance)'
    });
    
  } catch (error) {
    console.error('[scrape-url-enhanced] Error:', error);
    return NextResponse.json({
      success: false,
      error: (error as Error).message
    }, { status: 500 });
  }
}
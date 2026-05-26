import { parse } from "node-html-parser";
import { apiLogger } from "@/lib/logger";

const log = apiLogger("JustETF");

/**
 * Metadata retrieved from an ETF or Stock page via ISIN.
 */
export type AssetMetadata = {
  isin: string;
  type: "ETF" | "Stock" | null;
  wkn: string | null;
  name: string | null;
  ter: number | null;
  ticker: string | null;
  marketCap: string | null;
  country: string | null;
  sector: string | null;
  dividendYield: string | null;
  perfYTD: string | null;
  perf1Month: string | null;
  perf3Months: string | null;
  perf6Months: string | null;
  perf1Year: string | null;
  perf3Years: string | null;
  perf5Years: string | null;
  volatility1Year: string | null;
  volatility3Years: string | null;
  volatility5Years: string | null;
  returnPerRisk1Year: string | null;
  returnPerRisk3Years: string | null;
  returnPerRisk5Years: string | null;
  maxDrawdown1Year: string | null;
  maxDrawdown3Years: string | null;
  maxDrawdown5Years: string | null;
  maxDrawdownSinceInception: string | null;
  fundSize: string | null;
  distributionPolicy: string | null;
  replication: string | null;
  inceptionDate: string | null;
  holdingsTotalWeight: string | null;
  holdingsCount: string | null;
  topHoldings: string | null; // JSON string
  countriesWeight: string | null; // JSON string
  sectorsWeight: string | null; // JSON string
};

/**
 * Fetches the metadata from JustETF given an ISIN.
 * Note: If the ISIN is a standard stock, JustETF might not have it,
 * returning null fields.
 */
export async function fetchAssetMetadata(isin: string): Promise<AssetMetadata> {
  const defaultAsset: AssetMetadata = {
    isin,
    type: null,
    wkn: null,
    name: null,
    ter: null,
    ticker: null,
    marketCap: null,
    country: null,
    sector: null,
    dividendYield: null,
    perfYTD: null,
    perf1Month: null,
    perf3Months: null,
    perf6Months: null,
    perf1Year: null,
    perf3Years: null,
    perf5Years: null,
    volatility1Year: null,
    volatility3Years: null,
    volatility5Years: null,
    returnPerRisk1Year: null,
    returnPerRisk3Years: null,
    returnPerRisk5Years: null,
    maxDrawdown1Year: null,
    maxDrawdown3Years: null,
    maxDrawdown5Years: null,
    maxDrawdownSinceInception: null,
    fundSize: null,
    distributionPolicy: null,
    replication: null,
    inceptionDate: null,
    holdingsTotalWeight: null,
    holdingsCount: null,
    topHoldings: null,
    countriesWeight: null,
    sectorsWeight: null
  };

  if (!isin || isin.length !== 12) {
    log.info(`[fetchAssetMetadata] Skipped JustETF query for non-ISIN/crypto symbol: ${isin}`);
    return defaultAsset;
  }

  try {
    const url = `https://www.justetf.com/en/etf-profile.html?isin=${isin}`;
    log.request("GET", url, { isin });
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.75 Safari/537.36"
      }
    });

    if (!response.ok) {
      return defaultAsset;
    }

    // Extract and format cookies for the AJAX requests
    const headers = response.headers as Headers & { getSetCookie?: () => string[] };
    const setCookies = headers.getSetCookie
      ? headers.getSetCookie()
      : [headers.get("set-cookie") || ""];
    const cookieStr = setCookies.map((c: string) => c.split(";")[0]).join("; ");
    
    const html = await response.text();
    const root = parse(html);

    // 1. Extract Name
    const h1 = root.querySelector("h1");
    if (h1 && h1.text) {
      defaultAsset.name = h1.text.replace(/\s+/g, " ").trim();
      defaultAsset.type = "ETF";
    }

    // 2. Extract TER
    const valElements = root.querySelectorAll(".val");
    for (const el of valElements) {
      if (el.text.includes("%")) {
        const prev = el.previousElementSibling;
        if (prev && prev.text.toLowerCase().includes("ter")) {
          const parsed = Number.parseFloat(el.text.replace("%", "").trim());
          if (!Number.isNaN(parsed)) {
            defaultAsset.ter = parsed;
          }
          break;
        }
      }
    }

    // 3. Extract WKN
    for (const el of valElements) {
      const prev = el.previousElementSibling;
      if (prev && prev.text.toLowerCase().includes("wkn")) {
        defaultAsset.wkn = el.text.trim() || null;
        break;
      }
    }

    // 4. Extract Ticker (try to find typical labels)
    // Sometimes the ticker is stored in a span next to "Ticker"
    for (const el of valElements) {
      const prev = el.previousElementSibling;
      if (prev && prev.text.toLowerCase().includes("ticker")) {
        defaultAsset.ticker = el.text.trim() || null;
        break;
      }
    }
    
    // Additional ETF Facts
    for (const el of valElements) {
      const prev = el.previousElementSibling;
      if (prev) {
        const label = prev.text.toLowerCase();
        if (label.includes("fund size")) {
          defaultAsset.fundSize = el.text.trim() || null;
        } else if (label.includes("distribution policy")) {
          defaultAsset.distributionPolicy = el.text.trim() || null;
        } else if (label.includes("replication")) {
          defaultAsset.replication = el.text.trim() || null;
        } else if (label.includes("inception date")) {
          defaultAsset.inceptionDate = el.text.trim() || null;
        }
      }
    }

    // Performance and Risk table parsing for ETFs
    const etfRows = root.querySelectorAll("tr");
    const foundHoldings: { name: string; weight: string }[] = [];
    for (const row of etfRows) {
      const cells = row.querySelectorAll("td");
      if (cells.length >= 2) {
        const rowLabel = cells[0].text.trim();
        const rowLabelLower = rowLabel.toLowerCase();
        // Use last cell for value as before
        const value = cells[cells.length - 1].text.trim();
        
        if (rowLabelLower === "ytd") defaultAsset.perfYTD = value;
        else if (rowLabelLower === "1 month") defaultAsset.perf1Month = value;
        else if (rowLabelLower === "3 months") defaultAsset.perf3Months = value;
        else if (rowLabelLower === "6 months") defaultAsset.perf6Months = value;
        else if (rowLabelLower === "1 year") defaultAsset.perf1Year = value;
        else if (rowLabelLower === "3 years") defaultAsset.perf3Years = value;
        else if (rowLabelLower === "5 years") defaultAsset.perf5Years = value;
        else if (rowLabelLower === "volatility 1 year") defaultAsset.volatility1Year = value;
        else if (rowLabelLower === "volatility 3 years") defaultAsset.volatility3Years = value;
        else if (rowLabelLower === "volatility 5 years") defaultAsset.volatility5Years = value;
        else if (rowLabelLower === "return per risk 1 year") defaultAsset.returnPerRisk1Year = value;
        else if (rowLabelLower === "return per risk 3 years") defaultAsset.returnPerRisk3Years = value;
        else if (rowLabelLower === "return per risk 5 years") defaultAsset.returnPerRisk5Years = value;
        else if (rowLabelLower === "maximum drawdown 1 year") defaultAsset.maxDrawdown1Year = value;
        else if (rowLabelLower === "maximum drawdown 3 years") defaultAsset.maxDrawdown3Years = value;
        else if (rowLabelLower === "maximum drawdown 5 years") defaultAsset.maxDrawdown5Years = value;
        else if (rowLabelLower === "maximum drawdown since inception") defaultAsset.maxDrawdownSinceInception = value;
        else if (rowLabelLower === "weight of top 10 holdings") defaultAsset.holdingsTotalWeight = value;
        
        // Handling individual holdings - they usually have a link in the first cell
        // and a percentage in the second or last cell
        const link = cells[0].querySelector("a");
        if (link && value.includes("%") && value !== defaultAsset.holdingsTotalWeight) {
          foundHoldings.push({ name: link.text.trim(), weight: value });
        }
      } else if (cells.length === 1 && cells[0].text.toLowerCase().includes("out of")) {
        // Extracting "out of 1,308"
        defaultAsset.holdingsCount = cells[0].text.trim();
      }
    }
    
    if (foundHoldings.length > 0) {
      defaultAsset.topHoldings = JSON.stringify(foundHoldings);
    }

    // Allocation (Countries and Sectors) - Attempt to get full data via AJAX
    const foundCountries: { name: string; weight: string }[] = [];
    const foundSectors: { name: string; weight: string }[] = [];

    async function fetchFullBreakdown(pattern: string, isCountry: boolean, cookieStr: string | null) {
      const regex = new RegExp(`Wicket\\.Ajax\\.ajax\\(\\{"u":"([^"]+${pattern}[^"]+)"`, "i");
      const match = html.match(regex);
      if (match && match[1]) {
        let ajaxUrl = match[1];
        if (ajaxUrl.startsWith("/")) {
          ajaxUrl = `https://www.justetf.com${ajaxUrl}`;
        }
        log.info(`AJAX ${pattern}: ${ajaxUrl}`);
        
        try {
          const headers: Record<string, string> = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.75 Safari/537.36",
            "Wicket-Ajax": "true",
            "Wicket-FocusedElementId": "id",
            "X-Requested-With": "XMLHttpRequest",
            "Referer": `https://www.justetf.com/en/etf-profile.html?isin=${isin}`,
            "wicket-ajax-baseurl": `en/etf-profile.html?isin=${isin}`,
            "Accept": "application/xml, text/xml, */*; q=0.01"
          };
          if (cookieStr) {
            headers["Cookie"] = cookieStr;
          }

          const ajaxResponse = await fetch(ajaxUrl, { headers });
          if (ajaxResponse.ok) {
            const ajaxText = await ajaxResponse.text();
            log.info(`AJAX ${pattern} → ${ajaxText.length} chars`);
            
            // Wicket returns XML with one or more component tags containing CDATA
            const cdataRegex = /<!\[CDATA\[([\s\S]*?)\]\]>/g;
            let cdataMatch;
            while ((cdataMatch = cdataRegex.exec(ajaxText)) !== null) {
              const htmlContent = cdataMatch[1];
              const ajaxDoc = parse(htmlContent);
              
              // Try table structure first (as seen in user screenshot)
              const tRows = ajaxDoc.querySelectorAll("tr");
              if (tRows.length > 0) {
                log.info(`${pattern}: ${tRows.length} righe trovate`);
                for (const row of tRows) {
                  const cells = row.querySelectorAll("td");
                  if (cells.length >= 2) {
                    const name = cells[0].text.trim();
                    const weight = cells[cells.length - 1].text.trim();
                    if (name && weight.includes("%") && !name.toLowerCase().includes("show more")) {
                      if (isCountry) {
                        if (!foundCountries.find(c => c.name === name)) foundCountries.push({ name, weight });
                      } else {
                        if (!foundSectors.find(s => s.name === name)) foundSectors.push({ name, weight });
                      }
                    }
                  }
                }
              }

              // Also check for row structure just in case
              const rows = ajaxDoc.querySelectorAll(".row");
              if (rows.length > 0) {
                log.info(`${pattern}: ${rows.length} grid rows trovate`);
                for (const row of rows) {
                  const cols = row.querySelectorAll(".col-6, .col-5, .col-7, div");
                  if (cols.length >= 2) {
                    const name = cols[0].text.trim();
                    const weight = cols[cols.length - 1].text.trim();
                    if (name && weight.includes("%") && !name.toLowerCase().includes("show more")) {
                      if (isCountry) {
                        if (!foundCountries.find(c => c.name === name)) foundCountries.push({ name, weight });
                      } else {
                        if (!foundSectors.find(s => s.name === name)) foundSectors.push({ name, weight });
                      }
                    }
                  }
                }
              }
            }
          } else {
            log.info(`AJAX ${pattern} fallito: HTTP ${ajaxResponse.status}`);
          }
        } catch (e) {
          log.error("AJAX", pattern, e);
        }
      } else {
        log.info(`Nessun AJAX URL trovato per ${pattern}`);
      }
    }

    // Attempt to fetch full data
    await fetchFullBreakdown("loadMoreCountries", true, cookieStr);
    await fetchFullBreakdown("loadMoreSectors", false, cookieStr);

    // If AJAX failed or returned nothing, fallback to what's in the initial HTML
    if (foundCountries.length === 0 || foundSectors.length === 0) {
      const potentialHeaders = root.querySelectorAll("h2, h3, h4, .header, .title");
      for (const header of potentialHeaders) {
        const headerText = header.text.trim().toLowerCase();
        if (headerText === "countries" || headerText === "sectors") {
          let container = header.parentNode;
          for (let i = 0; i < 4 && container; i++) {
            const rows = container.querySelectorAll(".row");
            const validRows = rows.filter((r) => r.querySelectorAll(".col-6, .col-5, .col-7").length >= 2);
            if (validRows.length >= 1) {
              for (const row of validRows) {
                const cols = row.querySelectorAll(".col-6, .col-5, .col-7, div");
                const name = cols[0].text.trim();
                const weight = cols[cols.length - 1].text.trim();
                if (name && weight.includes("%") && !name.toLowerCase().includes("show more")) {
                  if (headerText.includes("countries")) {
                    if (!foundCountries.find(c => c.name === name)) foundCountries.push({ name, weight });
                  } else {
                    if (!foundSectors.find(s => s.name === name)) foundSectors.push({ name, weight });
                  }
                }
              }
              break;
            }
            container = container.parentNode;
          }
        }
      }
    }

    if (foundCountries.length > 0) defaultAsset.countriesWeight = JSON.stringify(foundCountries);
    if (foundSectors.length > 0) defaultAsset.sectorsWeight = JSON.stringify(foundSectors);
    
    // Alternative layout ticker extraction (if Justetf uses a specific class for ticker)
    if (!defaultAsset.ticker) {
      const tickerSpans = root.querySelectorAll("span.ticker, span.identifer");
      if (tickerSpans.length > 0) {
        defaultAsset.ticker = tickerSpans[0].text.trim();
      }
    }

    if (!defaultAsset.name) {
      const stockUrl = `https://www.justetf.com/en/stock-profiles/${isin}/`;
      const stockResponse = await fetch(stockUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.75 Safari/537.36"
        }
      });

      if (stockResponse.ok) {
        const stockHtml = await stockResponse.text();
        const stockRoot = parse(stockHtml);
        const stockH1 = stockRoot.querySelector("h1");
        if (stockH1 && stockH1.text) {
          defaultAsset.name = stockH1.text.replace(/\s+/g, " ").trim();
          defaultAsset.type = "Stock";
          // For stocks, we don't want TER or Ticker as they are not available/relevant here
          defaultAsset.ter = null;
          defaultAsset.ticker = null;
        }

        const stockValElements = stockRoot.querySelectorAll(".val");
        for (const el of stockValElements) {
          const prev = el.previousElementSibling;
          if (prev) {
            const label = prev.text.toLowerCase();
            if (label.includes("wkn")) {
              defaultAsset.wkn = el.text.trim() || null;
            } else if (label.includes("market cap")) {
              defaultAsset.marketCap = el.text.trim() || null;
            } else if (label.includes("country")) {
              defaultAsset.country = el.text.trim() || null;
            } else if (label.includes("sector")) {
              defaultAsset.sector = el.text.trim() || null;
            } else if (label.includes("dividend yield")) {
              defaultAsset.dividendYield = el.text.trim() || null;
            }
          }
        }

        // Performance table parsing
        const rows = stockRoot.querySelectorAll("tr");
        for (const row of rows) {
          const cells = row.querySelectorAll("td");
          if (cells.length >= 2) {
            const rowLabel = cells[0].text.trim().toLowerCase();
            const value = cells[cells.length - 1].text.trim();
            if (rowLabel === "ytd") defaultAsset.perfYTD = value;
            else if (rowLabel === "1 month") defaultAsset.perf1Month = value;
            else if (rowLabel === "3 months") defaultAsset.perf3Months = value;
            else if (rowLabel === "6 months") defaultAsset.perf6Months = value;
            else if (rowLabel === "1 year") defaultAsset.perf1Year = value;
            else if (rowLabel === "3 years") defaultAsset.perf3Years = value;
            else if (rowLabel === "5 years") defaultAsset.perf5Years = value;
            else if (rowLabel === "volatility 1 year") defaultAsset.volatility1Year = value;
            else if (rowLabel === "volatility 3 years") defaultAsset.volatility3Years = value;
            else if (rowLabel === "volatility 5 years") defaultAsset.volatility5Years = value;
            else if (rowLabel === "return per risk 1 year") defaultAsset.returnPerRisk1Year = value;
            else if (rowLabel === "return per risk 3 years") defaultAsset.returnPerRisk3Years = value;
            else if (rowLabel === "return per risk 5 years") defaultAsset.returnPerRisk5Years = value;
            else if (rowLabel === "maximum drawdown 1 year") defaultAsset.maxDrawdown1Year = value;
            else if (rowLabel === "maximum drawdown 3 years") defaultAsset.maxDrawdown3Years = value;
            else if (rowLabel === "maximum drawdown 5 years") defaultAsset.maxDrawdown5Years = value;
            else if (rowLabel === "maximum drawdown since inception") defaultAsset.maxDrawdownSinceInception = value;
          }
        }
      }
    }

    // Build detailed log output
    const lines: string[] = [];
    lines.push(`Metadata per ${isin}`);
    lines.push(`  Name="${defaultAsset.name}"`);
    lines.push(`  Type="${defaultAsset.type}"`);
    if (defaultAsset.wkn)    lines.push(`  WKN="${defaultAsset.wkn}"`);
    if (defaultAsset.ticker)  lines.push(`  Ticker="${defaultAsset.ticker}"`);
    if (defaultAsset.ter !== null) lines.push(`  TER=${defaultAsset.ter}%`);
    if (defaultAsset.marketCap)    lines.push(`  Market Cap:      ${defaultAsset.marketCap}`);
    if (defaultAsset.country)       lines.push(`  Country:         ${defaultAsset.country}`);
    if (defaultAsset.sector)        lines.push(`  Sector:          ${defaultAsset.sector}`);
    if (defaultAsset.dividendYield) lines.push(`  Dividend yield:  ${defaultAsset.dividendYield}`);

    if (defaultAsset.type === "ETF") {
      if (defaultAsset.fundSize)            lines.push(`  Fund size:           ${defaultAsset.fundSize}`);
      if (defaultAsset.distributionPolicy)  lines.push(`  Distribution policy: ${defaultAsset.distributionPolicy}`);
      if (defaultAsset.replication)          lines.push(`  Replication:         ${defaultAsset.replication}`);
      if (defaultAsset.inceptionDate)        lines.push(`  Inception date:      ${defaultAsset.inceptionDate}`);

      if (defaultAsset.topHoldings) {
        const holdings = JSON.parse(defaultAsset.topHoldings) as Array<{ name: string; weight: string }>;
        lines.push(`  Top ${holdings.length} Holdings:`);
        holdings.forEach((h) => { lines.push(`    - ${h.name.padEnd(30)} ${h.weight}`); });
      }
      if (defaultAsset.countriesWeight) {
        const countries = JSON.parse(defaultAsset.countriesWeight) as Array<{ name: string; weight: string }>;
        lines.push(`  Countries (${countries.length}):`);
        countries.forEach((c) => { lines.push(`    - ${c.name.padEnd(30)} ${c.weight}`); });
      }
      if (defaultAsset.sectorsWeight) {
        const sectors = JSON.parse(defaultAsset.sectorsWeight) as Array<{ name: string; weight: string }>;
        lines.push(`  Sectors (${sectors.length}):`);
        sectors.forEach((s) => { lines.push(`    - ${s.name.padEnd(30)} ${s.weight}`); });
      }
    }

    if (defaultAsset.type === "Stock" || defaultAsset.type === "ETF") {
      lines.push(`  Performance:`);
      if (defaultAsset.perf1Month)  lines.push(`    1 month:  ${defaultAsset.perf1Month}`);
      if (defaultAsset.perf3Months) lines.push(`    3 months: ${defaultAsset.perf3Months}`);
      if (defaultAsset.perf6Months) lines.push(`    6 months: ${defaultAsset.perf6Months}`);
      if (defaultAsset.perfYTD)     lines.push(`    YTD:      ${defaultAsset.perfYTD}`);
      if (defaultAsset.perf1Year)   lines.push(`    1 year:   ${defaultAsset.perf1Year}`);
      if (defaultAsset.perf3Years)  lines.push(`    3 years:  ${defaultAsset.perf3Years}`);
      if (defaultAsset.perf5Years)  lines.push(`    5 years:  ${defaultAsset.perf5Years}`);

      lines.push(`  Risk:`);
      if (defaultAsset.volatility1Year)         lines.push(`    Volatility 1Y:      ${defaultAsset.volatility1Year}`);
      if (defaultAsset.volatility3Years)        lines.push(`    Volatility 3Y:      ${defaultAsset.volatility3Years}`);
      if (defaultAsset.volatility5Years)        lines.push(`    Volatility 5Y:      ${defaultAsset.volatility5Years}`);
      if (defaultAsset.returnPerRisk1Year)      lines.push(`    Return/Risk 1Y:     ${defaultAsset.returnPerRisk1Year}`);
      if (defaultAsset.returnPerRisk3Years)     lines.push(`    Return/Risk 3Y:     ${defaultAsset.returnPerRisk3Years}`);
      if (defaultAsset.returnPerRisk5Years)     lines.push(`    Return/Risk 5Y:     ${defaultAsset.returnPerRisk5Years}`);
      if (defaultAsset.maxDrawdown1Year)        lines.push(`    Max Drawdown 1Y:    ${defaultAsset.maxDrawdown1Year}`);
      if (defaultAsset.maxDrawdown3Years)       lines.push(`    Max Drawdown 3Y:    ${defaultAsset.maxDrawdown3Years}`);
      if (defaultAsset.maxDrawdown5Years)       lines.push(`    Max Drawdown 5Y:    ${defaultAsset.maxDrawdown5Years}`);
      if (defaultAsset.maxDrawdownSinceInception) lines.push(`    Max Drawdown Tot:   ${defaultAsset.maxDrawdownSinceInception}`);
    }

    log.info(lines.join("\n"));
  } catch (error) {
    log.error("GET", `justetf.com/${isin}`, error);
  }

  return defaultAsset;
}

export interface AssetHistoryPoint {
  date: string;   // "YYYY-MM-DD"
  value: number;  // prezzo grezzo
}

export async function fetchAssetHistory(
  isin: string,
  currency: "EUR" | "USD" | "GBP" = "EUR"
): Promise<AssetHistoryPoint[]> {
  if (!isin || isin.length !== 12) {
    log.info(`[fetchAssetHistory] Skipped JustETF history query for non-ISIN/crypto symbol: ${isin}`);
    return [];
  }

  const params = new URLSearchParams({
    locale: "en",
    currency,
    valuesType: "MARKET_VALUE",
    reduceData: "false",
    includeDividends: "false",
    features: "DIVIDENDS",
  });

  const url = `https://www.justetf.com/api/etfs/${isin}/performance-chart?${params}`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json",
      },
    });

    if (!res.ok) {
      log.error("GET", url, new Error(`HTTP Error ${res.status} for ISIN ${isin}`));
      return [];
    }

    const data = await res.json() as {
      series?: Array<{
        date: string;
        value: {
          raw: number;
        };
      }>;
    };
    
    if (!data.series || !Array.isArray(data.series)) {
      return [];
    }

    // Mappa il formato grezzo in { date, value }
    return data.series.map((item) => ({
      date: item.date,
      value: item.value.raw,
    }));
  } catch (error) {
    log.error("GET", url, error);
    return [];
  }
}

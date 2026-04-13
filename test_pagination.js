import fetch from "node-fetch";

async function testWithExactHeaders() {
  const buildId = "_h77XUt-FNU_ZiwMVT3tE";
  const BASE = `https://careers.epam.com/_next/data/${buildId}/en/jobs/romania.json`;
  
  const cookie = "OptanonAlertBoxClosed=2026-01-21T16:08:28.074Z; _ga=GA1.1.843789455.1776063811; cloudfront-viewer-city=Cluj-Napoca; cloudfront-viewer-country=RO; cloudfront-viewer-country-name=Romania; cloudfront-viewer-time-zone=Europe/Bucharest; _ga_W1T3XZ3Z92=GS2.1.s1776063811$o1$g1$t1776063828$j43$l0$h0$dT6PnjpCCDYNt3vpMXHZQEhHHG2TFpJdNdA; OptanonConsent=isGpcEnabled=0&datestamp=Mon+Apr+13+2026+11%3A16%3A50+GMT%2B0300+(Eastern+European+Summer+Time)&version=202505.1.0&browserGpcFlag=0&isIABGlobal=false&hosts=&consentId=6388ef82-5b67-4a7f-bc72-b9f252416c9c&interactionCount=1&isAnonUser=1&landingPath=NotLandingPage&groups=C0001%3A1%2CC0002%3A1%2CC0003%3A1%2CC0004%3A1&intType=1&geolocation=RO%3BCJ&AwaitingReconsent=false";

  for (let page = 1; page <= 8; page++) {
    const url = `${BASE}?page=${page}&sort_by=relevance&slug=romania`;
    
    const headers = {
      "accept": "*/*",
      "accept-language": "en-US,en;q=0.9",
      "cookie": cookie,
      "referer": page === 1 ? "https://careers.epam.com/en/jobs/romania" : `https://careers.epam.com/en/jobs/romania?page=${page-1}&sort_by=relevance`,
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
      "x-nextjs-data": "1"
    };
    
    try {
      const data = await fetch(url, { headers }).then(r => r.json());
      const jobs = data.pageProps?.jobs?.jobs || [];
      const uids = jobs.slice(0, 3).map(j => j.uid);
      console.log(`Page ${page}: ${jobs.length} jobs - ${uids.join(', ')}`);
    } catch(e) {
      console.log(`Page ${page}: Error - ${e.message}`);
    }
  }
}

testWithExactHeaders();
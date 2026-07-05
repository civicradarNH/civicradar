import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        ctx = await browser.new_context()
        page = await ctx.new_page()
        await page.goto('http://127.0.0.1:8095/', wait_until='networkidle')
        await page.wait_for_function('() => typeof window.confirmReport === "function"', timeout=15000)
        await page.evaluate("""() => {
          localStorage.setItem('civicradar_user', JSON.stringify({
            id: 'mt01-user', ward: 'G/S Ward — Worli', city: 'mumbai', displayName: 'Test', tosAccepted: true
          }));
          localStorage.setItem('mosquiTrackReports', JSON.stringify([{
            id: 'mt01-dedupe-test', reporterId: 'other', hazard: 'garbage', notes: 'x', image: '',
            ward: 'G/S Ward — Worli', city: 'mumbai', lat: 19.0764, lng: 72.8781,
            status: 'pending', confirmations: 0, timestamp: new Date().toISOString()
          }]));
          window._mt01First = window.confirmReport('mt01-dedupe-test');
          window._mt01Second = window.confirmReport('mt01-dedupe-test');
          const row = JSON.parse(localStorage.getItem('mosquiTrackReports')||'[]')
            .find((r) => r.id === 'mt01-dedupe-test');
          window._mt01Count = row ? (Number(row.confirmations) || 0) : -1;
          const confirmed = JSON.parse(localStorage.getItem('civicradar_confirmed')||'[]');
          window._mt01SetLen = confirmed.filter((id) => String(id) === 'mt01-dedupe-test').length;
        }""")
        ok = await page.evaluate(
            '() => window._mt01First === true && window._mt01Second === false '
            '&& window._mt01Count === 1 && window._mt01SetLen === 1'
        )
        print('MT01 quick test:', 'PASS' if ok else 'FAIL')
        await browser.close()
        return 0 if ok else 1

if __name__ == '__main__':
    raise SystemExit(asyncio.run(main()))

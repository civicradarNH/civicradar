#!/usr/bin/env python3
import asyncio

WARD = 'G/N Ward — Dadar, Shivaji Park'

async def main():
    from playwright.async_api import async_playwright
    user = {
        'id': 'extra', 'tosAccepted': True, 'gpsConsent': True,
        'city': 'mumbai', 'ward': WARD, 'displayName': 'TestCitizen', 'pledges': [],
    }
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        ctx = await browser.new_context(viewport={'width': 390, 'height': 844})
        await ctx.add_init_script("""
          navigator.serviceWorker.register = () => Promise.reject(new Error('sw blocked'));
          window.CIVICRADAR_CONFIG = Object.assign({}, window.CIVICRADAR_CONFIG || {}, {
            moderation: { enabled: false }, supabaseUrl: '', supabaseAnonKey: '',
          });
        """)
        await ctx.set_geolocation({'latitude': 19.076, 'longitude': 72.8777})
        await ctx.grant_permissions(['geolocation'])
        page = await ctx.new_page()
        await page.goto('http://127.0.0.1:9080/', wait_until='domcontentloaded')
        await page.wait_for_function('() => typeof window.openReportModal === "function"')
        await page.evaluate(
            """(u) => localStorage.setItem('civicradar_user', JSON.stringify(u))""",
            user,
        )
        await page.reload(wait_until='domcontentloaded')
        await page.wait_for_timeout(1000)
        await page.evaluate("""() => {
          const reps = [{ id: 'extra-esc', reporterId: JSON.parse(localStorage.getItem('civicradar_user')).id,
            hazard: 'stagnant-water', image: 'data:image/jpeg;base64,/9j/4AAQ', ward: 'G/N Ward — Dadar, Shivaji Park',
            reporter: 'Test', lat: 19.076, lng: 72.877, status: 'pending', timestamp: new Date().toISOString() }];
          localStorage.setItem('mosquiTrackReports', JSON.stringify(reps));
        }""")
        result = await page.evaluate("""() => {
          const e = document.querySelector('.home-hero__sub');
          return { text: e?.textContent?.trim(), ob13: !!(e && /spot|photo|pin/i.test(e.textContent)), heroHidden: document.getElementById('homeHero')?.classList.contains('hidden') };
        }""")
        open(r'C:\civicradar\tests\debug_ob13_out.txt', 'w', encoding='utf-8').write(repr(result))
        await browser.close()

asyncio.run(main())

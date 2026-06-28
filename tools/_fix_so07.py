from pathlib import Path
p=Path("tests/e2e_comprehensive.py")
text=p.read_text(encoding="utf-8")
needle="    custom_name = 'My Custom RWA Test 9876'\n\n    await page.fill('#profileSocietyInput', custom_name)"
repl="    custom_name = 'My Custom RWA Test 9876'\n\n    await page.evaluate('() => window.openProfileModal()')\n\n    await page.wait_for_timeout(200)\n\n    await page.fill('#profileSocietyInput', custom_name)"
if needle not in text:
    raise SystemExit('SO07 block not found')
p.write_text(text.replace(needle, repl, 1), encoding='utf-8')
print('fixed SO07 profile open')

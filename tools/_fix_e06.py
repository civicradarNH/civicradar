from pathlib import Path
p = Path("js/app.js")
text = p.read_text(encoding="utf-8")
old = """    if (!navigator.geolocation) {

      showToast(t('toast.gpsRequired'), 'error');

      return;

    }



    if (window.ImageModeration && getModCfg().enabled) {"""
new = """    if (!navigator.geolocation) {

      showToast(t('toast.gpsRequired'), 'error');

      return;

    }

    if (submitBtn && (submitBtn.disabled || submitBtn.classList.contains('is-loading'))) return;

    setButtonLoading(submitBtn, true, t('report.submitting'));



    if (window.ImageModeration && getModCfg().enabled) {"""
if old not in text:
    raise SystemExit('submitReport anchor not found')
p.write_text(text.replace(old, new, 1), encoding='utf-8')
print('patched submitReport early disable')

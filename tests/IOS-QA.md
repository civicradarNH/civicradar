# CivicRadar — Manual iOS QA Checklist

Run on a real iPhone or iPad (Safari + Add to Home Screen). Requires HTTPS (staging/production).

## PWA install

- [ ] Open site in Safari → Share → **Add to Home Screen** → icon appears on home screen
- [ ] Launch from home screen → opens standalone (no Safari URL bar)
- [ ] Status bar readable; header/nav clear of notch and home indicator

## Map & location

- [ ] Map fills screen between header and bottom nav (no gap over home indicator)
- [ ] **Turn on** location banner → iOS permission prompt → map recenters with blue dot
- [ ] Deny location → banner stays; **Locate me** pill works after snooze
- [ ] Pinch-zoom and pan work; marker popups open on first tap (no double-tap delay)

## Report flow (camera)

- [ ] Tap Report FAB → hazard picker → **Capture Photo**
- [ ] iOS camera opens (rear camera preferred); take photo → returns to report sheet on **Submit** step
- [ ] Background app during camera → return → draft restores (sheet still open)
- [ ] Retake photo works; submit completes with GPS if enabled
- [ ] Focus notes field → page does **not** zoom (inputs stay 16px)

## Modals & navigation

- [ ] Open Profile / Community → bottom nav still tappable; switch back to Map
- [ ] Full-screen modals (Report, ToS) do not scroll the map behind them
- [ ] Hardware swipe-back / gesture does not lose an in-progress photo report

## Offline shell

- [ ] Add to Home Screen → load once online → enable airplane mode → relaunch → app shell loads (map tiles may be blank)

## Private browsing (optional)

- [ ] Safari Private → complete onboarding → report still works (sessionStorage draft may not persist across tab close — expected)

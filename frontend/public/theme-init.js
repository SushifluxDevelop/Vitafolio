// Applies the saved theme and language before the first paint. A plain script on purpose: it runs without a build step.
;(function () {
  try {
    var stored = localStorage.getItem('cv.theme')
    var dark = stored === 'dark' || ((stored === null || stored === 'system') && window.matchMedia('(prefers-color-scheme: dark)').matches)
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
    var language = localStorage.getItem('cv.language')
    if (language === 'de' || language === 'en') document.documentElement.setAttribute('lang', language)
  } catch (error) {
    // Storage can be blocked; the light theme is a safe default.
    void error
  }
})()

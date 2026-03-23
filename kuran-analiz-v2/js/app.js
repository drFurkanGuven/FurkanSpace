(function () {
  'use strict';

  /* ══════════════════════════════════════════════════════════════
     KUR'AN KÖK ANALİZİ v3 — Tamamen Client-Side (JSON Tabanlı)
     Backend gerektirmez. /database/quran-verses.json kullanır.
     ══════════════════════════════════════════════════════════════ */

  var LIMIT = 20;
  var QURAN_WBW_API = 'https://api.quran.com/api/v4';

  var app = document.getElementById('app');
  var currentQuery = '';
  var currentMode = 'text'; // text | root
  var currentOffset = 0;
  var totalResults = 0;
  var allResults = [];       // görüntülenen dilim
  var _fullResults = [];     // tüm eşleşen ayetler (bellekte)
  var debounceTimer = null;
  var surahStatsData = null;
  var chartInstance = null;
  var exactMatch = false;
  var correlationData = null;

  // ── Veri Önbelleği ──
  var versesCache = null;
  var versesLoading = false;
  var versesQueue = [];

  // ── Arapça Yardımcıları ──
  var TASHKEEL_RE = /[\u064B-\u0652\u0670\u06E1\u06E2\u06E5\u06E6\u06ED]/g;

  function stripTashkeel(text) {
    if (!text) return '';
    return text.replace(TASHKEEL_RE, '');
  }

  function normalizeArabic(text) {
    if (!text) return '';
    var s = stripTashkeel(text);
    s = s.replace(/[\u0623\u0625\u0622\u0671]/g, '\u0627');
    s = s.replace(/\u0629/g, '\u0647');
    s = s.replace(/\u0649/g, '\u064A');
    return s;
  }

  function isArabic(text) {
    return /[\u0600-\u06FF]/.test(text);
  }

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // ── Türkçe Stop Kelimeler ──
  var TR_STOP_WORDS = new Set([
    've', 'bir', 'bu', 'da', 'de', 'o', 'ki', 'ne', 'için', 'ile',
    'her', 'ya', 'onu', 'biz', 'siz', 'ben', 'sen', 'onlar', 'olan',
    'var', 'yok', 'daha', 'çok', 'en', 'ise', 'olarak', 'gibi',
    'sonra', 'önce', 'kadar', 'üzere', 'şey', 'mi', 'mu', 'mı', 'mü',
    'ancak', 'ama', 'fakat', 'hem', 'veya', 'ya', 'diye', 'üzerinde',
    'onu', 'ona', 'onun', 'bunu', 'buna', 'bunun', 'şu',
    'onları', 'onlara', 'onların', 'bizim', 'sizin', 'benim', 'senin',
    'ey', 'artık', 'hiç', 'hep', 'pek', 'bile', 'dir', 'dır',
    'oldu', 'olup', 'etmek', 'olur', 'olmuş',
    'diğer', 'başka', 'aynı', 'böyle', 'şöyle', 'öyle', 'nasıl',
    'neden', 'niçin', 'nerede', 'nereye', 'kim', 'kimi', 'hangi',
  ]);

  // ── Sık Kullanılan Kökler ──
  var COMMON_ROOTS = [
    { root: '\u0631\u062D\u0645', meaning: 'merhamet, rahmet', latin: 'r-h-m' },
    { root: '\u0639\u0644\u0645', meaning: 'bilmek, ilim', latin: 'a-l-m' },
    { root: '\u0643\u062A\u0628', meaning: 'yazmak, kitap', latin: 'k-t-b' },
    { root: '\u0642\u0648\u0644', meaning: 'söylemek, söz', latin: 'q-w-l' },
    { root: '\u0639\u0628\u062F', meaning: 'kulluk etmek', latin: 'a-b-d' },
    { root: '\u0627\u0645\u0646', meaning: 'iman etmek, güven', latin: 'â-m-n' },
    { root: '\u062D\u0645\u062F', meaning: 'övmek, hamd', latin: 'h-m-d' },
    { root: '\u0633\u0644\u0645', meaning: 'barış, İslam', latin: 's-l-m' },
    { root: '\u0646\u0632\u0644', meaning: 'indirmek, nüzul', latin: 'n-z-l' },
    { root: '\u0647\u062F\u064A', meaning: 'hidayet, doğru yol', latin: 'h-d-y' },
    { root: '\u062E\u0644\u0642', meaning: 'yaratmak', latin: 'kh-l-q' },
    { root: '\u0633\u0628\u062D', meaning: 'tesbih, yüzmek', latin: 's-b-h' },
    { root: '\u0635\u0644\u0648', meaning: 'namaz, dua', latin: 's-l-w' },
    { root: '\u0630\u0643\u0631', meaning: 'zikretmek, hatırlamak', latin: 'dh-k-r' },
    { root: '\u062C\u0639\u0644', meaning: 'yapmak, kılmak', latin: 'j-a-l' },
    { root: '\u0634\u0643\u0631', meaning: 'şükretmek', latin: 'sh-k-r' },
    { root: '\u0639\u0630\u0628', meaning: 'azap', latin: 'a-dh-b' },
    { root: '\u0642\u062F\u0631', meaning: 'kudret, kader', latin: 'q-d-r' },
    { root: '\u0641\u0631\u0642', meaning: 'ayırmak, furkan', latin: 'f-r-q' },
    { root: '\u062D\u0642\u0642', meaning: 'hak, hakikat', latin: 'h-q-q' },
    { root: '\u0646\u0648\u0631', meaning: 'nur, ışık', latin: 'n-w-r' },
    { root: '\u0633\u0645\u0639', meaning: 'duymak, işitmek', latin: 's-m-a' },
    { root: '\u0628\u0635\u0631', meaning: 'görmek, basiret', latin: 'b-s-r' },
    { root: '\u062D\u064A\u064A', meaning: 'hayat, yaşamak', latin: 'h-y-y' },
    { root: '\u0645\u0648\u062A', meaning: 'ölüm', latin: 'm-w-t' },
    { root: '\u062C\u0646\u0646', meaning: 'cennet, örtünmek', latin: 'j-n-n' },
    { root: '\u0646\u0631\u0631', meaning: 'ateş, cehennem', latin: 'n-r-r' },
    { root: '\u0643\u0641\u0631', meaning: 'örtmek, inkâr', latin: 'k-f-r' },
    { root: '\u0635\u0628\u0631', meaning: 'sabretmek', latin: 's-b-r' },
    { root: '\u062A\u0648\u0628', meaning: 'tevbe etmek', latin: 't-w-b' },
  ];

  /* ══════════════════════════════════════════════════════════════
     VERİ YÜKLEYİCİ
     ══════════════════════════════════════════════════════════════ */
  function loadVerses(callback) {
    if (versesCache) { callback(null, versesCache); return; }
    versesQueue.push(callback);
    if (versesLoading) return;
    versesLoading = true;

    fetch('/database/quran-verses.json')
      .then(function (r) {
        if (!r.ok) throw new Error('JSON yüklenemedi: ' + r.status);
        return r.json();
      })
      .then(function (data) {
        versesCache = data;
        versesLoading = false;
        var queue = versesQueue.splice(0);
        queue.forEach(function (cb) { cb(null, data); });
      })
      .catch(function (err) {
        versesLoading = false;
        var queue = versesQueue.splice(0);
        queue.forEach(function (cb) { cb(err); });
      });
  }

  /* ══════════════════════════════════════════════════════════════
     ARAMA MOTORLARı
     ══════════════════════════════════════════════════════════════ */
  function containsRoot(normalizedWord, rootLetters) {
    var pos = 0;
    for (var i = 0; i < rootLetters.length; i++) {
      var found = normalizedWord.indexOf(rootLetters[i], pos);
      if (found === -1) return false;
      if (i > 0 && (found - pos) > 2) return false;
      pos = found + 1;
    }
    return true;
  }

  function searchByRoot(verses, q) {
    var cleanRoot = normalizeArabic(q.replace(/[-\s\u200C\u200D]/g, ''));
    if (cleanRoot.length < 2 || cleanRoot.length > 5) return [];
    var rootLetters = Array.from(cleanRoot);
    var results = [];

    for (var i = 0; i < verses.length; i++) {
      var v = verses[i];
      var words = normalizeArabic(v.arabicText).split(/\s+/);
      var matched = false;
      for (var j = 0; j < words.length; j++) {
        var w = words[j];
        // Kelime uzunluk filtresi: prefix(3) + kök + suffix(3)
        if (w.length >= rootLetters.length && w.length <= rootLetters.length + 6) {
          if (containsRoot(w, rootLetters)) { matched = true; break; }
        }
      }
      if (matched) results.push(v);
    }
    return results;
  }

  function searchByText(verses, q, exact) {
    var arabic = isArabic(q);
    var results = [];

    if (arabic) {
      var normalizedQ = normalizeArabic(q);
      for (var i = 0; i < verses.length; i++) {
        var v = verses[i];
        var normText = normalizeArabic(v.arabicText);
        var match = false;
        if (exact) {
          var words = normText.split(/\s+/);
          for (var j = 0; j < words.length; j++) {
            if (words[j] === normalizedQ) { match = true; break; }
          }
        } else {
          match = normText.indexOf(normalizedQ) !== -1;
        }
        if (match) results.push(v);
      }
    } else {
      var qLower = q.toLowerCase();
      var exactRe = exact
        ? new RegExp('(^|[\\s,;:.!?])' + escapeRegex(q) + '($|[\\s,;:.!?])', 'i')
        : null;

      for (var i = 0; i < verses.length; i++) {
        var v = verses[i];
        var meal = v.turkishMeal || '';
        var translit = v.transliteration || '';
        var match = false;
        if (exact) {
          match = exactRe.test(meal) || exactRe.test(translit);
        } else {
          match = meal.toLowerCase().indexOf(qLower) !== -1 ||
                  translit.toLowerCase().indexOf(qLower) !== -1;
        }
        if (match) results.push(v);
      }
    }
    return results;
  }

  function computeSurahStats(results) {
    var surahMap = {};
    for (var i = 0; i < results.length; i++) {
      var v = results[i];
      if (!surahMap[v.surahNo]) {
        surahMap[v.surahNo] = {
          surahNo: v.surahNo,
          surahNameTr: v.surahNameTr,
          surahNameAr: v.surahNameAr,
          count: 0
        };
      }
      surahMap[v.surahNo].count++;
    }
    return Object.values(surahMap).sort(function (a, b) { return b.count - a.count; });
  }

  function computeCorrelation(results, query) {
    var wordFreq = {};
    var queryLower = query.toLowerCase();
    var sampleSize = Math.min(results.length, 500);

    for (var i = 0; i < sampleSize; i++) {
      var meal = results[i].turkishMeal || '';
      var words = meal.toLowerCase()
        .replace(/[.,;:!?"'()\[\]{}/\\-]/g, ' ')
        .split(/\s+/)
        .filter(function (w) { return w.length >= 3; });

      var uniqueWords = {};
      words.forEach(function (w) { uniqueWords[w] = true; });

      Object.keys(uniqueWords).forEach(function (word) {
        if (TR_STOP_WORDS.has(word) || word === queryLower) return;
        wordFreq[word] = (wordFreq[word] || 0) + 1;
      });
    }

    return Object.entries(wordFreq)
      .sort(function (a, b) { return b[1] - a[1]; })
      .slice(0, 30)
      .map(function (entry) {
        return {
          word: entry[0],
          count: entry[1],
          percentage: sampleSize > 0 ? Math.round((entry[1] / sampleSize) * 100) : 0
        };
      });
  }

  /* ══════════════════════════════════════════════════════════════
     BAŞLATMA
     ══════════════════════════════════════════════════════════════ */
  function init() {
    renderHero(false);
    // Veriyi arka planda önceden yükle
    loadVerses(function () {});
    document.addEventListener('click', function (e) {
      var suggestions = document.getElementById('suggestions');
      if (suggestions && !suggestions.contains(e.target)) {
        suggestions.classList.remove('active');
      }
    });
  }

  /* ══════════════════════════════════════════════════════════════
     HERO / ARAMA BÖLÜMÜ
     ══════════════════════════════════════════════════════════════ */
  function renderHero(compact) {
    var heroClass = compact ? 'ka-hero ka-hero--compact' : 'ka-hero';
    var textActive = currentMode === 'text' ? ' active' : '';
    var rootActive = currentMode === 'root' ? ' active' : '';

    var placeholder = currentMode === 'root'
      ? 'Bir kök girin… (Örn: \u0631\u062D\u0645, \u0639\u0644\u0645, \u0643\u062A\u0628)'
      : 'Bir kelime arayın… (Örn: furkan, rahmet, \u0631\u062D\u0645\u0629)';

    var exactChecked = exactMatch ? ' checked' : '';
    var exactToggleHtml = currentMode === 'text'
      ? '<label class="ka-exact-toggle" title="Sadece tam kelime eşleşmesi">' +
          '<input type="checkbox" id="exactToggle"' + exactChecked + '>' +
          '<span class="ka-exact-label">Tam Kelime</span>' +
        '</label>'
      : '';

    var html =
      '<section class="' + heroClass + '">' +
        '<h1 class="ka-title">Kur\'an Kök Analizi</h1>' +
        '<p class="ka-subtitle">Kök tarama, harekesiz Arapça arama ve korelasyon analizi</p>' +

        '<div class="ka-mode-toggle">' +
          '<button class="ka-mode-btn' + textActive + '" data-mode="text">' +
            '<span class="ka-mode-icon">🔍</span> Metin Arama' +
          '</button>' +
          '<button class="ka-mode-btn' + rootActive + '" data-mode="root">' +
            '<span class="ka-mode-icon">🌳</span> Kök Arama' +
          '</button>' +
        '</div>' +

        '<div class="ka-search-wrapper">' +
          '<div class="ka-search-box">' +
            '<input type="text" id="searchInput" class="ka-search-input" ' +
              'placeholder="' + placeholder + '" ' +
              'autocomplete="off" value="' + escapeHtml(currentQuery) + '" dir="auto">' +
            '<button class="ka-search-btn" id="searchBtn">Ara</button>' +
          '</div>' +
          exactToggleHtml +
          '<div class="ka-suggestions" id="suggestions"></div>' +
          '<div class="ka-search-hint" id="searchHint">' +
            (currentMode === 'root'
              ? 'Arapça kök harflerini girin (2–4 harf). Tüm çekim formları taranacaktır.'
              : 'Hareke (teşkil) duyarsız arama: Arapça metni harekesiz de arayabilirsiniz.') +
          '</div>' +
        '</div>' +

        ((!compact && currentMode === 'root')
          ? '<div class="ka-popular-roots">' +
              '<h3 class="ka-popular-title">Sık Kullanılan Kökler</h3>' +
              '<div class="ka-roots-grid">' +
                COMMON_ROOTS.slice(0, 15).map(function (r) {
                  return '<button class="ka-root-chip" data-root="' + r.root + '">' +
                    '<span class="ka-root-arabic">' + r.root + '</span>' +
                    '<span class="ka-root-meaning">' + r.meaning + '</span>' +
                  '</button>';
                }).join('') +
              '</div>' +
            '</div>'
          : '') +
      '</section>' +
      '<div id="statsPanel"></div>' +
      '<div id="correlationPanel"></div>' +
      '<div id="resultsInfo"></div>' +
      '<div class="ka-results" id="results"></div>';

    app.innerHTML = html;
    bindSearchEvents();
    bindModeToggle();
    bindRootChips();
    bindExactToggle();

    var input = document.getElementById('searchInput');
    if (input) input.focus();

    // Sonuçları koru (mod değişmeden compact render olduğunda)
    if (compact && _fullResults.length > 0) {
      renderStats();
      renderCorrelation();
      renderResults();
    }
  }

  /* ══════════════════════════════════════════════════════════════
     EVENT BINDING
     ══════════════════════════════════════════════════════════════ */
  function bindSearchEvents() {
    var input = document.getElementById('searchInput');
    var btn = document.getElementById('searchBtn');

    if (input) {
      input.addEventListener('input', function () {
        clearTimeout(debounceTimer);
        var q = input.value.trim();
        if (q.length < 2) { hideSuggestions(); return; }
        debounceTimer = setTimeout(function () {
          if (currentMode === 'root') {
            showRootSuggestions(q);
          } else {
            showLocalSuggestions(q);
          }
        }, 250);
      });

      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          hideSuggestions();
          doSearch(input.value.trim());
        }
      });
    }

    if (btn) {
      btn.addEventListener('click', function () {
        hideSuggestions();
        if (input) doSearch(input.value.trim());
      });
    }
  }

  function bindModeToggle() {
    var btns = document.querySelectorAll('.ka-mode-btn');
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener('click', function () {
        var newMode = this.getAttribute('data-mode');
        if (newMode !== currentMode) {
          currentMode = newMode;
          currentQuery = '';
          _fullResults = [];
          allResults = [];
          totalResults = 0;
          surahStatsData = null;
          correlationData = null;
          renderHero(false);
        }
      });
    }
  }

  function bindRootChips() {
    var chips = document.querySelectorAll('.ka-root-chip');
    for (var i = 0; i < chips.length; i++) {
      chips[i].addEventListener('click', function () {
        var root = this.getAttribute('data-root');
        var input = document.getElementById('searchInput');
        if (input) input.value = root;
        doSearch(root);
      });
    }
  }

  function bindExactToggle() {
    var toggle = document.getElementById('exactToggle');
    if (toggle) {
      toggle.addEventListener('change', function () {
        exactMatch = this.checked;
        var input = document.getElementById('searchInput');
        if (input && input.value.trim().length >= 2) {
          doSearch(input.value.trim());
        }
      });
    }
  }

  /* ══════════════════════════════════════════════════════════════
     ÖNERİLER (AUTOCOMPLETE)
     ══════════════════════════════════════════════════════════════ */
  function showLocalSuggestions(q) {
    if (!versesCache) { hideSuggestions(); return; }
    var results = searchByText(versesCache, q, false).slice(0, 5);
    if (results.length === 0) { hideSuggestions(); return; }

    var box = document.getElementById('suggestions');
    if (!box) return;

    var html = '';
    for (var i = 0; i < results.length; i++) {
      var v = results[i];
      var snippet = '';
      if (isArabic(q)) {
        snippet = getArabicSnippet(v.arabicText, q, 40);
      }
      if (!snippet) snippet = getSnippet(v.turkishMeal, q, 60);
      if (!snippet && v.transliteration) snippet = getSnippet(v.transliteration, q, 60);

      html +=
        '<div class="ka-suggestion-item">' +
          '<span class="ka-suggestion-ref">' +
            escapeHtml(v.surahNameTr) + ' ' + v.surahNo + ':' + v.ayahNo +
          '</span>' +
          '<span class="ka-suggestion-text">' +
            highlightText(snippet || v.turkishMeal.substring(0, 120), q) +
          '</span>' +
        '</div>';
    }

    box.innerHTML = html;
    box.classList.add('active');

    var items = box.querySelectorAll('.ka-suggestion-item');
    for (var j = 0; j < items.length; j++) {
      items[j].addEventListener('click', function () {
        var input = document.getElementById('searchInput');
        if (input) input.value = q;
        hideSuggestions();
        doSearch(q);
      });
    }
  }

  function showRootSuggestions(q) {
    var box = document.getElementById('suggestions');
    if (!box) return;

    var matching = COMMON_ROOTS.filter(function (r) {
      var normalQ = normalizeArabic(q);
      var normalRoot = normalizeArabic(r.root);
      return normalRoot.indexOf(normalQ) !== -1 ||
             r.meaning.toLowerCase().indexOf(q.toLowerCase()) !== -1 ||
             r.latin.indexOf(q.toLowerCase()) !== -1;
    }).slice(0, 6);

    if (matching.length === 0) { hideSuggestions(); return; }

    var html = '';
    for (var i = 0; i < matching.length; i++) {
      var r = matching[i];
      html +=
        '<div class="ka-suggestion-item ka-root-suggestion" data-root="' + r.root + '">' +
          '<span class="ka-suggestion-ref">' + r.root + ' (' + r.latin + ')</span>' +
          '<span class="ka-suggestion-text">' + escapeHtml(r.meaning) + '</span>' +
        '</div>';
    }

    box.innerHTML = html;
    box.classList.add('active');

    var items = box.querySelectorAll('.ka-root-suggestion');
    for (var j = 0; j < items.length; j++) {
      items[j].addEventListener('click', function () {
        var root = this.getAttribute('data-root');
        var input = document.getElementById('searchInput');
        if (input) input.value = root;
        hideSuggestions();
        doSearch(root);
      });
    }
  }

  function hideSuggestions() {
    var box = document.getElementById('suggestions');
    if (box) box.classList.remove('active');
  }

  /* ══════════════════════════════════════════════════════════════
     ANA ARAMA
     ══════════════════════════════════════════════════════════════ */
  function doSearch(q) {
    if (!q || q.length < 2) return;

    currentQuery = q;
    currentOffset = 0;
    _fullResults = [];
    allResults = [];
    totalResults = 0;
    surahStatsData = null;
    correlationData = null;

    renderHero(true);
    showLoading();

    loadVerses(function (err, verses) {
      if (err) {
        showError('Veri yüklenemedi: ' + err.message);
        return;
      }

      // Arama yap
      var matched = currentMode === 'root'
        ? searchByRoot(verses, q)
        : searchByText(verses, q, exactMatch);

      _fullResults = matched;
      totalResults = matched.length;
      currentOffset = Math.min(LIMIT, matched.length);
      allResults = matched.slice(0, currentOffset);

      // İstatistik ve korelasyon hesapla
      surahStatsData = computeSurahStats(matched);
      correlationData = computeCorrelation(matched, q);

      renderStats();
      renderCorrelation();
      renderResults();
    });
  }

  function loadMore() {
    var newOffset = Math.min(currentOffset + LIMIT, totalResults);
    allResults = _fullResults.slice(0, newOffset);
    currentOffset = newOffset;
    renderResults();
  }

  /* ══════════════════════════════════════════════════════════════
     İSTATİSTİK & GRAFİKLER
     ══════════════════════════════════════════════════════════════ */
  function renderStats() {
    var panel = document.getElementById('statsPanel');
    if (!panel || !surahStatsData || surahStatsData.length === 0) return;

    var top10 = surahStatsData.slice(0, 10);
    var totalOccurrences = totalResults;
    var surahCount = surahStatsData.length;
    var modeLabel = currentMode === 'root' ? 'Kök' : 'Kelime';

    panel.innerHTML =
      '<div class="ka-stats-panel">' +
        '<div class="ka-stats-summary">' +
          '<div class="ka-stat-card">' +
            '<div class="ka-stat-number">' + totalOccurrences + '</div>' +
            '<div class="ka-stat-label">Toplam Ayet</div>' +
          '</div>' +
          '<div class="ka-stat-card">' +
            '<div class="ka-stat-number">' + surahCount + '</div>' +
            '<div class="ka-stat-label">Farklı Sure</div>' +
          '</div>' +
          '<div class="ka-stat-card">' +
            '<div class="ka-stat-number">' + (totalOccurrences / 6236 * 100).toFixed(1) + '%</div>' +
            '<div class="ka-stat-label">Kur\'an Oranı</div>' +
          '</div>' +
        '</div>' +

        '<div class="ka-charts-grid">' +
          '<div class="ka-chart-container">' +
            '<h3 class="ka-chart-title">Sure Dağılım Grafiği (En Çok ' + modeLabel + ' Geçen Sureler)</h3>' +
            '<canvas id="surahChart" width="600" height="300"></canvas>' +
          '</div>' +
          '<div class="ka-chart-container">' +
            '<h3 class="ka-chart-title">Sure Sırasına Göre Dağılım</h3>' +
            '<canvas id="distributionChart" width="600" height="300"></canvas>' +
          '</div>' +
        '</div>' +

        '<div class="ka-heatmap-container">' +
          '<h3 class="ka-chart-title">Kur\'an Isı Haritası — Her Surede Kaç Ayet Eşleşiyor</h3>' +
          '<div class="ka-heatmap" id="heatmap"></div>' +
        '</div>' +
      '</div>';

    renderBarChart(top10);
    renderDistributionChart();
    renderHeatmap();
  }

  function renderBarChart(data) {
    var ctx = document.getElementById('surahChart');
    if (!ctx) return;
    if (chartInstance) chartInstance.destroy();

    var isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    var textColor = isDark ? '#E0DED5' : '#333333';
    var gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

    chartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.map(function (s) { return s.surahNameTr + ' (' + s.surahNo + ')'; }),
        datasets: [{
          label: 'Ayet Sayısı',
          data: data.map(function (s) { return s.count; }),
          backgroundColor: isDark ? 'rgba(143,188,139,0.6)' : 'rgba(107,155,107,0.6)',
          borderColor: isDark ? 'rgba(143,188,139,1)' : 'rgba(107,155,107,1)',
          borderWidth: 1,
          borderRadius: 4,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: isDark ? '#1C1F32' : '#fff',
            titleColor: textColor,
            bodyColor: textColor,
            borderColor: isDark ? '#2C2F45' : '#E8E3D0',
            borderWidth: 1,
          }
        },
        scales: {
          y: { beginAtZero: true, ticks: { color: textColor, stepSize: 1 }, grid: { color: gridColor } },
          x: { ticks: { color: textColor, maxRotation: 45 }, grid: { display: false } }
        }
      }
    });
  }

  function renderDistributionChart() {
    var ctx = document.getElementById('distributionChart');
    if (!ctx || !surahStatsData) return;

    var isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    var textColor = isDark ? '#E0DED5' : '#333333';
    var gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

    var surahCounts = new Array(114).fill(0);
    for (var i = 0; i < surahStatsData.length; i++) {
      surahCounts[surahStatsData[i].surahNo - 1] = surahStatsData[i].count;
    }

    new Chart(ctx, {
      type: 'line',
      data: {
        labels: surahCounts.map(function (_, i) { return (i + 1).toString(); }),
        datasets: [{
          label: 'Eşleşen Ayet',
          data: surahCounts,
          borderColor: isDark ? '#8FB8D4' : '#7BA7C2',
          backgroundColor: isDark ? 'rgba(143,184,212,0.1)' : 'rgba(123,167,194,0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          pointHoverRadius: 4,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: function (items) {
                var idx = items[0].dataIndex;
                var stat = surahStatsData.find(function (s) { return s.surahNo === idx + 1; });
                return stat ? stat.surahNameTr + ' (' + (idx + 1) + ')' : 'Sure ' + (idx + 1);
              }
            }
          }
        },
        scales: {
          y: { beginAtZero: true, ticks: { color: textColor }, grid: { color: gridColor } },
          x: {
            ticks: { color: textColor, maxTicksLimit: 20, callback: function (val) { return Number(val) + 1; } },
            grid: { display: false },
            title: { display: true, text: 'Sure No', color: textColor }
          }
        }
      }
    });
  }

  function renderHeatmap() {
    var container = document.getElementById('heatmap');
    if (!container || !surahStatsData) return;

    var surahMap = {};
    var maxCount = 0;
    for (var i = 0; i < surahStatsData.length; i++) {
      surahMap[surahStatsData[i].surahNo] = surahStatsData[i].count;
      if (surahStatsData[i].count > maxCount) maxCount = surahStatsData[i].count;
    }

    var html = '';
    for (var s = 1; s <= 114; s++) {
      var count = surahMap[s] || 0;
      var intensity = maxCount > 0 ? count / maxCount : 0;
      var title = s + '. sure: ' + count + ' ayet';
      html += '<div class="ka-heatmap-cell" style="opacity: ' + (0.15 + intensity * 0.85) +
        '; background: ' + (count > 0 ? 'var(--mod-green)' : 'var(--mod-border)') +
        ';" title="' + title + '"><span>' + s + '</span></div>';
    }
    container.innerHTML = html;
  }

  /* ══════════════════════════════════════════════════════════════
     KORELASYON
     ══════════════════════════════════════════════════════════════ */
  function renderCorrelation() {
    var panel = document.getElementById('correlationPanel');
    if (!panel || !correlationData || correlationData.length === 0) return;

    var top15 = correlationData.slice(0, 15);
    var maxCount = top15[0] ? top15[0].count : 1;

    var html =
      '<div class="ka-stats-panel">' +
        '<div class="ka-correlation-container">' +
          '<h3 class="ka-chart-title">Kelime Korelasyonu — "‎' + escapeHtml(currentQuery) + '‎" ile birlikte en çok geçen kelimeler</h3>' +
          '<p class="ka-correlation-desc">Aranan kelimenin geçtiği ayetlerde en sık kullanılan diğer kelimeler</p>' +
          '<div class="ka-correlation-grid">';

    for (var i = 0; i < top15.length; i++) {
      var item = top15[i];
      var barWidth = Math.max(5, Math.round((item.count / maxCount) * 100));
      html +=
        '<div class="ka-corr-row">' +
          '<span class="ka-corr-word">' + escapeHtml(item.word) + '</span>' +
          '<div class="ka-corr-bar-wrapper">' +
            '<div class="ka-corr-bar" style="width: ' + barWidth + '%"></div>' +
          '</div>' +
          '<span class="ka-corr-count">' + item.count + ' ayet (%' + item.percentage + ')</span>' +
        '</div>';
    }

    html += '</div>';

    if (correlationData.length > 15) {
      html += '<div class="ka-corr-chips">';
      for (var j = 15; j < correlationData.length; j++) {
        html += '<span class="ka-corr-chip">' +
          escapeHtml(correlationData[j].word) +
          ' <small>(' + correlationData[j].count + ')</small></span>';
      }
      html += '</div>';
    }

    html += '</div></div>';
    panel.innerHTML = html;
  }

  /* ══════════════════════════════════════════════════════════════
     SONUÇ RENDER
     ══════════════════════════════════════════════════════════════ */
  function showLoading() {
    var results = document.getElementById('results');
    if (results) {
      results.innerHTML =
        '<div class="ka-loading">' +
          '<div class="ka-spinner"></div>' +
          '<div>Aranıyor…</div>' +
        '</div>';
    }
  }

  function showError(msg) {
    var results = document.getElementById('results');
    if (results) results.innerHTML = '<div class="ka-error">' + escapeHtml(msg) + '</div>';
  }

  function renderResults() {
    var info = document.getElementById('resultsInfo');
    var container = document.getElementById('results');
    if (!container) return;

    var modeLabel = currentMode === 'root' ? 'Kök' : 'Metin';
    var exactLabel = (currentMode === 'text' && exactMatch) ? ' — Tam Kelime' : '';

    if (info) {
      info.innerHTML =
        '<div class="ka-results-info">' +
          '<strong>' + totalResults + '</strong> ayet bulundu' +
          (currentQuery ? ' — "' + escapeHtml(currentQuery) + '" (' + modeLabel + ' Arama' + exactLabel + ')' : '') +
        '</div>';
    }

    if (allResults.length === 0) {
      container.innerHTML =
        '<div class="ka-empty">' +
          '<h3>Sonuç bulunamadı</h3>' +
          '<p>"' + escapeHtml(currentQuery) + '" ile eşleşen ayet bulunamadı. ' +
          (currentMode === 'root'
            ? 'Farklı bir kök deneyin veya metin aramasına geçin.'
            : 'Farklı bir arama terimi deneyin veya kök aramasına geçin.') +
          '</p>' +
        '</div>';
      return;
    }

    var html = '';
    for (var i = 0; i < allResults.length; i++) {
      html += renderVerseCard(allResults[i], i);
    }

    if (allResults.length < totalResults) {
      html +=
        '<div class="ka-load-more-wrapper">' +
          '<button class="ka-load-more" id="loadMoreBtn">Daha fazla göster (' +
            allResults.length + '/' + totalResults +
          ')</button>' +
        '</div>';
    }

    container.innerHTML = html;

    var loadMoreBtn = document.getElementById('loadMoreBtn');
    if (loadMoreBtn) {
      loadMoreBtn.addEventListener('click', function () {
        loadMoreBtn.textContent = 'Yükleniyor…';
        loadMoreBtn.disabled = true;
        loadMore();
      });
    }
  }

  function renderVerseCard(verse, index) {
    var wbwId = 'wbw-' + verse.surahNo + '-' + verse.ayahNo;
    var highlightedArabic = (currentMode === 'root' || isArabic(currentQuery))
      ? highlightArabic(verse.arabicText, currentQuery)
      : escapeHtml(verse.arabicText);

    return (
      '<div class="ka-verse-card" style="animation-delay: ' + (index * 0.03) + 's">' +
        '<div class="ka-verse-ref">' +
          '<span class="ka-badge">' + verse.surahNo + ':' + verse.ayahNo + '</span>' +
          escapeHtml(verse.surahNameTr) +
          ' <span class="ka-surah-arabic">' + escapeHtml(verse.surahNameAr) + '</span>' +
        '</div>' +
        '<div class="ka-arabic-text" dir="rtl">' + highlightedArabic + '</div>' +
        '<div id="' + wbwId + '">' +
          '<button class="ka-wbw-toggle" onclick="window.__loadWBW(' +
            verse.surahNo + ',' + verse.ayahNo + ')">' +
            '▶ Kelime Kelime Göster' +
          '</button>' +
        '</div>' +
        (verse.transliteration
          ? '<div class="ka-transliteration">' + highlightText(verse.transliteration, currentQuery) + '</div>'
          : '') +
        '<div class="ka-turkish-meal">' + highlightText(verse.turkishMeal, currentQuery) + '</div>' +
      '</div>'
    );
  }

  /* ══════════════════════════════════════════════════════════════
     KELİME KELİME (Doğrudan quran.com API)
     ══════════════════════════════════════════════════════════════ */
  window.__loadWBW = function (surahNo, ayahNo) {
    var container = document.getElementById('wbw-' + surahNo + '-' + ayahNo);
    if (!container) return;

    container.innerHTML = '<div class="ka-wbw-loading">Kelime verileri yükleniyor…</div>';

    var verseKey = surahNo + ':' + ayahNo;
    var makeUrl = function (lang) {
      return QURAN_WBW_API + '/verses/by_key/' + verseKey +
        '?words=true&word_translation_language=' + lang + '&word_fields=text_uthmani';
    };

    Promise.all([
      fetch(makeUrl('tr'), { headers: { 'User-Agent': 'KuranAnaliz/3.0' } }).then(function (r) { return r.json(); }),
      fetch(makeUrl('en'), { headers: { 'User-Agent': 'KuranAnaliz/3.0' } }).then(function (r) { return r.json(); })
    ]).then(function (responses) {
      var trData = responses[0];
      var enData = responses[1];

      var trWords = (trData.verse && trData.verse.words) ? trData.verse.words : [];
      var enWords = (enData.verse && enData.verse.words) ? enData.verse.words : [];

      var enMap = {};
      enWords.forEach(function (w) { enMap[w.position] = w; });

      var words = trWords
        .filter(function (w) { return w.char_type_name === 'word'; })
        .map(function (w) {
          return {
            arabic: w.text_uthmani || w.text,
            turkish_meaning: (w.translation && w.translation.text) ? w.translation.text : '',
            english_meaning: enMap[w.position] ? ((enMap[w.position].translation || {}).text || '') : '',
            transliteration: (w.transliteration && w.transliteration.text) ? w.transliteration.text : '',
          };
        });

      if (words.length === 0) {
        container.innerHTML = '<div class="ka-wbw-loading">Kelime verisi bulunamadı.</div>';
        return;
      }

      var html = '<div class="ka-words-grid">';
      for (var i = 0; i < words.length; i++) {
        var w = words[i];
        html +=
          '<div class="ka-word-item">' +
            '<span class="ka-word-arabic">' + escapeHtml(w.arabic) + '</span>' +
            (w.transliteration ? '<span class="ka-word-translit">' + escapeHtml(w.transliteration) + '</span>' : '') +
            '<span class="ka-word-meaning-tr">' + escapeHtml(w.turkish_meaning || '—') + '</span>' +
            '<span class="ka-word-meaning-en">' + escapeHtml(w.english_meaning || '') + '</span>' +
          '</div>';
      }
      html += '</div>';
      container.innerHTML = html;
    }).catch(function () {
      container.innerHTML = '<div class="ka-wbw-loading">Kelime verisi yüklenemedi. İnternet bağlantınızı kontrol edin.</div>';
    });
  };

  /* ══════════════════════════════════════════════════════════════
     YARDIMCI FONKSİYONLAR
     ══════════════════════════════════════════════════════════════ */
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function highlightText(text, query) {
    if (!query || !text) return escapeHtml(text);
    var safe = escapeHtml(text);
    var escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    var regex = new RegExp('(' + escaped + ')', 'gi');
    return safe.replace(regex, '<span class="ka-highlight-match">$1</span>');
  }

  function highlightArabic(text, query) {
    if (!query || !text) return escapeHtml(text);

    if (currentMode === 'root') {
      var cleanRoot = normalizeArabic(query.replace(/[-\s\u200C\u200D]/g, ''));
      var rootLetters = Array.from(cleanRoot);
      return highlightRootInArabic(text, rootLetters);
    }

    var normalizedText = normalizeArabic(text);
    var normalizedQuery = normalizeArabic(query);
    var safe = escapeHtml(text);
    var idx = normalizedText.indexOf(normalizedQuery);
    if (idx === -1) return safe;

    var origPositions = mapNormalizedPositions(text);
    var start = origPositions[idx] || 0;
    var end = origPositions[idx + normalizedQuery.length] || text.length;

    return escapeHtml(text.substring(0, start)) +
      '<span class="ka-highlight-match">' + escapeHtml(text.substring(start, end)) + '</span>' +
      escapeHtml(text.substring(end));
  }

  function highlightRootInArabic(text, rootLetters) {
    var parts = text.split(/(\s+)/);
    var result = '';
    for (var i = 0; i < parts.length; i++) {
      var part = parts[i];
      if (/^\s+$/.test(part)) { result += part; continue; }
      var normWord = normalizeArabic(part);
      if (normWord.length >= rootLetters.length && containsRoot(normWord, rootLetters)) {
        result += '<span class="ka-highlight-root">' + escapeHtml(part) + '</span>';
      } else {
        result += escapeHtml(part);
      }
    }
    return result;
  }

  function mapNormalizedPositions(text) {
    var map = [];
    var normalIdx = 0;
    for (var i = 0; i < text.length; i++) {
      var normalized = normalizeArabic(text[i]);
      if (normalized.length > 0) { map[normalIdx] = i; normalIdx++; }
    }
    map[normalIdx] = text.length;
    return map;
  }

  function getSnippet(text, query, radius) {
    if (!text) return '';
    var lower = text.toLowerCase();
    var qLower = query.toLowerCase();
    var idx = lower.indexOf(qLower);
    if (idx === -1) return '';
    var start = Math.max(0, idx - radius);
    var end = Math.min(text.length, idx + query.length + radius);
    var snippet = '';
    if (start > 0) snippet += '…';
    snippet += text.substring(start, end);
    if (end < text.length) snippet += '…';
    return snippet;
  }

  function getArabicSnippet(text, query, radius) {
    if (!text) return '';
    var normalText = normalizeArabic(text);
    var normalQuery = normalizeArabic(query);
    var idx = normalText.indexOf(normalQuery);
    if (idx === -1) return '';
    var origMap = mapNormalizedPositions(text);
    var start = origMap[Math.max(0, idx - radius)] || 0;
    var end = origMap[Math.min(normalText.length, idx + normalQuery.length + radius)] || text.length;
    var snippet = '';
    if (start > 0) snippet += '…';
    snippet += text.substring(start, end);
    if (end < text.length) snippet += '…';
    return snippet;
  }

  /* ── Başlat ── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

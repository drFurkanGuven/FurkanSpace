/* ── Kitap Kulübü SPA ── */
(function () {
  "use strict";

  const API = "/api";
  let currentUser = null;
  let currentPage = "dashboard";

  // ── Helpers ──
  function getToken() {
    return localStorage.getItem("kk_token");
  }
  function setToken(token) {
    localStorage.setItem("kk_token", token);
  }
  function clearToken() {
    localStorage.removeItem("kk_token");
  }

  async function api(path, options = {}) {
    const token = getToken();
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = "Bearer " + token;
    const res = await fetch(API + path, { ...options, headers });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Bir hata oluştu.");
    return data;
  }

  function $(sel) {
    return document.querySelector(sel);
  }
  function html(el, content) {
    if (typeof el === "string") el = $(el);
    if (el) el.innerHTML = content;
  }
  function show(el) {
    if (typeof el === "string") el = $(el);
    if (el) el.style.display = "";
  }
  function hide(el) {
    if (typeof el === "string") el = $(el);
    if (el) el.style.display = "none";
  }

  function escapeHtml(str) {
    if (!str) return "";
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function percentStr(current, total) {
    if (!total) return "0";
    return Math.min(100, Math.round((current / total) * 100));
  }

  // ── Auth State ──
  async function checkAuth() {
    const token = getToken();
    if (!token) {
      currentUser = null;
      return;
    }
    try {
      const data = await api("/auth/me", { method: "GET" });
      currentUser = data.user;
    } catch {
      currentUser = null;
      clearToken();
    }
  }

  function renderAuthArea() {
    const area = $("#authArea");
    if (!area) return;
    if (currentUser) {
      area.innerHTML =
        '<span class="kk-user-name">' +
        escapeHtml(currentUser.name) +
        "</span>" +
        '<button class="kk-btn-logout" id="logoutBtn">Çıkış</button>';
      $("#logoutBtn").addEventListener("click", logout);
    } else {
      area.innerHTML = "";
    }
  }

  function logout() {
    clearToken();
    currentUser = null;
    renderAuthArea();
    navigate("login");
  }

  // ── Routing ──
  function navigate(page, param) {
    currentPage = page;
    // Update nav active state
    document.querySelectorAll(".kk-nav a[data-page]").forEach(function (a) {
      a.classList.toggle("active", a.dataset.page === page);
    });
    renderPage(page, param);
  }

  function renderPage(page, param) {
    if (!currentUser && page !== "login" && page !== "register") {
      renderLoginPage();
      return;
    }
    switch (page) {
      case "login":
        renderLoginPage();
        break;
      case "register":
        renderRegisterPage();
        break;
      case "dashboard":
        renderDashboard();
        break;
      case "etkinlik":
        renderEventForm();
        break;
      case "takip":
        renderTracking();
        break;
      case "event-detail":
        renderEventDetail(param);
        break;
      default:
        renderDashboard();
    }
  }

  // ── Login Page ──
  function renderLoginPage() {
    html(
      "#appContent",
      '<div class="kk-auth-page">' +
        '<div class="kk-auth-card">' +
        "<h1>Hoş Geldiniz</h1>" +
        '<p class="kk-subtitle">Kitap Kulübüne giriş yapın</p>' +
        '<div class="kk-error" id="loginError"></div>' +
        '<form id="loginForm">' +
        '<div class="kk-form-group">' +
        '<label for="loginEmail">E-posta</label>' +
        '<input type="email" id="loginEmail" class="kk-input" placeholder="ornek@mail.com" required />' +
        "</div>" +
        '<div class="kk-form-group">' +
        '<label for="loginPassword">Şifre</label>' +
        '<input type="password" id="loginPassword" class="kk-input" placeholder="Şifreniz" required />' +
        "</div>" +
        '<button type="submit" class="kk-btn" id="loginBtn">Giriş Yap</button>' +
        "</form>" +
        '<div class="kk-auth-switch">' +
        'Hesabınız yok mu? <a href="#" id="goRegister">Kayıt olun</a>' +
        "</div>" +
        "</div>" +
        "</div>"
    );
    $("#loginForm").addEventListener("submit", handleLogin);
    $("#goRegister").addEventListener("click", function (e) {
      e.preventDefault();
      navigate("register");
    });
  }

  async function handleLogin(e) {
    e.preventDefault();
    var errorEl = $("#loginError");
    hide(errorEl);
    var btn = $("#loginBtn");
    btn.disabled = true;
    btn.textContent = "Giriş yapılıyor...";
    try {
      var data = await api("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: $("#loginEmail").value.trim(),
          password: $("#loginPassword").value,
        }),
      });
      setToken(data.token);
      currentUser = data.user;
      renderAuthArea();
      navigate("dashboard");
    } catch (err) {
      errorEl.textContent = err.message;
      show(errorEl);
      btn.disabled = false;
      btn.textContent = "Giriş Yap";
    }
  }

  // ── Register Page ──
  function renderRegisterPage() {
    html(
      "#appContent",
      '<div class="kk-auth-page">' +
        '<div class="kk-auth-card">' +
        "<h1>Kayıt Ol</h1>" +
        '<p class="kk-subtitle">Kitap Kulübüne katılın</p>' +
        '<div class="kk-error" id="regError"></div>' +
        '<form id="regForm">' +
        '<div class="kk-form-group">' +
        '<label for="regName">Ad Soyad</label>' +
        '<input type="text" id="regName" class="kk-input" placeholder="Adınız Soyadınız" required />' +
        "</div>" +
        '<div class="kk-form-group">' +
        '<label for="regEmail">E-posta</label>' +
        '<input type="email" id="regEmail" class="kk-input" placeholder="ornek@mail.com" required />' +
        "</div>" +
        '<div class="kk-form-group">' +
        '<label for="regPassword">Şifre</label>' +
        '<input type="password" id="regPassword" class="kk-input" placeholder="En az 6 karakter" required minlength="6" />' +
        "</div>" +
        '<button type="submit" class="kk-btn" id="regBtn">Kayıt Ol</button>' +
        "</form>" +
        '<div class="kk-auth-switch">' +
        'Zaten hesabınız var mı? <a href="#" id="goLogin">Giriş yapın</a>' +
        "</div>" +
        "</div>" +
        "</div>"
    );
    $("#regForm").addEventListener("submit", handleRegister);
    $("#goLogin").addEventListener("click", function (e) {
      e.preventDefault();
      navigate("login");
    });
  }

  async function handleRegister(e) {
    e.preventDefault();
    var errorEl = $("#regError");
    hide(errorEl);
    var btn = $("#regBtn");
    btn.disabled = true;
    btn.textContent = "Kayıt yapılıyor...";
    try {
      var data = await api("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          name: $("#regName").value.trim(),
          email: $("#regEmail").value.trim(),
          password: $("#regPassword").value,
        }),
      });
      setToken(data.token);
      currentUser = data.user;
      renderAuthArea();
      navigate("dashboard");
    } catch (err) {
      errorEl.textContent = err.message;
      show(errorEl);
      btn.disabled = false;
      btn.textContent = "Kayıt Ol";
    }
  }

  // ── Dashboard ──
  async function renderDashboard() {
    html(
      "#appContent",
      '<h1 class="kk-page-title">Kitap Kulübü Paneli</h1>' +
        '<p class="kk-page-subtitle">Aktif okuma etkinlikleri ve üye ilerleme durumları</p>' +
        '<div id="eventsList" class="kk-events-grid"><div class="kk-loading">Etkinlikler yükleniyor...</div></div>'
    );
    try {
      var data = await api("/events", { method: "GET" });
      var events = data.events;
      if (!events || events.length === 0) {
        html(
          "#eventsList",
          '<div class="kk-empty">' +
            '<span class="kk-empty-icon">&#128218;</span>' +
            "<h3>Henüz bir etkinlik yok</h3>" +
            "<p>İlk okuma etkinliğini oluşturarak başlayın.</p>" +
            "</div>"
        );
        return;
      }
      var cardsHtml = "";
      events.forEach(function (ev) {
        cardsHtml += buildEventCard(ev);
      });
      html("#eventsList", cardsHtml);

      // Add click handlers for detail links
      document.querySelectorAll("[data-event-id]").forEach(function (el) {
        el.addEventListener("click", function (e) {
          e.preventDefault();
          navigate("event-detail", el.dataset.eventId);
        });
      });
    } catch (err) {
      html(
        "#eventsList",
        '<div class="kk-error" style="display:block">' + escapeHtml(err.message) + "</div>"
      );
    }
  }

  function buildEventCard(ev) {
    var detailsHtml = "";

    if (ev.selectedVerse) {
      detailsHtml +=
        '<div class="kk-verse-box"><span class="kk-verse-label">Ayet-i Kerime</span>' +
        escapeHtml(ev.selectedVerse) +
        "</div>";
    }
    if (ev.selectedHadith) {
      detailsHtml +=
        '<div class="kk-verse-box"><span class="kk-verse-label">Hadis-i Şerif</span>' +
        escapeHtml(ev.selectedHadith) +
        "</div>";
    }

    var metaHtml = "";
    if (ev.duration)
      metaHtml +=
        "<span>&#128197; " + escapeHtml(ev.duration) + "</span>";
    if (ev.location)
      metaHtml +=
        "<span>&#128205; " + escapeHtml(ev.location) + "</span>";
    metaHtml +=
      "<span>&#128214; " + ev.totalPages + " sayfa</span>";

    var progressHtml = "";
    if (ev.progress && ev.progress.length > 0) {
      progressHtml = '<div class="kk-progress-section"><h4>Üye İlerlemeleri</h4>';
      ev.progress.forEach(function (p) {
        var pct = percentStr(p.currentPage, ev.totalPages);
        progressHtml +=
          '<div class="kk-progress-item">' +
          '<div class="kk-progress-info">' +
          '<span class="kk-progress-name">' +
          escapeHtml(p.user.name) +
          "</span>" +
          '<span class="kk-progress-pages">' +
          p.currentPage +
          " / " +
          ev.totalPages +
          "</span>" +
          "</div>" +
          '<div class="kk-progress-bar-bg">' +
          '<div class="kk-progress-bar-fill" style="width:' +
          pct +
          '%"></div>' +
          "</div>" +
          '<div class="kk-progress-percent">%' +
          pct +
          "</div>" +
          "</div>";
      });
      progressHtml += "</div>";
    } else {
      progressHtml =
        '<div class="kk-progress-section"><p class="kk-no-progress">Henüz ilerleme kaydedilmemiş.</p></div>';
    }

    return (
      '<div class="kk-event-card">' +
      '<div class="kk-event-header">' +
      '<h3 class="kk-event-title">' +
      escapeHtml(ev.bookName) +
      "</h3>" +
      '<div class="kk-event-meta">' +
      metaHtml +
      "</div>" +
      "</div>" +
      (ev.creator
        ? '<div style="font-size:0.85rem;color:var(--kk-text-muted);margin-bottom:0.8rem;">Oluşturan: <strong>' +
          escapeHtml(ev.creator.name) +
          "</strong></div>"
        : "") +
      detailsHtml +
      progressHtml +
      '<div style="margin-top:1rem;text-align:right;">' +
      '<a href="#" data-event-id="' +
      ev.id +
      '" class="kk-btn kk-btn-secondary kk-btn-small">Detay &amp; Katıl</a>' +
      "</div>" +
      "</div>"
    );
  }

  // ── Event Detail ──
  async function renderEventDetail(eventId) {
    html(
      "#appContent",
      '<a href="#" class="kk-back" id="backBtn">&#8592; Panele Dön</a>' +
        '<div id="eventDetail" class="kk-loading">Yükleniyor...</div>'
    );
    $("#backBtn").addEventListener("click", function (e) {
      e.preventDefault();
      navigate("dashboard");
    });

    try {
      console.log("Event ID:", eventId, "Type:", typeof eventId);
      var data = await api("/event-detail?id=" + String(eventId), { method: "GET" });
      var ev = data.event;

      var detailsHtml =
        '<div class="kk-event-details">' +
        '<div class="kk-detail-item"><span class="kk-detail-label">Toplam Sayfa</span><span class="kk-detail-value">' +
        ev.totalPages +
        "</span></div>" +
        '<div class="kk-detail-item"><span class="kk-detail-label">Oluşturan</span><span class="kk-detail-value">' +
        escapeHtml(ev.creator.name) +
        "</span></div>" +
        (ev.duration
          ? '<div class="kk-detail-item"><span class="kk-detail-label">Süre / Bitiş</span><span class="kk-detail-value">' +
            escapeHtml(ev.duration) +
            "</span></div>"
          : "") +
        (ev.location
          ? '<div class="kk-detail-item"><span class="kk-detail-label">Mekan</span><span class="kk-detail-value">' +
            escapeHtml(ev.location) +
            "</span></div>"
          : "") +
        "</div>";

      var verseHtml = "";
      if (ev.selectedVerse) {
        verseHtml +=
          '<div class="kk-verse-box"><span class="kk-verse-label">Ayet-i Kerime</span>' +
          escapeHtml(ev.selectedVerse) +
          "</div>";
      }
      if (ev.selectedHadith) {
        verseHtml +=
          '<div class="kk-verse-box"><span class="kk-verse-label">Hadis-i Şerif</span>' +
          escapeHtml(ev.selectedHadith) +
          "</div>";
      }

      // Find current user's progress
      var myProgress = null;
      if (ev.progress) {
        ev.progress.forEach(function (p) {
          if (p.user.id === currentUser.id) myProgress = p;
        });
      }

      var myProgressHtml =
        '<div class="kk-tracking-card">' +
        '<h4 style="margin-bottom:1rem;">İlerlemenizi Güncelleyin</h4>' +
        '<div class="kk-error" id="progressError" style="display:none"></div>' +
        '<div class="kk-success-msg" id="progressSuccess" style="display:none"></div>' +
        '<div class="kk-page-input-row">' +
        '<div class="kk-form-group">' +
        '<label for="myPage">Kaldığınız Sayfa</label>' +
        '<input type="number" id="myPage" class="kk-input" min="0" max="' +
        ev.totalPages +
        '" value="' +
        (myProgress ? myProgress.currentPage : 0) +
        '" />' +
        "</div>" +
        '<button class="kk-btn kk-btn-small" id="updateProgressBtn">Güncelle</button>' +
        "</div>" +
        '<div class="kk-form-group">' +
        '<label for="myNotes">Notlar / Yorumlar</label>' +
        '<textarea id="myNotes" class="kk-input" placeholder="Kitaba dair notlarınız, Osmanlıca/Modern Türkçe yorumlarınız...">' +
        escapeHtml(myProgress ? myProgress.notes || "" : "") +
        "</textarea>" +
        "</div>" +
        "</div>";

      // All progress bars
      var allProgressHtml = '<div class="kk-progress-section"><h4>Tüm Üye İlerlemeleri</h4>';
      if (ev.progress && ev.progress.length > 0) {
        ev.progress.forEach(function (p) {
          var pct = percentStr(p.currentPage, ev.totalPages);
          allProgressHtml +=
            '<div class="kk-progress-item">' +
            '<div class="kk-progress-info">' +
            '<span class="kk-progress-name">' +
            escapeHtml(p.user.name) +
            (p.user.id === currentUser.id ? " (Siz)" : "") +
            "</span>" +
            '<span class="kk-progress-pages">' +
            p.currentPage +
            " / " +
            ev.totalPages +
            "</span>" +
            "</div>" +
            '<div class="kk-progress-bar-bg">' +
            '<div class="kk-progress-bar-fill" style="width:' +
            pct +
            '%"></div>' +
            "</div>" +
            '<div class="kk-progress-percent">%' +
            pct +
            "</div>" +
            "</div>";
        });
      } else {
        allProgressHtml += '<p class="kk-no-progress">Henüz ilerleme yok.</p>';
      }
      allProgressHtml += "</div>";

      html(
        "#eventDetail",
        '<h1 class="kk-page-title">' +
          escapeHtml(ev.bookName) +
          "</h1>" +
          detailsHtml +
          verseHtml +
          myProgressHtml +
          allProgressHtml
      );

      // Bind update button
      $("#updateProgressBtn").addEventListener("click", function () {
        updateProgress(eventId, ev.totalPages);
      });
    } catch (err) {
      html(
        "#eventDetail",
        '<div class="kk-error" style="display:block">' + escapeHtml(err.message) + "</div>"
      );
    }
  }

  async function updateProgress(eventId, totalPages) {
    var btn = $("#updateProgressBtn");
    var errorEl = $("#progressError");
    var successEl = $("#progressSuccess");
    hide(errorEl);
    hide(successEl);
    btn.disabled = true;
    btn.textContent = "Güncelleniyor...";

    var page = parseInt($("#myPage").value, 10);
    var notes = $("#myNotes").value;

    if (isNaN(page) || page < 0) {
      errorEl.textContent = "Geçerli bir sayfa numarası girin.";
      show(errorEl);
      btn.disabled = false;
      btn.textContent = "Güncelle";
      return;
    }

    try {
      await api("/progress", {
        method: "POST",
        body: JSON.stringify({ eventId: eventId, currentPage: page, notes: notes }),
      });
      successEl.textContent = "İlerleme güncellendi!";
      show(successEl);
      btn.disabled = false;
      btn.textContent = "Güncelle";
      // Refresh detail after short delay
      setTimeout(function () {
        renderEventDetail(eventId);
      }, 800);
    } catch (err) {
      errorEl.textContent = err.message;
      show(errorEl);
      btn.disabled = false;
      btn.textContent = "Güncelle";
    }
  }

  // ── Create Event Form ──
  function renderEventForm() {
    html(
      "#appContent",
      '<h1 class="kk-page-title">Yeni Okuma Etkinliği</h1>' +
        '<p class="kk-page-subtitle">Kitap bilgilerini ve detaylarını girin</p>' +
        '<div class="kk-form-card">' +
        '<div class="kk-error" id="eventError" style="display:none"></div>' +
        '<div class="kk-success-msg" id="eventSuccess" style="display:none"></div>' +
        '<form id="eventForm">' +
        '<div class="kk-form-group">' +
        '<label for="bookName">Kitap Adı *</label>' +
        '<input type="text" id="bookName" class="kk-input" placeholder="Kitabın tam adını yazın" required />' +
        "</div>" +
        '<div class="kk-form-row">' +
        '<div class="kk-form-group">' +
        '<label for="totalPages">Toplam Sayfa *</label>' +
        '<input type="number" id="totalPages" class="kk-input" placeholder="Sayfa sayısı" min="1" required />' +
        "</div>" +
        '<div class="kk-form-group">' +
        '<label for="duration">Süre / Bitiş Tarihi</label>' +
        '<input type="text" id="duration" class="kk-input" placeholder="Ör: 30 gün veya 15 Nisan 2026" />' +
        "</div>" +
        "</div>" +
        '<div class="kk-form-group">' +
        '<label for="location">Mekan</label>' +
        '<input type="text" id="location" class="kk-input" placeholder="Ör: Online / Kütüphane" />' +
        "</div>" +
        '<hr class="kk-divider" />' +
        '<div class="kk-form-group">' +
        '<label for="selectedVerse">Ayet-i Kerime</label>' +
        '<textarea id="selectedVerse" class="kk-input" placeholder="Bu etkinlik için seçilen ayet..." rows="3"></textarea>' +
        "</div>" +
        '<div class="kk-form-group">' +
        '<label for="selectedHadith">Hadis-i Şerif</label>' +
        '<textarea id="selectedHadith" class="kk-input" placeholder="Bu etkinlik için seçilen hadis..." rows="3"></textarea>' +
        "</div>" +
        '<button type="submit" class="kk-btn" id="createEventBtn">Etkinlik Oluştur</button>' +
        "</form>" +
        "</div>"
    );
    $("#eventForm").addEventListener("submit", handleCreateEvent);
  }

  async function handleCreateEvent(e) {
    e.preventDefault();
    var errorEl = $("#eventError");
    var successEl = $("#eventSuccess");
    hide(errorEl);
    hide(successEl);
    var btn = $("#createEventBtn");
    btn.disabled = true;
    btn.textContent = "Oluşturuluyor...";

    try {
      await api("/events", {
        method: "POST",
        body: JSON.stringify({
          bookName: $("#bookName").value.trim(),
          totalPages: parseInt($("#totalPages").value, 10),
          duration: $("#duration").value.trim() || null,
          location: $("#location").value.trim() || null,
          selectedVerse: $("#selectedVerse").value.trim() || null,
          selectedHadith: $("#selectedHadith").value.trim() || null,
        }),
      });
      successEl.textContent = "Etkinlik başarıyla oluşturuldu! Panele yönlendiriliyorsunuz...";
      show(successEl);
      setTimeout(function () {
        navigate("dashboard");
      }, 1200);
    } catch (err) {
      errorEl.textContent = err.message;
      show(errorEl);
      btn.disabled = false;
      btn.textContent = "Etkinlik Oluştur";
    }
  }

  // ── Personal Tracking ──
  async function renderTracking() {
    html(
      "#appContent",
      '<h1 class="kk-page-title">Kişisel Takibim</h1>' +
        '<p class="kk-page-subtitle">Katıldığınız etkinliklerdeki ilerlemeniz</p>' +
        '<div id="trackingList"><div class="kk-loading">Yükleniyor...</div></div>'
    );

    try {
      var data = await api("/events", { method: "GET" });
      var events = data.events;

      // Filter events where current user has progress
      var myEvents = [];
      events.forEach(function (ev) {
        var myP = null;
        if (ev.progress) {
          ev.progress.forEach(function (p) {
            if (p.user.id === currentUser.id) myP = p;
          });
        }
        if (myP) {
          myEvents.push({ event: ev, progress: myP });
        }
      });

      if (myEvents.length === 0) {
        html(
          "#trackingList",
          '<div class="kk-empty">' +
            '<span class="kk-empty-icon">&#128221;</span>' +
            "<h3>Henüz bir etkinliğe katılmadınız</h3>" +
            "<p>Paneldeki etkinliklere katılarak ilerlemenizi takip edebilirsiniz.</p>" +
            "</div>"
        );
        return;
      }

      var cardsHtml = "";
      myEvents.forEach(function (item) {
        var ev = item.event;
        var p = item.progress;
        var pct = percentStr(p.currentPage, ev.totalPages);
        cardsHtml +=
          '<div class="kk-tracking-card">' +
          '<div class="kk-tracking-header">' +
          '<h3 class="kk-tracking-title">' +
          escapeHtml(ev.bookName) +
          "</h3>" +
          '<span class="kk-tracking-badge">%' +
          pct +
          " tamamlandı</span>" +
          "</div>" +
          '<div class="kk-progress-item">' +
          '<div class="kk-progress-info">' +
          '<span class="kk-progress-name">İlerlemeniz</span>' +
          '<span class="kk-progress-pages">' +
          p.currentPage +
          " / " +
          ev.totalPages +
          " sayfa</span>" +
          "</div>" +
          '<div class="kk-progress-bar-bg">' +
          '<div class="kk-progress-bar-fill" style="width:' +
          pct +
          '%"></div>' +
          "</div>" +
          "</div>" +
          (p.notes
            ? '<div style="margin-top:1rem;"><strong style="font-size:0.85rem;color:var(--kk-text-muted);">Notlarınız:</strong>' +
              '<div class="kk-notes-display">' +
              escapeHtml(p.notes) +
              "</div></div>"
            : "") +
          '<div style="margin-top:1rem;">' +
          '<a href="#" data-track-event="' +
          ev.id +
          '" class="kk-btn kk-btn-secondary kk-btn-small">Güncelle</a>' +
          "</div>" +
          "</div>";
      });

      html("#trackingList", cardsHtml);

      document.querySelectorAll("[data-track-event]").forEach(function (el) {
        el.addEventListener("click", function (e) {
          e.preventDefault();
          navigate("event-detail", el.dataset.trackEvent);
        });
      });
    } catch (err) {
      html(
        "#trackingList",
        '<div class="kk-error" style="display:block">' + escapeHtml(err.message) + "</div>"
      );
    }
  }

  // ── Init ──
  async function init() {
    await checkAuth();
    renderAuthArea();

    // Handle nav clicks
    document.querySelectorAll(".kk-nav a[data-page]").forEach(function (a) {
      a.addEventListener("click", function (e) {
        e.preventDefault();
        navigate(a.dataset.page);
      });
    });

    // Determine initial page from hash
    var hash = window.location.hash.replace("#", "");
    if (hash && ["dashboard", "etkinlik", "takip", "login", "register"].indexOf(hash) >= 0) {
      navigate(hash);
    } else if (currentUser) {
      navigate("dashboard");
    } else {
      navigate("login");
    }
  }

  // Handle hash changes
  window.addEventListener("hashchange", function () {
    var hash = window.location.hash.replace("#", "");
    if (hash && ["dashboard", "etkinlik", "takip"].indexOf(hash) >= 0) {
      navigate(hash);
    }
  });

  init();
})();

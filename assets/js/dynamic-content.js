/* ═══════════════════════════════════════════════════════
   AMOURA FLORALS — dynamic-content.js
   Progressive enhancement for FAQs and testimonials.
   Replaces hardcoded content with admin-managed values
   from /api/faqs, /api/testimonials when available.
═══════════════════════════════════════════════════════ */

(function () {

  /* ── FAQ list ────────────────────────────────────────── */
  function hydrateFaqs() {
    var list = document.querySelector('.faq-list');
    if (!list) return;

    fetch('/api/faqs')
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        var faqs = data && Array.isArray(data.faqs) ? data.faqs : [];
        if (faqs.length === 0) return;

        var fragment = document.createDocumentFragment();
        faqs.forEach(function (faq) {
          fragment.appendChild(buildFaqItem(faq));
        });
        list.innerHTML = '';
        list.appendChild(fragment);

        attachRevealObserver(list.querySelectorAll('[data-reveal]'));
        wireFaqAccordions(list);
      })
      .catch(function (err) {
        console.warn('[dynamic-content] FAQ load failed; keeping static fallback.', err);
      });
  }

  function buildFaqItem(faq) {
    var item = document.createElement('div');
    item.className = 'faq-item';
    item.setAttribute('data-reveal', '');

    var btn = document.createElement('button');
    btn.className = 'faq-question';
    btn.setAttribute('aria-expanded', 'false');

    var label = document.createElement('span');
    label.textContent = faq.question;

    var icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('class', 'faq-icon');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('fill', 'none');
    icon.setAttribute('stroke', 'currentColor');
    icon.setAttribute('stroke-width', '1.5');
    var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M6 9l6 6 6-6');
    icon.appendChild(path);

    btn.appendChild(label);
    btn.appendChild(icon);

    var answer = document.createElement('div');
    answer.className = 'faq-answer';
    var p = document.createElement('p');
    p.textContent = faq.answer;
    answer.appendChild(p);

    item.appendChild(btn);
    item.appendChild(answer);
    return item;
  }

  function wireFaqAccordions(scope) {
    scope.querySelectorAll('.faq-question').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var expanded = btn.getAttribute('aria-expanded') === 'true';
        scope.querySelectorAll('.faq-question').forEach(function (b) {
          b.setAttribute('aria-expanded', 'false');
          if (b.nextElementSibling) b.nextElementSibling.classList.remove('open');
        });
        if (!expanded) {
          btn.setAttribute('aria-expanded', 'true');
          if (btn.nextElementSibling) btn.nextElementSibling.classList.add('open');
        }
      });
    });
  }

  /* ── Testimonials carousel ───────────────────────────── */
  function hydrateTestimonials() {
    var track = document.querySelector('.testimonials-track');
    if (!track) return;

    fetch('/api/testimonials')
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        var items = data && Array.isArray(data.testimonials) ? data.testimonials : [];
        if (items.length === 0) return;

        var fragment = document.createDocumentFragment();
        items.forEach(function (t, i) {
          fragment.appendChild(buildTestimonialCard(t, i === 0));
        });
        track.innerHTML = '';
        track.appendChild(fragment);

        // Reset carousel position so the first new card is shown
        track.style.transform = 'translateX(0)';

        // Notify app.js so its carousel rebinds
        document.dispatchEvent(new CustomEvent('testimonials:rendered', { bubbles: false }));
      })
      .catch(function (err) {
        console.warn('[dynamic-content] Testimonials load failed; keeping static fallback.', err);
      });
  }

  function buildTestimonialCard(t, isFirst) {
    var card = document.createElement('div');
    card.className = 'testimonial-card';
    card.setAttribute('aria-hidden', isFirst ? 'false' : 'true');

    var stars = document.createElement('div');
    stars.className = 'testimonial-stars';
    var rating = Math.max(0, Math.min(5, t.rating || 5));
    stars.textContent = '★★★★★'.slice(0, rating).padEnd(rating, '★');

    var p = document.createElement('p');
    p.textContent = '"' + t.content + '"';

    var author = document.createElement('span');
    author.className = 'testimonial-author';
    var label = t.author_label ? '— ' + t.author_name + ', ' + t.author_label
                               : '— ' + t.author_name;
    author.textContent = label;

    card.appendChild(stars);
    card.appendChild(p);
    card.appendChild(author);
    return card;
  }

  /* ── About page hero stats from /api/content (optional) ─ */
  function hydrateAnnouncement() {
    var bar = document.getElementById('announcement-bar');
    if (!bar) return;

    fetch('/api/content?section=announcement')
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (data) {
        if (!data || !data.content) return;
        var c = data.content;

        // If the admin has explicitly turned the bar off, hide it.
        if (c.announcement_active && String(c.announcement_active).toLowerCase() === 'false') {
          bar.classList.add('dismissed');
          document.body.classList.remove('has-ann-bar');
          return;
        }

        var en = bar.querySelector('.ann-text:not(.ann-es)');
        var es = bar.querySelector('.ann-text.ann-es');
        if (en && c.announcement_text_en) en.textContent = c.announcement_text_en;
        if (es && c.announcement_text_es) es.textContent = c.announcement_text_es;
      })
      .catch(function () { /* keep static fallback */ });
  }

  /* ── Reveal observer (shared) ────────────────────────── */
  function attachRevealObserver(elements) {
    if (!window.IntersectionObserver || !elements || !elements.length) return;
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
    elements.forEach(function (el) { observer.observe(el); });
  }

  /* ── Run ─────────────────────────────────────────────── */
  hydrateFaqs();
  hydrateTestimonials();
  hydrateAnnouncement();
})();

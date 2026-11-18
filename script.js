document.addEventListener('DOMContentLoaded', () => {
  // Footer year
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Sticky header shadow on scroll
  const header = document.getElementById('siteHeader');
  const onScroll = () => {
    if (header) header.classList.toggle('scrolled', window.scrollY > 8);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Mobile nav toggle
  const navToggle = document.getElementById('navToggle');
  const navList = document.getElementById('navList');

  if (navToggle && navList) {
    navToggle.addEventListener('click', () => {
      const isOpen = navList.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', String(isOpen));
    });

    navList.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        navList.classList.remove('open');
        navToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // Active link highlighting on scroll
  const sections = document.querySelectorAll('main .section[id]');
  const navLinks = document.querySelectorAll('.main-nav a');

  const setActive = (id) => {
    navLinks.forEach(link => {
      link.classList.toggle('active', link.getAttribute('href') === `#${id}`);
    });
  };

  if ('IntersectionObserver' in window && sections.length) {
    const navObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) setActive(entry.target.id);
      });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });

    sections.forEach(section => navObserver.observe(section));
  }

  // Scroll reveal animations
  const revealEls = document.querySelectorAll('.reveal');

  if ('IntersectionObserver' in window && revealEls.length) {
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });

    revealEls.forEach(el => revealObserver.observe(el));
  } else {
    revealEls.forEach(el => el.classList.add('in-view'));
  }

  // Animated stat counters
  const counters = document.querySelectorAll('.stat-num[data-count]');

  const animateCounter = (el) => {
    const target = parseInt(el.getAttribute('data-count'), 10);
    const duration = 1200;
    const start = performance.now();

    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(eased * target);
      if (progress < 1) requestAnimationFrame(tick);
      else el.textContent = target;
    };
    requestAnimationFrame(tick);
  };

  if ('IntersectionObserver' in window && counters.length) {
    const counterObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          animateCounter(entry.target);
          counterObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });

    counters.forEach(el => counterObserver.observe(el));
  }

  // Flip cards — tap-to-flip support for touch devices (hover handles desktop)
  const isTouch = window.matchMedia('(hover: none)').matches;
  if (isTouch) {
    document.querySelectorAll('.service-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('[data-pdf-trigger]') && card.classList.contains('is-flipped')) return;
        if (!card.classList.contains('is-flipped')) {
          e.preventDefault();
          document.querySelectorAll('.service-card.is-flipped').forEach(c => {
            if (c !== card) c.classList.remove('is-flipped');
          });
          card.classList.add('is-flipped');
        }
      });
    });
  }

  // Keyboard: Enter/Space flips a focused card, second press opens the PDF
  document.querySelectorAll('.service-card').forEach(card => {
    card.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      if (card.classList.contains('is-flipped') || !isTouch) {
        const trigger = card.querySelector('[data-pdf-trigger]');
        if (trigger) handlePdfTrigger(trigger);
      } else {
        card.classList.add('is-flipped');
      }
    });
  });

  // ---------- Read-only PDF preview (pre-rendered page images — no fetch, no CORS issues) ----------

  // Builds a zero-padded page path list, e.g. buildPages('assets/x/page-', 3, 111) -> page-001.jpg ... page-111.jpg
  function buildPages(prefix, pad, count) {
    const pages = [];
    for (let i = 1; i <= count; i++) {
      pages.push(`${prefix}${String(i).padStart(pad, '0')}.jpg`);
    }
    return pages;
  }

  // One entry per discipline that actually has sample drawings uploaded.
  // Disciplines not listed here fall through to the "not available yet" popup.
  const PDF_LIBRARY = {
    mechanical: buildPages('assets/drawings/mechanical/page-', 1, 4),
    plumbing: buildPages('assets/drawings/plumbing/page-', 1, 2),
    fire: buildPages('assets/drawings/fire-protection/page-', 1, 3),
    portfolio: buildPages('assets/portfolio-pages/page-', 3, 111),
  };

  const modal = document.getElementById('pdfModal');
  const modalBody = document.getElementById('pdfViewerBody');
  const modalLoading = document.getElementById('pdfModalLoading');
  const modalTitle = document.getElementById('pdfModalTitle');

  function renderPdfPages(pages) {
    modalBody.querySelectorAll('.pdf-page-canvas').forEach(el => el.remove());
    modalLoading.style.display = 'block';
    modalLoading.textContent = 'Loading preview…';

    let loaded = 0;
    pages.forEach((src, i) => {
      const img = new Image();
      img.className = 'pdf-page-canvas';
      img.alt = `Sample page ${i + 1} of ${pages.length}`;
      img.draggable = false;
      img.addEventListener('dragstart', (e) => e.preventDefault());
      img.addEventListener('load', () => {
        loaded += 1;
        if (loaded === pages.length) modalLoading.style.display = 'none';
      });
      img.addEventListener('error', () => {
        modalLoading.textContent = 'Preview unavailable — one or more page images are missing.';
      });
      img.src = src;
      modalBody.appendChild(img);
    });
  }

  function openPdfModal(key, title) {
    if (!modal) return;
    modalTitle.textContent = title || 'Project Sample';
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    renderPdfPages(PDF_LIBRARY[key]);
  }

  function closePdfModal() {
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function handlePdfTrigger(trigger) {
    const key = trigger.dataset.pdfKey || trigger.getAttribute('data-pdf-key');
    const title = trigger.dataset.pdfTitle || trigger.getAttribute('data-pdf-title');

    if (key && PDF_LIBRARY[key]) {
      openPdfModal(key, title);
    } else {
      showFeedback('info', 'Sample Not Available Yet', `We haven't uploaded a sample for "${title || 'this service'}" yet — check back soon, or get in touch and we'll share one directly.`);
    }
  }

  document.querySelectorAll('[data-pdf-trigger]').forEach(trigger => {
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      handlePdfTrigger(trigger);
    });
    trigger.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        handlePdfTrigger(trigger);
      }
    });
  });

  document.querySelectorAll('[data-pdf-close]').forEach(el => {
    el.addEventListener('click', closePdfModal);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal && modal.classList.contains('open')) closePdfModal();
  });

  // Block common save/print shortcuts while the read-only preview is open
  document.addEventListener('keydown', (e) => {
    if (!modal || !modal.classList.contains('open')) return;
    const key = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && (key === 's' || key === 'p')) {
      e.preventDefault();
    }
  });

  // ---------- Feedback popup (success / error) ----------
  const feedbackModal = document.getElementById('feedbackModal');
  const feedbackIconWrap = document.getElementById('feedbackIconWrap');
  const feedbackTitleEl = document.getElementById('feedbackTitle');
  const feedbackMessageEl = document.getElementById('feedbackMessage');
  let feedbackTimer = null;

  const FEEDBACK_ICONS = {
    success: '<svg class="feedback-svg" viewBox="0 0 52 52" aria-hidden="true">'
      + '<circle class="feedback-circle" cx="26" cy="26" r="24" fill="none"/>'
      + '<path class="feedback-mark" fill="none" d="M14 27l8 8 16-16"/></svg>',
    error: '<svg class="feedback-svg" viewBox="0 0 52 52" aria-hidden="true">'
      + '<circle class="feedback-circle" cx="26" cy="26" r="24" fill="none"/>'
      + '<path class="feedback-mark" fill="none" d="M17 17l18 18M35 17l-18 18"/></svg>',
    info: '<svg class="feedback-svg" viewBox="0 0 52 52" aria-hidden="true">'
      + '<circle class="feedback-circle" cx="26" cy="26" r="24" fill="none"/>'
      + '<rect class="feedback-info-mark" x="23.5" y="14" width="5" height="18" rx="2"/>'
      + '<rect class="feedback-info-mark" x="23.5" y="35" width="5" height="5" rx="2"/></svg>',
  };

  function showFeedback(type, title, message) {
    if (!feedbackModal) return;
    clearTimeout(feedbackTimer);

    feedbackModal.classList.remove('is-success', 'is-error');
    feedbackModal.classList.add(`is-${type}`);

    feedbackIconWrap.innerHTML = FEEDBACK_ICONS[type] || '';
    void feedbackIconWrap.offsetWidth; // restart the draw animation each time

    feedbackTitleEl.textContent = title;
    feedbackMessageEl.textContent = message;

    feedbackModal.classList.add('open');
    feedbackModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    if (type === 'success') {
      feedbackTimer = setTimeout(closeFeedback, 5000);
    }
  }

  function closeFeedback() {
    if (!feedbackModal) return;
    feedbackModal.classList.remove('open');
    feedbackModal.setAttribute('aria-hidden', 'true');
    clearTimeout(feedbackTimer);
    document.body.style.overflow = '';
  }

  document.querySelectorAll('[data-feedback-close]').forEach(el => {
    el.addEventListener('click', closeFeedback);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && feedbackModal && feedbackModal.classList.contains('open')) {
      closeFeedback();
    }
  });

  // ---------- Attachment field ----------
  const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10 MB
  const fileInput = document.getElementById('attachment');
  const fileText = document.getElementById('fileInputText');
  const fileClear = document.getElementById('fileInputClear');
  const FILE_PLACEHOLDER = 'No file selected — max 10 MB';

  function formatSize(bytes) {
    return bytes < 1024 * 1024
      ? `${Math.max(1, Math.round(bytes / 1024))} KB`
      : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function resetFile() {
    if (!fileInput) return;
    fileInput.value = '';
    fileText.textContent = FILE_PLACEHOLDER;
    fileClear.hidden = true;
  }

  if (fileInput && fileText && fileClear) {
    fileInput.addEventListener('change', () => {
      const file = fileInput.files[0];
      if (!file) { resetFile(); return; }
      if (file.size > MAX_ATTACHMENT_BYTES) {
        resetFile();
        showFeedback('error', 'File Too Large', `"${file.name}" is ${formatSize(file.size)}. Please attach a file under 10 MB.`);
        return;
      }
      fileText.textContent = `${file.name} (${formatSize(file.size)})`;
      fileClear.hidden = false;
    });
    fileClear.addEventListener('click', resetFile);
  }

  // Contact form — sends to send-mail.php (Hostinger SMTP via PHPMailer)
  const CONTACT_ENDPOINT = 'mail/send-mail.php';
  const form = document.getElementById('contactForm');

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const name = form.name.value.trim();
      const email = form.email.value.trim();
      const message = form.message.value.trim();

      if (!name || !email || !message) {
        showFeedback('error', 'Missing Information', 'Please fill in all required fields.');
        return;
      }

      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(email)) {
        showFeedback('error', 'Invalid Email', 'Please enter a valid email address.');
        return;
      }

      const submitBtn = form.querySelector('button[type="submit"]');
      const originalLabel = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending…';

      try {
        const res = await fetch(CONTACT_ENDPOINT, {
          method: 'POST',
          body: new FormData(form),
        });
        const data = await res.json();

        if (data.success) {
          showFeedback('success', 'Message Sent', data.message || "Thanks — we'll get back to you within 1–2 business days.");
          form.reset();
          resetFile();
        } else {
          showFeedback('error', 'Something Went Wrong', data.message || 'Please try again in a moment.');
        }
      } catch (err) {
        console.error('Contact form error:', err);
        showFeedback('error', 'Connection Problem', 'Could not send right now — please email us directly at contact@cherrsbim.in.');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalLabel;
      }
    });
  }
});

(() => {
  'use strict';

  // Default to public/read-only mode immediately. Only a verified configured owner session unlocks editing.
  document.body.classList.add('cloud-locked');
  document.body.classList.remove('owner-mode');
  let preCloudLocalDraft = null;
  let localDraftMergedForOwner = false;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const STORAGE = {
    links: 'nitinPortfolioLinksV2',
    customLinks: 'nitinPortfolioCustomLinksV2',
    problems: 'nitinPortfolioLeetCodeProblemsV2',
    learning: 'nitinPortfolioLearningV2',
    projectImages: 'nitinPortfolioProjectImagesV2',
    portrait: 'nitinPortfolioPortraitV4',
    credentials: 'nitinPortfolioCredentialsV2',
    notes: 'nitinPortfolioTechnicalNotesV1',
    projects: 'nitinPortfolioCustomProjectsV1',
    githubUsername: 'nitinPortfolioGitHubUsernameV3',
    leetcodeUsername: 'nitinPortfolioLeetCodeUsernameV3',
    githubReposCache: 'nitinPortfolioGitHubReposCacheV3',
    leetcodeStatsCache: 'nitinPortfolioLeetCodeStatsCacheV3'
  };
  const defaultLinks = { github: window.PORTFOLIO_CONFIG?.githubUrl || '', leetcode: window.PORTFOLIO_CONFIG?.leetcodeUrl || '', linkedin: window.PORTFOLIO_CONFIG?.linkedinUrl || '', instagram: window.PORTFOLIO_CONFIG?.instagramUrl || '', x: window.PORTFOLIO_CONFIG?.xUrl || '', email: window.PORTFOLIO_CONFIG?.email || '', resumePdf: window.PORTFOLIO_CONFIG?.resumeUrl || '', resqRepo: window.PORTFOLIO_CONFIG?.resqRepo || '', waterRepo: window.PORTFOLIO_CONFIG?.waterRepo || '' };
  const portalInfo = {
    github: { name: 'GitHub', eyebrow: 'CODE / REPOSITORIES', description: 'A place for project source code, experiments, documentation, and development history.', action: 'Open GitHub profile' },
    leetcode: { name: 'LeetCode', eyebrow: 'PRACTICE / PROBLEM SOLVING', description: 'A profile for coding practice, data structures, algorithms, and problem-solving progress.', action: 'Open LeetCode profile' },
    linkedin: { name: 'LinkedIn', eyebrow: 'PROFESSIONAL PROFILE', description: 'Connect for academic updates, internships, collaboration, and professional opportunities.', action: 'Open LinkedIn profile' },
    instagram: { name: 'Instagram', eyebrow: 'SOCIAL / PERSONAL', description: 'Your selected Instagram profile. Add your profile address in Manage links to activate it.', action: 'Open Instagram profile' },
    x: { name: 'X / Twitter', eyebrow: 'SOCIAL / UPDATES', description: 'A place to share thoughts, learning notes, and updates.', action: 'Open X profile' },
    email: { name: 'Email', eyebrow: 'DIRECT CONTACT', description: 'Use email for project discussions, collaboration, and internship-related communication.', action: 'Compose email' },
    resume: { name: 'Resume', eyebrow: 'DOCUMENT / PDF', description: 'Preview the resume destination before opening it. Add a shareable PDF link in Manage my profile links.', action: 'Open resume' }
  };
  const projectInfo = {
    resq: {
      title: 'RESQ — Disaster Response Simulator',
      eyebrow: 'PROJECT / 001 · SOFTWARE & SYSTEMS',
      description: 'A C / C++ academic project exploring how a software-based simulator can organize disaster-response scenarios and support structured decision-making. The project repository includes the implementation and supporting project documentation.',
      stack: 'C, C++, Data Structures, Simulation',
      role: 'Student developer · implementation and project documentation',
      problem: 'Disaster-response scenarios involve multiple events and decisions. A simulator provides a structured way to represent and work through scenarios.',
      approach: 'Model the scenario as a software workflow, organize program logic into manageable components, and use data-structure concepts where they fit the problem.',
      learning: 'Breaking a larger problem into smaller modules, working with C/C++ project structure, and documenting a technical solution.',
      linkKey: 'resqRepo',
      linkLabel: 'Open RESQ repository'
    },
    water: {
      title: 'Urban Water Demand Prediction',
      eyebrow: 'PROJECT / 002 · MACHINE LEARNING',
      description: 'An applied machine-learning project using household and seasonal factors to explore daily water-use prediction. The project work includes dataset curation, preprocessing, model training and residual analysis.',
      stack: 'Python, Pandas, Scikit-learn, StandardScaler, Linear Regression',
      role: 'Student researcher / developer · data preparation, modelling and evaluation',
      problem: 'Daily household water use can vary with household size, seasonal patterns and garden area. The project explores whether these features can help estimate daily usage.',
      approach: 'Curate a dataset with Household_Size, Seasonal_Index, Garden_Area and Daily_Liters_Used; prepare features, scale where appropriate, fit a regression model and inspect residuals.',
      learning: 'Connecting feature preparation, model assumptions and evaluation with a practical prediction problem. Report final metrics only after validating the final experiment.',
      linkKey: 'waterRepo',
      linkLabel: 'Open project repository'
    }
  };

  const CLOUD_PERSIST_KEYS = new Set(['nitinPortfolioLinksV2','nitinPortfolioCustomLinksV2','nitinPortfolioLeetCodeProblemsV2','nitinPortfolioLearningV2','nitinPortfolioProjectImagesV2','nitinPortfolioCredentialsV2','nitinPortfolioTechnicalNotesV1','nitinPortfolioCustomProjectsV1']);
  let cloudClient = null;
  let cloudSession = null;
  let cloudHydrated = false;
  let cloudSaveTimer = null;
  let cloudSaving = false;
  let cloudSaveQueued = false;

  function canEditPortfolio() {
    return Boolean(cloudSession && document.body.classList.contains('owner-mode'));
  }
  function requireOwnerEditor() {
    if (canEditPortfolio()) return true;
    setCloudStatus('Editing is restricted to the authenticated portfolio owner.', 'error');
    return false;
  }

  function setCloudStatus(message, state = 'idle') {
    const status = $('#cloudSyncStatus');
    const text = $('#cloudSyncStatusText');
    if (text) text.textContent = message;
    if (status) status.dataset.state = state;
  }
  function scheduleCloudSave() {
    if (!cloudHydrated || !cloudClient || !cloudSession) return;
    window.clearTimeout(cloudSaveTimer);
    cloudSaveTimer = window.setTimeout(() => saveCloudState(), 900);
  }

  function readJSON(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch (error) {
      console.warn(`Could not read ${key} from local storage.`, error);
      return fallback;
    }
  }
  function writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      if (CLOUD_PERSIST_KEYS.has(key)) {
        if (cloudClient && cloudSession) scheduleCloudSave();
        else if (cloudHydrated && cloudClient && !cloudSession) setCloudStatus('Saved in this browser only. Sign in with the owner email to publish this change for visitors.', 'idle');
      }
      return true;
    } catch (error) {
      alert('The browser could not save this item. Try using a smaller image or export your data first.');
      console.error(error);
      return false;
    }
  }

  let links = { ...defaultLinks, ...readJSON(STORAGE.links, {}) };
  // Keep the public profile URLs supplied in V4 as defaults even if an older test session saved blank fields.
  if (!links.github && window.PORTFOLIO_CONFIG?.githubUrl) links.github = window.PORTFOLIO_CONFIG.githubUrl;
  if (!links.leetcode && window.PORTFOLIO_CONFIG?.leetcodeUrl) links.leetcode = window.PORTFOLIO_CONFIG.leetcodeUrl;
  let customLinks = readJSON(STORAGE.customLinks, []);
  let problems = readJSON(STORAGE.problems, []);
  let learningEntries = readJSON(STORAGE.learning, []);
  let projectImages = readJSON(STORAGE.projectImages, { resq: [], water: [] });
  let customProjects = readJSON(STORAGE.projects, []);
  let credentials = readJSON(STORAGE.credentials, []);
  const curatedCredentials = [
  {
    "id": "portfolio-curated-01",
    "type": "Achievement",
    "title": "AWS Builder Challenge 2026",
    "issuer": "AWS Builder Challenge",
    "date": "11 July 2026",
    "note": "Verified achievement • Verify ID: 9DFAFC6F86",
    "url": "assets/certificates/01-aws-builder-challenge-2026.pdf",
    "createdAt": 0
  },
  {
    "id": "portfolio-curated-02",
    "type": "Event participation",
    "title": "AWS Jam 2025",
    "issuer": "Amazon Web Services / event participation",
    "date": "2025",
    "note": "Participation certificate",
    "url": "assets/certificates/02-aws-jam-2025.pdf",
    "createdAt": 0
  },
  {
    "id": "portfolio-curated-03",
    "type": "Event participation",
    "title": "AWS Jam 2026",
    "issuer": "Amazon Web Services / event participation",
    "date": "2026",
    "note": "Participation certificate",
    "url": "assets/certificates/03-aws-jam-2026.pdf",
    "createdAt": 0
  },
  {
    "id": "portfolio-curated-04",
    "type": "Event participation",
    "title": "Cloud Ignite 2025",
    "issuer": "Graphic Era University / Cloud Ignite",
    "date": "2025",
    "note": "Participation certificate",
    "url": "assets/certificates/04-cloud-ignite-2025.pdf",
    "createdAt": 0
  },
  {
    "id": "portfolio-curated-05",
    "type": "Workshop",
    "title": "Ethics and AI Workshop",
    "issuer": "Utopia Tech Fest 2025 • Graphic Era University",
    "date": "8 November 2025",
    "note": "Participation certificate",
    "url": "assets/certificates/05-ethics-and-ai-workshop.pdf",
    "createdAt": 0
  },
  {
    "id": "portfolio-curated-06",
    "type": "Course completion",
    "title": "Developing Generative Artificial Intelligence Solutions",
    "issuer": "AWS Training & Certification",
    "date": "29 September 2025",
    "note": "AWS digital course completion",
    "url": "assets/certificates/06-developing-generative-artificial-intelligence-solutions.pdf",
    "createdAt": 0
  },
  {
    "id": "portfolio-curated-07",
    "type": "Course completion",
    "title": "Developing Machine Learning Solutions",
    "issuer": "AWS Training & Certification",
    "date": "29 September 2025",
    "note": "AWS digital course completion",
    "url": "assets/certificates/07-developing-machine-learning-solutions.pdf",
    "createdAt": 0
  },
  {
    "id": "portfolio-curated-08",
    "type": "Course completion",
    "title": "Essentials of Prompt Engineering",
    "issuer": "AWS Training & Certification",
    "date": "29 September 2025",
    "note": "AWS digital course completion",
    "url": "assets/certificates/08-essentials-of-prompt-engineering.pdf",
    "createdAt": 0
  },
  {
    "id": "portfolio-curated-09",
    "type": "Course completion",
    "title": "Fundamentals of Machine Learning and Artificial Intelligence",
    "issuer": "AWS Training & Certification",
    "date": "29 September 2025",
    "note": "AWS digital course completion",
    "url": "assets/certificates/09-fundamentals-of-machine-learning-and-artificial-intelligence.pdf",
    "createdAt": 0
  },
  {
    "id": "portfolio-curated-10",
    "type": "Course completion",
    "title": "Responsible Artificial Intelligence Practices",
    "issuer": "AWS Training & Certification",
    "date": "29 September 2025",
    "note": "AWS digital course completion",
    "url": "assets/certificates/10-responsible-artificial-intelligence-practices.pdf",
    "createdAt": 0
  },
  {
    "id": "portfolio-curated-11",
    "type": "Course completion",
    "title": "Optimizing Foundation Models",
    "issuer": "AWS Training & Certification",
    "date": "29 September 2025",
    "note": "AWS digital course completion",
    "url": "assets/certificates/11-optimizing-foundation-models.pdf",
    "createdAt": 0
  },
  {
    "id": "portfolio-curated-12",
    "type": "Course completion",
    "title": "AWS Cloud Practitioner Essentials",
    "issuer": "AWS Training & Certification",
    "date": "2 October 2025",
    "note": "AWS digital course completion — not the AWS Certified Cloud Practitioner exam",
    "url": "assets/certificates/12-aws-cloud-practitioner-essentials.pdf",
    "createdAt": 0
  },
  {
    "id": "portfolio-curated-13",
    "type": "Course completion",
    "title": "AWS Well-Architected Foundations",
    "issuer": "AWS Training & Certification",
    "date": "28 May 2026",
    "note": "AWS digital course completion",
    "url": "assets/certificates/13-aws-well-architected-foundations.pdf",
    "createdAt": 0
  },
  {
    "id": "portfolio-curated-14",
    "type": "Course completion",
    "title": "AWS Foundations: Machine Learning Basics",
    "issuer": "AWS Training & Certification",
    "date": "28 May 2026",
    "note": "AWS digital course completion",
    "url": "assets/certificates/14-aws-foundations-machine-learning-basics.pdf",
    "createdAt": 0
  },
  {
    "id": "portfolio-curated-15",
    "type": "SimuLearn completion",
    "title": "AWS SimuLearn: Chatbots with a Large Language Model",
    "issuer": "AWS Training & Certification",
    "date": "28 June 2026",
    "note": "Applied learning activity",
    "url": "assets/certificates/15-aws-simulearn-chatbots-with-a-large-language-model.pdf",
    "createdAt": 0
  },
  {
    "id": "portfolio-curated-16",
    "type": "SimuLearn completion",
    "title": "AWS SimuLearn: Fine-Tuning an LLM on Amazon SageMaker",
    "issuer": "AWS Training & Certification",
    "date": "28 June 2026",
    "note": "Applied learning activity",
    "url": "assets/certificates/16-aws-simulearn-fine-tuning-an-llm-on-amazon-sagemaker.pdf",
    "createdAt": 0
  },
  {
    "id": "portfolio-curated-17",
    "type": "SimuLearn completion",
    "title": "AWS SimuLearn: TensorFlow and Computer Vision",
    "issuer": "AWS Training & Certification",
    "date": "26 June 2026",
    "note": "Applied learning activity",
    "url": "assets/certificates/17-aws-simulearn-tensorflow-and-computer-vision.pdf",
    "createdAt": 0
  },
  {
    "id": "portfolio-curated-18",
    "type": "SimuLearn completion",
    "title": "AWS SimuLearn: Anomaly Detection",
    "issuer": "AWS Training & Certification",
    "date": "25 June 2026",
    "note": "Applied learning activity",
    "url": "assets/certificates/18-aws-simulearn-anomaly-detection.pdf",
    "createdAt": 0
  }
];
  if (localStorage.getItem('nitinPortfolioCuratedCertsV1') !== '1') {
    const existingCredentialIds = new Set(credentials.map((item) => String(item.id)));
    credentials = [...curatedCredentials.filter((item) => !existingCredentialIds.has(String(item.id))), ...credentials];
    writeJSON(STORAGE.credentials, credentials);
    localStorage.setItem('nitinPortfolioCuratedCertsV1', '1');
  }
  let currentDialogAction = null;

  const dialog = $('#appDialog');
  const dialogTitle = $('#dialogTitle');
  const dialogEyebrow = $('#dialogEyebrow');
  const dialogContent = $('#dialogContent');

  function openDialog(title, eyebrow, html, onReady) {
    dialogTitle.textContent = title;
    dialogEyebrow.textContent = eyebrow;
    dialogContent.innerHTML = html;
    currentDialogAction = onReady || null;
    if (!dialog.open) dialog.showModal();
    if (currentDialogAction) currentDialogAction();
  }
  function closeDialog() { if (dialog.open) dialog.close(); currentDialogAction = null; }
  $('#dialogClose').addEventListener('click', closeDialog);
  dialog.addEventListener('click', (event) => { if (event.target === dialog) closeDialog(); });
  dialog.addEventListener('close', () => { dialogContent.innerHTML = ''; });

  $('#year').textContent = new Date().getFullYear();

  // Visitor-selectable themes. The choice is saved only in that visitor's browser.
  const THEME_KEY = 'nitinPortfolioThemeV1';
  const allowedThemes = ['midnight', 'aurora', 'ember', 'cyber'];
  function applyTheme(theme) {
    const selected = allowedThemes.includes(theme) ? theme : 'midnight';
    document.body.dataset.theme = selected;
    localStorage.setItem(THEME_KEY, selected);
    $$('[data-theme-choice]').forEach((button) => {
      const active = button.dataset.themeChoice === selected;
      button.setAttribute('aria-pressed', String(active));
    });
  }
  applyTheme(localStorage.getItem(THEME_KEY) || 'midnight');

  // Theme changes update the accent palette and section atmosphere.
  $$('[data-theme-choice]').forEach((button) => button.addEventListener('click', () => applyTheme(button.dataset.themeChoice)));

  // Keep content visible immediately: scroll-triggered reveal effects can feel sluggish on long pages.
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  $$('.reveal').forEach((item) => item.classList.add('is-visible'));

  const progressBar = $('#progressBar');
  const header = $('.site-header');
  const sections = $$('main section[id]');
  const navLinks = $$('.nav-links a');
  let scrollTicking = false;
  function updateScrollChrome() {
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    if (progressBar) progressBar.style.transform = `scaleX(${scrollable > 0 ? window.scrollY / scrollable : 0})`;
    header?.classList.toggle('scrolled', window.scrollY > 28);
    scrollTicking = false;
  }
  window.addEventListener('scroll', () => {
    if (!scrollTicking) { requestAnimationFrame(updateScrollChrome); scrollTicking = true; }
  }, { passive: true });
  updateScrollChrome();
  if ('IntersectionObserver' in window) {
    const sectionObserver = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a,b) => b.intersectionRatio-a.intersectionRatio)[0];
      if (!visible) return;
      navLinks.forEach((link) => link.classList.toggle('active', link.getAttribute('href') === `#${visible.target.id}`));
      document.body.dataset.scene = visible.target.id;
    }, { rootMargin: '-24% 0px -58% 0px', threshold: [0, .15, .3, .5] });
    sections.forEach((section) => sectionObserver.observe(section));
  }

  // Static atmospheric background; scroll colour transitions are CSS-driven.

  // Mobile navigation.
  const menuToggle = $('#menuToggle');
  const nav = $('#navLinks');
  menuToggle.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  });
  nav.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => { nav.classList.remove('open'); menuToggle.setAttribute('aria-expanded', 'false'); }));

  // Gentle card tilt, disabled on touch devices.
  if (!reduceMotion && window.matchMedia('(pointer:fine)').matches) {
    $$('[data-tilt]').forEach((card) => {
      card.addEventListener('pointermove', (event) => {
        const rect = card.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width;
        const y = (event.clientY - rect.top) / rect.height;
        card.style.transform = `perspective(1100px) rotateX(${(0.5 - y) * 2.8}deg) rotateY(${(x - 0.5) * 2.8}deg) translateY(-2px)`;
      });
      card.addEventListener('pointerleave', () => { card.style.transform = ''; });
    });
  }

  // External profiles: first click opens a preview card; the user chooses when to leave.
  function safeExternalURL(raw) {
    if (!raw) return '';
    const value = raw.trim();
    if (/^mailto:/i.test(value)) return value;
    const candidate = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    try { const url = new URL(candidate); return ['http:', 'https:'].includes(url.protocol) ? url.href : ''; }
    catch { return ''; }
  }
  function openPortal(key) {
    const info = portalInfo[key];
    const linkKey = key === 'resume' ? 'resumePdf' : key;
    const raw = key === 'email' ? links.email : links[linkKey];
    const destination = key === 'email' ? (raw && raw.includes('@') ? `mailto:${raw}` : '') : safeExternalURL(raw);
    const display = destination || 'Profile link not added yet';
    const readyText = destination ? 'Your profile link is saved. Open it when you are ready.' : (canEditPortfolio() ? 'Add your real profile URL through Manage my profile links. Nothing will open automatically.' : 'This profile link will be added by the portfolio owner.');
    openDialog(info.name, info.eyebrow, `
      <div class="portal-preview">
        <div class="portal-preview-icon">${key === 'github' ? 'GH' : key === 'leetcode' ? 'LC' : key === 'linkedin' ? 'in' : key === 'instagram' ? 'IG' : key === 'email' ? '＠' : key === 'resume' ? 'CV' : 'X'}</div>
        <div class="portal-preview-copy"><strong>${info.name}</strong><span>${display}</span></div>
        <span class="portal-status ${destination ? 'is-ready' : ''}">${destination ? 'READY' : 'SETUP'}</span>
      </div>
      <p class="dialog-description">${info.description}</p>
      <p class="dialog-hint">${readyText}</p>
      <div class="dialog-actions">${canEditPortfolio() ? '<button class="button button-outline" data-manage-from-portal>Manage links</button>' : ''}${destination ? `<button class="button button-primary" data-open-destination>${info.action} ↗</button>` : (canEditPortfolio() ? '<button class="button button-primary" data-manage-from-portal>＋ Add profile URL</button>' : '')}</div>
    `, () => {
      $$('[data-manage-from-portal]', dialogContent).forEach((button) => button.addEventListener('click', openLinkManager));
      const openButton = $('[data-open-destination]', dialogContent);
      if (openButton) openButton.addEventListener('click', () => {
        if (key === 'email') window.location.href = destination;
        else window.open(destination, '_blank', 'noopener,noreferrer');
        closeDialog();
      });
    });
  }
  $$('[data-portal]').forEach((button) => button.addEventListener('click', () => openPortal(button.dataset.portal)));

  function openLinkManager() {
    if (!requireOwnerEditor()) return;
    const fields = [
      ['github', 'GitHub profile URL', 'https://github.com/your-username'],
      ['leetcode', 'LeetCode profile URL', 'https://leetcode.com/u/your-username/'],
      ['linkedin', 'LinkedIn profile URL', 'https://www.linkedin.com/in/your-profile/'],
      ['instagram', 'Instagram profile URL', 'https://www.instagram.com/your-username/'],
      ['x', 'X / Twitter profile URL', 'https://x.com/your-username'],
      ['email', 'Email address', 'name@example.com'],
      ['resumePdf', 'Resume PDF share URL', 'https://drive.google.com/...'],
      ['resqRepo', 'RESQ project repository URL', 'https://github.com/your-username/resq-repository'],
      ['waterRepo', 'Urban Water project repository URL', 'https://github.com/your-username/water-project']
    ];
    openDialog('Manage your links', 'PROFILE / SETTINGS', `
      <p class="dialog-description">Add your real account addresses here. These are saved in this browser. Do not enter passwords or private tokens.</p>
      <form id="linksForm" class="settings-form">
        ${fields.map(([key, label, placeholder]) => `<label class="form-field"><span>${label}</span><input name="${key}" type="text" value="${escapeHTML(links[key] || '')}" placeholder="${placeholder}" ${key === 'email' ? 'inputmode="email"' : 'inputmode="url"'} /></label>`).join('')}
        <div class="dialog-actions"><button type="button" class="button button-outline" data-add-custom>＋ Add another social account</button><button type="submit" class="button button-primary">Save links</button></div>
      </form>
      <div id="customLinkEditor" class="custom-link-editor"></div>
    `, () => {
      const form = $('#linksForm', dialogContent);
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const data = new FormData(form);
        fields.forEach(([key]) => { links[key] = String(data.get(key) || '').trim(); });
        if (links.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(links.email)) { alert('Please enter a valid email address.'); return; }
        writeJSON(STORAGE.links, links);
        const githubNameFromLink = parseGitHubUsername(links.github);
        const leetcodeNameFromLink = parseLeetCodeUsername(links.leetcode);
        if (githubNameFromLink) { localStorage.setItem(STORAGE.githubUsername, githubNameFromLink); if ($('#githubUsernameInput')) $('#githubUsernameInput').value = githubNameFromLink; }
        if (leetcodeNameFromLink) { localStorage.setItem(STORAGE.leetcodeUsername, leetcodeNameFromLink); if ($('#leetcodeUsernameInput')) $('#leetcodeUsernameInput').value = leetcodeNameFromLink; }
        closeDialog(); renderCustomSocialLinks();
        if (githubNameFromLink) syncGithubRepos(true);
        if (leetcodeNameFromLink) syncLeetCodeStats(true);
      });
      $('[data-add-custom]', dialogContent).addEventListener('click', () => { $('#customPlatform', dialogContent)?.focus(); $('#customSocialForm', dialogContent)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); });
      renderCustomLinkEditor();
    });
  }
  $('#manageLinksBtn').addEventListener('click', openLinkManager);

  function addCustomLink() {
    if (!requireOwnerEditor()) return;
    const name = prompt('Platform name (for example, CodePen or YouTube):');
    if (!name || !name.trim()) return;
    const url = prompt(`Paste your ${name.trim()} profile URL:`);
    if (!url || !safeExternalURL(url)) { alert('Please enter a valid http or https profile URL.'); return; }
    customLinks.push({ id: Date.now(), name: name.trim(), url: safeExternalURL(url) });
    writeJSON(STORAGE.customLinks, customLinks);
    renderCustomLinkEditor();
    renderCustomSocialLinks();
  }
  function renderCustomLinkEditor() {
    const target = $('#customLinkEditor', dialogContent);
    if (!target) return;
    target.innerHTML = `
      <form id="customSocialForm" class="custom-social-form">
        <span class="mono-label">ADD ANOTHER SOCIAL / DEVELOPER ACCOUNT</span>
        <div class="custom-social-fields"><input id="customPlatform" name="platform" maxlength="28" required placeholder="Platform name (e.g. YouTube)" /><input name="url" type="url" required placeholder="https://profile-link" /><button class="button button-soft" type="submit">Add account +</button></div>
      </form>
      ${customLinks.length ? `<div class="custom-link-list"><span class="mono-label">ADDITIONAL ACCOUNTS</span>${customLinks.map((item) => `<div><span>${escapeHTML(item.name)} · ${escapeHTML(item.url)}</span><button type="button" data-remove-custom="${item.id}" aria-label="Remove ${escapeHTML(item.name)}">×</button></div>`).join('')}</div>` : '<p class="small-muted">No additional social accounts added yet.</p>'}
    `;
    $('#customSocialForm', target).addEventListener('submit', (event) => {
      event.preventDefault(); const data = new FormData(event.currentTarget); const name = safeText(data.get('platform')); const url = safeExternalURL(data.get('url'));
      if (!name || !url) { alert('Add a platform name and a valid http or https profile URL.'); return; }
      customLinks.push({ id: Date.now(), name, url }); writeJSON(STORAGE.customLinks, customLinks); renderCustomLinkEditor(); renderCustomSocialLinks();
    });
    $$('[data-remove-custom]', target).forEach((button) => button.addEventListener('click', () => {
      customLinks = customLinks.filter((item) => String(item.id) !== button.dataset.removeCustom);
      writeJSON(STORAGE.customLinks, customLinks); renderCustomLinkEditor(); renderCustomSocialLinks();
    }));
  }
  function renderCustomSocialLinks() {
    const target = $('#customSocialRow');
    target.innerHTML = customLinks.map((item) => `<button class="custom-social-chip glass" data-custom-portal="${item.id}"><span>${escapeHTML(item.name)}</span><b>↗</b></button>`).join('');
    $$('[data-custom-portal]', target).forEach((button) => button.addEventListener('click', () => {
      const item = customLinks.find((entry) => String(entry.id) === button.dataset.customPortal);
      if (item) openDialog(item.name, 'ADDITIONAL PROFILE', `<div class="portal-preview"><div class="portal-preview-icon">↗</div><div class="portal-preview-copy"><strong>${escapeHTML(item.name)}</strong><span>${escapeHTML(item.url)}</span></div><span class="portal-status is-ready">READY</span></div><p class="dialog-description">This is the external profile link you added.</p><div class="dialog-actions"><button class="button button-primary" id="openCustomLink">Open ${escapeHTML(item.name)} ↗</button></div>`, () => $('#openCustomLink', dialogContent).addEventListener('click', () => { window.open(item.url, '_blank', 'noopener,noreferrer'); closeDialog(); }));
    }));
  }
  renderCustomSocialLinks();

  // Project details and repository links.
  $$('.project-action').forEach((button) => button.addEventListener('click', () => {
    const info = projectInfo[button.dataset.project];
    const destination = safeExternalURL(links[info.linkKey]);
    openDialog(info.title, info.eyebrow, `
      <p class="dialog-description">${escapeHTML(info.description)}</p>
      <div class="case-study-grid">
        <div class="case-study-block"><span class="mono-label">THE PROBLEM</span><p>${escapeHTML(info.problem)}</p></div>
        <div class="case-study-block"><span class="mono-label">APPROACH</span><p>${escapeHTML(info.approach)}</p></div>
        <div class="case-study-block"><span class="mono-label">MY ROLE</span><p>${escapeHTML(info.role)}</p></div>
        <div class="case-study-block"><span class="mono-label">WHAT I LEARNED</span><p>${escapeHTML(info.learning)}</p></div>
      </div>
      <div class="project-modal-meta"><span class="mono-label">TECHNOLOGIES / AREAS</span><strong>${escapeHTML(info.stack)}</strong></div>
      <div class="dialog-hint">${destination ? 'Repository link is connected.' : 'The project repository has not been linked yet. The portfolio owner will add its public URL when it is ready.'}</div>
      <div class="dialog-actions">${canEditPortfolio() ? '<button class="button button-outline" data-manage-project-link>Manage links</button>' : ''}${destination ? `<button class="button button-primary" data-open-repository>${info.linkLabel} ↗</button>` : ''}</div>
    `, () => {
      $('[data-manage-project-link]', dialogContent)?.addEventListener('click', openLinkManager);
      const repo = $('[data-open-repository]', dialogContent);
      if (repo) repo.addEventListener('click', () => { window.open(destination, '_blank', 'noopener,noreferrer'); closeDialog(); });
    });
  }));

  // Project category filters keep the cards in place; no layout-shifting animation.
  $$('[data-work-filter]').forEach((button) => button.addEventListener('click', () => {
    const selected = button.dataset.workFilter;
    $$('[data-work-filter]').forEach((item) => { const active = item === button; item.classList.toggle('is-active', active); item.setAttribute('aria-pressed', String(active)); });
    $$('[data-project-category]').forEach((card) => { card.hidden = selected !== 'all' && card.dataset.projectCategory !== selected; });
  }));

  // LeetCode journal: manual entry, CSV/JSON import, filtering, editing, deleting, exporting.
  function safeText(value) { return String(value ?? '').trim(); }
  function normalizeProblem(item) {
    const title = safeText(item.title || item.name || item.problem || item.question);
    if (!title) return null;
    const difficulty = ['Easy', 'Medium', 'Hard'].includes(String(item.difficulty || '').trim()) ? String(item.difficulty).trim() : 'Unspecified';
    return { id: item.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`, title, url: safeExternalURL(item.url || item.link || item.problemUrl || ''), difficulty, topic: safeText(item.topic || item.category || item.tags || 'Uncategorised'), status: /^(solved|done|complete)$/i.test(String(item.status || item.state || '')) || item.solved === true ? 'solved' : 'practising', notes: safeText(item.notes || item.note || '') };
  }
  function renderProblems() {
    const q = ($('#problemSearch').value || '').toLowerCase();
    const filter = $('#problemFilter').value;
    const filtered = problems.filter((p) => (filter === 'all' || p.status === filter) && `${p.title} ${p.topic} ${p.notes}`.toLowerCase().includes(q));
    $('#problemCount').textContent = problems.length;
    $('#solvedCount').textContent = problems.filter((p) => p.status === 'solved').length;
    $('#topicCount').textContent = new Set(problems.map((p) => p.topic).filter(Boolean)).size;
    if (!filtered.length) {
      $('#problemList').innerHTML = problems.length ? '<div class="empty-state compact-empty"><strong>No matching problems.</strong><p>Try a different search or filter.</p></div>' : '<div class="empty-state"><span class="empty-icon">⌁</span><strong>Your problem log starts here.</strong><p>Add a LeetCode problem or import your existing list. Your entries will appear here.</p><button class="text-link" id="emptyAddProblem">Add your first problem →</button></div>';
      const add = $('#emptyAddProblem'); if (add) add.addEventListener('click', openProblemForm);
      return;
    }
    $('#problemList').innerHTML = `<div class="problem-table-wrap"><table class="problem-table"><thead><tr><th>PROBLEM</th><th>TOPIC</th><th>DIFFICULTY</th><th>STATUS</th><th></th></tr></thead><tbody>${filtered.map((p) => `<tr><td><strong>${escapeHTML(p.title)}</strong>${p.notes ? `<small>${escapeHTML(p.notes)}</small>` : ''}</td><td>${escapeHTML(p.topic)}</td><td><span class="difficulty difficulty-${p.difficulty.toLowerCase()}">${escapeHTML(p.difficulty)}</span></td><td><span class="problem-status ${p.status}">${p.status === 'solved' ? 'SOLVED' : 'PRACTISING'}</span></td><td class="problem-row-actions">${p.url ? `<a href="${escapeHTML(p.url)}" target="_blank" rel="noopener noreferrer" title="Open problem">↗</a>` : ''}<button data-edit-problem="${escapeHTML(p.id)}" title="Edit problem">✎</button><button data-delete-problem="${escapeHTML(p.id)}" title="Delete problem">×</button></td></tr>`).join('')}</tbody></table></div>`;
    $$('[data-delete-problem]', $('#problemList')).forEach((button) => button.addEventListener('click', () => { if (!requireOwnerEditor()) return; problems = problems.filter((p) => String(p.id) !== button.dataset.deleteProblem); writeJSON(STORAGE.problems, problems); renderProblems(); }));
    $$('[data-edit-problem]', $('#problemList')).forEach((button) => button.addEventListener('click', () => { if (!requireOwnerEditor()) return; openProblemForm(problems.find((p) => String(p.id) === button.dataset.editProblem)); }));
  }
  function openProblemForm(existing = null) {
    if (!requireOwnerEditor()) return;
    openDialog(existing ? 'Edit problem' : 'Add a LeetCode problem', 'PRACTICE / JOURNAL', `
      <form id="problemForm" class="settings-form">
        <label class="form-field"><span>Problem title *</span><input name="title" required maxlength="100" value="${escapeHTML(existing?.title || '')}" placeholder="e.g. Reverse Linked List" /></label>
        <label class="form-field"><span>LeetCode problem URL</span><input name="url" inputmode="url" value="${escapeHTML(existing?.url || '')}" placeholder="https://leetcode.com/problems/..." /></label>
        <div class="form-row"><label class="form-field"><span>Difficulty</span><select name="difficulty"><option ${existing?.difficulty === 'Easy' ? 'selected' : ''}>Easy</option><option ${existing?.difficulty === 'Medium' ? 'selected' : ''}>Medium</option><option ${existing?.difficulty === 'Hard' ? 'selected' : ''}>Hard</option><option ${!existing || existing?.difficulty === 'Unspecified' ? 'selected' : ''}>Unspecified</option></select></label><label class="form-field"><span>Status</span><select name="status"><option value="practising" ${existing?.status !== 'solved' ? 'selected' : ''}>Practising</option><option value="solved" ${existing?.status === 'solved' ? 'selected' : ''}>Solved</option></select></label></div>
        <label class="form-field"><span>Topic / category</span><input name="topic" maxlength="60" value="${escapeHTML(existing?.topic || '')}" placeholder="e.g. Linked List, Arrays, Trees" /></label>
        <label class="form-field"><span>Notes (optional)</span><textarea name="notes" rows="3" maxlength="300" placeholder="What did you learn? Any important pattern?">${escapeHTML(existing?.notes || '')}</textarea></label>
        <div class="dialog-actions"><button type="button" class="button button-outline" data-cancel-form>Cancel</button><button type="submit" class="button button-primary">${existing ? 'Save changes' : 'Add to log'}</button></div>
      </form>
    `, () => {
      $('[data-cancel-form]', dialogContent).addEventListener('click', closeDialog);
      $('#problemForm', dialogContent).addEventListener('submit', (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const urlRaw = safeText(data.get('url'));
        const url = urlRaw ? safeExternalURL(urlRaw) : '';
        if (urlRaw && !url) { alert('Please enter a valid http or https URL.'); return; }
        const item = normalizeProblem({ id: existing?.id, title: data.get('title'), url, difficulty: data.get('difficulty'), topic: data.get('topic'), status: data.get('status'), notes: data.get('notes') });
        if (!item) return;
        if (existing) problems = problems.map((p) => String(p.id) === String(existing.id) ? item : p); else problems.unshift(item);
        writeJSON(STORAGE.problems, problems); closeDialog(); renderProblems();
      });
    });
  }
  $('#addProblemBtn').addEventListener('click', () => openProblemForm());
  $('#emptyAddProblem')?.addEventListener('click', openProblemForm);
  $('#problemSearch').addEventListener('input', renderProblems);
  $('#problemFilter').addEventListener('change', renderProblems);
  $('#exportProblems').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(problems, null, 2)], { type: 'application/json' });
    downloadBlob(blob, 'nitin-leetcode-practice-log.json');
  });
  $('#problemImport').addEventListener('change', async (event) => {
    if (!requireOwnerEditor()) { event.target.value = ''; return; }
    const file = event.target.files?.[0]; if (!file) return;
    try {
      const content = await file.text();
      let rows;
      if (file.name.toLowerCase().endsWith('.json')) {
        const parsed = JSON.parse(content); rows = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.problems) ? parsed.problems : []);
      } else rows = parseCSV(content);
      const imported = rows.map(normalizeProblem).filter(Boolean);
      const known = new Set(problems.map((p) => `${p.title.toLowerCase()}|${p.topic.toLowerCase()}`));
      const fresh = imported.filter((p) => !known.has(`${p.title.toLowerCase()}|${p.topic.toLowerCase()}`));
      problems = [...fresh, ...problems]; writeJSON(STORAGE.problems, problems); renderProblems();
      alert(`${fresh.length} new problem(s) imported. ${imported.length - fresh.length} duplicate(s) skipped.`);
    } catch (error) { alert(`Could not import this file: ${error.message}`); }
    event.target.value = '';
  });
  function parseCSV(text) {
    const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim());
    if (lines.length < 2) return [];
    const parseLine = (line) => { const out = []; let cell = ''; let quoted = false; for (let i = 0; i < line.length; i++) { const ch = line[i]; if (ch === '"' && line[i + 1] === '"' && quoted) { cell += '"'; i++; } else if (ch === '"') quoted = !quoted; else if (ch === ',' && !quoted) { out.push(cell.trim()); cell = ''; } else cell += ch; } out.push(cell.trim()); return out; };
    const headers = parseLine(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z]/g, ''));
    return lines.slice(1).map((line) => { const cells = parseLine(line); return Object.fromEntries(headers.map((key, index) => [key, cells[index] || ''])); });
  }

  // Skills / learning log entries can be added at any time.
  function renderLearningEntries() {
    const panel = $('#learningPanel');
    const existing = $('.user-learning-group', panel);
    if (existing) existing.remove();
    if (!learningEntries.length) return;
    const group = document.createElement('div');
    group.className = 'skill-group user-learning-group';
    group.innerHTML = `<span class="mono-label">MY LEARNING NOTES</span><div class="learning-entry-list">${learningEntries.map((item) => `<span class="learning-entry">${escapeHTML(item.title)} <small>${escapeHTML(item.status)}</small><button data-remove-learning="${item.id}" aria-label="Remove learning entry">×</button></span>`).join('')}</div>`;
    const footnote = $('.skill-footnote', panel); panel.insertBefore(group, footnote);
    $$('[data-remove-learning]', group).forEach((button) => button.addEventListener('click', () => { if (!requireOwnerEditor()) return; learningEntries = learningEntries.filter((item) => String(item.id) !== button.dataset.removeLearning); writeJSON(STORAGE.learning, learningEntries); renderLearningEntries(); }));
  }
  function openLearningForm() {
    if (!requireOwnerEditor()) return;
    openDialog('Add a learning entry', 'LEARNING / JOURNAL', `<form id="learningForm" class="settings-form"><label class="form-field"><span>Topic or technology *</span><input name="title" required maxlength="60" placeholder="e.g. Binary Search Trees" /></label><label class="form-field"><span>Current stage</span><select name="status"><option>Exploring</option><option>Practising</option><option>Studied</option><option>Building with it</option></select></label><div class="dialog-actions"><button type="button" class="button button-outline" data-cancel-form>Cancel</button><button type="submit" class="button button-primary">Add learning entry</button></div></form>`, () => {
      $('[data-cancel-form]', dialogContent).addEventListener('click', closeDialog);
      $('#learningForm', dialogContent).addEventListener('submit', (event) => { event.preventDefault(); const data = new FormData(event.currentTarget); learningEntries.push({ id: Date.now(), title: safeText(data.get('title')), status: safeText(data.get('status')) }); writeJSON(STORAGE.learning, learningEntries); closeDialog(); renderLearningEntries(); });
    });
  }
  $('#addLearningBtn').addEventListener('click', openLearningForm);
  renderLearningEntries();

  // Image uploads are compressed before saving locally to keep storage manageable.
  async function imageToDataURL(file, maxSize = 1200, quality = 0.76) {
    if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.');
    const image = await createImageBitmap(file);
    const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas'); canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale);
    const context = canvas.getContext('2d'); context.drawImage(image, 0, 0, canvas.width, canvas.height); image.close?.();
    return canvas.toDataURL('image/webp', quality);
  }
  function renderProjectImages(projectId) {
    const target = $(`#${projectId}Gallery`);
    const art = $(`#${projectId}Art`);
    if (!target || !art) return;
    const images = projectImages[projectId] || [];
    target.innerHTML = images.map((src, index) => `<div class="project-thumb"><img src="${src}" alt="${projectId.toUpperCase()} project image ${index + 1}" /><button data-remove-image="${projectId}:${index}" aria-label="Remove image">×</button></div>`).join('');
    const old = $('.uploaded-cover', art); if (old) old.remove();
    if (images[0]) { const img = document.createElement('img'); img.className = 'uploaded-cover'; img.src = images[0]; img.alt = `${projectId} uploaded project visual`; art.appendChild(img); }
    $$('[data-remove-image]', target).forEach((button) => button.addEventListener('click', () => {
      if (!requireOwnerEditor()) return;
      const [id, index] = button.dataset.removeImage.split(':'); projectImages[id].splice(Number(index), 1); writeJSON(STORAGE.projectImages, projectImages); renderProjectImages(id);
    }));
  }
  async function handleProjectImageUpload(projectId, fileList) {
    if (!requireOwnerEditor()) return;
    const files = [...fileList].slice(0, 3);
    try {
      for (const file of files) {
        const data = await imageToDataURL(file, 960, 0.66);
        projectImages[projectId] ||= []; projectImages[projectId].push(data);
      }
      writeJSON(STORAGE.projectImages, projectImages); renderProjectImages(projectId);
    } catch (error) { alert(error.message || 'Could not process that image.'); }
  }

  // Owner-added projects are stored locally first and included in the optional cloud publication payload.
  function renderCustomProjects() {
    const target = $('#customProjectGrid'); if (!target) return;
    target.innerHTML = customProjects.map((item) => `
      <article class="project-card custom-project-card glass" data-project-category="${escapeHTML(item.category || 'software')}">
        <div class="custom-project-cover">${item.image ? `<img src="${item.image}" alt="${escapeHTML(item.title)} project preview" loading="lazy">` : `<div class="custom-project-placeholder"><span>PROJECT / ${escapeHTML(String(item.year || ''))}</span><strong>${escapeHTML(item.title.slice(0, 2).toUpperCase())}</strong><small>ADD A PROJECT COVER</small></div>`}<span class="custom-project-label">${escapeHTML(item.categoryLabel || 'PERSONAL PROJECT')}</span></div>
        <div class="project-info"><div class="project-topline"><span class="project-type">ADDED PROJECT</span><span class="project-year">${escapeHTML(item.year || '—')}</span></div><h3>${escapeHTML(item.title)}</h3><p>${escapeHTML(item.summary || '')}</p><div class="project-footer"><span class="tag">${escapeHTML(item.stack || 'TECHNOLOGY')}</span><button class="project-action" data-view-custom-project="${escapeHTML(item.id)}">View project ↗</button></div><div class="custom-project-manage"><button type="button" data-edit-custom-project="${escapeHTML(item.id)}">Edit</button><button type="button" data-remove-custom-project="${escapeHTML(item.id)}">Remove</button></div></div>
      </article>`).join('');
    $$('[data-view-custom-project]', target).forEach((button) => button.addEventListener('click', () => {
      const item = customProjects.find((entry) => String(entry.id) === button.dataset.viewCustomProject); if (!item) return;
      openDialog(item.title, `PROJECT / ${item.year || 'DETAILS'}`, `<p class="dialog-description">${escapeHTML(item.summary || '')}</p><div class="project-modal-meta"><span class="mono-label">CATEGORY</span><strong>${escapeHTML(item.categoryLabel || 'Project')}</strong><span class="mono-label">TECHNOLOGY</span><strong>${escapeHTML(item.stack || 'Not specified')}</strong><span class="mono-label">ROLE</span><strong>${escapeHTML(item.role || 'Student developer')}</strong></div><div class="dialog-actions">${item.repo ? '<button class="button button-primary" id="customProjectRepo">Open repository ↗</button>' : ''}${item.demo ? '<button class="button button-outline" id="customProjectDemo">Open demo ↗</button>' : ''}</div>`, () => {
        $('#customProjectRepo', dialogContent)?.addEventListener('click', () => window.open(item.repo, '_blank', 'noopener,noreferrer'));
        $('#customProjectDemo', dialogContent)?.addEventListener('click', () => window.open(item.demo, '_blank', 'noopener,noreferrer'));
      });
    }));
    $$('[data-edit-custom-project]', target).forEach((button) => button.addEventListener('click', () => { if (!requireOwnerEditor()) return; openCustomProjectForm(customProjects.find((entry) => String(entry.id) === button.dataset.editCustomProject)); }));
    $$('[data-remove-custom-project]', target).forEach((button) => button.addEventListener('click', () => {
      if (!requireOwnerEditor()) return;
      if (!confirm('Remove this project from the portfolio?')) return;
      customProjects = customProjects.filter((entry) => String(entry.id) !== button.dataset.removeCustomProject);
      writeJSON(STORAGE.projects, customProjects); renderCustomProjects();
    }));
  }
  function openCustomProjectForm(existing = null) {
    if (!requireOwnerEditor()) return;
    openDialog(existing ? 'Edit project' : 'Add a project', 'PROJECT / PORTFOLIO', `
      <form id="customProjectForm" class="settings-form">
        <label class="form-field"><span>Project title *</span><input name="title" required maxlength="90" value="${escapeHTML(existing?.title || '')}" placeholder="e.g. RESQ Disaster Response Simulator" /></label>
        <div class="form-row"><label class="form-field"><span>Category</span><select name="category"><option value="software" ${existing?.category === 'software' ? 'selected' : ''}>Software & systems</option><option value="machine-learning" ${existing?.category === 'machine-learning' ? 'selected' : ''}>AI / Machine learning</option></select></label><label class="form-field"><span>Year</span><input name="year" maxlength="12" value="${escapeHTML(existing?.year || new Date().getFullYear())}" placeholder="2026" /></label></div>
        <label class="form-field"><span>Short project overview *</span><textarea name="summary" required rows="3" maxlength="420" placeholder="What does it do, and what problem does it explore?">${escapeHTML(existing?.summary || '')}</textarea></label>
        <div class="form-row"><label class="form-field"><span>Technologies</span><input name="stack" maxlength="100" value="${escapeHTML(existing?.stack || '')}" placeholder="C++, Python, scikit-learn…" /></label><label class="form-field"><span>Your role</span><input name="role" maxlength="100" value="${escapeHTML(existing?.role || 'Student developer')}" placeholder="Development, modelling, testing…" /></label></div>
        <label class="form-field"><span>GitHub repository URL</span><input name="repo" type="url" value="${escapeHTML(existing?.repo || '')}" placeholder="https://github.com/…" /></label>
        <label class="form-field"><span>Live demo URL (optional)</span><input name="demo" type="url" value="${escapeHTML(existing?.demo || '')}" placeholder="https://…" /></label>
        <label class="form-field"><span>Project cover image ${existing?.image ? '(leave empty to keep current image)' : '(optional)'}</span><input name="cover" type="file" accept="image/*" /></label>
        <div class="dialog-actions"><button type="button" class="button button-outline" data-cancel-form>Cancel</button><button type="submit" class="button button-primary">${existing ? 'Save project' : 'Add project'}</button></div>
      </form>`, () => {
      $('[data-cancel-form]', dialogContent).addEventListener('click', closeDialog);
      $('#customProjectForm', dialogContent).addEventListener('submit', async (event) => {
        event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
        const repoRaw = safeText(data.get('repo')); const demoRaw = safeText(data.get('demo'));
        const repo = repoRaw ? safeExternalURL(repoRaw) : ''; const demo = demoRaw ? safeExternalURL(demoRaw) : '';
        if ((repoRaw && !repo) || (demoRaw && !demo)) { alert('Please use valid http or https links.'); return; }
        const file = data.get('cover'); let image = existing?.image || '';
        try { if (file && file.size) image = await imageToDataURL(file, 960, 0.66); }
        catch (error) { alert(error.message || 'Could not process this image.'); return; }
        const category = String(data.get('category'));
        const item = { id: existing?.id || `project-${Date.now()}`, title: safeText(data.get('title')), category, categoryLabel: category === 'machine-learning' ? 'AI / MACHINE LEARNING' : 'SOFTWARE & SYSTEMS', year: safeText(data.get('year')), summary: safeText(data.get('summary')), stack: safeText(data.get('stack')), role: safeText(data.get('role')), repo, demo, image, updatedAt: Date.now() };
        if (existing) customProjects = customProjects.map((entry) => String(entry.id) === String(existing.id) ? item : entry); else customProjects.unshift(item);
        writeJSON(STORAGE.projects, customProjects); closeDialog(); renderCustomProjects();
      });
    });
  }
  $('#addProjectBtn')?.addEventListener('click', () => openCustomProjectForm());
  renderCustomProjects();
  [['resqImages', 'resq'], ['waterImages', 'water']].forEach(([inputId, projectId]) => {
    $(`#${inputId}`).addEventListener('change', (event) => { handleProjectImageUpload(projectId, event.target.files); event.target.value = ''; });
    renderProjectImages(projectId);
  });

  // Portrait is an optional local preview; upload does not alter facial features.
  $('#portraitUpload').addEventListener('change', async (event) => {
    if (!requireOwnerEditor()) { event.target.value = ''; return; }
    const file = event.target.files?.[0]; if (!file) return;
    try {
      const image = await imageToDataURL(file, 1000, 0.84);
      localStorage.setItem(STORAGE.portrait, image); applyPortrait(image); scheduleCloudSave();
    } catch (error) { alert(error.message || 'Could not load that photo.'); }
    event.target.value = '';
  });
  function applyPortrait(src) {
    const frame = $('#portraitFrame');
    let img = $('.portrait-photo', frame);
    if (!img) { img = document.createElement('img'); img.className = 'portrait-photo'; img.alt = 'Nitin Singh portrait'; frame.appendChild(img); }
    img.src = src; const holo = $('.portrait-holo', frame); if (holo) holo.src = src; $('#portraitInitials').hidden = true; $('#portraitNote').hidden = true;
  }
  const savedPortrait = localStorage.getItem(STORAGE.portrait); if (savedPortrait) applyPortrait(savedPortrait);

  // Credentials: add only completed, verifiable courses or achievements.
  function renderCredentials() {
    const target = $('#credentialGrid');
    if (!target) return;
    if (!credentials.length) {
      target.innerHTML = '<div class="credential-empty glass"><span class="empty-icon">✳</span><strong>No credentials added yet.</strong><p>Your certificates and course completions will appear here after you add them.</p></div>';
      return;
    }
    target.innerHTML = credentials.map((item) => `<article class="credential-card glass"><div class="credential-symbol">✦</div><div class="credential-copy"><span class="mono-label">${escapeHTML(item.issuer || 'COURSE / CERTIFICATE')}</span><span class="credential-type">${escapeHTML(item.type || 'Learning achievement')}</span><h3>${escapeHTML(item.title)}</h3><p>${escapeHTML(item.date || 'Date not specified')}${item.note ? ` · ${escapeHTML(item.note)}` : ''}</p></div><div class="credential-actions">${item.url ? `<button data-credential-open="${item.id}">View certificate ↗</button>` : '<span>PROOF NOT ADDED</span>'}<button class="credential-remove" data-credential-remove="${item.id}" aria-label="Remove credential">×</button></div></article>`).join('');
    $$('[data-credential-open]', target).forEach((button) => button.addEventListener('click', () => {
      const item = credentials.find((entry) => String(entry.id) === button.dataset.credentialOpen);
      if (!item) return;
      openDialog(item.title, 'CREDENTIAL / PROOF', `<div class="project-modal-meta"><span class="mono-label">ISSUER</span><strong>${escapeHTML(item.issuer || 'Not specified')}</strong><span class="mono-label">DATE</span><strong>${escapeHTML(item.date || 'Not specified')}</strong></div><p class="dialog-description">${escapeHTML(item.note || 'Credential details added to this portfolio.')}</p><div class="dialog-actions"><button class="button button-primary" id="openCredentialProof">Open certificate proof ↗</button></div>`, () => $('#openCredentialProof', dialogContent).addEventListener('click', () => { window.open(item.url, '_blank', 'noopener,noreferrer'); closeDialog(); }));
    }));
    $$('[data-credential-remove]', target).forEach((button) => button.addEventListener('click', () => { if (!requireOwnerEditor()) return; credentials = credentials.filter((item) => String(item.id) !== button.dataset.credentialRemove); writeJSON(STORAGE.credentials, credentials); renderCredentials(); }));
  }
  function openCredentialForm() {
    if (!requireOwnerEditor()) return;
    openDialog('Add a credential', 'COURSES / CERTIFICATES', `<form id="credentialForm" class="settings-form"><label class="form-field"><span>Credential type</span><select name="type"><option>Certification</option><option>Course completion</option><option>Workshop</option><option>Hackathon</option><option>Award</option><option>Academic achievement</option></select></label><label class="form-field"><span>Certificate or course title *</span><input name="title" required maxlength="90" placeholder="Exact course / certificate name" /></label><label class="form-field"><span>Issuing organization</span><input name="issuer" maxlength="70" placeholder="University, platform or organization" /></label><div class="form-row"><label class="form-field"><span>Completion date</span><input name="date" maxlength="30" placeholder="e.g. November 2026" /></label><label class="form-field"><span>Credential ID (optional)</span><input name="note" maxlength="70" placeholder="ID or short detail" /></label></div><label class="form-field"><span>Public certificate / proof URL (optional)</span><input name="url" type="url" placeholder="https://..." /></label><div class="dialog-actions"><button type="button" class="button button-outline" data-cancel-form>Cancel</button><button type="submit" class="button button-primary">Add credential</button></div></form>`, () => {
      $('[data-cancel-form]', dialogContent).addEventListener('click', closeDialog);
      $('#credentialForm', dialogContent).addEventListener('submit', (event) => {
        event.preventDefault(); const data = new FormData(event.currentTarget); const rawUrl = safeText(data.get('url')); const url = rawUrl ? safeExternalURL(rawUrl) : '';
        if (rawUrl && !url) { alert('Please enter a valid certificate URL.'); return; }
        credentials.unshift({ id: Date.now(), type: safeText(data.get('type')), title: safeText(data.get('title')), issuer: safeText(data.get('issuer')), date: safeText(data.get('date')), note: safeText(data.get('note')), url, createdAt: Date.now() });
        writeJSON(STORAGE.credentials, credentials); closeDialog(); renderCredentials();
      });
    });
  }
  $('#addCredentialBtn').addEventListener('click', openCredentialForm);
  renderCredentials();


  // Personal technical notebook. Entries remain in this browser and can be exported.
  let technicalNotes = readJSON(STORAGE.notes, []);
  function renderTechnicalNotes() {
    const target = $('#notesGrid'); if (!target) return;
    if (!technicalNotes.length) {
      target.innerHTML = '<div class="notes-empty glass"><span class="empty-icon">⌁</span><strong>Your technical notebook is ready.</strong><p>Add a concept, a debugging lesson or a resource you want to remember.</p></div>';
      return;
    }
    target.innerHTML = technicalNotes.slice().sort((a,b) => (b.createdAt || 0) - (a.createdAt || 0)).map((note) => `
      <article class="note-card glass">
        <div class="note-card-top"><span class="mono-label">${escapeHTML(note.topic || 'LEARNING NOTE')}</span><time>${escapeHTML(note.date || '')}</time></div>
        <h3>${escapeHTML(note.title)}</h3><p>${escapeHTML(note.body)}</p>
        <div class="note-card-actions">${note.url ? `<a href="${escapeHTML(note.url)}" target="_blank" rel="noopener noreferrer">Open reference ↗</a>` : '<span>PERSONAL NOTE</span>'}<button type="button" data-delete-note="${note.id}" aria-label="Delete ${escapeHTML(note.title)}">Remove ×</button></div>
      </article>`).join('');
    $$('[data-delete-note]', target).forEach((button) => button.addEventListener('click', () => {
      if (!requireOwnerEditor()) return;
      technicalNotes = technicalNotes.filter((note) => String(note.id) !== button.dataset.deleteNote);
      writeJSON(STORAGE.notes, technicalNotes); renderTechnicalNotes();
    }));
  }
  function openTechnicalNoteForm() {
    if (!requireOwnerEditor()) return;
    openDialog('Add a technical note', 'NOTEBOOK / PERSONAL LEARNING', `
      <form id="technicalNoteForm" class="settings-form">
        <label class="form-field"><span>Title *</span><input name="title" required maxlength="90" placeholder="e.g. Why a tail pointer helps when merging lists" /></label>
        <div class="form-row"><label class="form-field"><span>Topic</span><input name="topic" maxlength="40" placeholder="Data Structures, Python, ML…" /></label><label class="form-field"><span>Date</span><input name="date" type="date" value="${new Date().toISOString().slice(0,10)}" /></label></div>
        <label class="form-field"><span>What did you learn? *</span><textarea name="body" required rows="4" maxlength="900" placeholder="Write a short explanation, debugging lesson or takeaway."></textarea></label>
        <label class="form-field"><span>Optional reference URL</span><input name="url" type="url" placeholder="https://…" /></label>
        <div class="dialog-actions"><button type="button" class="button button-outline" data-cancel-form>Cancel</button><button type="submit" class="button button-primary">Save note</button></div>
      </form>`, () => {
      $('[data-cancel-form]', dialogContent).addEventListener('click', closeDialog);
      $('#technicalNoteForm', dialogContent).addEventListener('submit', (event) => {
        event.preventDefault(); const data = new FormData(event.currentTarget);
        const rawUrl = safeText(data.get('url')); const url = rawUrl ? safeExternalURL(rawUrl) : '';
        if (rawUrl && !url) { alert('Please enter a valid http or https reference URL.'); return; }
        technicalNotes.push({ id: Date.now(), title: safeText(data.get('title')), topic: safeText(data.get('topic')), date: safeText(data.get('date')), body: safeText(data.get('body')), url, createdAt: Date.now() });
        writeJSON(STORAGE.notes, technicalNotes); closeDialog(); renderTechnicalNotes();
      });
    });
  }
  $('#addNoteBtn')?.addEventListener('click', openTechnicalNoteForm);
  $('#exportNotesBtn')?.addEventListener('click', () => downloadBlob(new Blob([JSON.stringify(technicalNotes, null, 2)], { type: 'application/json' }), 'nitin-technical-notes.json'));
  renderTechnicalNotes();

  // Eleven short, factual reminders rotate automatically; they are editorial tips, not personal claims.
  const quickNotes = [
    { topic: 'LINKED LISTS', title: 'A tail pointer can make appending constant time.', body: 'When a linked list keeps a tail pointer, inserting at the end can be O(1). Without it, you usually walk from the head to find the last node.' },
    { topic: 'POINTERS IN C', title: 'A pointer stores an address, not the value itself.', body: 'Use * to access the value at an address and & to obtain an object’s address. Keep track of which variable owns allocated memory.' },
    { topic: 'MEMORY SAFETY', title: 'Update links before freeing a node.', body: 'For deletion in a linked list, first reconnect the surrounding nodes, then free the removed node. Do not read through a pointer after freeing it.' },
    { topic: 'EDGE CASES', title: 'Test the empty list and the one-node list.', body: 'Many linked-list bugs appear when head is NULL or when the node being removed is both the head and the tail. Test these cases deliberately.' },
    { topic: 'DYNAMIC MEMORY', title: 'Always check whether malloc succeeded.', body: 'malloc can return NULL when allocation fails. Check the returned pointer before writing through it, and free memory when it is no longer needed.' },
    { topic: 'BINARY SEARCH TREES', title: 'Inorder traversal visits BST keys in sorted order.', body: 'For a binary search tree, visiting left subtree, node, then right subtree returns keys in ascending order when the tree follows the usual ordering rule.' },
    { topic: 'GRAPH ALGORITHMS', title: 'BFS finds shortest paths in unweighted graphs.', body: 'Breadth-first search explores vertices level by level. In an unweighted graph, the first visit to a vertex gives a shortest path in number of edges.' },
    { topic: 'DEBUGGING', title: 'Trace one small input before changing the whole program.', body: 'Write down the values of important pointers, indexes and return values for a tiny example. A short trace often reveals the first incorrect state.' },
    { topic: 'MACHINE LEARNING', title: 'Keep test data out of the training process.', body: 'Split the data before fitting preprocessing steps. Fit a scaler on the training set, then use that fitted scaler to transform validation and test data.' },
    { topic: 'MODEL EVALUATION', title: 'A metric is useful only when read with context.', body: 'Compare MAE, RMSE and R² alongside the target scale, data split and baseline. A single high score does not prove a model generalizes.' },
    { topic: 'GIT & GITHUB', title: 'A useful commit explains the change.', body: 'Prefer focused commits such as “Add input validation to problem form” over vague messages such as “Update files”. Small commits are easier to review and undo.' }
  ];
  let quickNoteIndex = 0;
  let quickNoteTimer = null;
  let quickNoteSwapTimer = null;
  let quickNotePaused = reduceMotion;
  const quickNoteDuration = 9000;
  function showQuickNote(index, restartTimer = true) {
    const body = $('#quickNoteBody');
    const counter = $('#quickNoteCounter');
    const progress = $('#quickNoteProgress');
    if (!body || !progress) return;
    quickNoteIndex = (index + quickNotes.length) % quickNotes.length;
    const note = quickNotes[quickNoteIndex];
    body.classList.add('is-changing');
    window.clearTimeout(quickNoteSwapTimer);
    quickNoteSwapTimer = window.setTimeout(() => {
      body.innerHTML = `<span class="quick-note-topic">${escapeHTML(note.topic)}</span><h3>${escapeHTML(note.title)}</h3><p>${escapeHTML(note.body)}</p>`;
      body.classList.remove('is-changing');
    }, 140);
    if (counter) counter.textContent = `${String(quickNoteIndex + 1).padStart(2, '0')} / ${String(quickNotes.length).padStart(2, '0')}`;
    if (restartTimer) {
      window.clearTimeout(quickNoteTimer);
      progress.style.animation = 'none';
      progress.style.width = '0%';
      if (!quickNotePaused) {
        void progress.offsetWidth;
        progress.style.animation = `quickNoteProgress ${quickNoteDuration}ms linear forwards`;
        quickNoteTimer = window.setTimeout(() => showQuickNote(quickNoteIndex + 1), quickNoteDuration);
      }
    }
  }
  function setQuickNotesPaused(paused) {
    quickNotePaused = paused;
    const button = $('#quickNotePause');
    const progress = $('#quickNoteProgress');
    if (button) { button.textContent = paused ? '▶' : 'Ⅱ'; button.setAttribute('aria-label', paused ? 'Resume automatic notes' : 'Pause automatic notes'); }
    if (paused) { window.clearTimeout(quickNoteTimer); if (progress) progress.style.animationPlayState = 'paused'; }
    else { showQuickNote(quickNoteIndex); }
  }
  $('#quickNotePrev')?.addEventListener('click', () => showQuickNote(quickNoteIndex - 1));
  $('#quickNoteNext')?.addEventListener('click', () => showQuickNote(quickNoteIndex + 1));
  $('#quickNotePause')?.addEventListener('click', () => setQuickNotesPaused(!quickNotePaused));
  showQuickNote(0);
  if (reduceMotion) setQuickNotesPaused(true);

  // Live GitHub integration: public repositories are pulled from GitHub's REST API.
  function parseGitHubUsername(raw) {
    if (!raw) return '';
    const value = String(raw).trim();
    try {
      if (/^https?:\/\//i.test(value)) {
        const url = new URL(value);
        if (!/(^|\.)github\.com$/i.test(url.hostname)) return '';
        return (url.pathname.split('/').filter(Boolean)[0] || '').replace(/^@/, '');
      }
    } catch { return ''; }
    return value.replace(/^@/, '').split('/')[0].trim();
  }
  function validGitHubUsername(value) { return /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(value); }
  let githubRepos = [];
  function setSyncStatus(id, message, state = '') {
    const node = $(`#${id}`); if (!node) return;
    node.className = `sync-status${state ? ` is-${state}` : ''}`;
    node.innerHTML = `<span class="sync-dot"></span>${escapeHTML(message)}`;
  }
  function formatUpdated(value) {
    if (!value) return 'date unavailable';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'date unavailable' : `updated ${date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}`;
  }
  function renderGithubRepos(repos) {
    const grid = $('#githubRepoGrid'); if (!grid) return;
    if (!repos.length) {
      grid.innerHTML = '<div class="github-empty"><span class="repo-empty-symbol">GH</span><strong>No public original repositories found.</strong><small>Forks are hidden. Make sure the username is correct and the repositories are public.</small></div>';
      return;
    }
    grid.innerHTML = repos.map((repo) => `
      <button class="github-repo-card" type="button" data-github-repo="${repo.id}">
        <span class="repo-card-top"><span class="repo-folder">▱</span><span class="repo-visibility">PUBLIC REPOSITORY</span></span>
        <h4>${escapeHTML(repo.name)}</h4>
        <p>${escapeHTML(repo.description || 'No description added yet. Open the repository to see its README and source files.')}</p>
        <span class="repo-card-meta"><span><i class="repo-language-dot"></i>${escapeHTML(repo.language || 'Mixed / not specified')}</span><span>★ ${Number(repo.stargazers_count || 0)}</span><span>${escapeHTML(formatUpdated(repo.pushed_at))}</span></span>
      </button>`).join('');
    $$('[data-github-repo]', grid).forEach((button) => button.addEventListener('click', () => {
      const repo = githubRepos.find((item) => String(item.id) === button.dataset.githubRepo);
      if (!repo) return;
      const topics = Array.isArray(repo.topics) ? repo.topics.slice(0, 8) : [];
      openDialog(repo.name, 'GITHUB / PUBLIC REPOSITORY', `
        <div class="project-modal-meta"><span class="mono-label">DESCRIPTION</span><strong>${escapeHTML(repo.description || 'No description has been added to this repository yet.')}</strong><span class="mono-label">LANGUAGE</span><strong>${escapeHTML(repo.language || 'Not specified')}</strong><span class="mono-label">STARS / FORKS</span><strong>${Number(repo.stargazers_count || 0)} stars · ${Number(repo.forks_count || 0)} forks</strong><span class="mono-label">LAST PUSHED</span><strong>${escapeHTML(formatUpdated(repo.pushed_at))}</strong>${topics.length ? `<span class="mono-label">TOPICS</span><strong>${topics.map(escapeHTML).join(' · ')}</strong>` : ''}</div>
        <p class="dialog-description">This card is synced from the public GitHub repository list. Open the repository to view its README, code, issues, and complete project history.</p>
        <div class="dialog-actions"><button class="button button-outline" data-copy-repo>Copy repository link</button><button class="button button-primary" data-open-repo>View on GitHub ↗</button></div>
      `, () => {
        $('[data-open-repo]', dialogContent).addEventListener('click', () => { window.open(repo.html_url, '_blank', 'noopener,noreferrer'); closeDialog(); });
        $('[data-copy-repo]', dialogContent).addEventListener('click', async () => { try { await navigator.clipboard.writeText(repo.html_url); $('[data-copy-repo]', dialogContent).textContent = 'Copied'; } catch { alert(repo.html_url); } });
      });
    }));
  }
  async function syncGithubRepos(force = false) {
    const usernameInput = $('#githubUsernameInput');
    const username = (usernameInput?.value || localStorage.getItem(STORAGE.githubUsername) || window.PORTFOLIO_CONFIG?.githubUsername || parseGitHubUsername(links.github) || '').trim();
    if (!username) { setSyncStatus('githubSyncStatus', 'Enter your GitHub username to connect your public repositories.'); return; }
    if (!validGitHubUsername(username)) { setSyncStatus('githubSyncStatus', 'That username format does not look valid. Check the GitHub handle.', 'error'); return; }
    if (usernameInput && usernameInput.value !== username) usernameInput.value = username;
    localStorage.setItem(STORAGE.githubUsername, username);
    const cached = readJSON(STORAGE.githubReposCache, null);
    const maxAge = 10 * 60 * 1000;
    if (!force && cached?.username?.toLowerCase() === username.toLowerCase() && Date.now() - cached.savedAt < maxAge) {
      githubRepos = cached.repos || []; renderGithubRepos(githubRepos);
      setSyncStatus('githubSyncStatus', `Showing ${githubRepos.length} public repositories · cached ${new Date(cached.savedAt).toLocaleTimeString()}.`, 'success');
      return;
    }
    setSyncStatus('githubSyncStatus', `Connecting to GitHub as ${username}…`, 'loading');
    try {
      let allRepos = [];
      for (let page = 1; page <= 3; page++) {
        const endpoint = `https://api.github.com/users/${encodeURIComponent(username)}/repos?type=owner&sort=updated&per_page=100&page=${page}`;
        const response = await fetch(endpoint, { headers: { Accept: 'application/vnd.github+json' } });
        if (response.status === 404) throw new Error('GitHub username was not found. Check the spelling and try again.');
        if (response.status === 403) throw new Error('GitHub rate limit reached. Try Sync again later.');
        if (!response.ok) throw new Error(`GitHub returned ${response.status}. Please try again.`);
        const pageRepos = await response.json();
        if (!Array.isArray(pageRepos)) throw new Error('GitHub returned an unexpected repository response.');
        allRepos = allRepos.concat(pageRepos);
        const linkHeader = response.headers.get('Link') || '';
        if (!linkHeader.includes('rel="next"')) break;
      }
      githubRepos = allRepos.filter((repo) => !repo.fork && !repo.archived && !repo.disabled).sort((a, b) => new Date(b.pushed_at || 0) - new Date(a.pushed_at || 0));
      writeJSON(STORAGE.githubReposCache, { username, savedAt: Date.now(), repos: githubRepos });
      renderGithubRepos(githubRepos);
      setSyncStatus('githubSyncStatus', `Synced ${githubRepos.length} public original repositories for @${username}. New repos are picked up on the next sync.`, 'success');
    } catch (error) {
      const saved = cached?.username?.toLowerCase() === username.toLowerCase() ? cached : null;
      if (saved?.repos) { githubRepos = saved.repos; renderGithubRepos(githubRepos); setSyncStatus('githubSyncStatus', `${error.message} Showing the last saved repository list instead.`, 'error'); }
      else setSyncStatus('githubSyncStatus', error.message || 'Could not connect to GitHub. Check your connection and try again.', 'error');
    }
  }
  $('#connectGithubBtn')?.addEventListener('click', () => syncGithubRepos(true));
  $('#refreshGithubBtn')?.addEventListener('click', () => syncGithubRepos(true));
  const savedGitHubUsername = localStorage.getItem(STORAGE.githubUsername) || window.PORTFOLIO_CONFIG?.githubUsername || parseGitHubUsername(links.github);
  if ($('#githubUsernameInput') && savedGitHubUsername) $('#githubUsernameInput').value = savedGitHubUsername;
  if (savedGitHubUsername) syncGithubRepos(false);
  window.setInterval(() => { if (document.visibilityState === 'visible' && localStorage.getItem(STORAGE.githubUsername)) syncGithubRepos(false); }, 15 * 60 * 1000);

  // Live LeetCode public-profile integration. The profile endpoint is public; no session cookie is used.
  function parseLeetCodeUsername(raw) {
    if (!raw) return '';
    const value = String(raw).trim();
    try {
      if (/^https?:\/\//i.test(value)) {
        const url = new URL(value);
        if (!/(^|\.)leetcode\.com$/i.test(url.hostname)) return '';
        return (url.pathname.split('/').filter(Boolean).filter((part) => part !== 'u')[0] || '').replace(/^@/, '');
      }
    } catch { return ''; }
    return value.replace(/^@/, '').trim();
  }
  function lcNumber(value) { return Number.isFinite(Number(value)) ? Number(value).toLocaleString() : '—'; }
  function lcRequest(query, variables) {
    const params = new URLSearchParams({ query, variables: JSON.stringify(variables) });
    const url = `https://proxy.cors.dev/https://leetcode.com/graphql?${params.toString()}`;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 18000);
    return fetch(url, { method: 'GET', signal: controller.signal, headers: { Accept: 'application/json' } })
      .then(async (response) => { if (!response.ok) throw new Error(`LeetCode data service returned ${response.status}.`); return response.json(); })
      .finally(() => window.clearTimeout(timeout));
  }
  const LEETCODE_PROFILE_QUERY = `query portfolioProfile($username: String!, $limit: Int!) {
    matchedUser(username: $username) {
      username
      profile { ranking }
      submitStats { acSubmissionNum { difficulty count } }
      userCalendar { streak totalActiveDays }
    }
    recentAcSubmissionList(username: $username, limit: $limit) { title titleSlug timestamp }
    userContestRanking(username: $username) { rating attendedContestsCount globalRanking }
  }`;
  const LEETCODE_LANGUAGE_QUERY = `query portfolioLanguages($username: String!) {
    matchedUser(username: $username) { languageProblemCount { languageName problemsSolved } }
  }`;
  function renderLeetCodeStats(stats, isCached = false) {
    const target = $('#leetcodeLiveStats'); if (!target) return;
    const metrics = [
      [lcNumber(stats.total), 'TOTAL SOLVED'], [lcNumber(stats.easy), 'EASY'], [lcNumber(stats.medium), 'MEDIUM'],
      [lcNumber(stats.hard), 'HARD'], [stats.rank ? `#${lcNumber(stats.rank)}` : '—', 'GLOBAL RANK'],
      [stats.contestRating ? lcNumber(stats.contestRating) : '—', 'CONTEST RATING'], [lcNumber(stats.streak), 'CURRENT STREAK'], [lcNumber(stats.activeDays), 'ACTIVE DAYS']
    ];
    target.innerHTML = metrics.map(([value, label]) => `<div class="leetcode-live-stat"><strong>${value}</strong><span>${label}</span></div>`).join('');
    const languageTarget = $('#leetcodeLanguages');
    const languages = (stats.languages || []).slice(0, 7);
    if (languageTarget) {
      if (!languages.length) languageTarget.innerHTML = '<div class="language-empty">Language totals are not available from this profile response right now.</div>';
      else {
        const max = Math.max(...languages.map((item) => Number(item.problemsSolved) || 0), 1);
        languageTarget.innerHTML = languages.map((item) => `<div class="language-row"><span>${escapeHTML(item.languageName)}</span><span class="language-track"><span class="language-fill" style="width:${Math.max(2, (Number(item.problemsSolved) / max) * 100)}%"></span></span><span class="language-count">${lcNumber(item.problemsSolved)}</span></div>`).join('');
      }
    }
    const recentTarget = $('#leetcodeRecent');
    if (recentTarget) {
      const recent = stats.recent || [];
      recentTarget.innerHTML = recent.length ? recent.map((item) => {
        const when = item.timestamp ? new Date(Number(item.timestamp) * 1000).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : 'recent';
        const url = `https://leetcode.com/problems/${encodeURIComponent(item.titleSlug || '')}/`;
        return `<div class="recent-solve-item"><strong>${escapeHTML(item.title)}</strong><a href="${url}" target="_blank" rel="noopener noreferrer" aria-label="Open ${escapeHTML(item.title)} on LeetCode">${when} ↗</a></div>`;
      }).join('') : '<div class="language-empty">No recent accepted submissions were returned by the public profile.</div>';
    }
    const lastUpdated = $('#leetcodeLastUpdated');
    if (lastUpdated) lastUpdated.textContent = `${isCached ? 'CACHED' : 'UPDATED'} · ${new Date(stats.savedAt || Date.now()).toLocaleString()}`;
  }
  async function syncLeetCodeStats(force = false) {
    const usernameInput = $('#leetcodeUsernameInput');
    const username = (usernameInput?.value || localStorage.getItem(STORAGE.leetcodeUsername) || window.PORTFOLIO_CONFIG?.leetcodeUsername || parseLeetCodeUsername(links.leetcode) || '').trim();
    if (!username) { setSyncStatus('leetcodeSyncStatus', 'Enter your LeetCode username to connect your public profile.'); return; }
    if (!/^[A-Za-z0-9_-]{2,30}$/.test(username)) { setSyncStatus('leetcodeSyncStatus', 'That username format does not look valid. Check your LeetCode handle.', 'error'); return; }
    if (usernameInput && usernameInput.value !== username) usernameInput.value = username;
    localStorage.setItem(STORAGE.leetcodeUsername, username);
    const cached = readJSON(STORAGE.leetcodeStatsCache, null);
    const maxAge = 8 * 60 * 1000;
    if (!force && cached?.username?.toLowerCase() === username.toLowerCase() && Date.now() - cached.savedAt < maxAge) {
      renderLeetCodeStats(cached.stats, true);
      setSyncStatus('leetcodeSyncStatus', `Showing public LeetCode data for ${username} · refreshed ${new Date(cached.savedAt).toLocaleTimeString()}.`, 'success');
      return;
    }
    setSyncStatus('leetcodeSyncStatus', `Fetching public LeetCode statistics for ${username}…`, 'loading');
    try {
      const [profileResult, languageResult] = await Promise.all([
        lcRequest(LEETCODE_PROFILE_QUERY, { username, limit: 6 }),
        lcRequest(LEETCODE_LANGUAGE_QUERY, { username }).catch(() => null)
      ]);
      if (!profileResult?.data?.matchedUser) throw new Error(profileResult?.errors?.[0]?.message || 'LeetCode profile not found. Check the username.');
      const matched = profileResult.data.matchedUser;
      const accepted = matched.submitStats?.acSubmissionNum || [];
      const countFor = (difficulty) => Number(accepted.find((item) => String(item.difficulty).toLowerCase() === difficulty.toLowerCase())?.count || 0);
      const languages = languageResult?.data?.matchedUser?.languageProblemCount || [];
      const stats = {
        total: countFor('All'), easy: countFor('Easy'), medium: countFor('Medium'), hard: countFor('Hard'),
        rank: matched.profile?.ranking || 0, streak: matched.userCalendar?.streak || 0, activeDays: matched.userCalendar?.totalActiveDays || 0,
        contestRating: profileResult.data.userContestRanking?.rating ? Math.round(profileResult.data.userContestRanking.rating) : 0,
        languages: [...languages].sort((a, b) => Number(b.problemsSolved || 0) - Number(a.problemsSolved || 0)),
        recent: profileResult.data.recentAcSubmissionList || [], savedAt: Date.now()
      };
      writeJSON(STORAGE.leetcodeStatsCache, { username, savedAt: Date.now(), stats });
      renderLeetCodeStats(stats);
      setSyncStatus('leetcodeSyncStatus', `Live public profile synced for ${username}. Accepted solve counts and language totals are from LeetCode's profile data.`, 'success');
    } catch (error) {
      const saved = cached?.username?.toLowerCase() === username.toLowerCase() ? cached : null;
      if (saved?.stats) { renderLeetCodeStats(saved.stats, true); setSyncStatus('leetcodeSyncStatus', `${error.message} Showing your last saved snapshot instead.`, 'error'); }
      else setSyncStatus('leetcodeSyncStatus', `${error.message || 'Could not load LeetCode data.'} Check your connection and retry.`, 'error');
    }
  }
  $('#connectLeetcodeBtn')?.addEventListener('click', () => syncLeetCodeStats(true));
  $('#refreshLeetcodeBtn')?.addEventListener('click', () => syncLeetCodeStats(true));
  const savedLeetCodeUsername = localStorage.getItem(STORAGE.leetcodeUsername) || window.PORTFOLIO_CONFIG?.leetcodeUsername || parseLeetCodeUsername(links.leetcode);
  if ($('#leetcodeUsernameInput') && savedLeetCodeUsername) $('#leetcodeUsernameInput').value = savedLeetCodeUsername;
  if (savedLeetCodeUsername) syncLeetCodeStats(false);
  window.setInterval(() => { if (document.visibilityState === 'visible' && localStorage.getItem(STORAGE.leetcodeUsername)) syncLeetCodeStats(false); }, 10 * 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { syncGithubRepos(false); syncLeetCodeStats(false); } });

  function escapeHTML(value) { return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]); }
  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
  }

  // Optional shared cloud storage. Visitors can read published content; only the configured owner email can write.
  function mergeById(remoteItems, localItems) {
    const merged = new Map();
    [...(Array.isArray(remoteItems) ? remoteItems : []), ...(Array.isArray(localItems) ? localItems : [])].forEach((item, index) => {
      const key = String(item?.id ?? `${item?.title || 'item'}-${index}`);
      merged.set(key, item);
    });
    return [...merged.values()];
  }
  function collectCloudPayload() {
    return {
      schemaVersion: 1,
      notes: technicalNotes,
      problems,
      learningEntries,
      credentials,
      customProjects,
      projectImages,
      links,
      customLinks,
      portraitOverride: localStorage.getItem(STORAGE.portrait) || ''
    };
  }
  function writeCloudPayloadLocally(payload, mergeLocal = true) {
    const merge = (remote, local) => mergeLocal ? mergeById(remote, local) : (Array.isArray(remote) ? remote : []);
    problems = merge(payload.problems, problems);
    learningEntries = merge(payload.learningEntries, learningEntries);
    credentials = merge(payload.credentials, credentials);
    technicalNotes = merge(payload.notes, technicalNotes);
    customProjects = merge(payload.customProjects, customProjects);
    const remoteImages = payload.projectImages || {};
    if (mergeLocal) {
      projectImages = { ...remoteImages, ...projectImages };
      ['resq', 'water'].forEach((id) => { projectImages[id] = [...new Set([...(remoteImages[id] || []), ...(projectImages[id] || [])])]; });
    } else {
      projectImages = { resq: [...(remoteImages.resq || [])], water: [...(remoteImages.water || [])] };
    }
    links = mergeLocal ? { ...links, ...(payload.links || {}) } : { ...defaultLinks, ...(payload.links || {}) };
    customLinks = merge(payload.customLinks, customLinks);
    if (payload.portraitOverride && (!mergeLocal || !localStorage.getItem(STORAGE.portrait))) {
      localStorage.setItem(STORAGE.portrait, payload.portraitOverride);
      applyPortrait(payload.portraitOverride);
    }
    const pairs = [
      [STORAGE.problems, problems], [STORAGE.learning, learningEntries], [STORAGE.credentials, credentials],
      [STORAGE.notes, technicalNotes], [STORAGE.projects, customProjects], [STORAGE.projectImages, projectImages],
      [STORAGE.links, links], [STORAGE.customLinks, customLinks]
    ];
    pairs.forEach(([key, value]) => localStorage.setItem(key, JSON.stringify(value)));
    renderProblems(); renderLearningEntries(); renderCredentials(); renderTechnicalNotes(); renderCustomProjects();
    renderProjectImages('resq'); renderProjectImages('water'); renderCustomSocialLinks();
  }
  function isConfiguredOwner(session, cfg = window.PORTFOLIO_CLOUD_CONFIG || {}) {
    const configuredEmail = String(cfg.ownerEmail || '').trim().toLowerCase();
    const sessionEmail = String(session?.user?.email || '').trim().toLowerCase();
    return Boolean(session?.user?.id && configuredEmail && sessionEmail && sessionEmail === configuredEmail);
  }
  function mergeLocalDraftIntoPublishedState(draft) {
    if (!draft || localDraftMergedForOwner) return;
    const current = collectCloudPayload();
    const merged = {
      schemaVersion: 1,
      notes: mergeById(current.notes, draft.notes),
      problems: mergeById(current.problems, draft.problems),
      learningEntries: mergeById(current.learningEntries, draft.learningEntries),
      credentials: mergeById(current.credentials, draft.credentials),
      customProjects: mergeById(current.customProjects, draft.customProjects),
      customLinks: mergeById(current.customLinks, draft.customLinks),
      projectImages: { resq: [], water: [] },
      links: { ...(current.links || {}) },
      portraitOverride: draft.portraitOverride || current.portraitOverride || ''
    };
    ['resq', 'water'].forEach((id) => {
      merged.projectImages[id] = [...new Set([...(current.projectImages?.[id] || []), ...(draft.projectImages?.[id] || [])])];
    });
    Object.entries(draft.links || {}).forEach(([key, value]) => {
      if (value !== '' && value !== null && value !== undefined) merged.links[key] = value;
      else if (!(key in merged.links)) merged.links[key] = value;
    });
    writeCloudPayloadLocally(merged, false);
    localDraftMergedForOwner = true;
    preCloudLocalDraft = null;
    scheduleCloudSave();
  }
  async function saveCloudState() {
    if (!cloudClient || !cloudSession || !cloudHydrated || cloudSaving) { cloudSaveQueued = true; return; }
    cloudSaving = true; cloudSaveQueued = false; setCloudStatus('Publishing your notes, projects, credentials and learning data…', 'loading');
    try {
      const payload = collectCloudPayload();
      const payloadSize = new Blob([JSON.stringify(payload)]).size;
      if (payloadSize > 3500000) throw new Error('Your shared content is over 3.5 MB. Reduce the number or size of uploaded project images, then try again.');
      const { error } = await cloudClient.from('portfolio_state').upsert({ id: 'main', owner_id: cloudSession.user.id, payload, updated_at: new Date().toISOString() }, { onConflict: 'id' });
      if (error) throw error;
      setCloudStatus(`Published successfully · ${new Date().toLocaleTimeString()}. Visitors and your other devices will load this saved version.`, 'success');
    } catch (error) {
      console.error('Cloud publication failed:', error);
      setCloudStatus(`Cloud save failed: ${error.message || 'Check the setup and database permissions.'} Your local copy is still saved.`, 'error');
    } finally {
      cloudSaving = false;
      if (cloudSaveQueued) scheduleCloudSave();
    }
  }
  async function loadCloudState(mergeLocal = true) {
    if (!cloudClient) return;
    setCloudStatus('Checking for the latest published portfolio data…', 'loading');
    const { data, error } = await cloudClient.from('portfolio_state').select('payload, updated_at').eq('id', 'main').maybeSingle();
    if (error) throw error;
    if (data?.payload) {
      writeCloudPayloadLocally(data.payload, mergeLocal);
      setCloudStatus(`Showing published content · last updated ${new Date(data.updated_at).toLocaleString()}.`, 'success');
    } else {
      setCloudStatus('Cloud is connected, but no shared portfolio data exists yet. Sign in as the owner and publish your local content.', 'idle');
    }
    cloudHydrated = true;
    if (cloudSession && mergeLocal) scheduleCloudSave();
  }
  function subscribeToCloudChanges() {
    if (!cloudClient) return;
    cloudClient.channel('public-portfolio-live-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'portfolio_state', filter: 'id=eq.main' }, async () => {
        try { await loadCloudState(false); }
        catch (error) { console.warn('Could not refresh the published portfolio after a cloud update.', error); }
      })
      .subscribe();
  }
  function cloudSetupDialog() {
    openDialog('Publish your portfolio data', 'CLOUD / ONE-TIME SETUP', `
      <p class="dialog-description">Your portfolio is public and read-only for visitors. Supabase stores the published portfolio data; only the verified owner account can add or change projects, certificates, profile links, notes and the portrait.</p>
      <ol class="cloud-setup-list"><li>Create a Supabase project and add your own email as the only owner user.</li><li>Run <strong>supabase/schema.sql</strong> after replacing the owner-email placeholder.</li><li>Add the Project URL, anon/publishable key and the same owner email to <strong>cloud-config.js</strong>.</li><li>Add your local and live website addresses to Supabase Auth redirect URLs.</li><li>Open Owner sign-in, authenticate with your email link, then publish once. Future changes sync automatically.</li></ol>
      <p class="dialog-hint">Never place a Supabase service-role key in this website. Only the anon/public key belongs in cloud-config.js; database row-level security protects writes.</p>
      <div class="dialog-actions"><button class="button button-primary" id="cloudSetupClose">Got it</button></div>`, () => $('#cloudSetupClose', dialogContent).addEventListener('click', closeDialog));
  }
  async function openCloudManager() {
    const cfg = window.PORTFOLIO_CLOUD_CONFIG || {};
    if (!cloudClient) { cloudSetupDialog(); return; }
    if (cloudSession && isConfiguredOwner(cloudSession, cfg)) {
      openDialog('Cloud publishing', 'OWNER / SYNC STATUS', `<p class="dialog-description">Signed in as <strong>${escapeHTML(cloudSession.user.email || 'portfolio owner')}</strong>. Changes to notes, project entries, credentials, links and learning data will publish automatically.</p><div class="dialog-actions"><button class="button button-outline" id="cloudSignOut">Sign out</button><button class="button button-primary" id="cloudSyncNow">Publish now ↗</button></div>`, () => {
        $('#cloudSyncNow', dialogContent).addEventListener('click', async () => { closeDialog(); await saveCloudState(); });
        $('#cloudSignOut', dialogContent).addEventListener('click', async () => { await cloudClient.auth.signOut(); cloudSession = null; document.body.classList.remove('owner-mode'); closeDialog(); setCloudStatus('Signed out. Published content remains visible; owner edit controls are hidden until you sign in again.', 'idle'); });
      });
      return;
    }
    if (!cfg.enabled || !cfg.supabaseUrl || !cfg.supabaseAnonKey || !cfg.ownerEmail) { cloudSetupDialog(); return; }
    openDialog('Owner sign-in', 'CLOUD / MAGIC LINK', `<p class="dialog-description">Only the configured owner email can unlock editing. Supabase sends a one-time sign-in link; visitor accounts remain read-only.</p><form id="cloudLoginForm" class="settings-form"><label class="form-field"><span>Owner email</span><input name="email" type="email" required value="${escapeHTML(cfg.ownerEmail || '')}" placeholder="you@example.com" /></label><div class="dialog-actions"><button class="button button-primary" type="submit">Send sign-in link</button></div></form>`, () => {
      $('#cloudLoginForm', dialogContent).addEventListener('submit', async (event) => {
        event.preventDefault(); const email = new FormData(event.currentTarget).get('email').toString().trim();
        if (!cfg.ownerEmail || email.toLowerCase() !== cfg.ownerEmail.trim().toLowerCase()) { alert('Use the configured portfolio owner email.'); return; }
        const { error } = await cloudClient.auth.signInWithOtp({ email, options: { emailRedirectTo: new URL('/auth/confirm.html', window.location.origin).href, shouldCreateUser: false } });
        if (error) { alert(`Could not send sign-in link: ${error.message}`); return; }
        closeDialog(); setCloudStatus(`A sign-in link was sent to ${email}. Open it in this browser to enable publishing.`, 'loading');
      });
    });
  }
  $('#cloudSyncBtn')?.addEventListener('click', openCloudManager);
  $('#ownerAccessBtn')?.addEventListener('click', openCloudManager);
  async function initCloudSync() {
    const cfg = window.PORTFOLIO_CLOUD_CONFIG || {};
    // Preserve any local draft so the owner can publish it after signing in for the first time.
    preCloudLocalDraft = collectCloudPayload();
    document.body.classList.add('cloud-locked');
    document.body.classList.remove('owner-mode');

    if (!cfg.enabled || !cfg.supabaseUrl || !cfg.supabaseAnonKey || !cfg.ownerEmail) {
      setCloudStatus('Public preview mode · editing is locked until the owner configures cloud publishing and signs in.', 'idle');
      return;
    }
    if (!window.supabase?.createClient) {
      setCloudStatus('Cloud connection is unavailable. The portfolio remains in read-only mode; no visitor can edit it.', 'error');
      return;
    }
    try {
      cloudClient = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' }
      });
      const { data: sessionData, error: sessionError } = await cloudClient.auth.getSession();
      if (sessionError) throw sessionError;

      const initialSession = sessionData.session;
      const initialOwner = isConfiguredOwner(initialSession, cfg);
      cloudSession = initialOwner ? initialSession : null;
      if (initialSession && !initialOwner) {
        // Remove a non-owner session so it cannot be mistaken for the portfolio editor.
        await cloudClient.auth.signOut();
      }

      await loadCloudState(initialOwner);
      if (initialOwner) {
        document.body.classList.add('owner-mode');
        localDraftMergedForOwner = true;
        preCloudLocalDraft = null;
        setCloudStatus('Owner signed in · edits publish automatically to the live portfolio.', 'success');
      } else {
        setCloudStatus('Public portfolio · published content is visible to everyone. Owner sign-in is required to edit.', 'success');
      }
      subscribeToCloudChanges();

      cloudClient.auth.onAuthStateChange((event, session) => {
        const verifiedOwner = isConfiguredOwner(session, cfg);
        cloudSession = verifiedOwner ? session : null;
        document.body.classList.toggle('owner-mode', verifiedOwner);
        if (verifiedOwner) {
          setCloudStatus('Owner signed in · publishing enabled. Your local draft will be merged with the published portfolio.', 'success');
          mergeLocalDraftIntoPublishedState(preCloudLocalDraft);
          scheduleCloudSave();
        } else if (session) {
          setCloudStatus('This account is not the configured portfolio owner. Editing remains locked.', 'error');
          // Sign out outside the auth callback to avoid re-entrant Supabase auth operations.
          window.setTimeout(() => cloudClient?.auth.signOut(), 0);
        } else if (event === 'SIGNED_OUT') {
          setCloudStatus('Signed out · public content remains visible; all editing controls are locked.', 'idle');
        }
      });
    } catch (error) {
      console.error('Cloud initialization failed:', error);
      cloudSession = null;
      document.body.classList.remove('owner-mode');
      document.body.classList.add('cloud-locked');
      setCloudStatus(`Cloud connection failed: ${error.message || 'Check cloud-config.js and the Supabase SQL setup.'} Editing remains locked for safety.`, 'error');
    }
  }

  renderProblems();
  initCloudSync();
})();

/* Source file: hand-maintained, non-minified JavaScript. No build step.
 * Long HTML template literals are application source, not compiled output.
 * See SOURCE-CODE.md in the plugin root for the source map.
 */
(function () {
  'use strict';

  if (typeof SIMME_MEDIA_ORGANISER_DATA === 'undefined') return;

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const encode = (value) => String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const studioLoaderSvgMarkup = typeof SIMME_MEDIA_ORGANISER_DATA.studioLoaderSvg === 'string'
    ? SIMME_MEDIA_ORGANISER_DATA.studioLoaderSvg.trim()
    : '';

  const buildStudioLoaderCharacter = () => {
    if (studioLoaderSvgMarkup) {
      return `<div class="smo-studio-loading__character-art" aria-hidden="true">${studioLoaderSvgMarkup}</div>`;
    }
    const loaderUrl = SIMME_MEDIA_ORGANISER_DATA.studioLoaderUrl || '';
    return loaderUrl
      ? `<img src="${encode(loaderUrl)}" alt="Simme is organising your media" loading="eager" decoding="sync" fetchpriority="high" />`
      : '';
  };

  const primeStudioLoader = () => {
    if (studioLoaderSvgMarkup) {
      if ($('#smo-studio-loader-cache')) return;
      const cache = document.createElement('div');
      cache.id = 'smo-studio-loader-cache';
      cache.className = 'smo-studio-loader-cache';
      cache.setAttribute('aria-hidden', 'true');
      cache.innerHTML = `<div class="smo-studio-loading__character-art">${studioLoaderSvgMarkup}</div>`;
      document.body.appendChild(cache);
      return;
    }
    const loaderUrl = SIMME_MEDIA_ORGANISER_DATA.studioLoaderUrl || '';
    if (!loaderUrl) return;
    const img = new Image();
    try { img.decoding = 'sync'; } catch (e) {}
    try { img.fetchPriority = 'high'; } catch (e) {}
    img.src = loaderUrl;
  };

  const studioLoaderHtml = (title, detailTitle, detailBody) => `
    <div class="smo-studio-loading">
      <div class="smo-studio-loading__character">${buildStudioLoaderCharacter()}</div>
      <strong>${encode(title)}</strong>
      ${detailTitle
        ? `<div class="smo-studio-loading__detail"><b id="smo-studio-loading-step">${encode(detailTitle)}</b><span id="smo-studio-loading-note">${encode(detailBody || '')}</span></div>`
        : detailBody
          ? `<span>${encode(detailBody)}</span>`
          : ''}
    </div>`;

  primeStudioLoader();

  const api = async (action, data = {}, files = null) => {
    const form = new FormData();
    form.append('action', action);
    form.append('nonce', SIMME_MEDIA_ORGANISER_DATA.nonce);
    Object.entries(data).forEach(([key, value]) => {
      if (Array.isArray(value)) value.forEach((v) => form.append(`${key}[]`, v));
      else form.append(key, value == null ? '' : value);
    });
    if (files) Object.entries(files).forEach(([key, value]) => form.append(key, value));

    const response = await fetch(SIMME_MEDIA_ORGANISER_DATA.ajaxUrl, { method: 'POST', credentials: 'same-origin', body: form });
    const json = await response.json().catch(() => null);
    if (!json || !json.success) {
      const message = json && json.data && json.data.message ? json.data.message : SIMME_MEDIA_ORGANISER_DATA.strings.serverError;
      throw new Error(message);
    }
    return json.data;
  };

  const apiWithUploadProgress = (action, data = {}, files = null, callbacks = {}) => new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('action', action);
    form.append('nonce', SIMME_MEDIA_ORGANISER_DATA.nonce);
    Object.entries(data).forEach(([key, value]) => {
      if (Array.isArray(value)) value.forEach((v) => form.append(`${key}[]`, v));
      else form.append(key, value == null ? '' : value);
    });
    if (files) Object.entries(files).forEach(([key, value]) => form.append(key, value));

    const xhr = new XMLHttpRequest();
    xhr.open('POST', SIMME_MEDIA_ORGANISER_DATA.ajaxUrl, true);
    xhr.withCredentials = true;

    if (xhr.upload) {
      xhr.upload.addEventListener('progress', (event) => {
        if (!event.lengthComputable) return;
        if (typeof callbacks.progress === 'function') callbacks.progress(event.loaded, event.total);
      });
      xhr.upload.addEventListener('load', () => {
        if (typeof callbacks.uploaded === 'function') callbacks.uploaded();
      });
    }

    xhr.addEventListener('load', () => {
      let json = null;
      try { json = JSON.parse(xhr.responseText || ''); } catch (err) { json = null; }
      if (xhr.status < 200 || xhr.status >= 300 || !json || !json.success) {
        const message = json && json.data && json.data.message ? json.data.message : SIMME_MEDIA_ORGANISER_DATA.strings.serverError;
        reject(new Error(message));
        return;
      }
      resolve(json.data);
    });
    xhr.addEventListener('error', () => reject(new Error('The upload connection was interrupted. Please try again.')));
    xhr.addEventListener('abort', () => reject(new Error('The upload was cancelled.')));
    xhr.send(form);
  });

  const toast = (message, type = 'success', timeout = 3200) => {
    const region = $('#smo-toast-region');
    if (!region) return;
    const el = document.createElement('div');
    el.className = `smo-toast ${type === 'error' ? 'is-error' : ''}`;
    el.textContent = message;
    region.appendChild(el);
    setTimeout(() => el.remove(), timeout);
  };

  const icon = (name, cls = '') => `<svg class="smo-icon ${cls}" aria-hidden="true"><use href="#smo-i-${name}"></use></svg>`;

  const copyText = async (text) => {
    const value = String(text || '');
    if (!value) throw new Error('This media item does not have a public URL.');

    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return;
    }

    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    textarea.remove();
    if (!copied) throw new Error('Your browser would not copy the URL automatically.');
  };

  const flattenFolders = (tree, depth = 0, out = []) => {
    tree.forEach((folder) => {
      out.push({ ...folder, depth });
      if (folder.children && folder.children.length) flattenFolders(folder.children, depth + 1, out);
    });
    return out;
  };

  const findFolder = (tree, id) => {
    for (const folder of tree) {
      if (Number(folder.id) === Number(id)) return folder;
      const nested = findFolder(folder.children || [], id);
      if (nested) return nested;
    }
    return null;
  };

  const expandFolderPathTo = (libraryState, id) => {
    const target = Number(id || 0);
    if (!target) return;
    const walk = (tree, ancestors = []) => {
      for (const folder of tree || []) {
        const folderId = Number(folder.id);
        if (folderId === target) {
          ancestors.concat(folderId).forEach((ancestorId) => libraryState.expanded.add(Number(ancestorId)));
          return true;
        }
        if (walk(folder.children || [], ancestors.concat(folderId))) return true;
      }
      return false;
    };
    walk(libraryState.folders || []);
  };

  const formatFolderOptions = (tree, includeUnfiled = false) => {
    const flat = flattenFolders(tree, 0, []);
    const opts = [];
    if (includeUnfiled) opts.push('<option value="0">Unfiled</option>');
    flat.forEach((f) => opts.push(`<option value="${f.id}">${'— '.repeat(f.depth)}${encode(f.name)}</option>`));
    return opts.join('');
  };

  const getFileKindIcon = (kind) => ({ image: 'image', audio: 'audio', video: 'video', document: 'file' }[kind] || 'file');

  const library = () => {
    const wrap = $('[data-smo-screen="library"]');
    if (!wrap) return;

    const state = {
      page: 1,
      pages: 1,
      search: '',
      folder: 'all',
      type: 'all',
      alt: 'all',
      sort: 'date_desc',
      customPositioning: false,
      customPositioningEligible: false,
      preferCustomPositioning: true,
      lastLoadedFolder: null,
      reorderingId: 0,
      folderDraggingId: 0,
      folderActionId: 0,
      perPage: Number(SIMME_MEDIA_ORGANISER_DATA.settings.items_per_page || 48),
      view: localStorage.getItem('smo_view') || SIMME_MEDIA_ORGANISER_DATA.settings.default_view || 'grid',
      items: [],
      folders: Array.isArray(SIMME_MEDIA_ORGANISER_DATA.folderTree) ? SIMME_MEDIA_ORGANISER_DATA.folderTree : [],
      selected: new Set(),
      expanded: new Set(),
      loading: false,
      inspectorItem: null,
      altEditItem: null,
      favouriteOnly: false,
      preFavouritesView: null,
      helpEnabled: localStorage.getItem('smo_help_enabled') !== '0',
      selectionAnchorId: null,
      rangeComplete: false,
      rangeSelectEnabled: localStorage.getItem('smo_range_select_enabled') !== '0',
      studioData: null,
      studioSourceId: 'master',
      studioCrop: null,
      studioRotation: 0,
      studioFlipH: false,
      studioFlipV: false,
      studioPreviewUrl: '',
      studioPreviewTimer: null,
      studioCropMode: false,
      studioPreset: null,
      studioLabelAuto: false,
      studioSocialPlatform: localStorage.getItem('smo_social_platform') || 'instagram',
      studioSafeZonesEnabled: localStorage.getItem('smo_social_safe_zones') !== '0',
      studioFocusCanvas: false,
      studioTransparencyBg: 'checker',
      studioVersionsDrawerOpen: false,
      studioVersionsPinned: localStorage.getItem('smo_studio_versions_pinned') === '1',
      studioVersionsDiscoveryStarted: false,
      studioVersionsLayoutCleanup: null,
      studioEditVersionId: null,
      studioEditLocked: false,
      // Unsaved Image Studio work is kept in page memory per attachment.
      // Visual crop/safe-zone masks are deliberately NOT kept in the library DOM.
      studioSessions: new Map(),
      studioCropCleanup: null,
      bulkFolderCreateContext: false
    };
    const LIBRARY_WORKSPACE_KEY = 'smo_library_workspace_v1';
    const initialParams = new URLSearchParams(window.location.search);
    const initialView = initialParams.get('view');
    const initialSearch = initialParams.get('search');
    const hasExplicitLibraryDestination = !!initialView || initialSearch !== null;
    let restoredWorkspace = null;
    if (!hasExplicitLibraryDestination) {
      try {
        restoredWorkspace = JSON.parse(sessionStorage.getItem(LIBRARY_WORKSPACE_KEY) || 'null');
      } catch (err) {
        restoredWorkspace = null;
      }
      if (restoredWorkspace && typeof restoredWorkspace === 'object') {
        state.folder = String(restoredWorkspace.folder || 'all');
        state.page = Math.max(1, Number(restoredWorkspace.page || 1));
        state.search = String(restoredWorkspace.search || '');
        state.type = String(restoredWorkspace.type || 'all');
        state.alt = String(restoredWorkspace.alt || 'all');
        state.sort = String(restoredWorkspace.sort || 'date_desc');
        if (restoredWorkspace.view) state.view = String(restoredWorkspace.view);
        if (Array.isArray(restoredWorkspace.expanded)) {
          state.expanded = new Set(restoredWorkspace.expanded.map(Number).filter(Number.isFinite));
        }
        if (restoredWorkspace.preFavouritesView && typeof restoredWorkspace.preFavouritesView === 'object') {
          state.preFavouritesView = restoredWorkspace.preFavouritesView;
        }
      }
    }
    if (initialView) state.folder = initialView;
    if (initialSearch !== null) state.search = initialSearch;

    let lastKnownFolderTreeScroll = restoredWorkspace ? Math.max(0, Number(restoredWorkspace.folderTreeScrollTop || 0)) : 0;
    let libraryPositionRestored = !restoredWorkspace;

    // Always enter Simme Media at the top of its WordPress admin page. Browsers can
    // otherwise restore the previous document scroll position after navigation,
    // reopening the plugin halfway down the Library. Folder/filter/view state is
    // still remembered separately below.
    const forcePluginEntryTop = () => {
      if ('scrollRestoration' in window.history) {
        try { window.history.scrollRestoration = 'manual'; } catch (err) {}
      }
      const reset = () => {
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
        if (document.documentElement) document.documentElement.scrollTop = 0;
        if (document.body) document.body.scrollTop = 0;
      };
      reset();
      requestAnimationFrame(() => requestAnimationFrame(reset));
      window.setTimeout(reset, 80);
      window.setTimeout(reset, 240);
    };
    forcePluginEntryTop();
    window.addEventListener('pageshow', forcePluginEntryTop);
    window.addEventListener('load', forcePluginEntryTop, { once: true });
    window.addEventListener('pagehide', () => {
      if ('scrollRestoration' in window.history) {
        try { window.history.scrollRestoration = 'auto'; } catch (err) {}
      }
    });

    const persistLibraryWorkspace = () => {
      try {
        const folderTree = $('#smo-folder-tree');
        if (libraryPositionRestored && folderTree) {
          lastKnownFolderTreeScroll = Math.max(0, Number(folderTree.scrollTop || 0));
        }
        sessionStorage.setItem(LIBRARY_WORKSPACE_KEY, JSON.stringify({
          folder: state.folder,
          page: state.page,
          search: state.search,
          type: state.type,
          alt: state.alt,
          sort: state.sort,
          view: state.view,
          expanded: Array.from(state.expanded || []),
          preFavouritesView: state.preFavouritesView || null,
          folderTreeScrollTop: lastKnownFolderTreeScroll,
          savedAt: Date.now()
        }));
      } catch (err) {
        // Session storage is a convenience only; Library browsing must still work if it is unavailable.
      }
    };

    const restoreLibraryWorkspacePosition = () => {
      if (!restoredWorkspace || libraryPositionRestored) return;
      libraryPositionRestored = true;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const folderTree = $('#smo-folder-tree');
        if (folderTree && lastKnownFolderTreeScroll > 0) folderTree.scrollTop = lastKnownFolderTreeScroll;
      }));
    };

    const grid = $('#smo-media-grid');
    const search = $('#smo-search');
    const typeFilter = $('#smo-type-filter');
    const typeFilterShell = $('#smo-file-type-filter');
    const typeFilterTrigger = $('#smo-file-type-filter-trigger');
    const typeFilterMenu = $('#smo-file-type-filter-menu');
    const typeFilterCurrentVisual = $('#smo-file-type-filter-current-visual');
    const typeFilterCurrentLabel = $('#smo-file-type-filter-current-label');
    const typeFilterOptions = typeFilterShell ? $$('.smo-file-type-option', typeFilterShell) : [];
    const altFilter = $('#smo-alt-filter');
    const sort = $('#smo-sort');
    const prevButtons = $$('.smo-page-prev');
    const nextButtons = $$('.smo-page-next');
    const pageLabels = $$('.smo-page-label');
    const bulkbar = $('#smo-bulkbar');
    const selectedCount = $('#smo-selected-count');
    const selectAll = $('#smo-select-all');
    const favouritesToggle = $('#smo-favourites-toggle');
    const helpToggle = $('#smo-help-toggle');
    const historyUndo = $('#smo-history-undo');
    const historyRedo = $('#smo-history-redo');
    const rangeToggle = $('#smo-range-toggle');
    const appShell = $('#smo-library-shell');
    const librarySidebar = $('#smo-library-sidebar');
    const mobileNavTrigger = $('#smo-mobile-nav-trigger');
    const mobileNavClose = $('#smo-mobile-nav-close');
    const mobileNavScrim = $('#smo-mobile-nav-scrim');
    const mobileNavCurrent = $('#smo-mobile-nav-current');
    const mobileNavAction = $('#smo-mobile-nav-action');
    const desktopNavCollapse = $('#smo-desktop-nav-collapse');
    let desktopNavCollapsed = localStorage.getItem('smo_library_sidebar_collapsed') === '1';

    const closeFileTypeFilter = ({ restoreFocus = false } = {}) => {
      if (!typeFilterMenu || !typeFilterTrigger) return;
      const wasOpen = !typeFilterMenu.hidden;
      typeFilterMenu.hidden = true;
      typeFilterShell?.classList.remove('is-open');
      typeFilterTrigger.setAttribute('aria-expanded', 'false');
      if (restoreFocus && wasOpen) typeFilterTrigger.focus();
    };
    const openFileTypeFilter = () => {
      if (!typeFilterMenu || !typeFilterTrigger) return;
      typeFilterMenu.hidden = false;
      typeFilterShell?.classList.add('is-open');
      typeFilterTrigger.setAttribute('aria-expanded', 'true');
      const active = typeFilterOptions.find((option) => option.classList.contains('is-active')) || typeFilterOptions[0];
      window.requestAnimationFrame(() => active?.focus());
    };
    const syncFileTypeFilter = () => {
      if (!typeFilter) return;
      const value = String(typeFilter.value || 'all');
      const selected = typeFilterOptions.find((option) => String(option.dataset.typeValue || '') === value) || typeFilterOptions.find((option) => option.dataset.typeValue === 'all');
      typeFilterOptions.forEach((option) => {
        const active = option === selected;
        option.classList.toggle('is-active', active);
        option.setAttribute('aria-checked', active ? 'true' : 'false');
      });
      if (selected) {
        if (typeFilterCurrentVisual) {
          const visual = selected.querySelector('.smo-file-type-option__visual');
          typeFilterCurrentVisual.innerHTML = visual ? visual.innerHTML : '<span class="smo-file-badge is-file">ALL</span>';
        }
        if (typeFilterCurrentLabel) typeFilterCurrentLabel.textContent = selected.dataset.filterLabel || selected.querySelector('strong')?.textContent || 'All file types';
      }
    };

    const isCompactLibraryNav = () => !!appShell?.classList.contains('is-compact-nav');
    const currentLibraryNavLabel = () => (mobileNavCurrent?.textContent || 'All Media').trim();
    const syncLibraryNavBounds = () => {
      if (!appShell) return;
      const rect = appShell.getBoundingClientRect();
      const adminBarFloor = window.matchMedia('(max-width: 782px)').matches ? 46 : 32;
      const left = Math.max(0, rect.left);
      const right = Math.max(0, window.innerWidth - rect.right);
      const top = Math.max(adminBarFloor, rect.top);
      const bottom = Math.max(0, window.innerHeight - rect.bottom);
      appShell.style.setProperty('--smo-nav-shell-left', `${left}px`);
      appShell.style.setProperty('--smo-nav-shell-right', `${right}px`);
      appShell.style.setProperty('--smo-nav-shell-top', `${top}px`);
      appShell.style.setProperty('--smo-nav-shell-bottom', `${bottom}px`);
      appShell.style.setProperty('--smo-nav-shell-width', `${Math.max(1, rect.width)}px`);
    };
    const updateLibraryNavPresentation = () => {
      if (!appShell || !mobileNavTrigger) return;
      const compact = isCompactLibraryNav();
      const drawerOpen = compact && appShell.classList.contains('is-nav-open');
      const desktopCollapsed = !compact && appShell.classList.contains('is-sidebar-collapsed');
      const action = drawerOpen ? 'Close menu' : 'Open menu';
      if (mobileNavAction) mobileNavAction.textContent = action;
      mobileNavTrigger.setAttribute('aria-expanded', drawerOpen ? 'true' : (!desktopCollapsed && !compact ? 'true' : 'false'));
      mobileNavTrigger.setAttribute('aria-label', `${action}. Current view: ${currentLibraryNavLabel()}`);
      desktopNavCollapse?.setAttribute('aria-expanded', desktopCollapsed ? 'false' : 'true');
    };
    const setDesktopLibraryNavCollapsed = (collapsed, { persist = true, focusTrigger = false } = {}) => {
      if (!appShell || isCompactLibraryNav()) return;
      desktopNavCollapsed = !!collapsed;
      appShell.classList.toggle('is-sidebar-collapsed', desktopNavCollapsed);
      librarySidebar?.setAttribute('aria-hidden', desktopNavCollapsed ? 'true' : 'false');
      if (persist) localStorage.setItem('smo_library_sidebar_collapsed', desktopNavCollapsed ? '1' : '0');
      updateLibraryNavPresentation();
      if (focusTrigger && desktopNavCollapsed) window.requestAnimationFrame(() => mobileNavTrigger?.focus());
    };
    const closeLibraryNav = ({ restoreFocus = false } = {}) => {
      if (!appShell) return;
      const wasOpen = appShell.classList.contains('is-nav-open');
      appShell.classList.remove('is-nav-open');
      document.body.classList.remove('smo-mobile-nav-open');
      syncLibraryNavBounds();
      librarySidebar?.setAttribute('aria-hidden', isCompactLibraryNav() ? 'true' : (desktopNavCollapsed ? 'true' : 'false'));
      updateLibraryNavPresentation();
      if (restoreFocus && wasOpen) mobileNavTrigger?.focus();
    };
    const openLibraryNav = ({ focusClose = true } = {}) => {
      if (!appShell) return;
      if (!isCompactLibraryNav()) {
        setDesktopLibraryNavCollapsed(false);
        return;
      }
      syncLibraryNavBounds();
      appShell.classList.add('is-nav-open');
      librarySidebar?.setAttribute('aria-hidden', 'false');
      updateLibraryNavPresentation();
      if (focusClose) window.requestAnimationFrame(() => mobileNavClose?.focus());
    };
    const syncLibraryNavLayout = () => {
      if (!appShell) return;
      // Measure Simme's real workspace, not the browser viewport. WordPress' own
      // admin menu can remove a lot of usable width before the plugin sees it.
      syncLibraryNavBounds();
      // Beta90: use the compact Open menu / Viewing bar at every Library width.
      // Keeping one navigation model prevents the wide-screen sidebar from
      // replacing the cleaner drawer trigger on larger displays.
      const compact = true;
      appShell.classList.add('is-compact-nav');
      appShell.classList.remove('is-sidebar-collapsed');
      if (!appShell.classList.contains('is-nav-open')) librarySidebar?.setAttribute('aria-hidden', 'true');
      updateLibraryNavPresentation();
    };

    mobileNavTrigger?.addEventListener('click', () => {
      if (isCompactLibraryNav()) {
        appShell?.classList.contains('is-nav-open') ? closeLibraryNav({ restoreFocus: true }) : openLibraryNav();
      } else {
        setDesktopLibraryNavCollapsed(false);
      }
    });
    desktopNavCollapse?.addEventListener('click', () => setDesktopLibraryNavCollapsed(true, { focusTrigger: true }));
    mobileNavClose?.addEventListener('click', () => closeLibraryNav({ restoreFocus: true }));
    mobileNavScrim?.addEventListener('click', () => closeLibraryNav({ restoreFocus: true }));
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && appShell?.classList.contains('is-nav-open')) {
        event.preventDefault();
        closeLibraryNav({ restoreFocus: true });
      }
    });
    if (appShell && 'ResizeObserver' in window) {
      const libraryNavResizeObserver = new ResizeObserver(syncLibraryNavLayout);
      libraryNavResizeObserver.observe(appShell);
    } else {
      window.addEventListener('resize', syncLibraryNavLayout, { passive: true });
    }
    window.addEventListener('resize', syncLibraryNavBounds, { passive: true });
    let libraryNavScrollFrame = 0;
    window.addEventListener('scroll', () => {
      if (libraryNavScrollFrame) return;
      libraryNavScrollFrame = window.requestAnimationFrame(() => {
        libraryNavScrollFrame = 0;
        syncLibraryNavBounds();
      });
    }, { passive: true });
    syncLibraryNavLayout();

    /* Menu discovery on every full Library load.
     * Give the user one calm preview of the full Media menu each time the
     * Library page is entered or refreshed, then return it to the normal
     * closed state and gently pulse the burger trigger. It never steals focus
     * and deliberate user interaction immediately cancels the sequence. */
    let menuDiscoveryTimers = [];
    let menuDiscoveryRunning = false;
    let menuDiscoveryStarted = false;
    const clearMenuDiscoveryTimers = () => {
      menuDiscoveryTimers.forEach((timer) => window.clearTimeout(timer));
      menuDiscoveryTimers = [];
    };
    const stopMenuDiscovery = ({ keepCurrentState = true } = {}) => {
      clearMenuDiscoveryTimers();
      menuDiscoveryRunning = false;
      appShell?.classList.remove('is-menu-discovery-peek');
      mobileNavTrigger?.classList.remove('is-menu-discovery-glow', 'is-menu-discovery-static');
      if (!keepCurrentState && appShell?.classList.contains('is-nav-open')) closeLibraryNav();
    };
    const reduceMenuDiscoveryMotion = () => {
      const wrap = appShell?.closest('.smo-wrap');
      return wrap?.dataset.reduceMotion === '1' || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    };
    const startMenuDiscovery = () => {
      if (!appShell || !mobileNavTrigger || menuDiscoveryStarted || appShell.classList.contains('is-nav-open')) return;
      menuDiscoveryStarted = true;
      menuDiscoveryRunning = true;

      if (reduceMenuDiscoveryMotion()) {
        mobileNavTrigger.classList.add('is-menu-discovery-static');
        menuDiscoveryTimers.push(window.setTimeout(() => {
          mobileNavTrigger.classList.remove('is-menu-discovery-static');
          menuDiscoveryRunning = false;
        }, 3600));
        return;
      }

      menuDiscoveryTimers.push(window.setTimeout(() => {
        if (!menuDiscoveryRunning) return;
        appShell.classList.add('is-menu-discovery-peek');
        openLibraryNav({ focusClose: false });
      }, 650));

      menuDiscoveryTimers.push(window.setTimeout(() => {
        if (!menuDiscoveryRunning) return;
        closeLibraryNav();
      }, 2450));

      menuDiscoveryTimers.push(window.setTimeout(() => {
        if (!menuDiscoveryRunning) return;
        appShell.classList.remove('is-menu-discovery-peek');
        mobileNavTrigger.classList.add('is-menu-discovery-glow');
      }, 2900));

      menuDiscoveryTimers.push(window.setTimeout(() => {
        mobileNavTrigger.classList.remove('is-menu-discovery-glow');
        menuDiscoveryRunning = false;
      }, 6500));
    };

    // Any deliberate interaction cancels this load's automatic sequence and
    // leaves the user's chosen menu state untouched.
    mobileNavTrigger?.addEventListener('pointerdown', () => {
      if (menuDiscoveryRunning) stopMenuDiscovery({ keepCurrentState: true });
    }, { capture: true });
    mobileNavClose?.addEventListener('pointerdown', () => {
      if (menuDiscoveryRunning) stopMenuDiscovery({ keepCurrentState: true });
    }, { capture: true });
    mobileNavScrim?.addEventListener('pointerdown', () => {
      if (menuDiscoveryRunning) stopMenuDiscovery({ keepCurrentState: true });
    }, { capture: true });
    librarySidebar?.addEventListener('pointerdown', () => {
      if (menuDiscoveryRunning) stopMenuDiscovery({ keepCurrentState: true });
    }, { capture: true });
    mobileNavTrigger?.addEventListener('keydown', (event) => {
      if (menuDiscoveryRunning && (event.key === 'Enter' || event.key === ' ')) stopMenuDiscovery({ keepCurrentState: true });
    }, { capture: true });
    librarySidebar?.addEventListener('keydown', () => {
      if (menuDiscoveryRunning) stopMenuDiscovery({ keepCurrentState: true });
    }, { capture: true });

    window.requestAnimationFrame(() => startMenuDiscovery());

    const currentFolderId = () => /^\d+$/.test(String(state.folder)) ? Number(state.folder) : 0;

    const clearFiltersButton = $('#smo-clear-filters');
    const removeCustomPositioningButton = $('#smo-remove-custom-positioning');
    const customSortOption = sort?.querySelector('option[value="custom"]');
    const activeFilterCount = () => [
      !!String(state.search || '').trim(),
      state.type !== 'all',
      state.alt !== 'all',
      state.sort !== 'date_desc' && state.sort !== 'custom'
    ].filter(Boolean).length;
    const canArrangeCurrentView = () => state.customPositioningEligible
      && state.folder !== 'trash'
      && (state.sort === 'custom' || (!state.customPositioning && state.sort === 'date_desc'));

    const updateCustomPositioningControls = () => {
      if (customSortOption) {
        customSortOption.hidden = !state.customPositioning;
        customSortOption.disabled = !state.customPositioning;
      }
      if (removeCustomPositioningButton) {
        removeCustomPositioningButton.hidden = !state.customPositioning;
        const currentName = ($('#smo-current-path')?.textContent || 'this view').trim();
        removeCustomPositioningButton.setAttribute('data-help-text', `Remove the saved manual card order for ${currentName} and return to automatic sorting. This never moves, renames or deletes media.`);
      }
      if (sort) sort.value = state.sort === 'custom' && state.customPositioning ? 'custom' : (state.sort || 'date_desc');
    };

    const updateFilterClearState = () => {
      if (!clearFiltersButton) return;
      const count = activeFilterCount();
      clearFiltersButton.classList.toggle('has-active-filters', count > 0);
      const label = clearFiltersButton.querySelector('span');
      if (label) label.textContent = count > 0 ? `Clear active filters (${count})` : 'Clear filters';
      clearFiltersButton.disabled = count === 0;
      clearFiltersButton.setAttribute('data-help-text', count > 0
        ? `Clear ${count} active search/filter setting${count === 1 ? '' : 's'} and stay inside the current folder or Smart View.`
        : 'No search, type, ALT or sort filters are active.');
    };

    // Free Social Avatar Creator: one approved 1:1 avatar/profile preset per channel.
    const socialPlatforms = Object.freeze({
      instagram: { label: 'Instagram', icon: '◎', preset: { id: 'ig-profile', width: 320, height: 320 } },
      facebook: { label: 'Facebook', icon: 'f', preset: { id: 'fb-profile', width: 320, height: 320 } },
      x: { label: 'X', icon: 'X', preset: { id: 'x-profile', width: 400, height: 400 } },
      linkedin: { label: 'LinkedIn', icon: 'in', preset: { id: 'li-profile', width: 400, height: 400 } },
      youtube: { label: 'YouTube', icon: '▶', preset: { id: 'yt-profile', width: 800, height: 800 } },
      tiktok: { label: 'TikTok', icon: '♪', preset: { id: 'tt-profile', width: 200, height: 200 } },
      pinterest: { label: 'Pinterest', icon: 'P', preset: { id: 'pin-profile', width: 280, height: 280 } },
      threads: { label: 'Threads', icon: '@', preset: { id: 'threads-profile', width: 320, height: 320 } }
    });

    const socialZone = (x, y, width, height, label, tone = 'safe', note = '', shape = 'rect') => ({ x, y, width, height, label, tone, note, shape });

    // Avatar safe-zone geometry is derived from the real circular display mask,
    // not from an arbitrary inset. The platform-specific output target remains
    // authoritative for pixel-fit validation, while the guide itself scales
    // continuously with the user's live crop.
    const avatarSafeZones = (preset, model = 'circular-avatar-v1') => {
      const targetDiameter = Math.max(1, Math.min(Number(preset?.width || 1), Number(preset?.height || 1)));
      // Keep the model version explicit so a saved Working Version can reopen
      // with the same researched safe-zone behaviour even as future models evolve.
      if (model !== 'circular-avatar-v1') model = 'circular-avatar-v1';
      return [
        socialZone(
          0, 0, 1, 1,
          'Visible avatar area',
          'safe',
          `Circular display boundary at the ${targetDiameter} × ${targetDiameter} target output.`,
          'circle'
        ),
        socialZone(
          0, 0, 1, 1,
          'Corner crop area',
          'warning',
          'These four corner regions sit outside the circular avatar display and may be clipped.',
          'circle-corners'
        )
      ];
    };
    const socialPresetProfile = (platform, snapshot = null) => {
      const group = socialPlatforms[platform] || socialPlatforms.instagram;
      const basePreset = { ...group.preset };
      const targetWidth = Math.max(1, Number(snapshot?.socialTargetWidth || snapshot?.targetWidth || basePreset.width));
      const targetHeight = Math.max(1, Number(snapshot?.socialTargetHeight || snapshot?.targetHeight || basePreset.height));
      const safeZoneModel = String(snapshot?.safeZoneModel || 'circular-avatar-v1');
      const preset = { ...basePreset, width: targetWidth, height: targetHeight };
      return {
        ...preset,
        label: 'Avatar',
        platform,
        platformLabel: group.label,
        bestFor: 'Profile avatars and channel pictures.',
        fixedAspectRatio: true,
        safeZoneModel,
        safeZones: avatarSafeZones(preset, safeZoneModel),
        safeGuideLabel: 'Circular avatar display guide',
        safeGuideNote: `${group.label} target: ${preset.width} × ${preset.height} px. Green is the circular area retained by the avatar mask; amber corners are outside that circle.`
      };
    };
    const socialPresetShapeHtml = () => '<span class="smo-social-preset__shape"><i style="width:16px;height:16px"></i></span>';
    const socialPresetStatusMessage = (preset, crop) => {
      if (!preset || !crop) return { tone: '', title: 'Choose a channel avatar', body: 'Choose a channel to apply its 1:1 avatar size and circular safe-area guide.', aux: '' };
      const scale = Math.min(Number(crop.width) / Number(preset.width), Number(crop.height) / Number(preset.height));
      if (scale < 1) return { tone: 'is-low', title: 'Source is smaller than target', body: `Current crop is ${crop.width} × ${crop.height}.`, aux: 'Studio will preserve native quality rather than inventing pixels.' };
      if (scale < 1.35) return { tone: 'is-caution', title: 'Good fit', body: `Current crop is ${crop.width} × ${crop.height}.`, aux: 'Enough pixels, with limited repositioning headroom.' };
      return { tone: 'is-good', title: scale >= 2 ? 'Excellent fit' : 'Strong fit', body: `Current crop is ${crop.width} × ${crop.height}.`, aux: 'Enough source detail for a clean avatar crop.' };
    };
    const socialSafeZonesAvailable = (preset) => !!(preset && Array.isArray(preset.safeZones) && preset.safeZones.length);
    const socialSafeToggleText = (preset) => !preset ? 'Choose avatar for safe zones' : (state.studioSafeZonesEnabled ? 'Hide safe zones' : 'Show safe zones');
    const socialEmptyStatusHtml = () => '<span class="smo-social-status-dot"></span><div><strong>Choose a channel avatar</strong><span>Each channel includes one practical 1:1 avatar/profile preset.</span><small class="smo-social-status-aux">Selecting a channel sets the crop target and reveals the circular safe-area guide.</small></div>';
    const socialLogo = (platform) => {
      const data = socialPlatforms[platform] || socialPlatforms.instagram;
      return `<span class="smo-social-logo is-${encode(platform)}" aria-hidden="true">${encode(data.icon)}</span><span>${encode(data.label)}</span>`;
    };

    const positionBulkbar = () => {
      if (!bulkbar) return;
      const libraryPanel = $('.smo-library', wrap);
      if (!libraryPanel) return;
      const rect = libraryPanel.getBoundingClientRect();
      const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
      const inset = viewportWidth <= 680 ? 10 : 14;
      const left = Math.max(10, Math.round(rect.left + inset));
      const right = Math.max(10, Math.round(viewportWidth - rect.right + inset));
      bulkbar.style.left = `${left}px`;
      bulkbar.style.right = `${right}px`;
      bulkbar.style.width = 'auto';
      bulkbar.style.maxWidth = 'none';
      bulkbar.style.transform = 'none';
    };

    const studioLoadHealth = (bytes) => {
      const value = Math.max(0, Number(bytes || 0));
      let grade = 'A'; let label = 'Excellent'; let tone = 'excellent';
      if (value > 1024 * 1024) { grade = 'E'; label = 'Very heavy'; tone = 'poor'; }
      else if (value > 650 * 1024) { grade = 'D'; label = 'Heavy'; tone = 'poor'; }
      else if (value > 350 * 1024) { grade = 'C'; label = 'Could improve'; tone = 'fair'; }
      else if (value > 180 * 1024) { grade = 'B'; label = 'Good'; tone = 'good'; }
      const seconds = value ? (value * 8 / 10000000) : 0;
      const time = seconds < 0.1 ? '<0.1s' : `${seconds.toFixed(seconds < 1 ? 1 : 2)}s`;
      return { grade, label, tone, time };
    };

    const studioLoadHealthHtml = (bytes, prefix = 'Current file') => {
      const health = studioLoadHealth(bytes);
      return `<div class="smo-load-rating is-${health.tone}">
        <span class="smo-load-rating__grade">${health.grade}</span>
        <div><strong>${encode(prefix)} · ${health.label}</strong><span>Approx. ${health.time} transfer at 10 Mbps · filesize is the main signal used for this rating.</span></div>
      </div>`;
    };

    const studioLoadGuideHtml = () => `<div class="smo-load-guide"><strong>Load grade guide</strong><div class="smo-load-guide__list"><span class="smo-load-guide__item"><span class="smo-load-guide__dot is-a">A</span><span>lightweight</span></span><span class="smo-load-guide__item"><span class="smo-load-guide__dot is-b">B</span><span>good</span></span><span class="smo-load-guide__item"><span class="smo-load-guide__dot is-c">C</span><span>could improve</span></span><span class="smo-load-guide__item"><span class="smo-load-guide__dot is-d">D</span><span>heavy</span></span><span class="smo-load-guide__item"><span class="smo-load-guide__dot is-e">E</span><span>very heavy</span></span></div><span class="smo-load-guide__note">The guide is mainly based on filesize and shows an approximate transfer time at 10 Mbps.</span></div>`;

    const studioLoadBadge = (bytes) => {
      const health = studioLoadHealth(bytes);
      return `<span class="smo-mini-load is-${health.tone}" title="${encode(health.label)} · approx. ${encode(health.time)} at 10 Mbps">Load ${health.grade}</span>`;
    };

    let confirmResolver = null;
    const closeSimmeConfirm = (result) => {
      const modal = $('#smo-confirm-dialog');
      if (!modal || !modal.classList.contains('is-open')) return;
      modal.classList.remove('is-open', 'is-danger', 'is-warning');
      modal.setAttribute('aria-hidden', 'true');
      const resolve = confirmResolver;
      confirmResolver = null;
      if (resolve) resolve(!!result);
    };

    const simmeConfirm = ({ title = 'Confirm action', message = '', note = '', confirmLabel = 'Continue', tone = 'normal' } = {}) => new Promise((resolve) => {
      const modal = $('#smo-confirm-dialog');
      if (!modal) { resolve(window.confirm(`${title}\n\n${message}`)); return; }
      if (confirmResolver) closeSimmeConfirm(false);
      confirmResolver = resolve;
      modal.classList.toggle('is-danger', tone === 'danger');
      modal.classList.toggle('is-warning', tone === 'warning');
      $('#smo-confirm-title').textContent = title;
      $('#smo-confirm-message').textContent = message;
      const noteEl = $('#smo-confirm-note');
      noteEl.textContent = note || '';
      noteEl.hidden = !note;
      const action = $('#smo-confirm-action');
      action.textContent = confirmLabel;
      action.classList.toggle('smo-button--danger', tone === 'danger');
      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden', 'false');
      setTimeout(() => action.focus(), 10);
      if (!modal.dataset.bound) {
        modal.dataset.bound = '1';
        $$('[data-smo-confirm-cancel]', modal).forEach((el) => el.addEventListener('click', () => closeSimmeConfirm(false)));
        $('#smo-confirm-action', modal).addEventListener('click', () => closeSimmeConfirm(true));
      }
    });

    let trashTimerIds = [];
    const closeTrashTimer = () => {
      const modal = $('#smo-trash-timer-dialog');
      if (!modal) return;
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
      trashTimerIds = [];
    };

    const openTrashTimer = (ids) => {
      const modal = $('#smo-trash-timer-dialog');
      if (!modal) return toast('The purge timer panel could not be opened.', 'error');
      const uniqueIds = Array.from(new Set((ids || []).map(Number).filter(Boolean)));
      const items = state.items.filter((item) => uniqueIds.includes(Number(item.id)) && !!item.trashed);
      const eligible = items.filter((item) => !item.protected).map((item) => Number(item.id));
      const protectedCount = items.length - eligible.length;
      if (!eligible.length) return toast(protectedCount ? 'Remove asset protection before changing the purge timer.' : 'No Trash items were selected.', 'error', 5200);
      trashTimerIds = eligible;
      const selection = $('#smo-trash-timer-selection');
      if (selection) selection.textContent = `${eligible.length} Trash item${eligible.length === 1 ? '' : 's'} selected${protectedCount ? ` · ${protectedCount} protected item${protectedCount === 1 ? '' : 's'} excluded` : ''}`;
      const amountInput = $('#smo-trash-timer-amount');
      const unitSelect = $('#smo-trash-timer-unit');
      const first = items.find((item) => eligible.includes(Number(item.id)));
      if (amountInput && unitSelect) {
        if (first && first.trashTimerOverridden && first.trashReadyAt) {
          const remainingMs = Math.max(0, new Date(first.trashReadyAt).getTime() - Date.now());
          if (remainingMs <= 0) {
            amountInput.value = '0';
            unitSelect.value = 'minutes';
          } else if (remainingMs < 24 * 60 * 60 * 1000) {
            amountInput.value = String(Math.max(1, Math.ceil(remainingMs / (60 * 60 * 1000))));
            unitSelect.value = 'hours';
          } else {
            amountInput.value = String(Math.max(1, Math.ceil(remainingMs / (24 * 60 * 60 * 1000))));
            unitSelect.value = 'days';
          }
        } else {
          amountInput.value = '24';
          unitSelect.value = 'hours';
        }
      }
      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden', 'false');
      setTimeout(() => amountInput?.focus(), 10);
    };

    const saveTrashTimer = async ({ reset = false } = {}) => {
      if (!trashTimerIds.length) return closeTrashTimer();
      const amountInput = $('#smo-trash-timer-amount');
      const unitSelect = $('#smo-trash-timer-unit');
      const amount = Math.max(0, Number(amountInput?.value || 0));
      const unit = unitSelect?.value || 'hours';
      if (!reset && !Number.isFinite(amount)) return toast('Enter a valid purge unlock time.', 'error');
      if (!reset && amount === 0) {
        const confirmed = await simmeConfirm({
          title: 'Make permanent purge available now?',
          message: `This removes the waiting period for ${trashTimerIds.length} selected Trash item${trashTimerIds.length === 1 ? '' : 's'}.`,
          note: 'Nothing is deleted by this timer change. You will still have to choose Purge permanently and pass both destructive confirmation gates.',
          confirmLabel: 'Unlock purge now',
          tone: 'warning'
        });
        if (!confirmed) return;
      }
      try {
        const data = await api('simme_media_organiser_set_purge_timer', {
          ids: trashTimerIds,
          amount: reset ? 0 : amount,
          unit,
          reset: reset ? 1 : 0
        });
        const changed = Number(data.changed || 0);
        const blocked = Number(data.blockedProtected || 0) + Number(data.blockedPermission || 0);
        closeTrashTimer();
        if (reset) toast(`${changed} Trash item${changed === 1 ? '' : 's'} returned to the normal protection period.${blocked ? ` ${blocked} item${blocked === 1 ? '' : 's'} could not be changed.` : ''}`, 'success', 5600);
        else if (amount === 0) toast(`${changed} Trash item${changed === 1 ? '' : 's'} ${changed === 1 ? 'is' : 'are'} now ready to purge. Nothing has been deleted.`, 'success', 6000);
        else toast(`Custom purge unlock timer set for ${changed} Trash item${changed === 1 ? '' : 's'}. Nothing will be deleted automatically.`, 'success', 6000);
        await load();
      } catch (err) { toast(err.message, 'error', 7000); }
    };

    const trashTimerModal = $('#smo-trash-timer-dialog');
    if (trashTimerModal && !trashTimerModal.dataset.bound) {
      trashTimerModal.dataset.bound = '1';
      $$('[data-trash-timer-close]', trashTimerModal).forEach((el) => el.addEventListener('click', closeTrashTimer));
      $$('[data-trash-timer-quick]', trashTimerModal).forEach((button) => button.addEventListener('click', () => {
        const amount = $('#smo-trash-timer-amount');
        const unit = $('#smo-trash-timer-unit');
        if (amount) amount.value = button.dataset.trashTimerQuick || '0';
        if (unit) unit.value = button.dataset.trashTimerUnit || 'hours';
        $$('[data-trash-timer-quick]', trashTimerModal).forEach((choice) => choice.classList.toggle('is-selected', choice === button));
      }));
      $('#smo-trash-timer-save', trashTimerModal)?.addEventListener('click', () => saveTrashTimer({ reset: false }));
      $('#smo-trash-timer-reset', trashTimerModal)?.addEventListener('click', () => saveTrashTimer({ reset: true }));
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && trashTimerModal.classList.contains('is-open')) closeTrashTimer();
      });
    }

    const copiedFeedback = (button, defaultLabel = 'Copy URL') => {
      if (!button) return;
      if (!button.dataset.copyOriginal) button.dataset.copyOriginal = button.innerHTML;
      button.classList.add('is-copied');
      button.innerHTML = `${icon('check')}<span>Copied</span>`;
      clearTimeout(Number(button.dataset.copyTimer || 0));
      const timer = setTimeout(() => {
        if (!button.isConnected) return;
        button.classList.remove('is-copied');
        button.innerHTML = button.dataset.copyOriginal || `${icon('copy')}<span>${encode(defaultLabel)}</span>`;
      }, 1300);
      button.dataset.copyTimer = String(timer);
    };

    const studioIconMarkup = (className = '') => {
      const url = SIMME_MEDIA_ORGANISER_DATA.studioIconUrl || '';
      return url ? `<img class="smo-studio-action-icon ${encode(className)}" src="${encode(url)}" alt="" aria-hidden="true" />` : icon('studio');
    };

    let historyState = { undo: null, redo: null };
    const syncHistoryControls = () => {
      const undo = historyState?.undo || null;
      const redo = historyState?.redo || null;
      if (historyUndo) {
        historyUndo.disabled = !undo;
        historyUndo.dataset.activityId = undo?.id ? String(undo.id) : '';
        historyUndo.setAttribute('aria-label', undo ? `Undo: ${undo.summary}` : 'Undo — no reversible action available');
        historyUndo.setAttribute('data-help-title', undo ? `Undo: ${undo.summary}` : 'Undo');
        historyUndo.setAttribute('data-help-text', undo ? `Reverse the most recent reversible action: ${undo.summary}.` : 'There is no reversible Media Organiser action available to undo.');
      }
      if (historyRedo) {
        historyRedo.disabled = !redo;
        historyRedo.dataset.activityId = redo?.id ? String(redo.id) : '';
        historyRedo.setAttribute('aria-label', redo ? `Redo: ${redo.summary}` : 'Redo — no undone action available');
        historyRedo.setAttribute('data-help-title', redo ? `Redo: ${redo.summary}` : 'Redo');
        historyRedo.setAttribute('data-help-text', redo ? `Re-apply the most recently undone action: ${redo.summary}.` : 'There is no safely redoable Media Organiser action available.');
      }
    };
    const refreshHistoryControls = async () => {
      if (!historyUndo || !historyRedo) return;
      try {
        historyState = await api('simme_media_organiser_history_state');
      } catch (err) {
        historyState = { undo: null, redo: null };
      }
      syncHistoryControls();
    };
    const runHistoryAction = async (direction) => {
      const item = direction === 'redo' ? historyState?.redo : historyState?.undo;
      const button = direction === 'redo' ? historyRedo : historyUndo;
      if (!item?.id || !button || button.disabled) return;
      const undoButton = historyUndo;
      const redoButton = historyRedo;
      if (undoButton) undoButton.disabled = true;
      if (redoButton) redoButton.disabled = true;
      button.classList.add('is-working');
      try {
        const data = await api(direction === 'redo' ? 'simme_media_organiser_redo_activity' : 'simme_media_organiser_undo_activity', { id: item.id });
        toast(data.message || (direction === 'redo' ? 'Action redone.' : 'Action undone.'));
        historyState = data.history || { undo: null, redo: null };
        await load();
      } catch (err) {
        toast(err.message, 'error', 5000);
        await refreshHistoryControls();
      } finally {
        button.classList.remove('is-working');
        syncHistoryControls();
      }
    };

    const skeleton = () => {
      grid.innerHTML = Array.from({ length: Math.min(12, state.perPage) }, () => '<div class="smo-skeleton"></div>').join('');
    };

    const load = async () => {
      if (state.loading) return;
      state.loading = true;
      if (String(state.lastLoadedFolder) !== String(state.folder)) state.preferCustomPositioning = true;
      skeleton();
      try {
        const data = await api('simme_media_organiser_list_media', {
          page: state.page,
          per_page: state.perPage,
          search: state.search,
          folder: state.folder,
          type: state.type,
          alt: state.alt,
          sort: state.sort,
          prefer_custom: state.preferCustomPositioning ? 1 : 0,
          favourite_only: state.favouriteOnly ? 1 : 0
        });
        state.items = data.items || [];
        state.pages = data.pages || 1;
        state.page = Math.max(1, Number(data.page || state.page));
        state.folders = data.folders || state.folders;
        state.customPositioningEligible = !!data.customPositioningEligible;
        state.customPositioning = !!data.customPositioning;
        state.sort = String(data.effectiveSort || state.sort || 'date_desc');
        state.lastLoadedFolder = String(state.folder);
        updateCustomPositioningControls();
        if (/^\d+$/.test(String(state.folder || ''))) expandFolderPathTo(state, state.folder);
        state.selected.clear();
        state.selectionAnchorId = null;
        state.rangeComplete = false;
        renderFolders();
        renderFolderDropdowns();
        renderMedia();
        updateBulk();
        updateStats(data.stats || {});
        $('#smo-result-count').textContent = `${data.total || 0} item${Number(data.total) === 1 ? '' : 's'}`;
        const viewExplanation = $('#smo-view-explanation');
        if (viewExplanation) {
          if (state.folder === 'trash') {
            viewExplanation.hidden = false;
            viewExplanation.textContent = 'Recoverable holding Trash — original files and URLs stay intact until a later manual permanent purge.';
          } else {
            viewExplanation.hidden = true;
            viewExplanation.textContent = '';
          }
        }
        const trashToolbar = $('#smo-trash-toolbar');
        if (trashToolbar) {
          trashToolbar.hidden = state.folder !== 'trash';
          const trashNote = $('#smo-trash-toolbar-note');
          if (trashNote) trashNote.textContent = `Your normal protection period is ${Number(SIMME_MEDIA_ORGANISER_DATA.settings.trash_retention_days || 30)} days. You can set a custom purge unlock timer for selected Trash items, and expiry still never deletes them automatically.`;
        }
        const pathLabel = data.currentPath || 'All Media';
        const currentFolder = /^\d+$/.test(String(state.folder || '')) ? findFolder(state.folders, Number(state.folder)) : null;
        const titleLabel = state.folder === 'all'
          ? 'Media Library'
          : (currentFolder?.name || pathLabel);
        $('#smo-current-path').textContent = pathLabel;
        if (mobileNavCurrent) mobileNavCurrent.textContent = pathLabel;
        updateLibraryNavPresentation();
        const currentTitle = $('#smo-current-title');
        const currentTitleText = $('#smo-current-title-text');
        if (currentTitleText) currentTitleText.textContent = titleLabel;
        else if (currentTitle) currentTitle.textContent = titleLabel;
        currentTitle?.classList.toggle('is-folder-title', !!currentFolder);
        if (currentTitle) {
          if (currentFolder) {
            currentTitle.setAttribute('tabindex', '0');
            currentTitle.setAttribute('aria-label', `Current folder: ${titleLabel}. Hover or focus to reveal the full name when it is longer than the title panel.`);
          } else {
            currentTitle.removeAttribute('tabindex');
            currentTitle.removeAttribute('aria-label');
          }
        }
        const refreshCurrentTitleOverflow = () => {
          if (!currentTitle || !currentTitleText || !currentFolder) {
            currentTitle?.classList.remove('is-overflowing');
            currentTitle?.style.removeProperty('--smo-title-scroll-distance');
            return;
          }
          currentTitle.classList.remove('is-overflowing');
          currentTitle.style.removeProperty('--smo-title-scroll-distance');
          window.requestAnimationFrame(() => {
            const overflow = Math.ceil(currentTitleText.scrollWidth - currentTitle.clientWidth);
            if (overflow > 4) {
              currentTitle.style.setProperty('--smo-title-scroll-distance', `${overflow + 6}px`);
              currentTitle.classList.add('is-overflowing');
            }
          });
        };
        refreshCurrentTitleOverflow();
        const currentFolderColour = $('#smo-current-folder-colour');
        if (currentFolderColour) {
          if (currentFolder) {
            currentFolderColour.hidden = false;
            currentFolderColour.style.setProperty('--smo-current-folder-colour', currentFolder.colour || '#8c5cff');
            currentFolderColour.setAttribute('title', `${currentFolder.name} folder colour`);
          } else {
            currentFolderColour.hidden = true;
            currentFolderColour.style.removeProperty('--smo-current-folder-colour');
            currentFolderColour.removeAttribute('title');
          }
        }
        const currentFolderRename = $('#smo-current-folder-rename');
        const currentFolderRenameForm = $('#smo-current-folder-rename-form');
        if (currentFolderRename) currentFolderRename.hidden = !currentFolder;
        if (!currentFolder && currentFolderRenameForm) {
          currentFolderRenameForm.hidden = true;
          currentFolderRenameForm.closest('.smo-current-title-row')?.classList.remove('is-renaming');
        }
        updateTopButtons();
        await refreshHistoryControls();
        updateFilterClearState();
        pageLabels.forEach((label) => { label.textContent = `Page ${state.page} of ${state.pages}`; });
        prevButtons.forEach((button) => { button.disabled = state.page <= 1; });
        nextButtons.forEach((button) => { button.disabled = state.page >= state.pages; });
        persistLibraryWorkspace();
        restoreLibraryWorkspacePosition();
      } catch (err) {
        grid.innerHTML = `<div class="smo-empty"><div><div class="smo-empty-graphic"></div><h3>Could not load media</h3><p>${encode(err.message)}</p></div></div>`;
        toast(err.message, 'error');
      } finally {
        state.loading = false;
      }
    };

    const updateStats = (stats) => {
      Object.entries(stats).forEach(([key, value]) => {
        const el = document.querySelector(`[data-count="${key}"]`);
        if (el) el.textContent = value;
      });
      updateTopButtons();
    };

    const updateTopButtons = () => {
      if (favouritesToggle) {
        const active = state.folder === 'favourites';
        favouritesToggle.classList.toggle('is-active', active);
        favouritesToggle.setAttribute('aria-pressed', active ? 'true' : 'false');
        const countEl = $('[data-count="favourites"]');
        const countText = countEl ? countEl.textContent : '—';
        const label = favouritesToggle.querySelector('span');
        if (label) label.textContent = active ? `Seeing favourites (${countText})` : `See your favourites (${countText})`;
      }
      if (helpToggle) {
        helpToggle.classList.toggle('is-active', !!state.helpEnabled);
        helpToggle.setAttribute('aria-pressed', state.helpEnabled ? 'true' : 'false');
        const label = helpToggle.querySelector('span');
        if (label) label.textContent = state.helpEnabled ? 'Help: On' : 'Help: Off';
      }
    };

    const syncLibraryControls = () => {
      search.value = state.search || '';
      typeFilter.value = state.type || 'all';
      syncFileTypeFilter();
      altFilter.value = state.alt || 'all';
      updateCustomPositioningControls();
      sort.value = state.sort || 'date_desc';
    };

    const setSmartNavActive = (folder) => {
      $$('.smo-nav-item').forEach((button) => {
        button.classList.toggle('is-active', String(button.dataset.folder) === String(folder));
      });
    };

    const captureCurrentView = () => ({
      folder: state.folder,
      page: state.page,
      search: state.search,
      type: state.type,
      alt: state.alt,
      sort: state.sort
    });

    const restoreViewSnapshot = (snapshot) => {
      const view = snapshot || { folder: 'all', page: 1, search: '', type: 'all', alt: 'all', sort: 'date_desc' };
      state.folder = String(view.folder || 'all');
      state.page = Number(view.page || 1);
      state.search = String(view.search || '');
      state.type = String(view.type || 'all');
      state.alt = String(view.alt || 'all');
      state.sort = String(view.sort || 'date_desc');
      state.favouriteOnly = false;
      syncLibraryControls();
      setSmartNavActive(state.folder);
    };

    const enterGlobalFavourites = () => {
      if (state.folder === 'favourites') return;
      state.preFavouritesView = captureCurrentView();
      state.folder = 'favourites';
      state.page = 1;
      state.search = '';
      state.type = 'all';
      state.alt = 'all';
      state.sort = 'date_desc';
      state.favouriteOnly = false;
      syncLibraryControls();
      setSmartNavActive('favourites');
      load();
    };

    const leaveGlobalFavourites = () => {
      const snapshot = state.preFavouritesView;
      state.preFavouritesView = null;
      restoreViewSnapshot(snapshot);
      load();
    };

    const toggleGlobalFavourites = () => {
      if (state.folder === 'favourites') {
        leaveGlobalFavourites();
      } else {
        enterGlobalFavourites();
      }
    };

    let activeHelpTarget = null;
    let helpHoverTimer = 0;
    let helpPointerX = 0;
    let helpPointerY = 0;
    const HELP_HOVER_DELAY = 850;

    const clearHelpTimer = () => {
      if (helpHoverTimer) {
        window.clearTimeout(helpHoverTimer);
        helpHoverTimer = 0;
      }
    };

    const positionHelpBubble = (x = helpPointerX, y = helpPointerY, target = null) => {
      const panel = $('#smo-help-panel');
      if (!panel || panel.hidden || !state.helpEnabled) return;

      const edge = 12;
      const gap = 14;
      const viewportWidth = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
      const viewportHeight = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
      const targetRect = target && target.isConnected ? target.getBoundingClientRect() : null;
      const helpBoundary = wrap.querySelector('.smo-page-frame') || wrap;
      const boundaryRect = helpBoundary && helpBoundary.isConnected ? helpBoundary.getBoundingClientRect() : wrap.getBoundingClientRect();
      const bounds = {
        left: Math.max(edge, Math.round(boundaryRect.left + edge)),
        top: Math.max(edge, Math.round(boundaryRect.top + edge)),
        right: Math.min(viewportWidth - edge, Math.round(boundaryRect.right - edge)),
        bottom: Math.min(viewportHeight - edge, Math.round(boundaryRect.bottom - edge))
      };

      panel.style.left = `${bounds.left}px`;
      panel.style.top = `${bounds.top}px`;
      panel.style.right = 'auto';
      panel.style.bottom = 'auto';
      panel.dataset.helpPlacement = 'right';

      const measured = panel.getBoundingClientRect();
      const width = measured.width || 250;
      const height = measured.height || 90;
      const leftMax = Math.max(bounds.left, bounds.right - width);
      const topMax = Math.max(bounds.top, bounds.bottom - height);
      const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
      const rectFor = (left, top) => ({ left, top, right: left + width, bottom: top + height, width, height });
      const overlapArea = (a, b) => {
        const w = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
        const h = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
        return w * h;
      };
      const inBounds = (candidate) => candidate.left >= bounds.left && candidate.top >= bounds.top && candidate.right <= bounds.right && candidate.bottom <= bounds.bottom;

      const obstacles = Array.from(wrap.querySelectorAll([
        '.smo-brandbar', '.smo-brand-tabs-deck', '.smo-library-topbar', '.smo-controlbar',
        '.smo-selection-row', '.smo-bulkbar:not([hidden])', '.smo-trash-guide:not([hidden])',
        '.smo-media-card', '.smo-sidebar', '.smo-panel', '.smo-health-card', '.smo-rule-panel',
        '.smo-command-palette:not([hidden])', '.smo-studio-shell', '.smo-modal:not([hidden])', 'button', 'a[href]', 'input:not([type="hidden"])', 'select', 'textarea'
      ].join(','))).filter((el) => {
        if (!el.isConnected || el === panel || el === target || (target && target.contains(el)) || el.contains(panel)) return false;
        const r = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        return style.visibility !== 'hidden' && style.display !== 'none' && r.width > 2 && r.height > 2 && r.bottom > bounds.top && r.right > bounds.left && r.top < bounds.bottom && r.left < bounds.right;
      }).map((el) => el.getBoundingClientRect());

      const candidates = [];
      if (targetRect) {
        candidates.push(
          { placement: 'right', left: targetRect.right + gap, top: targetRect.top + (targetRect.height - height) / 2, distance: 0 },
          { placement: 'left', left: targetRect.left - width - gap, top: targetRect.top + (targetRect.height - height) / 2, distance: 0 },
          { placement: 'below', left: targetRect.left + (targetRect.width - width) / 2, top: targetRect.bottom + gap, distance: 0 },
          { placement: 'above', left: targetRect.left + (targetRect.width - width) / 2, top: targetRect.top - height - gap, distance: 0 }
        );
      }

      const pointerLeft = Number.isFinite(x) ? x + gap : bounds.left;
      const pointerTop = Number.isFinite(y) ? y + gap : bounds.top;
      candidates.push(
        { placement: 'right', left: pointerLeft, top: pointerTop, distance: 250 },
        { placement: 'left', left: (Number.isFinite(x) ? x : bounds.left) - width - gap, top: pointerTop, distance: 260 },
        { placement: 'safe', left: bounds.left, top: bounds.bottom - height, distance: 600 },
        { placement: 'safe', left: bounds.right - width, top: bounds.top, distance: 600 },
        { placement: 'safe', left: bounds.right - width, top: bounds.bottom - height, distance: 650 },
        { placement: 'safe', left: bounds.left, top: bounds.top, distance: 650 }
      );

      const scored = candidates.map((candidate) => {
        const left = clamp(candidate.left, bounds.left, leftMax);
        const top = clamp(candidate.top, bounds.top, topMax);
        const rect = rectFor(left, top);
        let score = candidate.distance || 0;
        if (!inBounds(rect)) score += 100000;
        if (targetRect) score += overlapArea(rect, targetRect) * 100000;
        obstacles.forEach((obstacle) => { score += overlapArea(rect, obstacle); });
        return { ...candidate, left, top, rect, score };
      }).sort((a, b) => a.score - b.score);

      const best = scored[0] || { placement: 'right', left: bounds.left, top: bounds.top };
      panel.dataset.helpPlacement = best.placement;
      panel.style.left = `${Math.round(best.left)}px`;
      panel.style.top = `${Math.round(best.top)}px`;
    };

    const showHelp = (title, text, target = null, pointerX = helpPointerX, pointerY = helpPointerY) => {
      const panel = $('#smo-help-panel');
      if (!panel || !state.helpEnabled) return;
      activeHelpTarget = target && target.isConnected ? target : null;
      $('#smo-help-title').textContent = title || 'Help';
      $('#smo-help-text').textContent = text || 'This control helps you organise and work with your media.';
      panel.hidden = false;
      panel.classList.remove('is-visible');
      positionHelpBubble(pointerX, pointerY, activeHelpTarget);
      requestAnimationFrame(() => panel.classList.add('is-visible'));
    };

    const hideHelp = () => {
      const panel = $('#smo-help-panel');
      clearHelpTimer();
      activeHelpTarget = null;
      if (!panel) return;
      panel.classList.remove('is-visible');
      panel.hidden = true;
    };

    const scheduleHelpForTarget = (target, x, y) => {
      if (!state.helpEnabled || !target) return;
      clearHelpTimer();
      activeHelpTarget = target;
      helpPointerX = x;
      helpPointerY = y;
      helpHoverTimer = window.setTimeout(() => {
        helpHoverTimer = 0;
        if (!state.helpEnabled || activeHelpTarget !== target || !target.isConnected) return;
        showHelp(
          target.getAttribute('data-help-title') || target.getAttribute('aria-label') || target.getAttribute('title') || 'Help',
          target.getAttribute('data-help-text') || target.getAttribute('title') || '',
          target,
          helpPointerX,
          helpPointerY
        );
      }, HELP_HOVER_DELAY);
    };

    const initHelp = () => {
      updateTopButtons();

      wrap.addEventListener('mouseover', (e) => {
        if (!state.helpEnabled) return;
        const target = e.target.closest('[data-help-title],[data-help-text]');
        if (!target || !wrap.contains(target)) return;
        if (target === activeHelpTarget) return;
        hideHelp();
        scheduleHelpForTarget(target, e.clientX, e.clientY);
      });

      wrap.addEventListener('mousemove', (e) => {
        helpPointerX = e.clientX;
        helpPointerY = e.clientY;
      }, { passive: true });

      wrap.addEventListener('mouseout', (e) => {
        if (!activeHelpTarget) return;
        const related = e.relatedTarget;
        if (related && activeHelpTarget.contains(related)) return;
        const leavingTarget = e.target.closest('[data-help-title],[data-help-text]');
        if (leavingTarget === activeHelpTarget) hideHelp();
      });

      wrap.addEventListener('focusin', (e) => {
        if (!state.helpEnabled || e.target.matches(':focus-visible') === false) return;
        const target = e.target.closest('[data-help-title],[data-help-text]');
        if (!target || !wrap.contains(target)) return;
        hideHelp();
        const rect = target.getBoundingClientRect();
        scheduleHelpForTarget(target, rect.right, rect.bottom);
      });

      wrap.addEventListener('focusout', (e) => {
        if (activeHelpTarget && (e.target === activeHelpTarget || activeHelpTarget.contains(e.target))) hideHelp();
      });

      wrap.addEventListener('mouseleave', hideHelp);
      window.addEventListener('blur', hideHelp);
      window.addEventListener('scroll', hideHelp, { passive: true, capture: true });
      window.addEventListener('resize', () => {
        const panel = $('#smo-help-panel');
        if (panel && !panel.hidden && activeHelpTarget) positionHelpBubble(helpPointerX, helpPointerY, activeHelpTarget);
      }, { passive: true });

      historyUndo?.addEventListener('click', () => runHistoryAction('undo'));
    historyRedo?.addEventListener('click', () => runHistoryAction('redo'));
    document.addEventListener('keydown', (event) => {
      const target = event.target;
      const editable = target && (target.matches?.('input,textarea,select') || target.isContentEditable);
      if (editable || !(event.metaKey || event.ctrlKey) || event.altKey) return;
      const key = String(event.key || '').toLowerCase();
      if (key === 'z' && !event.shiftKey && historyState?.undo) {
        event.preventDefault();
        runHistoryAction('undo');
      } else if ((key === 'z' && event.shiftKey || key === 'y') && historyState?.redo) {
        event.preventDefault();
        runHistoryAction('redo');
      }
    });

    helpToggle?.addEventListener('click', () => {
        state.helpEnabled = !state.helpEnabled;
        localStorage.setItem('smo_help_enabled', state.helpEnabled ? '1' : '0');
        hideHelp();
        updateTopButtons();
        toast(state.helpEnabled ? 'Hover help on — rest the pointer briefly over a control.' : 'Hover help turned off.');
      });
    };

    const folderSubtreeContains = (sourceId, candidateId) => {
      const source = findFolder(state.folders, Number(sourceId));
      if (!source) return false;
      const walk = (children) => (children || []).some((child) => Number(child.id) === Number(candidateId) || walk(child.children));
      return walk(source.children || []);
    };

    const clearFolderDropCues = () => {
      const root = $('#smo-folder-tree');
      if (!root) return;
      $$('.smo-folder-row', root).forEach((row) => row.classList.remove('is-folder-drop-before', 'is-folder-drop-after', 'is-folder-drop-inside', 'is-drop-target'));
      $('.smo-folder-root-drop', root)?.classList.remove('is-folder-root-target');
    };

    const finishFolderDrag = () => {
      const root = $('#smo-folder-tree');
      clearFolderDropCues();
      if (root) root.classList.remove('is-folder-drag-active');
      $$('.smo-folder-row.is-folder-dragging', root || document).forEach((row) => row.classList.remove('is-folder-dragging'));
      state.folderDraggingId = 0;
    };

    const moveFolder = async (termId, targetId, placement) => {
      const source = findFolder(state.folders, Number(termId));
      if (!source) return;
      try {
        const data = await api('simme_media_organiser_move_folder', {
          term_id: termId,
          target_id: targetId || 0,
          placement
        });
        state.folders = data.folders || [];
        const parentId = Number(data.parent || 0);
        if (parentId) state.expanded.add(parentId);
        expandFolderPathTo(state, Number(termId));
        renderFolders();
        renderFolderDropdowns();
        persistLibraryWorkspace();
        toast(`“${source.name}” moved. Media URLs and files were not changed.`);
      } catch (err) {
        toast(err.message, 'error', 6000);
        renderFolders();
      } finally {
        finishFolderDrag();
      }
    };

    const ensureFolderDialog = () => {
      let modal = $('#smo-folder-manage-dialog');
      if (modal) return modal;
      modal = document.createElement('div');
      modal.id = 'smo-folder-manage-dialog';
      modal.className = 'smo-folder-manage-dialog';
      modal.setAttribute('aria-hidden', 'true');
      modal.innerHTML = `<div class="smo-folder-manage-scrim" data-folder-manage-close></div>
        <section class="smo-folder-manage-panel" role="dialog" aria-modal="true" aria-labelledby="smo-folder-manage-title">
          <button type="button" class="smo-folder-manage-close" data-folder-manage-close aria-label="Close">${icon('close')}</button>
          <div id="smo-folder-manage-content"></div>
        </section>`;
      wrap.appendChild(modal);
      $$('[data-folder-manage-close]', modal).forEach((button) => button.addEventListener('click', () => {
        modal.classList.remove('is-open');
        modal.setAttribute('aria-hidden', 'true');
      }));
      return modal;
    };

    const closeFolderDialog = () => {
      const modal = $('#smo-folder-manage-dialog');
      if (!modal) return;
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
    };

    const folderMoveOptions = (folder) => {
      const flat = flattenFolderTree(state.folders, 0, []);
      return flat.filter((candidate) => Number(candidate.id) !== Number(folder.id) && !folderSubtreeContains(folder.id, candidate.id));
    };

    const openFolderMoveDialog = (folder) => {
      const modal = ensureFolderDialog();
      const content = $('#smo-folder-manage-content', modal);
      const options = folderMoveOptions(folder);
      content.innerHTML = `<div class="smo-folder-manage-kicker">MOVE VIRTUAL FOLDER</div>
        <h3 id="smo-folder-manage-title">Move “${encode(folder.name)}”</h3>
        <p>Choose a new parent folder. This changes only Simme’s virtual organisation — no media files, attachment IDs or URLs move.</p>
        <label class="smo-folder-manage-label" for="smo-folder-move-parent">New location</label>
        <select id="smo-folder-move-parent" class="smo-folder-manage-select">
          <option value="0">Root level</option>
          ${options.map((candidate) => `<option value="${candidate.id}" ${Number(folder.parent || 0) === Number(candidate.id) ? 'selected' : ''}>${'— '.repeat(candidate.depth)}${encode(candidate.name)}</option>`).join('')}
        </select>
        <div class="smo-folder-manage-note">Tip: dragging gives you precise before/after ordering. This control is the non-drag alternative for moving a folder into or out of another folder.</div>
        <div class="smo-folder-manage-actions"><button type="button" class="smo-button" data-folder-manage-close>Cancel</button><button type="button" class="smo-button smo-button--primary" id="smo-folder-move-save">Move folder</button></div>`;
      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden', 'false');
      $$('[data-folder-manage-close]', content).forEach((button) => button.addEventListener('click', closeFolderDialog));
      $('#smo-folder-move-save', content)?.addEventListener('click', async () => {
        const parentId = Number($('#smo-folder-move-parent', content)?.value || 0);
        closeFolderDialog();
        if (parentId === Number(folder.parent || 0)) return toast('That folder is already in this location.');
        await moveFolder(folder.id, parentId, parentId ? 'inside' : 'root');
      });
      setTimeout(() => $('#smo-folder-move-parent', content)?.focus(), 20);
    };

    const openFolderDeleteDialog = (folder) => {
      const modal = ensureFolderDialog();
      const content = $('#smo-folder-manage-content', modal);
      const directCount = Number(folder.direct_count || 0);
      const descendants = flattenFolderTree(folder.children || [], 0, []).length;
      const isLostProperty = !!folder.lost_property;

      const renderReviewStep = () => {
        content.innerHTML = `<div class="smo-folder-manage-kicker is-danger">DELETE VIRTUAL FOLDER</div>
          <div class="smo-folder-delete-steps" aria-label="Delete folder safety steps">
            <span class="is-active"><b>1</b><em>Review</em></span><i></i><span><b>2</b><em>Delete</em></span>
          </div>
          <h3 id="smo-folder-manage-title">Delete “${encode(folder.name)}”?</h3>
          <p>First, review what will happen. <strong>No media file will be deleted.</strong></p>
          <div class="smo-folder-delete-summary"><div><strong>${directCount}</strong><span>media item${directCount === 1 ? '' : 's'} directly inside</span></div><div><strong>${descendants}</strong><span>nested folder${descendants === 1 ? '' : 's'} preserved</span></div></div>
          ${descendants ? `<div class="smo-folder-manage-note"><strong>Nested folders are safe.</strong> They will be moved up one level so their structure and media remain intact.</div>` : ''}
          ${directCount ? `<fieldset class="smo-folder-delete-destinations"><legend>Where should the media go?</legend>
            <label><input type="radio" name="smo-folder-delete-destination" value="unfiled" checked><span><b>Main Media Library</b><small>Remove the virtual-folder assignment and return the media to Unfiled.</small></span></label>
            ${isLostProperty ? '' : `<label><input type="radio" name="smo-folder-delete-destination" value="lost_property"><span><b>Lost Property</b><small>Create/use a temporary root-level holding folder so you can review the media before deciding where it belongs.</small></span></label>`}
          </fieldset>` : `<div class="smo-folder-manage-note"><strong>Nothing needs relocating.</strong> This folder has no media directly inside it.</div>`}
          <div class="smo-folder-manage-actions"><button type="button" class="smo-button" data-folder-manage-close>Cancel</button><button type="button" class="smo-button smo-button--danger" id="smo-folder-delete-continue">Review &amp; continue</button></div>`;

        $$('[data-folder-manage-close]', content).forEach((button) => button.addEventListener('click', closeFolderDialog));
        $('#smo-folder-delete-continue', content)?.addEventListener('click', () => {
          const destination = $('input[name="smo-folder-delete-destination"]:checked', content)?.value || 'unfiled';
          renderFinalStep(destination);
        });
      };

      const renderFinalStep = (destination) => {
        const destinationText = destination === 'lost_property' ? 'Lost Property at the root level' : 'the Main Media Library (Unfiled)';
        content.innerHTML = `<div class="smo-folder-manage-kicker is-danger">FINAL DELETE CHECK</div>
          <div class="smo-folder-delete-steps" aria-label="Delete folder safety steps">
            <span class="is-complete"><b>${icon('check')}</b><em>Reviewed</em></span><i class="is-complete"></i><span class="is-active is-danger"><b>2</b><em>Delete</em></span>
          </div>
          <h3 id="smo-folder-manage-title">Final check — delete “${encode(folder.name)}”?</h3>
          <p>One more click will remove this <strong>virtual folder only</strong>.</p>
          <div class="smo-folder-delete-final-grid">
            <div><b>${icon('check')}</b><span><strong>No media files deleted</strong><small>Attachment files, URLs and IDs remain unchanged.</small></span></div>
            ${directCount ? `<div><b>${icon('folder')}</b><span><strong>${directCount} media item${directCount === 1 ? '' : 's'} relocated</strong><small>They will move to ${encode(destinationText)}.</small></span></div>` : `<div><b>${icon('folder')}</b><span><strong>No media to relocate</strong><small>This folder is empty of direct media items.</small></span></div>`}
            <div><b>${icon('folder')}</b><span><strong>${descendants} nested folder${descendants === 1 ? '' : 's'} preserved</strong><small>${descendants ? 'They will be promoted up one level.' : 'There are no child folders to move.'}</small></span></div>
          </div>
          <div class="smo-folder-delete-status" id="smo-folder-delete-status" role="status" aria-live="polite"></div>
          <div class="smo-folder-manage-actions"><button type="button" class="smo-button" id="smo-folder-delete-back">Back</button><button type="button" class="smo-button smo-button--danger" id="smo-folder-delete-final">${icon('trash')}<span>Delete “${encode(folder.name)}” folder</span></button></div>`;

        $('#smo-folder-delete-back', content)?.addEventListener('click', renderReviewStep);
        const finalButton = $('#smo-folder-delete-final', content);
        finalButton?.addEventListener('click', async () => {
          const status = $('#smo-folder-delete-status', content);
          finalButton.disabled = true;
          finalButton.setAttribute('aria-busy', 'true');
          finalButton.innerHTML = `${icon('clock')}<span>Deleting safely…</span>`;
          if (status) {
            status.className = 'smo-folder-delete-status is-working';
            status.textContent = 'Removing the virtual folder and preserving its media…';
          }
          try {
            const data = await api('simme_media_organiser_delete_folder', { term_id: folder.id, destination, gate: `DELETE:${folder.id}` });
            state.folders = data.folders || [];
            const destinationFolder = Number(data.destinationFolder || 0);
            if (String(state.folder) === String(folder.id)) state.folder = destinationFolder ? String(destinationFolder) : 'unfiled';
            renderFolders();
            renderFolderDropdowns();
            persistLibraryWorkspace();
            if (status) {
              status.className = 'smo-folder-delete-status is-success';
              status.textContent = 'Folder deleted safely.';
            }
            toast(`${folder.name} deleted safely.${Number(data.moved || 0) ? ` ${data.moved} media item${Number(data.moved) === 1 ? '' : 's'} moved.` : ''}`, 'success', 6000);
            closeFolderDialog();
            await load();
          } catch (err) {
            finalButton.disabled = false;
            finalButton.removeAttribute('aria-busy');
            finalButton.innerHTML = `${icon('trash')}<span>Try deleting “${encode(folder.name)}” again</span>`;
            if (status) {
              status.className = 'smo-folder-delete-status is-error';
              status.textContent = err?.message || 'The folder could not be deleted.';
            }
            toast(err?.message || 'The folder could not be deleted.', 'error', 7000);
          }
        });
      };

      renderReviewStep();
      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden', 'false');
    };

    const openFolderActions = (folder) => {
      const modal = ensureFolderDialog();
      const content = $('#smo-folder-manage-content', modal);
      content.innerHTML = `<div class="smo-folder-manage-kicker">FOLDER CONTROLS</div>
        <h3 id="smo-folder-manage-title">${encode(folder.name)}</h3>
        <p>${encode(folder.path || folder.name)}</p>
        <div class="smo-folder-action-grid">
          <button type="button" data-folder-action="rename">${icon('edit')}<span><b>Rename</b><small>Change the virtual folder name.</small></span></button>
          <button type="button" data-folder-action="move">${icon('folder')}<span><b>Move folder</b><small>Choose another parent or move it to root.</small></span></button>
          <button type="button" class="is-danger" data-folder-action="delete">${icon('trash')}<span><b>Delete folder</b><small>Gated deletion with safe media relocation.</small></span></button>
        </div>`;
      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden', 'false');
      $('[data-folder-action="rename"]', content)?.addEventListener('click', async () => {
        const name = window.prompt('Rename virtual folder', folder.name);
        if (!name || !name.trim() || name.trim() === folder.name) return;
        closeFolderDialog();
        try {
          const data = await api('simme_media_organiser_update_folder', { term_id: folder.id, name: name.trim(), parent: folder.parent || 0, colour: folder.colour || '' });
          state.folders = data.folders || [];
          renderFolders();
          renderFolderDropdowns();
          toast('Folder renamed. Media URLs were not changed.');
        } catch (err) { toast(err.message, 'error'); }
      });
      $('[data-folder-action="move"]', content)?.addEventListener('click', () => { closeFolderDialog(); openFolderMoveDialog(folder); });
      $('[data-folder-action="delete"]', content)?.addEventListener('click', () => { closeFolderDialog(); openFolderDeleteDialog(folder); });
    };

    const renderFolders = () => {
      const root = $('#smo-folder-tree');
      if (!root) return;
      if (!state.folders.length) {
        root.innerHTML = '<div style="padding:8px;color:#657287;font-size:11px">No folders yet.</div>';
        return;
      }

      const branch = (folders) => folders.map((folder) => {
        const hasChildren = folder.children && folder.children.length;
        const open = state.expanded.has(Number(folder.id));
        const active = String(state.folder) === String(folder.id);
        const colour = folder.colour || '#8d5cff';
        const lost = !!folder.lost_property;
        return `<div class="smo-folder-branch ${lost ? 'is-lost-property' : ''}" data-folder-branch="${folder.id}">
          <div class="smo-folder-row ${active ? 'is-active' : ''} ${open ? 'is-open' : ''}" data-folder-id="${folder.id}" data-help-title="${encode(folder.name)}" data-help-text="Open this virtual folder. Drag media onto the row, or use the dotted grip to move the folder itself.">
            <button type="button" class="smo-folder-chevron" data-folder-toggle="${folder.id}" aria-label="${open ? 'Collapse' : 'Expand'} ${encode(folder.name)}">${hasChildren ? icon('chevron') : ''}</button>
            <button type="button" class="smo-folder-open" data-folder-open="${folder.id}"><span class="smo-folder-dot" style="color:${encode(colour)}"></span><span class="smo-folder-name">${encode(folder.name)}</span>${lost ? '<span class="smo-lost-property-tag">HOLDING</span>' : ''}</button>
            <span class="smo-count">${folder.count}</span>
            <button type="button" class="smo-folder-drag-handle" draggable="true" data-folder-drag="${folder.id}" aria-label="Drag ${encode(folder.name)} to move or reorder it" title="Drag to move or reorder folder"><span class="smo-folder-grip-dots" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></span></button>
            <button type="button" class="smo-folder-actions" data-folder-actions="${folder.id}" aria-label="Folder options for ${encode(folder.name)}" title="Folder options"><span aria-hidden="true">•••</span></button>
          </div>
          ${hasChildren ? `<div class="smo-folder-children" ${open ? '' : 'hidden'}>${branch(folder.children)}</div>` : ''}
        </div>`;
      }).join('');
      root.innerHTML = `<div class="smo-folder-root-drop" data-folder-root-drop><span class="smo-folder-root-icon">${icon('folder')}</span><span><strong>Root level</strong><small>Drop here to move a folder out of another folder</small></span></div>${branch(state.folders)}`;

      const rootDrop = $('[data-folder-root-drop]', root);
      rootDrop?.addEventListener('dragover', (e) => {
        if (!state.folderDraggingId) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        clearFolderDropCues();
        rootDrop.classList.add('is-folder-root-target');
      });
      rootDrop?.addEventListener('dragleave', () => rootDrop.classList.remove('is-folder-root-target'));
      rootDrop?.addEventListener('drop', async (e) => {
        if (!state.folderDraggingId) return;
        e.preventDefault();
        const sourceId = state.folderDraggingId;
        await moveFolder(sourceId, 0, 'root');
      });

      $$('.smo-folder-row', root).forEach((row) => {
        const id = Number(row.dataset.folderId);
        const folder = findFolder(state.folders, id);
        $('[data-folder-toggle]', row)?.addEventListener('click', (e) => {
          e.stopPropagation();
          if (!folder?.children?.length) return;
          state.expanded.has(id) ? state.expanded.delete(id) : state.expanded.add(id);
          renderFolders();
          persistLibraryWorkspace();
        });
        $('[data-folder-open]', row)?.addEventListener('click', () => {
          closeLibraryNav();
          state.preFavouritesView = null;
          state.favouriteOnly = false;
          state.folder = String(id);
          state.page = 1;
          setSmartNavActive('__none__');
          load();
        });
        $('[data-folder-actions]', row)?.addEventListener('click', (e) => {
          e.stopPropagation();
          if (folder) openFolderActions(folder);
        });
        row.addEventListener('dblclick', (e) => {
          if (e.target.closest('button')) return;
          if (folder) openFolderActions(folder);
        });

        const dragHandle = $('[data-folder-drag]', row);
        dragHandle?.addEventListener('dragstart', (e) => {
          state.folderDraggingId = id;
          row.classList.add('is-folder-dragging');
          root.classList.add('is-folder-drag-active');
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/smo-folder-id', String(id));
          e.dataTransfer.setData('text/plain', `Simme folder ${id}`);
          if (e.dataTransfer.setDragImage) e.dataTransfer.setDragImage(row, 32, Math.min(24, row.offsetHeight / 2));
        });
        dragHandle?.addEventListener('dragend', finishFolderDrag);

        row.addEventListener('dragover', (e) => {
          if (state.folderDraggingId) {
            const sourceId = Number(state.folderDraggingId);
            if (sourceId === id || folderSubtreeContains(sourceId, id)) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            clearFolderDropCues();
            const rect = row.getBoundingClientRect();
            const ratio = rect.height ? (e.clientY - rect.top) / rect.height : .5;
            const placement = ratio < .28 ? 'before' : ratio > .72 ? 'after' : 'inside';
            row.dataset.folderDropPlacement = placement;
            row.classList.add(`is-folder-drop-${placement}`);
            return;
          }
          e.preventDefault();
          row.classList.add('is-drop-target');
        });
        row.addEventListener('dragleave', (e) => {
          if (e.relatedTarget && row.contains(e.relatedTarget)) return;
          row.classList.remove('is-folder-drop-before', 'is-folder-drop-after', 'is-folder-drop-inside', 'is-drop-target');
        });
        row.addEventListener('drop', async (e) => {
          e.preventDefault();
          if (state.folderDraggingId) {
            const sourceId = Number(state.folderDraggingId);
            const placement = row.dataset.folderDropPlacement || 'inside';
            if (!sourceId || sourceId === id || folderSubtreeContains(sourceId, id)) return finishFolderDrag();
            if (placement === 'inside') state.expanded.add(id);
            await moveFolder(sourceId, id, placement);
            return;
          }
          row.classList.remove('is-drop-target');
          const dropped = Number(e.dataTransfer.getData('text/smo-media-id'));
          const ids = state.selected.has(dropped) ? Array.from(state.selected) : [dropped];
          if (!dropped) return;
          await moveItems(ids, id);
        });
      });
    };

    const renderFolderDropdowns = () => {
      const parent = $('#smo-folder-parent');
      if (parent) parent.innerHTML = '<option value="0">Top level</option>' + formatFolderOptions(state.folders, false);
      renderBulkFolderPicker();
    };

    const flattenFolderTree = (tree, depth = 0, output = []) => {
      (tree || []).forEach((folder) => {
        output.push({ ...folder, depth });
        if (folder.children && folder.children.length) flattenFolderTree(folder.children, depth + 1, output);
      });
      return output;
    };

    const closeBulkFolderPicker = () => {
      const menu = $('#smo-bulk-folder-menu');
      const trigger = $('#smo-bulk-folder-trigger');
      if (!menu || !trigger) return;
      menu.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
      trigger.classList.remove('is-open');
    };

    const setBulkFolderDestination = (value, label, colour = '') => {
      const input = $('#smo-bulk-folder');
      const labelEl = $('#smo-bulk-folder-label');
      if (input) input.value = String(value);
      if (labelEl) labelEl.textContent = label || 'Move to folder…';
      const trigger = $('#smo-bulk-folder-trigger');
      if (trigger) {
        trigger.classList.toggle('has-destination', String(value) !== '');
        if (colour) trigger.style.setProperty('--smo-picker-colour', colour);
        else trigger.style.removeProperty('--smo-picker-colour');
      }
      $$('.smo-folder-picker__option').forEach((button) => button.classList.toggle('is-selected', String(button.dataset.bulkFolderValue) === String(value)));
    };

    const renderBulkFolderPicker = () => {
      const options = $('#smo-bulk-folder-options');
      if (!options) return;
      const flat = flattenFolderTree(state.folders, 0, []);
      options.innerHTML = flat.map((folder) => {
        const colour = folder.colour || '#8d5cff';
        return `<button type="button" class="smo-folder-picker__option" data-bulk-folder-value="${folder.id}" data-folder-colour="${encode(colour)}" data-folder-label="${encode(folder.name)}" role="option" style="--smo-folder-depth:${folder.depth};--smo-picker-colour:${encode(colour)}">
          <span class="smo-folder-picker__indent"></span><span class="smo-folder-picker__dot"></span><span class="smo-folder-picker__option-copy"><strong>${encode(folder.name)}</strong>${folder.depth ? `<small>Nested level ${folder.depth + 1}</small>` : '<small>Top-level folder</small>'}</span>
        </button>`;
      }).join('');
      bindBulkFolderPickerOptions();
      const current = $('#smo-bulk-folder')?.value || '';
      if (current !== '') {
        const selected = $(`.smo-folder-picker__option[data-bulk-folder-value="${current}"]`);
        if (selected) setBulkFolderDestination(current, current === '0' ? 'Unfiled' : (selected.dataset.folderLabel || selected.querySelector('strong')?.textContent || 'Folder'), selected.dataset.folderColour || '');
      }
    };

    const bindBulkFolderPickerOptions = () => {
      $$('.smo-folder-picker__option').forEach((button) => {
        if (button.dataset.smoPickerBound === '1') return;
        button.dataset.smoPickerBound = '1';
        button.addEventListener('click', () => {
          const value = button.dataset.bulkFolderValue;
          const label = value === '0' ? 'Unfiled' : (button.dataset.folderLabel || button.querySelector('strong')?.textContent || 'Folder');
          setBulkFolderDestination(value, label, button.dataset.folderColour || '');
          closeBulkFolderPicker();
        });
      });
    };

    const renderMedia = () => {
      grid.dataset.view = state.view;
      $$('.smo-view-switcher button').forEach((b) => b.classList.toggle('is-active', b.dataset.view === state.view));
      if (!state.items.length) {
        grid.innerHTML = state.folder === 'trash'
          ? '<div class="smo-empty smo-empty--trash"><div><div class="smo-empty-graphic"></div><h3>Trash is empty</h3><p>Nothing is being held here. Media moved to Trash will stay recoverable until you restore or deliberately purge it.</p></div></div>'
          : '<div class="smo-empty"><div><div class="smo-empty-graphic"></div><h3>Nothing here yet</h3><p>Try another folder or filter, or add new media.</p></div></div>';
        return;
      }
      grid.innerHTML = state.items.map(cardHtml).join('');
      bindCards();
    };

    const formatMediaTime = (seconds) => {
      const value = Number.isFinite(Number(seconds)) ? Math.max(0, Number(seconds)) : 0;
      const mins = Math.floor(value / 60);
      const secs = Math.floor(value % 60);
      return `${mins}:${String(secs).padStart(2, '0')}`;
    };

    const DEFAULT_MEDIA_VOLUME = 0.25;
    const MIN_AUDIBLE_MEDIA_VOLUME = 0.05;

    const preferredAudibleVolume = () => {
      const stored = Number(localStorage.getItem('smo_media_volume'));
      // Media previews should never surprise the user at full volume. Remember a
      // genuinely low preference, otherwise fall back to the calm 25% default.
      if (Number.isFinite(stored) && stored >= MIN_AUDIBLE_MEDIA_VOLUME && stored <= 0.35) return stored;
      return DEFAULT_MEDIA_VOLUME;
    };

    const mediaPlayerHtml = (item, kind) => {
      const nativeAudio = kind === 'audio' ? `<audio class="smo-player-media" preload="metadata" src="${encode(item.url)}"></audio>` : '';
      return `<div class="smo-inline-player" data-media-player="${encode(kind)}" data-media-id="${item.id}" draggable="false">
        ${nativeAudio}
        <button type="button" class="smo-player-play" aria-label="Play ${encode(item.title || item.filename)}" title="Play / pause">${icon('play')}<span class="smo-player-play-label">Play</span></button>
        <span class="smo-player-clock"><span class="smo-player-time smo-player-current">0:00</span><i>/</i><span class="smo-player-time smo-player-duration">0:00</span></span>
        <input class="smo-player-progress" type="range" min="0" max="100" step="0.1" value="0" aria-label="Media position" style="--smo-player-progress:0%" />
        <button type="button" class="smo-player-volume-button" aria-label="Mute or unmute" title="Mute / unmute">${icon('volume')}</button>
        <input class="smo-player-volume" type="range" min="0.05" max="1" step="0.05" value="0.25" aria-label="Volume" style="--smo-volume-progress:25%" />
      </div>`;
    };

    const getFileBadgeClass = (item) => {
      const ext = String(item.extension || '').toUpperCase();
      const mime = String(item.mime || '').toLowerCase();
      const kind = String(item.kind || '').toLowerCase();
      if (ext === 'PDF' || mime === 'application/pdf') return 'is-pdf';
      if (['DOC', 'DOCX'].includes(ext)) return 'is-doc';
      if (['XLS', 'XLSX', 'CSV'].includes(ext)) return 'is-sheet';
      if (['PPT', 'PPTX'].includes(ext)) return 'is-slides';
      if (['ZIP', 'RAR', '7Z', 'TAR', 'GZ'].includes(ext)) return 'is-archive';
      if (['MP3', 'WAV', 'M4A', 'AAC', 'FLAC', 'OGG'].includes(ext) || kind === 'audio' || mime.startsWith('audio/')) return 'is-audio';
      if (['MP4', 'MOV', 'WEBM', 'AVI', 'M4V'].includes(ext) || kind === 'video' || mime.startsWith('video/')) return 'is-video';
      if (ext === 'SVG') return 'is-svg';
      if (ext === 'PNG') return 'is-png';
      if (['JPG', 'JPEG'].includes(ext)) return 'is-jpg';
      if (ext === 'WEBP') return 'is-webp';
      if (ext === 'GIF') return 'is-gif';
      if (ext === 'AVIF') return 'is-avif';
      return 'is-file';
    };

    const cardHtml = (item) => {
      const selected = state.selected.has(Number(item.id));
      const isPdf = item.mime === 'application/pdf' || item.extension === 'PDF';
      let preview = '';
      let playerUtility = '';
      if (item.kind === 'image' && item.thumb) {
        preview = `<div class="smo-card-preview"><img src="${encode(item.thumb)}" alt="" loading="lazy" /></div>`;
      } else if (item.kind === 'video') {
        preview = `<div class="smo-card-preview smo-card-preview--video" data-video-preview="${item.id}">
          <video class="smo-player-media" preload="metadata" playsinline ${item.thumb ? `poster="${encode(item.thumb)}"` : ''}>
            <source src="${encode(item.url)}" type="${encode(item.mime || 'video/mp4')}" />
          </video>
        </div>`;
        if (!item.trashed) playerUtility = mediaPlayerHtml(item, 'video');
      } else if (item.kind === 'audio') {
        preview = `<div class="smo-card-preview smo-card-preview--audio">
          <div class="smo-audio-visual">
            <div class="smo-audio-bars" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
            ${icon('audio', 'smo-card-audio-icon')}
          </div>
        </div>`;
        if (!item.trashed) playerUtility = mediaPlayerHtml(item, 'audio');
      } else if (isPdf) {
        preview = `<div class="smo-card-preview smo-card-preview--pdf">
          <div class="smo-pdf-stack" aria-hidden="true"><span class="smo-pdf-page smo-pdf-page--back"></span><span class="smo-pdf-page smo-pdf-page--mid"></span><span class="smo-pdf-page smo-pdf-page--front"></span></div>
          <div class="smo-pdf-icon">${icon('file')}</div>
        </div>`;
      } else {
        preview = `<div class="smo-card-preview smo-card-preview--generic">${icon(getFileKindIcon(item.kind))}</div>`;
      }
      const dims = item.width && item.height ? `${item.width} × ${item.height}` : '';
      const alt = item.kind === 'image' ? (item.alt ? `<button type="button" class="smo-meta-pill smo-alt-pill is-good" data-alt-edit="${item.id}" title="Edit ALT text" data-help-title="Quick ALT edit" data-help-text="Open a focused ALT-only editor for this image.">ALT ✓</button>` : `<button type="button" class="smo-meta-pill smo-alt-pill is-warning" data-alt-edit="${item.id}" title="Add ALT text" data-help-title="Add ALT text" data-help-text="Open a focused ALT-only editor so you can rapidly complete missing ALT text.">ALT !</button>`) : '';
      const folder = item.folder ? item.folder.path : 'Unfiled';
      const folderColour = item.folder && item.folder.colour ? item.folder.colour : '#657287';
      const folderTrail = item.folder && Array.isArray(item.folder.trail) ? item.folder.trail : [];
      const visibleFolderTrail = folderTrail.length ? folderTrail : [{ name: 'Unfiled', colour: '#657287' }];
      const folderTrailMarkup = visibleFolderTrail.map((entry) => `<i class="smo-folder-depth-bar" style="--trail-colour:${encode(entry.colour || '#657287')};" title="${encode(entry.name || '')}"></i>`).join('');
      const folderDepth = Math.max(1, visibleFolderTrail.length);
      const folderTarget = item.folder ? String(item.folder.id) : 'unfiled';
      const folderIcon = item.folder ? 'folder' : 'unfiled';
      const dragPositionEnabled = !item.trashed && canArrangeCurrentView();
      const dragPositionAvailable = !item.trashed && state.customPositioningEligible;
      const dragHandle = dragPositionAvailable ? `<button type="button" class="smo-card-drag-handle ${dragPositionEnabled ? '' : 'is-disabled'}" data-reorder-handle="${item.id}" draggable="${dragPositionEnabled ? 'true' : 'false'}" aria-label="Drag ${encode(item.title || item.filename)} to a custom position" aria-disabled="${dragPositionEnabled ? 'false' : 'true'}" title="${dragPositionEnabled ? 'Drag to arrange this media' : 'Return to Custom positioning to rearrange cards'}" data-help-title="Custom positioning" data-help-text="${dragPositionEnabled ? 'Drag this handle to place the media card exactly where you want it in this folder. The position is remembered even when filters are applied.' : 'This folder has saved custom positioning, but a temporary sort is active. Choose Custom positioning before dragging cards.'}"><span class="smo-card-drag-dots" aria-hidden="true"><i></i><i></i><i></i></span></button>` : '';
      const protectionBadge = item.protected ? `<span class="smo-meta-pill is-protected">${icon('shield')} Protected</span>` : '';
      const duplicateBadge = Number(item.duplicateCount || 0) > 1 ? `<span class="smo-meta-pill is-duplicate">${Number(item.duplicateCount)} duplicates</span>` : '';
      const trashBadge = item.trashed ? `<span class="smo-meta-pill is-trash">${icon('trash')} Trash</span>` : '';
      const trashProtection = item.trashed
        ? (item.trashReady
          ? `Ready to purge${item.trashTimerOverridden ? ' · custom timer' : ''}`
          : `${item.trashRemainingLabel || `${Number(item.trashDaysRemaining || 0)} day${Number(item.trashDaysRemaining || 0) === 1 ? '' : 's'} remaining`}${item.trashTimerOverridden ? ' · custom timer' : ''}`)
        : '';
      const trashTimerBadge = item.trashed && item.trashTimerOverridden
        ? `<span class="smo-meta-pill is-trash-timer">${icon('recent')} Custom purge timer</span>`
        : '';
      const folderControl = item.trashed
        ? `<div class="smo-card-folder-badge ${item.folder ? 'is-filed' : 'is-unfiled'} is-trash-folder" style="--smo-folder-colour:${encode(folderColour)};--smo-folder-depth:${folderDepth};" data-help-title="Stored folder" data-help-text="This is the virtual folder the media will still belong to when restored. Trash does not remove its folder metadata.">
            <span class="smo-card-folder-bars" aria-hidden="true">${folderTrailMarkup}</span>
            <span class="smo-card-folder-icon" aria-hidden="true">${icon(folderIcon)}</span>
            <span class="smo-card-folder-label">${encode(folder)}</span>
          </div>`
        : `<button type="button" class="smo-card-folder-badge ${item.folder ? 'is-filed' : 'is-unfiled'}" data-card-folder="${encode(folderTarget)}" title="Open ${encode(folder)}" style="--smo-folder-colour:${encode(folderColour)};--smo-folder-depth:${folderDepth};" data-help-title="Current folder" data-help-text="This shows which virtual folder the media item belongs to. Each vertical colour bar represents one folder level: parent folders appear to the left and the current folder is the final bar. Click the badge to jump straight to that folder.">
            <span class="smo-card-folder-bars" aria-hidden="true">${folderTrailMarkup}</span>
            <span class="smo-card-folder-icon" aria-hidden="true">${icon(folderIcon)}</span>
            <span class="smo-card-folder-label">${encode(folder)}</span>
          </button>`;
      const footer = item.trashed
        ? `<footer class="smo-card-footer smo-card-footer--trash">
            <div class="smo-trash-card-actions smo-trash-card-actions--safe">
              <button type="button" class="smo-card-button smo-card-copy" title="Copy media URL" data-help-title="Copy URL" data-help-text="The physical upload remains in place while held in Trash, so its existing public URL can still be copied.">${icon('copy')}<span>Copy URL</span></button>
              <button type="button" class="smo-card-button smo-card-restore" data-help-title="Restore media" data-help-text="Returns this item to the working library with the same WordPress attachment ID, URL, virtual folder and Simme metadata.">${icon('recent')}<span>Restore</span></button>
            </div>
            <button type="button" class="smo-card-button smo-card-trash-timer" data-help-title="Set purge unlock timer" data-help-text="Choose your own waiting time before permanent purge becomes available for this item. The timer never deletes the media automatically.">${icon('recent')}<span>${item.trashTimerOverridden ? 'Change purge timer' : 'Set purge timer'}</span></button>
            <button type="button" class="smo-card-button smo-card-purge ${item.trashReady ? 'is-ready' : 'is-locked'}" ${item.trashReady ? '' : 'disabled'} data-help-title="${item.trashReady ? 'Purge permanently' : 'Purge locked'}" data-help-text="${item.trashReady ? 'Permanently deletes this attachment and its files after two deliberate confirmation gates. This cannot be undone.' : `Permanent purge is locked until ${encode(item.trashReadyLabel || 'the protection period ends')}. Use Set purge timer if you deliberately need to unlock purge sooner.`}">${item.trashReady ? icon('trash') : icon('lock')}<span>${item.trashReady ? 'Purge permanently' : 'Purge locked'}</span></button>
          </footer>`
        : `<footer class="smo-card-footer">
            <button type="button" class="smo-card-button smo-card-copy" title="Copy media URL" data-help-title="Copy URL" data-help-text="Copies the active public WordPress media URL to your clipboard so you can paste it elsewhere immediately.">${icon('copy')}<span>Copy URL</span></button>
            ${item.kind === 'image' ? `<button type="button" class="smo-card-button smo-card-studio" title="Open Image Studio" data-help-title="Image Studio" data-help-text="Create protected, non-destructive crops, resized versions and optimised website copies without overwriting your master image.">${studioIconMarkup('is-card')}<span>Studio</span></button>` : ''}
            ${item.protected ? `<button type="button" class="smo-card-button smo-card-unprotect" title="Un-protect asset" data-help-title="Un-protect" data-help-text="Remove deletion protection from this WordPress media attachment.">${icon('shield-off')}<span>Un-protect</span></button>` : ''}
            ${item.kind === 'image' ? `<button type="button" class="smo-card-button smo-card-quicklook" title="Quick View" data-help-title="Quick View" data-help-text="Open a read-only preview of this image so you can inspect it quickly without entering Quick Edit or Image Studio.">${icon('eye')}<span>Quick View</span></button>` : ''}
            <button type="button" class="smo-card-button smo-card-edit" title="Quick edit" data-help-title="Quick edit" data-help-text="Open the quick-edit panel to change the title, alt text, caption, description and virtual folder.">${icon('edit')}<span>Quick edit</span></button>
            <button type="button" class="smo-card-button smo-card-trash ${item.protected ? 'is-locked' : ''}" ${item.protected ? 'disabled' : ''} title="${item.protected ? 'Un-protect this asset before moving it to Trash' : 'Move to Trash'}" data-help-title="${item.protected ? 'Protected asset' : 'Move to Trash'}" data-help-text="${item.protected ? 'This asset is protected against deletion. Remove protection before moving it into Trash.' : 'Moves this media into a recoverable holding Trash. The physical file and public URL stay intact until a later manual purge.'}">${icon('trash')}<span>${item.protected ? 'Trash locked' : 'Move to Trash'}</span></button>
          </footer>`;
      return `<article class="smo-media-card ${selected ? 'is-selected' : ''} ${playerUtility ? 'has-inline-player' : ''} ${item.protected ? 'is-protected-asset' : ''} ${item.trashed ? 'is-trashed-asset' : ''}" data-id="${item.id}">
        <div class="smo-card-tools">
          <div class="smo-card-tools__identity">
            <span class="smo-file-badge ${getFileBadgeClass(item)}" title="${encode(item.mime || item.extension)}">${encode(item.extension)}</span>
          </div>
          ${dragHandle}
          <div class="smo-card-tools__actions">
            <button type="button" class="smo-card-select" aria-label="Select ${encode(item.filename)}" data-help-title="Select item" data-help-text="Select this media item for floating bulk controls.">${selected ? icon('check') : ''}</button>
            ${item.trashed ? '' : `<button type="button" class="smo-card-fav ${item.favourite ? 'is-on' : ''}" title="Favourite" aria-pressed="${item.favourite ? 'true' : 'false'}" data-help-title="Favourite" data-help-text="Mark this item as a favourite so you can find it quickly later or collect favourites within a folder.">${icon('heart')}</button>`}
          </div>
        </div>
        <div class="smo-card-preview-wrap">${preview}</div>
        ${playerUtility}
        <div class="smo-card-body">
          <div class="smo-card-title" title="${encode(item.title || item.filename)}">${encode(item.title || item.filename)}</div>
          <div class="smo-card-file" title="${encode(item.filename)}">${encode(item.filename)}</div>
          ${folderControl}
          <div class="smo-card-meta">
            ${dims ? `<span class="smo-meta-pill">${encode(dims)}</span>` : ''}
            <span class="smo-meta-pill">${encode(item.size)}</span>
            ${item.ratio ? `<span class="smo-meta-pill">${encode(item.ratio)}</span>` : ''}
            ${item.trashed ? '' : alt}
            ${!item.trashed && item.kind === 'image' && item.studioVersionCount ? `<button type="button" class="smo-meta-pill is-studio smo-version-pill" data-open-versions="${item.id}" title="View Image Studio versions" data-help-title="Image Studio versions" data-help-text="Open this media item directly at its Image Studio versions so you can inspect them, copy their URLs or open a version in Studio.">V ${item.studioVersionCount}</button>` : ''}
            ${item.loadGrade ? `<span class="smo-meta-pill is-load is-grade-${encode(item.loadGrade)}">Load ${encode(item.loadGrade)}</span>` : ''}
            ${trashBadge}${trashTimerBadge}${protectionBadge}${duplicateBadge}
          </div>
          <div class="smo-card-detail-row">
            ${item.trashed
              ? `<div><span class="smo-detail-key">Moved to Trash</span><br>${encode(item.trashedLabel || 'Held safely')}</div><div><span class="smo-detail-key">Protection</span><br>${encode(trashProtection)}</div>`
              : `<div><span class="smo-detail-key">Status</span><br>${encode(item.editState.label)}</div><div><span class="smo-detail-key">Total storage</span><br>${encode(item.totalStorage)}</div>`}
          </div>
        </div>
        ${footer}
      </article>`;
    };

    const trashSelectedItems = async (ids) => {
      const uniqueIds = Array.from(new Set((ids || []).map(Number).filter(Boolean)));
      if (!uniqueIds.length) return toast('No media items were selected.', 'error');
      const items = state.items.filter((item) => uniqueIds.includes(Number(item.id)));
      const eligible = items.filter((item) => !item.trashed && !item.protected).map((item) => Number(item.id));
      const protectedCount = items.filter((item) => !!item.protected).length;
      if (!eligible.length) return toast(protectedCount ? 'The selected media is protected. Remove protection before moving it to Trash.' : 'No eligible media was selected.', 'error', 5200);

      const first = await simmeConfirm({
        title: `Move ${eligible.length} media item${eligible.length === 1 ? '' : 's'} to Trash?`,
        message: 'This removes the media from normal Simme library views but keeps the original WordPress attachment, file, URL, folders and Studio metadata intact.',
        note: `Trash is recoverable. Permanent deletion stays locked for ${Number(SIMME_MEDIA_ORGANISER_DATA.settings.trash_retention_days || 30)} days and must still be triggered manually.${protectedCount ? ` ${protectedCount} protected item${protectedCount === 1 ? '' : 's'} will be left untouched.` : ''}`,
        confirmLabel: 'Continue to safety check',
        tone: 'warning'
      });
      if (!first) return;
      const second = await simmeConfirm({
        title: 'Confirm move to protected Trash',
        message: `Move ${eligible.length} media item${eligible.length === 1 ? '' : 's'} into the recoverable Trash holding area now?`,
        note: 'This is the second safety gate. The physical uploads are not deleted and can be restored from Trash.',
        confirmLabel: 'Move to Trash',
        tone: 'warning'
      });
      if (!second) return;
      try {
        const data = await api('simme_media_organiser_trash_media', { ids: eligible });
        const changed = Number(data.changed || 0);
        state.selected.clear(); state.selectionAnchorId = null; state.rangeComplete = false;
        const blocked = Number(data.blockedProtected || 0) + Number(data.blockedPermission || 0);
        toast(`${changed} media item${changed === 1 ? '' : 's'} moved to protected Trash.${blocked ? ` ${blocked} item${blocked === 1 ? '' : 's'} stayed in the library.` : ''}`, 'success', 5600);
        await load();
      } catch (err) { toast(err.message, 'error', 6500); }
    };

    const restoreTrashItems = async (ids) => {
      const uniqueIds = Array.from(new Set((ids || []).map(Number).filter(Boolean)));
      if (!uniqueIds.length) return toast('No Trash items were selected.', 'error');
      try {
        const data = await api('simme_media_organiser_restore_media', { ids: uniqueIds });
        const changed = Number(data.changed || 0);
        state.selected.clear(); state.selectionAnchorId = null; state.rangeComplete = false;
        toast(`${changed} media item${changed === 1 ? '' : 's'} restored to the working library. Existing URLs and folder assignments were retained.`, 'success', 5200);
        await load();
      } catch (err) { toast(err.message, 'error', 6500); }
    };

    const purgeTrashItems = async (ids) => {
      const uniqueIds = Array.from(new Set((ids || []).map(Number).filter(Boolean)));
      if (!uniqueIds.length) return toast('No Trash items were selected.', 'error');
      const items = state.items.filter((item) => uniqueIds.includes(Number(item.id)));
      const locked = items.filter((item) => !item.trashReady);
      if (locked.length) {
        const next = locked[0];
        return toast(`Permanent purge is still locked. ${next.title || next.filename || 'The selected item'} becomes purgeable on ${next.trashReadyLabel || 'the end of its protection period'}. Use Set purge timer if you deliberately need to unlock it sooner.`, 'error', 8000);
      }
      const usageCount = items.reduce((sum, item) => sum + Math.max(0, Number(item.usageCount || 0)), 0);
      const totalBytes = items.reduce((sum, item) => sum + Math.max(0, Number(item.totalBytes || item.sizeBytes || 0)), 0);
      const sizeLabel = totalBytes ? ` Approximate attached storage: ${studioHumanBytes(totalBytes)}.` : '';
      const first = await simmeConfirm({
        title: `Permanently purge ${uniqueIds.length} media item${uniqueIds.length === 1 ? '' : 's'}?`,
        message: 'This removes the WordPress attachment and physical media files. Image Studio working-version files belonging to the item are also cleaned up.',
        note: `${usageCount ? `Simme has detected ${usageCount} possible content reference${usageCount === 1 ? '' : 's'} across the selected media. ` : ''}${sizeLabel} This cannot be undone.`,
        confirmLabel: 'Continue to final gate',
        tone: 'danger'
      });
      if (!first) return;
      const second = await simmeConfirm({
        title: 'Final permanent-delete confirmation',
        message: `Permanently delete ${uniqueIds.length} selected media item${uniqueIds.length === 1 ? '' : 's'} and their files now?`,
        note: 'This is the second destructive safety gate. Restore will no longer be possible after this action.',
        confirmLabel: 'Purge permanently',
        tone: 'danger'
      });
      if (!second) return;
      try {
        const data = await api('simme_media_organiser_purge_media', { ids: uniqueIds });
        const purged = Number(data.purged || 0);
        state.selected.clear(); state.selectionAnchorId = null; state.rangeComplete = false;
        toast(`${purged} media item${purged === 1 ? '' : 's'} permanently purged.`, 'success', 5200);
        await load();
      } catch (err) { toast(err.message, 'error', 7000); }
    };

    const purgeReadyTrash = async () => {
      const first = await simmeConfirm({
        title: 'Purge all ready Trash items?',
        message: 'Only items whose configured protection period has fully elapsed will be permanently deleted. Protected or still-waiting items remain untouched.',
        note: 'Nothing is purged automatically. This manual action permanently removes eligible WordPress attachments and their physical files.',
        confirmLabel: 'Continue to final gate',
        tone: 'danger'
      });
      if (!first) return;
      const second = await simmeConfirm({
        title: 'Final Empty Trash safety gate',
        message: 'Permanently purge every currently eligible item from Simme Trash?',
        note: 'This cannot be undone. Items still inside their protection period will stay in Trash.',
        confirmLabel: 'Purge ready items',
        tone: 'danger'
      });
      if (!second) return;
      try {
        const data = await api('simme_media_organiser_purge_ready_trash');
        const purged = Number(data.purged || 0);
        const limitedNote = data.limited ? ' Up to 500 Trash items were checked in this pass; run Purge ready items again if more remain.' : '';
        toast(purged ? `${purged} ready Trash item${purged === 1 ? '' : 's'} permanently purged.${limitedNote}` : (data.message || 'No Trash items are ready to purge yet.'), purged ? 'success' : 'error', 7000);
        await load();
      } catch (err) { toast(err.message, 'error', 7000); }
    };

    const clearReorderMarkers = () => {
      $$('.smo-media-card', grid).forEach((entry) => entry.classList.remove('is-reorder-before', 'is-reorder-after', 'is-reordering'));
    };

    const reorderVisibleItems = (movedId, targetId, placement) => {
      const items = state.items.slice();
      const movedIndex = items.findIndex((item) => Number(item.id) === Number(movedId));
      if (movedIndex < 0) return false;
      const [moved] = items.splice(movedIndex, 1);
      const targetIndex = items.findIndex((item) => Number(item.id) === Number(targetId));
      if (targetIndex < 0) return false;
      const insertAt = placement === 'after' ? targetIndex + 1 : targetIndex;
      items.splice(insertAt, 0, moved);
      state.items = items;
      return true;
    };

    const saveCustomPosition = async (movedId, targetId, placement) => {
      const previous = state.items.slice();
      if (!reorderVisibleItems(movedId, targetId, placement)) return;
      state.customPositioning = true;
      state.preferCustomPositioning = true;
      state.sort = 'custom';
      updateCustomPositioningControls();
      renderMedia();
      syncSelectionUI();
      updateFilterClearState();
      persistLibraryWorkspace();
      try {
        await api('simme_media_organiser_save_media_order', {
          folder: state.folder,
          moved_id: movedId,
          target_id: targetId,
          placement
        });
        toast('Custom media position saved.');
      } catch (err) {
        state.items = previous;
        renderMedia();
        syncSelectionUI();
        toast(err.message, 'error', 5200);
      }
    };

    const bindCards = () => {
      $$('.smo-media-card', grid).forEach((card) => {
        const id = Number(card.dataset.id);
        const dragHandle = $('.smo-card-drag-handle', card);
        dragHandle?.addEventListener('dragstart', (e) => {
          if (!canArrangeCurrentView() || dragHandle.getAttribute('aria-disabled') === 'true') {
            e.preventDefault();
            return;
          }
          state.reorderingId = id;
          clearReorderMarkers();
          card.classList.add('is-reordering');
          e.dataTransfer.setData('application/x-smo-reorder-id', String(id));
          e.dataTransfer.setData('text/smo-media-id', String(id));
          e.dataTransfer.effectAllowed = 'move';
          try { e.dataTransfer.setDragImage(card, Math.min(80, card.offsetWidth / 2), 24); } catch (err) { /* browser default is fine */ }
        });
        dragHandle?.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!canArrangeCurrentView()) toast('Choose Custom positioning before rearranging cards.', 'error', 3800);
        });
        card.addEventListener('dragover', (e) => {
          const movedId = Number(state.reorderingId || e.dataTransfer?.getData('application/x-smo-reorder-id') || 0);
          if (!movedId || movedId === id || !canArrangeCurrentView()) return;
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = 'move';
          clearReorderMarkers();
          const rect = card.getBoundingClientRect();
          const columns = state.view === 'list' ? 1 : Math.max(1, (getComputedStyle(grid).gridTemplateColumns || '').split(' ').filter(Boolean).length);
          const placement = columns <= 1
            ? (e.clientY < rect.top + rect.height / 2 ? 'before' : 'after')
            : (e.clientX < rect.left + rect.width / 2 ? 'before' : 'after');
          card.classList.add(placement === 'before' ? 'is-reorder-before' : 'is-reorder-after');
          card.dataset.reorderPlacement = placement;
        });
        card.addEventListener('dragleave', (e) => {
          if (e.relatedTarget && card.contains(e.relatedTarget)) return;
          card.classList.remove('is-reorder-before', 'is-reorder-after');
          delete card.dataset.reorderPlacement;
        });
        card.addEventListener('drop', async (e) => {
          const movedId = Number(state.reorderingId || e.dataTransfer?.getData('application/x-smo-reorder-id') || 0);
          if (!movedId || movedId === id || !canArrangeCurrentView()) return;
          e.preventDefault();
          e.stopPropagation();
          const placement = card.dataset.reorderPlacement || 'before';
          clearReorderMarkers();
          state.reorderingId = 0;
          await saveCustomPosition(movedId, id, placement);
        });
        dragHandle?.addEventListener('dragend', () => {
          state.reorderingId = 0;
          clearReorderMarkers();
        });
        $('.smo-card-select', card).addEventListener('click', (e) => {
          e.stopPropagation();
          toggleSelected(id, { shiftKey: e.shiftKey, metaKey: e.metaKey, ctrlKey: e.ctrlKey });
        });
        $('.smo-card-fav', card)?.addEventListener('click', async (e) => { e.stopPropagation(); await setFavourite([id], !state.items.find((i) => Number(i.id) === id).favourite); });
        $('.smo-card-trash', card)?.addEventListener('click', async (e) => { e.preventDefault(); e.stopPropagation(); await trashSelectedItems([id]); });
        $('.smo-card-restore', card)?.addEventListener('click', async (e) => { e.preventDefault(); e.stopPropagation(); await restoreTrashItems([id]); });
        $('.smo-card-trash-timer', card)?.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); openTrashTimer([id]); });
        $('.smo-card-purge', card)?.addEventListener('click', async (e) => { e.preventDefault(); e.stopPropagation(); await purgeTrashItems([id]); });
        $('.smo-card-unprotect', card)?.addEventListener('click', async (e) => {
          e.stopPropagation();
          try {
            await api('simme_media_organiser_toggle_protection', { ids: [id], value: 0 });
            const item = state.items.find((entry) => Number(entry.id) === id);
            if (item) item.protected = false;
            toast('Asset protection removed.');
            if (state.folder === 'smart-protected') await load();
            else { renderMedia(); syncSelectionUI(); updateBulk(); }
          } catch (err) { toast(err.message, 'error'); }
        });
        $('.smo-version-pill', card)?.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          openInspector(id, { focusVersions: true });
        });
        $('.smo-card-copy', card)?.addEventListener('click', async (e) => {
          e.stopPropagation();
          const item = state.items.find((i) => Number(i.id) === id);
          const button = e.currentTarget;
          try {
            await copyText(item ? item.url : '');
            button.classList.add('is-copied');
            button.innerHTML = `${icon('check')}<span>Copied</span>`;
            toast('Media URL copied to clipboard.');
            setTimeout(() => {
              if (!button.isConnected) return;
              button.classList.remove('is-copied');
              button.innerHTML = `${icon('copy')}<span>Copy URL</span>`;
            }, 1300);
          } catch (err) {
            toast(err.message, 'error');
          }
        });
        $('.smo-card-export-package', card)?.addEventListener('click', async (e) => {
          e.preventDefault();
          e.stopPropagation();
          return;
        });
        $('.smo-card-quicklook', card)?.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const item = state.items.find((entry) => Number(entry.id) === id);
          if (!item || item.kind !== 'image' || !item.url) {
            toast('This media item does not have an image preview to show.', 'error');
            return;
          }
          openVersionQuickLook({
            url: item.url,
            width: item.width,
            height: item.height,
            mime: item.mime,
            size: item.size,
            sizeBytes: item.sizeBytes,
          }, item.title || item.filename || 'Image', e.currentTarget);
        });
        $('.smo-card-edit', card)?.addEventListener('click', (e) => { e.stopPropagation(); openInspector(id); });
        $('.smo-alt-pill', card)?.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); openAltEditor(id); });
        $('.smo-card-studio', card)?.addEventListener('click', (e) => { e.stopPropagation(); openStudio(id); });
        $('button.smo-card-folder-badge', card)?.addEventListener('click', (e) => {
          e.stopPropagation();
          state.folder = String(e.currentTarget.dataset.cardFolder || 'all');
          state.page = 1;
          $$('.smo-nav-item').forEach((b) => b.classList.toggle('is-active', b.dataset.folder === state.folder));
          load();
        });
        $('.smo-card-preview', card)?.addEventListener('dblclick', () => {
          const item = state.items.find((entry) => Number(entry.id) === id);
          if (!item?.trashed) openInspector(id);
        });

        const player = $('.smo-inline-player', card);
        if (player) {
          const media = player.dataset.mediaPlayer === 'video' ? $('.smo-player-media', card) : $('.smo-player-media', player);
          const playButton = $('.smo-player-play', player);
          const playLabel = $('.smo-player-play-label', player);
          const progress = $('.smo-player-progress', player);
          const current = $('.smo-player-current', player);
          const duration = $('.smo-player-duration', player);
          const volumeButton = $('.smo-player-volume-button', player);
          const volume = $('.smo-player-volume', player);
          const stopControlPropagation = (e) => e.stopPropagation();
          ['click', 'mousedown', 'dblclick'].forEach((eventName) => player.addEventListener(eventName, stopControlPropagation));
          player.addEventListener('dragstart', (e) => e.preventDefault());

          // The media card itself is draggable for filing into folders. While a
          // player control is being manipulated, temporarily disable that card
          // drag so range sliders always belong to the player, not the card.
          player.addEventListener('pointerdown', (e) => {
            stopControlPropagation(e);
            card.dataset.playerInteracting = '1';
            card.draggable = false;
            const releasePlayerLock = () => {
              if (!card.isConnected) return;
              delete card.dataset.playerInteracting;
              card.draggable = true;
            };
            window.addEventListener('pointerup', releasePlayerLock, { once: true });
            window.addEventListener('pointercancel', releasePlayerLock, { once: true });
          });

          const pauseOtherMedia = () => {
            $$('.smo-player-media', grid).forEach((other) => {
              if (other !== media && !other.paused) other.pause();
            });
          };

          const updatePlayState = () => {
            if (!media || !playButton) return;
            const playing = !media.paused && !media.ended;
            card.classList.toggle('is-media-playing', playing);
            playButton.classList.toggle('is-playing', playing);
            playButton.innerHTML = `${icon(playing ? 'pause' : 'play')}<span class="smo-player-play-label">${playing ? 'Pause' : 'Play'}</span>`;
            playButton.setAttribute('aria-label', `${playing ? 'Pause' : 'Play'} ${card.querySelector('.smo-card-title')?.textContent || 'media'}`);
          };

          const updateTimeline = () => {
            if (!media || !progress || !current || !duration) return;
            const total = Number.isFinite(media.duration) ? media.duration : 0;
            const elapsed = Number.isFinite(media.currentTime) ? media.currentTime : 0;
            const percent = total > 0 ? Math.min(100, Math.max(0, (elapsed / total) * 100)) : 0;
            progress.value = String(percent);
            progress.style.setProperty('--smo-player-progress', `${percent}%`);
            current.textContent = formatMediaTime(elapsed);
            duration.textContent = formatMediaTime(total);
          };

          const updateVolumeState = () => {
            if (!media || !volumeButton || !volume) return;
            const effective = media.muted ? 0 : media.volume;
            volume.value = String(effective);
            volume.style.setProperty('--smo-volume-progress', `${Math.round(effective * 100)}%`);
            volumeButton.innerHTML = icon(effective <= 0.001 ? 'mute' : 'volume');
            volumeButton.classList.toggle('is-muted', effective <= 0.001);
          };

          if (media && playButton && progress && volumeButton && volume) {
            media.muted = false;
            media.volume = preferredAudibleVolume();
            updateVolumeState();
            updateTimeline();

            playButton.addEventListener('click', async () => {
              try {
                if (media.paused || media.ended) {
                  pauseOtherMedia();
                  if (media.ended) media.currentTime = 0;
                  if (media.muted || media.volume < MIN_AUDIBLE_MEDIA_VOLUME) {
                    media.muted = false;
                    media.volume = preferredAudibleVolume();
                  }
                  await media.play();
                } else {
                  media.pause();
                }
              } catch (err) {
                toast('Media playback could not start in this browser.', 'error');
              }
              updatePlayState();
            });

            progress.addEventListener('input', () => {
              const total = Number.isFinite(media.duration) ? media.duration : 0;
              if (total > 0) media.currentTime = (Number(progress.value) / 100) * total;
              progress.style.setProperty('--smo-player-progress', `${progress.value}%`);
              updateTimeline();
            });

            volume.addEventListener('input', () => {
              const next = Math.min(1, Math.max(MIN_AUDIBLE_MEDIA_VOLUME, Number(volume.value)));
              media.muted = false;
              media.volume = next;
              localStorage.setItem('smo_media_volume', String(next));
              updateVolumeState();
            });

            volumeButton.addEventListener('click', () => {
              const willUnmute = media.muted;
              media.muted = !media.muted;
              if (willUnmute && media.volume < MIN_AUDIBLE_MEDIA_VOLUME) media.volume = preferredAudibleVolume();
              updateVolumeState();
            });

            media.addEventListener('play', () => { pauseOtherMedia(); updatePlayState(); });
            media.addEventListener('pause', updatePlayState);
            media.addEventListener('ended', () => { updatePlayState(); updateTimeline(); });
            media.addEventListener('timeupdate', updateTimeline);
            media.addEventListener('durationchange', updateTimeline);
            media.addEventListener('loadedmetadata', updateTimeline);
            media.addEventListener('volumechange', updateVolumeState);
          }
        }
      });
    };

    const visibleIds = () => state.items.map((item) => Number(item.id));

    const markdownSafe = (value) => String(value ?? '')
      .replace(/\\/g, '\\\\')
      .replace(/([*_`#\[\]<>])/g, '\\$1')
      .trim();

    const fileSlug = (value) => String(value || 'simme-media')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 72) || 'simme-media';

    const downloadSelectedUrls = () => {
      const selectedIds = new Set(Array.from(state.selected).map(Number));
      const selectedItems = state.items.filter((item) => selectedIds.has(Number(item.id)));
      if (!selectedItems.length) {
        toast('Select at least one media item first.', 'error');
        return;
      }

      const now = new Date();
      const generated = now.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
      const currentView = ($('#smo-current-title')?.textContent || 'Media Library').trim();
      const lines = [
        '# Simme Media URL Pack',
        '',
        `Generated: ${generated}`,
        `View / folder: ${markdownSafe(currentView)}`,
        `Selected media: ${selectedItems.length}`,
        '',
        '## Quick URL List',
        ''
      ];

      selectedItems.forEach((item) => {
        const label = item.title || item.filename || `Attachment ${item.id}`;
        lines.push(`- **${markdownSafe(label)}** — <${item.url}>`);
      });

      lines.push('', '---', '', '## Developer Pack', '', '### PHP array', '', '```php', '$simme_media = [');
      selectedItems.forEach((item) => {
        const key = fileSlug(item.title || item.filename || `attachment-${item.id}`).replace(/-/g, '_');
        lines.push(`    '${key}' => '${String(item.url || '').replace(/'/g, "\\'")}',`);
      });
      lines.push('];', '```', '', '### JSON', '', '```json');
      lines.push(JSON.stringify(Object.fromEntries(selectedItems.map((item) => [fileSlug(item.title || item.filename || `attachment-${item.id}`).replace(/-/g, '_'), { url: item.url, attachmentId: Number(item.id), mime: item.mime || '', width: Number(item.width || 0), height: Number(item.height || 0), folder: item.folder?.path || 'Unfiled' }])), null, 2));
      lines.push('```', '', '### CSS custom properties', '', '```css', ':root {');
      selectedItems.forEach((item) => {
        const key = fileSlug(item.title || item.filename || `attachment-${item.id}`);
        lines.push(`  --media-${key}: url("${String(item.url || '').replace(/"/g, '\\"')}");`);
      });
      lines.push('}', '```', '', '---', '', '## Media Details', '');

      selectedItems.forEach((item, index) => {
        const label = item.title || item.filename || `Attachment ${item.id}`;
        const folder = item.folder?.path || 'Unfiled';
        const dimensions = item.width && item.height ? `${item.width} × ${item.height}` : '';
        lines.push(`### ${index + 1}. ${markdownSafe(label)}`);
        lines.push('');
        if (item.filename) lines.push(`- **Filename:** ${markdownSafe(item.filename)}`);
        lines.push(`- **WordPress attachment ID:** ${Number(item.id)}`);
        lines.push(`- **Folder:** ${markdownSafe(folder)}`);
        if (item.mime) lines.push(`- **File type:** ${markdownSafe(item.mime)}`);
        if (dimensions) lines.push(`- **Dimensions:** ${dimensions}`);
        if (item.size) lines.push(`- **File size:** ${markdownSafe(item.size)}`);
        if (item.alt) lines.push(`- **Alt text:** ${markdownSafe(item.alt)}`);
        lines.push(`- **URL:** <${item.url}>`);
        lines.push('');
      });

      lines.push('---', '', '_Created by Simme Media Organiser. The URLs above are the existing public WordPress media URLs; creating this file does not move or rename any media._', '');

      const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const datePart = now.toISOString().slice(0, 10);
      link.href = objectUrl;
      link.download = `${fileSlug(currentView)}-urls-${datePart}.md`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      toast(`${selectedItems.length} media URL${selectedItems.length === 1 ? '' : 's'} downloaded as Markdown.`);
    };

    const resetSelectionAnchorIfEmpty = () => {
      if (state.selected.size === 0) {
        state.selectionAnchorId = null;
        state.rangeComplete = false;
      }
    };

    const syncSelectionUI = () => {
      $$('.smo-media-card', grid).forEach((card) => {
        const cardId = Number(card.dataset.id);
        const selected = state.selected.has(cardId);
        card.classList.toggle('is-selected', selected);
        const button = $('.smo-card-select', card);
        if (button) {
          button.innerHTML = selected ? icon('check') : '';
          button.setAttribute('aria-pressed', selected ? 'true' : 'false');
        }
      });
      updateBulk();
    };

    const updateRangeToggle = () => {
      if (!rangeToggle) return;
      const enabled = !!state.rangeSelectEnabled;
      rangeToggle.classList.toggle('is-on', enabled);
      rangeToggle.classList.toggle('is-off', !enabled);
      rangeToggle.setAttribute('aria-checked', enabled ? 'true' : 'false');
      const label = $('#smo-range-mode-label');
      if (label) label.textContent = enabled ? 'On · choose first, then last' : 'Off · select items individually';
      rangeToggle.setAttribute('data-help-text', enabled
        ? 'Range Select is on. Click a lead item, then a later item to select everything between them. Click any selected item again to remove only that item.'
        : 'Range Select is off. Each click selects or deselects only that individual media item. Turn it on when you want first-to-last range selection.');
    };

    const selectRange = (fromId, toId) => {
      const ids = visibleIds();
      const fromIndex = ids.indexOf(Number(fromId));
      const toIndex = ids.indexOf(Number(toId));
      if (fromIndex < 0 || toIndex < 0) return false;
      const start = Math.min(fromIndex, toIndex);
      const end = Math.max(fromIndex, toIndex);
      ids.slice(start, end + 1).forEach((itemId) => state.selected.add(itemId));
      return true;
    };

    const toggleSelected = (id, keys = {}) => {
      id = Number(id);
      const isSelected = state.selected.has(id);

      // Clicking an already-selected item always removes only that one item.
      // This makes it easy to clean unwanted files out of a selected range.
      if (isSelected) {
        state.selected.delete(id);
        resetSelectionAnchorIfEmpty();
        syncSelectionUI();
        return;
      }

      // When Range Select is off, every normal click is an individual toggle.
      // Existing selections stay intact, so users can build a non-contiguous set naturally.
      if (!state.rangeSelectEnabled) {
        state.selected.add(id);
        state.selectionAnchorId = null;
        state.rangeComplete = false;
        syncSelectionUI();
        return;
      }

      // Cmd/Ctrl-click is an explicit individual add while Range Select is on.
      if (keys.metaKey || keys.ctrlKey) {
        state.selected.add(id);
        state.selectionAnchorId = id;
        state.rangeComplete = true;
        syncSelectionUI();
        return;
      }

      if (!state.selectionAnchorId || state.selected.size === 0) {
        // First click becomes the lead item for a simple two-click range selection.
        state.selected.add(id);
        state.selectionAnchorId = id;
        state.rangeComplete = false;
      } else if (keys.shiftKey || !state.rangeComplete) {
        // Second click (or any Shift-click) selects everything between lead and end.
        if (selectRange(state.selectionAnchorId, id)) {
          state.rangeComplete = true;
        } else {
          state.selected.add(id);
        }
      } else {
        // Once the first range is complete, normal clicks add individual items.
        state.selected.add(id);
      }

      syncSelectionUI();
    };

    const updateBulk = () => {
      const visibleSelected = visibleIds().filter((id) => state.selected.has(id)).length;
      const count = state.selected.size;
      const selectedItems = state.items.filter((item) => state.selected.has(Number(item.id)));
      const protectedSelected = selectedItems.filter((item) => !!item.protected);
      const unprotectedSelected = selectedItems.filter((item) => !item.protected);
      const favouriteSelected = selectedItems.filter((item) => !!item.favourite);
      const unfavouriteSelected = selectedItems.filter((item) => !item.favourite);
      const trashView = state.folder === 'trash';
      const trashReadySelected = selectedItems.filter((item) => !!item.trashed && !!item.trashReady);
      const trashLockedSelected = selectedItems.filter((item) => !!item.trashed && !item.trashReady);
      selectedCount.textContent = count;
      bulkbar.hidden = count === 0;
      if (count > 0) window.requestAnimationFrame(positionBulkbar);
      $$('.smo-bulkbar__group--organise,.smo-bulkbar__group--mark,.smo-bulkbar__group--output', bulkbar).forEach((group) => { group.hidden = trashView; });
      const trashGroup = $('.smo-bulkbar__group--trash', bulkbar);
      if (trashGroup) trashGroup.hidden = false;
      const trashButton = $('#smo-bulk-trash');
      const restoreButton = $('#smo-bulk-restore');
      const timerButton = $('#smo-bulk-trash-timer');
      const purgeButton = $('#smo-bulk-purge');
      if (trashButton) {
        trashButton.hidden = trashView;
        const eligible = unprotectedSelected.filter((item) => !item.trashed).length;
        const label = trashButton.querySelector('span');
        if (label) label.textContent = eligible && eligible !== count ? `Move to Trash (${eligible})` : 'Move to Trash';
        trashButton.disabled = eligible === 0;
      }
      if (restoreButton) {
        restoreButton.hidden = !trashView;
        const label = restoreButton.querySelector('span');
        if (label) label.textContent = count ? `Restore (${count})` : 'Restore';
      }
      if (timerButton) {
        timerButton.hidden = !trashView;
        const eligibleTimerCount = selectedItems.filter((item) => !!item.trashed && !item.protected).length;
        timerButton.disabled = eligibleTimerCount === 0;
        const label = timerButton.querySelector('span');
        if (label) label.textContent = eligibleTimerCount && eligibleTimerCount !== count ? `Set purge timer (${eligibleTimerCount})` : `Set purge timer${count ? ` (${count})` : ''}`;
        timerButton.setAttribute('data-help-text', eligibleTimerCount ? `Choose exactly how long permanent purge should stay locked for ${eligibleTimerCount} selected Trash item${eligibleTimerCount === 1 ? '' : 's'}. This timer never deletes media automatically.` : 'Protected Trash items cannot have their purge timer changed until asset protection is removed.');
      }
      if (purgeButton) {
        purgeButton.hidden = !trashView;
        purgeButton.disabled = trashReadySelected.length === 0 || trashLockedSelected.length > 0;
        const label = purgeButton.querySelector('span');
        if (label) label.textContent = trashLockedSelected.length ? `Purge locked (${trashLockedSelected.length})` : `Purge permanently (${trashReadySelected.length})`;
        purgeButton.setAttribute('data-help-text', trashLockedSelected.length ? `${trashLockedSelected.length} selected Trash item${trashLockedSelected.length === 1 ? ' is' : 's are'} still inside the protection period.` : 'Permanently deletes the selected ready Trash items after two deliberate confirmation gates.');
      }
      selectAll.checked = state.items.length > 0 && visibleSelected === state.items.length;
      selectAll.indeterminate = visibleSelected > 0 && visibleSelected < state.items.length;
      $$('.smo-clear-selection-control').forEach((button) => {
        button.disabled = count === 0;
        button.classList.toggle('has-selection', count > 0);
        const label = button.querySelector('span');
        if (label) label.textContent = count > 0 ? `Clear selection (${count})` : 'Clear selection';
      });
      const countBlock = $('.smo-bulkbar__count');
      if (countBlock) {
        countBlock.setAttribute('data-help-title', 'Current selection');
        countBlock.setAttribute('data-help-text', `${count} media item${count === 1 ? '' : 's'} will be included in the next bulk action. The purple card state and this number are generated from the same live selection set.`);
      }
      const protectionSummary = $('#smo-bulk-protection-summary');
      if (protectionSummary) {
        const summaryParts = [];
        if (trashView) {
          if (trashReadySelected.length) summaryParts.push(`${trashReadySelected.length} ready to purge`);
          if (trashLockedSelected.length) summaryParts.push(`${trashLockedSelected.length} purge gate locked`);
          if (!summaryParts.length && count) summaryParts.push('Recoverable Trash selection');
        } else {
          if (favouriteSelected.length) summaryParts.push(`${favouriteSelected.length} favourite${favouriteSelected.length === 1 ? '' : 's'}`);
          if (protectedSelected.length) summaryParts.push(`${protectedSelected.length} protected`);
          if (!summaryParts.length && count) summaryParts.push('No favourites or protection');
        }
        protectionSummary.textContent = summaryParts.join(' · ');
      }
      const favouriteButton = $('#smo-bulk-favourite');
      const unfavouriteButton = $('#smo-bulk-unfavourite');
      if (favouriteButton) {
        const favouriteCount = unfavouriteSelected.length;
        favouriteButton.hidden = favouriteCount === 0;
        favouriteButton.innerHTML = `${icon('heart')}<span>${favouriteSelected.length > 0 && favouriteCount > 0 ? `Favourite (${favouriteCount})` : 'Favourite'}</span>`;
        favouriteButton.setAttribute('data-help-title', favouriteSelected.length > 0 && favouriteCount > 0 ? 'Favourite un-favourited selected items' : 'Favourite selected items');
        favouriteButton.setAttribute('data-help-text', favouriteCount > 0 ? `Adds ${favouriteCount} currently un-favourited selected item${favouriteCount === 1 ? '' : 's'} to favourites.` : 'Every selected item is already a favourite.');
      }
      if (unfavouriteButton) {
        const unfavouriteCount = favouriteSelected.length;
        unfavouriteButton.hidden = unfavouriteCount === 0;
        unfavouriteButton.innerHTML = `${icon('heart')}<span>${unfavouriteSelected.length > 0 && unfavouriteCount > 0 ? `Un-favourite (${unfavouriteCount})` : 'Un-favourite'}</span>`;
        unfavouriteButton.setAttribute('data-help-title', 'Un-favourite selected items');
        unfavouriteButton.setAttribute('data-help-text', unfavouriteCount > 0 ? `Removes favourite status from ${unfavouriteCount} selected item${unfavouriteCount === 1 ? '' : 's'}.` : 'None of the selected items are favourites.');
      }
      const protectButton = $('#smo-bulk-protect');
      const unprotectButton = $('#smo-bulk-unprotect');
      if (protectButton) {
        const protectCount = unprotectedSelected.length;
        protectButton.hidden = protectCount === 0;
        protectButton.innerHTML = `${icon('shield')}<span>${protectedSelected.length > 0 && protectCount > 0 ? `Protect (${protectCount})` : 'Protect'}</span>`;
        protectButton.setAttribute('data-help-title', protectedSelected.length > 0 && protectCount > 0 ? 'Protect unprotected selected assets' : 'Protect selected assets');
        protectButton.setAttribute('data-help-text', protectCount > 0 ? `Protects ${protectCount} currently unprotected selected asset${protectCount === 1 ? '' : 's'} against WordPress deletion.` : 'Every selected asset is already protected.');
      }
      if (unprotectButton) {
        const unprotectCount = protectedSelected.length;
        unprotectButton.hidden = unprotectCount === 0;
        unprotectButton.innerHTML = `${icon('shield-off')}<span>${unprotectedSelected.length > 0 && unprotectCount > 0 ? `Un-protect (${unprotectCount})` : 'Un-protect'}</span>`;
        unprotectButton.setAttribute('data-help-title', 'Un-protect selected assets');
        unprotectButton.setAttribute('data-help-text', unprotectCount > 0 ? `Removes deletion protection from ${unprotectCount} protected selected asset${unprotectCount === 1 ? '' : 's'}.` : 'None of the selected assets are protected.');
      }
    };

    const moveItems = async (ids, folderId) => {
      const uniqueIds = Array.from(new Set((ids || []).map(Number).filter(Boolean)));
      if (!uniqueIds.length) return toast('No media items are selected.', 'error');
      try {
        const data = await api('simme_media_organiser_move_media', { ids: uniqueIds, folder_id: folderId });
        const moved = Number(data.moved || 0);
        if (moved !== uniqueIds.length) {
          toast(`${moved} of ${uniqueIds.length} selected items were moved. Please review any items that remained behind.`, 'error', 5500);
        } else {
          toast(data.message || `${moved} items organised.`);
        }
        state.selected.clear();
        state.selectionAnchorId = null;
        state.rangeComplete = false;
        await load();
      } catch (err) { toast(err.message, 'error'); }
    };

    const setFavourite = async (ids, value) => {
      try {
        await api('simme_media_organiser_toggle_favourite', { ids, value: value ? 1 : 0 });
        toast(value ? 'Added to favourites.' : 'Removed from favourites.');
        await load();
      } catch (err) { toast(err.message, 'error'); }
    };

    const studioSource = () => {
      if (!state.studioData) return null;
      if (state.studioSourceId === 'master') return state.studioData.master;
      return state.studioData.versions.find((v) => String(v.id) === String(state.studioSourceId)) || state.studioData.master;
    };

    const formatStudioMime = (mime) => ({ 'image/webp': 'WEBP', 'image/avif': 'AVIF', 'image/jpeg': 'JPEG', 'image/png': 'PNG' }[mime] || String(mime || '').replace('image/', '').toUpperCase());

    const studioVersionOptions = () => {
      if (!state.studioData) return '';
      return `<option value="master">Master Original · ${state.studioData.master.width} × ${state.studioData.master.height}</option>`;
    };

    const studioFormatOptions = () => {
      if (!state.studioData) return '';
      return (state.studioData.formats || []).map((f) => `<option value="${encode(f.value)}">${encode(f.label)}</option>`).join('');
    };

    const studioSocialPlatformButtons = () => Object.entries(socialPlatforms).map(([key, data]) => `
      <button type="button" class="smo-social-platform ${state.studioSocialPlatform === key ? 'is-active' : ''}" data-social-platform="${encode(key)}" title="${encode(data.label)} avatar">${socialLogo(key)}</button>`).join('');

    const studioSocialPresetButtons = (platform = state.studioSocialPlatform) => {
      const group = socialPlatforms[platform] || socialPlatforms.instagram;
      const preset = socialPresetProfile(platform);
      return `<button type="button" class="smo-social-preset ${state.studioPreset?.id === preset.id ? 'is-active' : ''}" data-social-preset="${encode(preset.id)}" data-platform="${encode(platform)}">
        ${socialPresetShapeHtml()}
        <span class="smo-social-preset__copy"><span>Avatar</span><small>${encode(preset.bestFor)}</small></span>
        <span class="smo-social-preset__meta"><strong>${preset.width} × ${preset.height}</strong><em>1:1</em></span>
      </button>`;
    };

    const studioRecommendation = (source) => {
      if (!source) return '';
      const large = Number(source.width) > 2400 || Number(source.sizeBytes) > 1024 * 1024;
      if (!large) {
        return `<div class="smo-studio-recommendation is-good"><strong>Already fairly lean</strong><span>This image is ${source.width} × ${source.height} and ${encode(source.size)}. Only make a website version if you need a different crop or dimensions.</span></div>`;
      }
      const target = Math.min(1920, Number(source.width) || 1920);
      return `<div class="smo-studio-recommendation"><strong>Website optimisation available</strong><span>This source is larger than most web placements need. A max-width ${target}px WebP working version is a good starting point.</span><button type="button" class="smo-text-button" id="smo-studio-apply-recommendation">Apply recommendation</button></div>`;
    };

    const studioSessionKey = (attachmentId) => String(Number(attachmentId || 0));

    const clearStudioSession = (attachmentId) => {
      state.studioSessions.delete(studioSessionKey(attachmentId));
    };

    const refreshWordPressAttachmentModel = (attachmentId) => {
      const id = Number(attachmentId || 0);
      if (!id || !window.wp?.media?.attachment) return;
      try {
        const attachment = window.wp.media.attachment(id);
        if (attachment?.fetch) attachment.fetch();
      } catch (err) {
        // The server-side attachment pointer is authoritative. This refresh is
        // only to keep an already-open WordPress media model from showing stale data.
      }
    };

    const captureStudioSession = () => {
      const attachmentId = Number(state.studioData?.attachmentId || 0);
      if (!attachmentId) return null;
      const session = {
        attachmentId,
        sourceId: String(state.studioSourceId || 'master'),
        crop: state.studioCrop ? { ...state.studioCrop } : null,
        cropMode: !!state.studioCropMode,
        socialPlatform: state.studioSocialPlatform,
        presetId: state.studioPreset?.id || '',
        socialTargetWidth: Number(state.studioPreset?.width || 0),
        socialTargetHeight: Number(state.studioPreset?.height || 0),
        fixedAspectRatio: !!state.studioPreset?.fixedAspectRatio,
        safeZoneModel: state.studioPreset?.safeZoneModel || '',
        safeZonesEnabled: !!state.studioSafeZonesEnabled,
        rotation: Number(state.studioRotation || 0),
        flipH: !!state.studioFlipH,
        flipV: !!state.studioFlipV,
        transparencyBg: String(state.studioTransparencyBg || 'checker'),
        controls: {
          ratio: $('#smo-studio-crop-ratio')?.value || 'free',
          width: $('#smo-studio-width')?.value || '',
          height: $('#smo-studio-height')?.value || '',
          lockRatio: !!$('#smo-studio-lock-ratio')?.checked,
          format: $('#smo-studio-format')?.value || 'original',
          quality: $('#smo-studio-quality')?.value || '82',
          label: $('#smo-studio-label')?.value || 'Website Version',
          preferred: !!$('#smo-studio-preferred')?.checked
        }
      };
      state.studioSessions.set(studioSessionKey(attachmentId), session);
      return session;
    };

    const normaliseStudioSessionCrop = (crop, source) => {
      if (!crop || !source) return null;
      const sourceW = Math.max(2, Number(source.width || 0));
      const sourceH = Math.max(2, Number(source.height || 0));
      if (!sourceW || !sourceH) return null;
      const x = Math.max(0, Math.min(sourceW - 2, Number(crop.x || 0)));
      const y = Math.max(0, Math.min(sourceH - 2, Number(crop.y || 0)));
      const width = Math.max(2, Math.min(sourceW - x, Number(crop.width || sourceW)));
      const height = Math.max(2, Math.min(sourceH - y, Number(crop.height || sourceH)));
      return { x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) };
    };

    const applyStudioSessionControls = (session) => {
      if (!session?.controls) return;
      const controls = session.controls;
      const ratio = $('#smo-studio-crop-ratio');
      if (ratio && [...ratio.options].some((option) => option.value === String(controls.ratio))) ratio.value = String(controls.ratio);
      const width = $('#smo-studio-width');
      const height = $('#smo-studio-height');
      const restoredWidth = Number(session.socialTargetWidth || controls.width || 0);
      const restoredHeight = Number(session.socialTargetHeight || controls.height || 0);
      if (width && restoredWidth > 0) width.value = String(restoredWidth);
      if (height && restoredHeight > 0) height.value = String(restoredHeight);
      const lock = $('#smo-studio-lock-ratio');
      if (lock) lock.checked = session.presetId ? session.fixedAspectRatio !== false : controls.lockRatio !== false;
      const format = $('#smo-studio-format');
      if (format && [...format.options].some((option) => option.value === String(controls.format))) format.value = String(controls.format);
      const quality = $('#smo-studio-quality');
      if (quality && Number(controls.quality) >= 40 && Number(controls.quality) <= 100) quality.value = String(controls.quality);
      const qualityValue = $('#smo-studio-quality-value');
      if (qualityValue && quality) qualityValue.textContent = quality.value;
      const label = $('#smo-studio-label');
      if (label && typeof controls.label === 'string') label.value = controls.label;
      const preferred = $('#smo-studio-preferred');
      if (preferred) preferred.checked = !!controls.preferred;
    };

    const removeStudioVisualMask = () => {
      const layer = $('#smo-studio-crop-layer');
      const box = $('#smo-studio-crop-box');
      const safe = $('#smo-crop-safe-zone');
      const safeToggle = $('#smo-crop-safe-toggle');
      const legend = $('#smo-crop-safe-legend');
      const frame = $('#smo-studio-image-frame');
      if (layer) {
        layer.classList.remove('is-active');
        layer.setAttribute('aria-hidden', 'true');
        layer.style.pointerEvents = 'none';
      }
      if (box) {
        box.hidden = true;
        box.classList.remove('is-resolution-good', 'is-resolution-low');
        box.removeAttribute('style');
      }
      if (safe) {
        safe.hidden = true;
        safe.innerHTML = '';
        safe.removeAttribute('style');
      }
      if (safeToggle) safeToggle.hidden = true;
      if (legend) {
        legend.hidden = true;
        legend.innerHTML = '';
      }
      if (frame) frame.classList.remove('is-crop-mode');
    };

    const versionRecipeSession = (version, attachmentId) => {
      const r = version?.editRecipe || {};
      const social = r.social_crop && typeof r.social_crop === 'object' ? r.social_crop : null;
      return {
        attachmentId: Number(attachmentId || 0),
        sourceId: 'master',
        crop: r.crop ? { ...r.crop } : null,
        cropMode: !!r.crop_mode,
        socialPlatform: social?.platform || '',
        presetId: social?.preset_id || '',
        socialTargetWidth: Number(social?.target_width || 0),
        socialTargetHeight: Number(social?.target_height || 0),
        fixedAspectRatio: social ? social.fixed_aspect_ratio !== false : false,
        safeZoneModel: social?.safe_zone_model || '',
        safeZonesEnabled: social ? social.safe_zones_enabled !== false : false,
        rotation: Number(r.rotation || 0),
        flipH: !!r.flip_h,
        flipV: !!r.flip_v,
        transparencyBg: r.transparency_bg || 'checker',
        labelAuto: false,
        controls: {
          ratio: r.crop_ratio || 'free',
          width: Number(social?.target_width || r.resize?.width || version.width || 0),
          height: Number(social?.target_height || r.resize?.height || version.height || 0),
          lockRatio: social ? social.fixed_aspect_ratio !== false : r.lock_ratio !== false,
          format: r.format || version.mime || 'original',
          quality: Number(r.quality || 82),
          label: r.label || version.label || 'Working Version',
          preferred: !!version.preferred
        }
      };
    };

    let socialRecoveryResolver = null;
    let socialRecoveryPreviousFocus = null;

    const closeSocialRecoveryChooser = (selection = null) => {
      const modal = $('#smo-social-recovery-dialog');
      if (!modal) return;
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
      const resolver = socialRecoveryResolver;
      socialRecoveryResolver = null;
      if (socialRecoveryPreviousFocus?.isConnected && typeof socialRecoveryPreviousFocus.focus === 'function') {
        socialRecoveryPreviousFocus.focus({ preventScroll: true });
      }
      socialRecoveryPreviousFocus = null;
      if (resolver) resolver(selection);
    };

    const chooseLegacySocialChannel = (version) => new Promise((resolve) => {
      const recovery = version?.editRecipe?.social_recovery;
      const candidates = Array.isArray(recovery?.candidates) ? recovery.candidates : [];
      const modal = $('#smo-social-recovery-dialog');
      const options = $('#smo-social-recovery-options');
      const target = $('#smo-social-recovery-target');
      if (!modal || !options || candidates.length < 2) {
        resolve(null);
        return;
      }

      if (socialRecoveryResolver) closeSocialRecoveryChooser(null);
      socialRecoveryResolver = resolve;
      socialRecoveryPreviousFocus = document.activeElement;

      const targetWidth = Number(recovery.target_width || 0);
      const targetHeight = Number(recovery.target_height || 0);
      if (target) {
        target.innerHTML = `<span>Saved crop</span><strong>${targetWidth} × ${targetHeight} px</strong><small>Choose the original channel once. Simme will remember it with this Working Version.</small>`;
      }

      options.innerHTML = candidates.map((candidate) => {
        const platform = String(candidate.platform || '');
        const presetId = String(candidate.preset_id || '');
        const label = String(candidate.platformLabel || socialPlatforms[platform]?.label || platform);
        const iconText = socialPlatforms[platform]?.icon || '•';
        return `<button type="button" class="smo-social-recovery-option" data-social-recovery-platform="${encode(platform)}" data-social-recovery-preset="${encode(presetId)}">
          <span class="smo-social-recovery-option__identity"><span class="smo-social-logo is-${encode(platform)}" aria-hidden="true">${encode(iconText)}</span></span>
          <span class="smo-social-recovery-option__copy"><strong>${encode(label)}</strong><small>${Number(candidate.target_width || targetWidth)} × ${Number(candidate.target_height || targetHeight)} avatar</small></span>
          <span class="smo-social-recovery-option__action">Restore</span>
        </button>`;
      }).join('');

      $('.smo-social-recovery-option', options).forEach((button) => button.addEventListener('click', () => {
        const platform = button.dataset.socialRecoveryPlatform || '';
        const presetId = button.dataset.socialRecoveryPreset || '';
        const selection = candidates.find((candidate) => String(candidate.platform) === platform && String(candidate.preset_id) === presetId);
        if (selection) closeSocialRecoveryChooser(selection);
      }));

      if (!modal.dataset.bound) {
        modal.dataset.bound = '1';
        $('[data-social-recovery-cancel]', modal).forEach((button) => button.addEventListener('click', () => closeSocialRecoveryChooser(null)));
        modal.addEventListener('keydown', (event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            closeSocialRecoveryChooser(null);
            return;
          }
          if (event.key !== 'Tab') return;
          const focusable = $('button:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])', modal)
            .filter((element) => element.offsetParent !== null);
          if (!focusable.length) return;
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        });
      }

      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden', 'false');
      window.setTimeout(() => $('.smo-social-recovery-option', options)?.focus({ preventScroll: true }), 10);
    });

    const beginVersionReedit = async (version) => {
      if (!version?.editable || !state.studioData) return;

      const recovery = version?.editRecipe?.social_recovery;
      if (Array.isArray(recovery?.candidates) && recovery.candidates.length > 1) {
        const selection = await chooseLegacySocialChannel(version);
        if (!selection) return;

        try {
          const data = await api('simme_media_organiser_studio_recover_social_crop', {
            id: state.studioData.attachmentId,
            version_id: version.id,
            platform: selection.platform,
            preset_id: selection.preset_id
          });
          state.studioData = data;
          const recovered = (data.versions || []).find((item) => String(item.id) === String(version.id));
          if (!recovered?.editable) throw new Error('The recovered Working Version could not be reopened.');
          version = recovered;
          toast(`${selection.platformLabel || 'Social'} crop restored. Simme will remember this channel with the saved version.`);
        } catch (err) {
          toast(err.message || 'The social channel could not be restored.', 'error', 6500);
          return;
        }
      }

      state.studioEditVersionId = String(version.id);
      state.studioEditLocked = true;
      state.studioSourceId = 'master';
      renderStudio(state.studioData, 'master', versionRecipeSession(version, state.studioData.attachmentId));
      toast('Version reconstructed from the protected master. Unlock the version settings when you are ready to adjust it.');
    };

    const studioReeditMutationLocked = () => !!(state.studioEditVersionId && state.studioEditLocked);

    const syncStudioReeditLock = (locked, announce = false) => {
      if (!state.studioEditVersionId) return;
      state.studioEditLocked = !!locked;

      const workspace = $('.smo-studio-workspace');
      workspace?.classList.toggle('is-reedit-locked', state.studioEditLocked);

      const versionName = $('#smo-studio-label');
      if (versionName) {
        versionName.disabled = false;
        versionName.readOnly = false;
        versionName.removeAttribute('aria-disabled');
      }

      const lockButton = $('#smo-studio-reedit-lock');
      if (lockButton) {
        lockButton.classList.toggle('is-locked', state.studioEditLocked);
        lockButton.classList.toggle('is-unlocked', !state.studioEditLocked);
        lockButton.innerHTML = state.studioEditLocked
          ? `${icon('lock')}<span>Unlock to adjust</span>`
          : `${icon('unlock')}<span>Unlocked</span>`;
        lockButton.setAttribute('aria-label', state.studioEditLocked ? 'Unlock version settings' : 'Lock version settings');
        lockButton.setAttribute('aria-pressed', state.studioEditLocked ? 'true' : 'false');
        lockButton.title = state.studioEditLocked ? 'Version settings are locked. Click to unlock them.' : 'Version settings are unlocked. Click to lock them again.';
      }

      // CSS blocks pointer interaction while locked; native disabled states also
      // prevent keyboard/programmatic activation of editing controls. Controls
      // that were already disabled for another reason are left untouched.
      const lockable = [
        ...$$('.smo-studio-workspace .smo-studio-tools section:not(:first-child) button, .smo-studio-workspace .smo-studio-tools section:not(:first-child) input, .smo-studio-workspace .smo-studio-tools section:not(:first-child) select, .smo-studio-workspace .smo-studio-tools section:not(:first-child) textarea'),
        $('#smo-studio-apply-recommendation')
      ].filter((control) => control && control.id !== 'smo-studio-label');
      lockable.forEach((control) => {
        if (state.studioEditLocked) {
          if (!control.disabled) {
            control.disabled = true;
            control.dataset.smoReeditLockDisabled = '1';
          }
        } else if (control.dataset.smoReeditLockDisabled === '1') {
          control.disabled = false;
          delete control.dataset.smoReeditLockDisabled;
        }
      });

      if (announce) {
        toast(state.studioEditLocked
          ? 'Version settings locked. The saved recipe is frozen until you unlock it again.'
          : 'Version settings unlocked. Changes will still be rebuilt from the protected master.');
      }
    };

    const exitVersionReeditToMaster = async () => {
      if (!state.studioEditVersionId || !state.studioData) return;
      const version = state.studioData.versions.find((item) => String(item.id) === String(state.studioEditVersionId));
      const label = version?.label || 'this version';
      const confirmed = await simmeConfirm({
        title: 'Back to Master Original?',
        message: `Stop Re-editing “${label}” and return to the protected Master Original so you can create a new version?`,
        note: 'Any unsaved changes in this Re-edit session will be discarded. The saved version and protected master will not be changed.',
        confirmLabel: 'Back to Master',
        tone: 'warning'
      });
      if (!confirmed) return;
      state.studioEditVersionId = null;
      state.studioEditLocked = false;
      state.studioSourceId = 'master';
      renderStudio(state.studioData, 'master');
      toast('Back at Master Original — ready to create a new protected version.');
    };

    const studioVersionStateLabel = (data, sourceId) => {
      if (String(sourceId || '') === 'master') return 'Master Original';
      const match = (data.versions || []).find((version) => String(version.id) === String(sourceId));
      return match?.label || 'Working Version';
    };

    const studioStateActionIcon = (direction) => {
      const url = direction === 'redo'
        ? (SIMME_MEDIA_ORGANISER_DATA.historyRedoIconUrl || '')
        : (SIMME_MEDIA_ORGANISER_DATA.historyUndoIconUrl || '');
      return url ? `<img src="${encode(url)}" alt="" aria-hidden="true" />` : '';
    };

    const renderStudio = (data, selectedVersionId = null, restoreSession = null) => {
      if (typeof state.studioVersionsLayoutCleanup === 'function') {
        state.studioVersionsLayoutCleanup();
        state.studioVersionsLayoutCleanup = null;
      }
      state.studioData = data;
      const canRestore = !!(restoreSession && Number(restoreSession.attachmentId) === Number(data.attachmentId));
      const requestedSourceId = selectedVersionId || (canRestore ? restoreSession.sourceId : state.studioSourceId) || 'master';
      if (requestedSourceId !== 'master' && data.versions.some((v) => String(v.id) === String(requestedSourceId))) {
        state.studioSourceId = requestedSourceId;
      } else {
        state.studioSourceId = 'master';
      }

      state.studioCrop = null;
      state.studioSocialPlatform = canRestore && socialPlatforms[restoreSession.socialPlatform] ? restoreSession.socialPlatform : state.studioSocialPlatform;
      state.studioSafeZonesEnabled = canRestore ? restoreSession.safeZonesEnabled !== false : state.studioSafeZonesEnabled;
      state.studioPreset = canRestore && restoreSession.presetId && socialPlatforms[state.studioSocialPlatform]?.preset?.id === restoreSession.presetId
        ? socialPresetProfile(state.studioSocialPlatform, restoreSession)
        : null;
      if (state.studioPreset?.fixedAspectRatio) {
        state.studioSafeZonesEnabled = restoreSession.safeZonesEnabled !== false;
      }
      state.studioRotation = canRestore ? Number(restoreSession.rotation || 0) : 0;
      state.studioFlipH = canRestore ? !!restoreSession.flipH : false;
      state.studioFlipV = canRestore ? !!restoreSession.flipV : false;
      state.studioFocusCanvas = false;
      if (canRestore && ['checker', 'dark', 'light'].includes(restoreSession.transparencyBg)) state.studioTransparencyBg = restoreSession.transparencyBg;

      const source = studioSource();
      if (canRestore) state.studioCrop = normaliseStudioSessionCrop(restoreSession.crop, source);
      state.studioCropMode = canRestore ? !!(restoreSession.cropMode && state.studioCrop) : false;
      const versions = data.versions || [];
      const versionStateHistory = data.versionStateHistory || {};
      const activeVersion = versions.find((version) => !!version.active);
      const activeSourceId = data.masterActive ? 'master' : (activeVersion?.id || 'master');
      const preferredSourceId = data.preferred || 'master';
      const activeStateLabel = studioVersionStateLabel(data, activeSourceId);
      const preferredStateLabel = studioVersionStateLabel(data, preferredSourceId);
      const editVersion = state.studioEditVersionId ? versions.find((v) => String(v.id) === String(state.studioEditVersionId)) : null;
      const reeditMode = !!editVersion;
      const content = $('#smo-studio-content');
      const versionCards = versions.length ? versions.map((version) => `
        <article class="smo-studio-version ${version.preferred ? 'is-preferred' : ''} ${version.active ? 'is-active' : ''}" data-version-id="${encode(version.id)}">
          <div class="smo-studio-version__thumb"><img src="${encode(version.url)}" alt="" /></div>
          <div class="smo-studio-version__body">
            <div class="smo-studio-version__top"><strong>${encode(version.label)}</strong><span>${version.preferred ? 'Studio default' : ''}${version.active ? `${version.preferred ? ' · ' : ''}Active in WordPress` : ''}</span></div>
            <div class="smo-studio-source-statuses">${version.preferred ? '<span class="smo-studio-state-chip is-preferred">Studio default</span>' : ''}${version.active ? '<span class="smo-studio-state-chip is-active">Active in WordPress</span>' : ''}</div>
            <div class="smo-studio-version__meta">${version.width} × ${version.height} · ${formatStudioMime(version.mime)} · ${encode(version.size)} ${studioLoadBadge(version.sizeBytes)}${version.revision > 1 ? ` · Revision ${version.revision}` : ''}</div>
            <div class="smo-studio-version__recipe ${version.editable ? 'is-editable' : 'is-locked'}">${version.editable ? `${icon('history')}<span class="smo-studio-version__recipe-label">Re-editable</span><span class="smo-studio-version__recipe-note">· Protected master</span>` : `${icon('lock')}<span class="smo-studio-version__recipe-label">Re-edit unavailable</span>`}</div>
            <div class="smo-studio-version__actions">
              <button type="button" class="smo-version-quicklook" data-studio-action="quicklook">${icon('eye')}<span>Quick Look</span></button>
              <button type="button" class="smo-version-reedit" data-studio-action="reedit" ${version.editable ? '' : 'disabled'}>${icon('history')}<span>Re-edit</span></button>
              <button type="button" data-studio-action="compare">Compare</button>
              <button type="button" data-studio-action="copy">${icon('copy')}<span>Copy URL</span></button>
              <button type="button" data-studio-action="preferred" ${version.preferred ? 'disabled' : ''}>${version.preferred ? 'Studio default' : 'Set as Studio default'}</button>
              <button type="button" data-studio-action="publish" ${version.active ? 'disabled' : ''}>${version.active ? 'Active in WordPress' : 'Publish to WordPress'}</button>
              <button type="button" class="is-danger" data-studio-action="delete" ${version.active ? 'disabled' : ''}>Delete</button>
            </div>
            <div class="smo-copy-confirm" hidden aria-live="polite"></div>
          </div>
        </article>`).join('') : `<div class="smo-studio-empty-versions"><strong>No working versions yet</strong><span>Your protected master is ready. Use the tools to create your first crop, resized copy or website-optimised version.</span></div>`;

      content.innerHTML = `
        <div class="smo-studio-workspace ${state.studioEditLocked ? 'is-reedit-locked' : ''} ${reeditMode ? 'is-reedit-mode' : ''}">
          <aside class="smo-studio-tools">
            <section class="smo-studio-tool-section">
              <div class="smo-studio-section-title">Source</div>
              <label class="smo-field"><span>Build from</span><select id="smo-studio-source" ${reeditMode ? 'disabled' : ''}>${studioVersionOptions()}</select></label>${reeditMode ? `<div class="smo-studio-reedit-note"><span class="smo-studio-reedit-note__mode">${icon('history')} Re-edit mode</span><strong>Re-editing ${encode(editVersion.label)}</strong><span>This version is being reconstructed from the untouched protected master. <b>Reset changes</b> restores its last-saved recipe. To make a separate new version, return to Master Original.</span><button type="button" class="smo-studio-back-master smo-studio-back-master--source" data-studio-exit-reedit>${icon('image')}<span class="smo-studio-back-master__copy"><b>Back to Master</b><small>Create a new version</small></span></button></div>` : ''}
              ${studioRecommendation(source)}
              ${studioLoadHealthHtml(source.sizeBytes, 'Current source')}
              ${studioLoadGuideHtml()}
            </section>

            <section class="smo-studio-tool-section smo-studio-crop-section">
              <div class="smo-studio-section-title">Crop</div>
              <div class="smo-studio-crop-intro"><strong>Choose a shape, then position it on the image.</strong><span>Preset buttons start crop mode automatically — you do not need to press another control first.</span></div>
              <select id="smo-studio-crop-ratio" aria-label="Crop ratio" class="smo-studio-hidden-select">
                <option value="free">Free crop</option>
                <option value="1">1:1 square</option>
                <option value="1.7777777778">16:9</option>
                <option value="1.3333333333">4:3</option>
                <option value="0.8">4:5</option>
                <option value="0.5625">9:16</option>
              </select>
              <div class="smo-studio-ratio-grid" aria-label="Common crop ratios">
                <button type="button" class="smo-ratio-preset" data-crop-ratio-preset="free">Free</button>
                <button type="button" class="smo-ratio-preset" data-crop-ratio-preset="1">1:1</button>
                <button type="button" class="smo-ratio-preset" data-crop-ratio-preset="1.7777777778">16:9</button>
                <button type="button" class="smo-ratio-preset" data-crop-ratio-preset="0.8">4:5</button>
                <button type="button" class="smo-ratio-preset" data-crop-ratio-preset="0.5625">9:16</button>
              </div>
              <div class="smo-studio-crop-actions">
                <button type="button" class="smo-tool-button smo-tool-button--wide" id="smo-studio-draw-crop">${icon('crop')} Start free crop</button>
                <button type="button" class="smo-tool-button smo-tool-button--soft smo-clear-crop-trigger" data-clear-crop="1">${icon('close')} Clear crop</button>
              </div>

              <div class="smo-social-builder is-free-avatar-mode">
                <div class="smo-social-builder__head"><div><strong>Social Avatar Creator</strong><span>One 1:1 profile preset for each supported channel</span></div><small class="is-free-avatar">AVATAR MODE</small></div>
                <div class="smo-social-platforms" id="smo-social-platforms">${studioSocialPlatformButtons()}</div>
                <div class="smo-social-presets" id="smo-social-presets">${studioSocialPresetButtons()}</div>
                <div class="smo-social-preset-status" id="smo-social-preset-status">${socialEmptyStatusHtml()}</div>
                <div class="smo-social-builder__actions">
                  <button type="button" class="smo-social-mini-button" id="smo-social-safe-toggle" disabled>Choose avatar for safe zones</button>
                </div>
                <div class="smo-social-free-note"><strong>Built into the Free workflow</strong><span>The avatar preset sets the target dimensions and circular crop-safety guide while keeping the protected Master untouched.</span></div>
                <button type="button" class="smo-text-button smo-clear-crop-trigger" data-clear-crop="1">Clear crop and avatar preset</button>
              </div>

              <div class="smo-studio-crop-readout" id="smo-studio-crop-readout">No crop selected</div>
              <div class="smo-studio-crop-footer"><button type="button" class="smo-text-button smo-clear-crop-trigger" data-clear-crop="1">Clear crop</button></div>
            </section>

            <section class="smo-studio-tool-section">
              <div class="smo-studio-section-title">Resize</div>
              <div class="smo-studio-size-row">
                <label><span>Width</span><input type="number" min="1" max="16000" id="smo-studio-width" value="${source.width}" /></label>
                <span class="smo-studio-size-link">×</span>
                <label><span>Height</span><input type="number" min="1" max="16000" id="smo-studio-height" value="${source.height}" /></label>
              </div>
              <label class="smo-studio-check"><input type="checkbox" id="smo-studio-lock-ratio" checked /> Keep aspect ratio</label>
              <div class="smo-studio-note">Image Studio will not silently upscale an image above its current source dimensions.</div>
            </section>

            <section class="smo-studio-tool-section">
              <div class="smo-studio-section-title">Transform</div>
              <div class="smo-studio-button-grid">
                <button type="button" class="smo-tool-button" data-studio-rotate="-90">${icon('rotate', 'smo-icon--rotate-left')} Left</button>
                <button type="button" class="smo-tool-button" data-studio-rotate="90">${icon('rotate')} Right</button>
                <button type="button" class="smo-tool-button" data-studio-flip="h">${icon('flip')} Flip H</button>
                <button type="button" class="smo-tool-button smo-tool-button--flip-v" data-studio-flip="v">${icon('flip')} Flip V</button>
              </div>
              <div class="smo-studio-transform-state" id="smo-studio-transform-state">No rotation or flip</div>
            </section>

            <section class="smo-studio-tool-section">
              <div class="smo-studio-section-title">Output</div>
              <label class="smo-field"><span>Format</span><select id="smo-studio-format">${studioFormatOptions()}</select></label>
              <label class="smo-field"><span>Quality <strong id="smo-studio-quality-value">82</strong></span><input type="range" id="smo-studio-quality" min="40" max="100" value="82" /></label>
              <div class="smo-studio-quality-note" id="smo-studio-quality-note">Quality mainly affects JPEG, WebP and AVIF. PNG remains lossless.</div>
              <div class="smo-studio-estimate" id="smo-studio-estimate">
                <span class="smo-studio-estimate__label">Estimated output</span>
                <strong id="smo-studio-estimate-size">Calculating…</strong>
                <span id="smo-studio-estimate-meta">Previewing your current settings</span>
                <div id="smo-studio-estimate-load"></div>
                <small>Browser estimate only — the final server encoder may vary slightly.</small>
              </div>
              <label class="smo-field smo-version-name-field"><span>Version name</span><input type="text" id="smo-studio-label" maxlength="80" value="Website Version" autocomplete="off" /></label>
              <div class="smo-preferred-wrap"><label class="smo-studio-check"><input type="checkbox" id="smo-studio-preferred" /> Set as Studio default</label><div class="smo-preferred-hint"><span class="smo-preferred-arrow" aria-hidden="true">➜</span><span>Optional — makes this the source Image Studio opens first. It does not publish the version to WordPress.</span></div></div>
              <button type="button" class="smo-button smo-button--primary smo-studio-create" id="smo-studio-create-version">${reeditMode ? 'Save changes to version' : 'Create protected version'}</button>
            </section>
          </aside>

          <main class="smo-studio-canvas-area">
            <div class="smo-studio-canvas-toolbar ${reeditMode ? 'is-reedit-mode' : ''}">
              <div class="smo-studio-canvas-toolbar__source">${reeditMode ? `<span class="smo-studio-reedit-mode-pill">${icon('history')} Re-edit mode</span>` : ''}<strong id="smo-studio-source-label">${reeditMode ? `Re-editing: ${encode(editVersion.label)}` : encode(source.label)}</strong><span>${reeditMode ? 'Using protected Master Original · ' : ''}${source.width} × ${source.height} · ${formatStudioMime(source.mime)} · ${encode(source.size)}</span></div>
              <div class="smo-studio-canvas-toolbar__actions">${reeditMode ? `<button type="button" class="smo-studio-back-master smo-studio-back-master--toolbar" data-studio-exit-reedit aria-label="Back to Master Original to create a new version" title="Stop Re-editing and return to Master Original">${icon('image')}<span class="smo-studio-back-master__copy"><b>Back to Master</b><small>Create new version</small></span></button><button type="button" class="smo-tool-button smo-studio-reedit-reset" id="smo-studio-reedit-reset" aria-label="Reset unsaved Re-edit changes" title="Restore this Re-edit session to the version's last saved settings">${icon('history')}<span>Reset changes</span></button><button type="button" class="smo-studio-image-lock smo-studio-toolbar-lock ${state.studioEditLocked ? 'is-locked' : 'is-unlocked'}" id="smo-studio-reedit-lock" aria-label="${state.studioEditLocked ? 'Unlock version settings' : 'Version settings unlocked'}">${icon(state.studioEditLocked ? 'lock' : 'unlock')}<span>${state.studioEditLocked ? 'Unlock to adjust' : 'Unlocked'}</span></button>` : ''}<div class="smo-studio-toolbar-history" role="group" aria-label="Undo or redo version choices"><button type="button" class="smo-studio-toolbar-history-button" id="smo-studio-toolbar-undo" ${versionStateHistory.canUndo ? '' : 'disabled'} title="${versionStateHistory.canUndo ? `Undo: ${encode(versionStateHistory.undoSummary || 'last version choice')}` : 'Nothing to undo'}" aria-label="${versionStateHistory.canUndo ? `Undo: ${encode(versionStateHistory.undoSummary || 'last version choice')}` : 'Undo — nothing to undo'}">${studioStateActionIcon('undo')}<span>Undo</span></button><button type="button" class="smo-studio-toolbar-history-button" id="smo-studio-toolbar-redo" ${versionStateHistory.canRedo ? '' : 'disabled'} title="${versionStateHistory.canRedo ? `Redo: ${encode(versionStateHistory.redoSummary || 'last version choice')}` : 'Nothing to redo'}" aria-label="${versionStateHistory.canRedo ? `Redo: ${encode(versionStateHistory.redoSummary || 'last version choice')}` : 'Redo — nothing to redo'}">${studioStateActionIcon('redo')}<span>Redo</span></button></div><button type="button" class="smo-tool-button smo-tool-button--look-closer" id="smo-studio-look-closer">Look closer</button><button type="button" class="smo-tool-button smo-tool-button--focus-close" id="smo-studio-focus-close" aria-label="Close closer look window">Close</button><div class="smo-studio-view-buttons" aria-label="Transparency preview background"><button type="button" class="is-active" data-studio-bg="checker" title="Show transparent pixels on a checkerboard">Checker</button><button type="button" data-studio-bg="dark" title="Show transparent pixels on a dark background">Dark</button><button type="button" data-studio-bg="light" title="Show transparent pixels on a light background">Light</button></div></div>
            </div>
            <div class="smo-studio-canvas-bg" id="smo-studio-canvas-bg">
              <div class="smo-studio-image-frame is-checker" id="smo-studio-image-frame">
                <img id="smo-studio-image" src="${encode(source.url)}" alt="" draggable="false" />
                <div class="smo-studio-crop-layer" id="smo-studio-crop-layer" aria-hidden="true">
                  <div class="smo-studio-crop-box" id="smo-studio-crop-box" hidden>
                    <span class="smo-crop-gridline is-v1"></span><span class="smo-crop-gridline is-v2"></span><span class="smo-crop-gridline is-h1"></span><span class="smo-crop-gridline is-h2"></span>
                    <div class="smo-crop-safe-zone" id="smo-crop-safe-zone" hidden></div>
                    <i class="tl" data-crop-handle="tl"></i><i class="tr" data-crop-handle="tr"></i><i class="bl" data-crop-handle="bl"></i><i class="br" data-crop-handle="br"></i>
                    <b class="smo-crop-drag-label">Drag to move</b>
                    <b class="smo-crop-resolution-label" id="smo-crop-resolution-label" hidden></b>
                  </div>
                </div>
                <button type="button" class="smo-crop-safe-toggle" id="smo-crop-safe-toggle" hidden>Show safe zones</button>
              </div>
            </div>
            <div class="smo-crop-safe-legend" id="smo-crop-safe-legend" hidden></div>
            <div class="smo-studio-canvas-hint" id="smo-studio-canvas-hint">Choose a common ratio or a channel avatar preset in the left panel. The crop box appears automatically; drag its corners to resize and drag inside it to position the crop.</div>

            <section class="smo-studio-live-preview" id="smo-studio-live-preview">
              <div class="smo-studio-preview-head">
                <div><span class="smo-eyebrow">Unsaved preview</span><strong>See changes before you create a version</strong></div>
                <span id="smo-studio-preview-status">Preparing preview…</span>
              </div>
              <div class="smo-studio-preview-stage" id="smo-studio-preview-stage"><span class="smo-studio-preview-image-frame is-checker" id="smo-studio-preview-image-frame"><img id="smo-studio-preview-image" src="${encode(source.url)}" alt="" /></span></div>
              <div class="smo-studio-preview-meta" id="smo-studio-preview-meta">Current source</div>
            </section>

            <section class="smo-studio-compare" id="smo-studio-compare" hidden>
              <div class="smo-compare-head">
                <div><div class="smo-studio-section-title">Before / after comparison</div><span>Inspect the working version against the protected master, then close this view when you are finished.</span></div>
                <button type="button" class="smo-compare-close" id="smo-compare-close" aria-label="Close comparison">${icon('close')}<span>Close comparison</span></button>
              </div>
              <div class="smo-compare-meta" id="smo-compare-meta"></div>
              <div class="smo-compare-frame" id="smo-compare-frame" style="--smo-compare-ratio:${Math.max(1, data.master.width)}/${Math.max(1, data.master.height)}">
                <img class="smo-compare-base" src="${encode(data.master.url)}" alt="" />
                <div class="smo-compare-after" id="smo-compare-after"><img id="smo-compare-after-image" src="" alt="" /></div>
                <span class="smo-compare-divider" id="smo-compare-divider"></span>
              </div>
              <div class="smo-compare-control"><span>Master</span><input type="range" min="0" max="100" value="50" id="smo-compare-range" /><span id="smo-compare-version-label">Version</span></div>
            </section>
          </main>

          <button type="button" class="smo-studio-versions-toggle" id="smo-studio-versions-toggle" aria-controls="smo-studio-versions-panel" aria-expanded="false" title="Open protected master and version history">${icon('history')}<span>Versions</span><b>${versions.length}</b></button>
          <button type="button" class="smo-studio-versions-scrim" id="smo-studio-versions-scrim" aria-label="Close versions panel" hidden></button>
          <aside class="smo-studio-versions" id="smo-studio-versions-panel" aria-label="Protected master and version history">
            <div class="smo-studio-versions-drawer-head">
              <div><span class="smo-eyebrow">Image versions</span><strong>Protected master + history</strong></div>
              <div class="smo-studio-versions-drawer-actions">
                <button type="button" class="smo-studio-versions-pin" id="smo-studio-versions-pin" aria-pressed="false" title="Keep the versions panel open on the right while you work">${icon('lock')}<span>Keep open</span></button>
                <button type="button" class="smo-studio-versions-drawer-close" id="smo-studio-versions-drawer-close" aria-label="Hide versions">${icon('chevron')}<span>Hide</span></button>
              </div>
            </div>
            <section class="smo-studio-version-statebar" aria-label="Studio default and active WordPress image">
              <div class="smo-studio-version-statebar__summary">
                <div class="smo-studio-version-state smo-studio-version-state--preferred">
                  <span class="smo-studio-version-state__label">Studio default</span>
                  <strong>${encode(preferredStateLabel)}</strong>
                  <small>Image Studio opens this source first. Changing it does not change the image WordPress is using.</small>
                </div>
                <div class="smo-studio-version-state smo-studio-version-state--active">
                  <span class="smo-studio-version-state__label">Active in WordPress</span>
                  <strong>${encode(activeStateLabel)}</strong>
                  <small>This is the file WordPress currently uses for this attachment in the Media Library and for new image selections.</small>
                </div>
              </div>
              <div class="smo-studio-version-statebar__history" role="group" aria-label="Undo or redo version choices">
                <button type="button" class="smo-studio-state-history-button" id="smo-studio-state-undo" ${versionStateHistory.canUndo ? '' : 'disabled'} title="${versionStateHistory.canUndo ? `Undo: ${encode(versionStateHistory.undoSummary || 'last version choice')}` : 'Nothing to undo'}">${studioStateActionIcon('undo')}<span>Undo</span></button>
                <button type="button" class="smo-studio-state-history-button" id="smo-studio-state-redo" ${versionStateHistory.canRedo ? '' : 'disabled'} title="${versionStateHistory.canRedo ? `Redo: ${encode(versionStateHistory.redoSummary || 'last version choice')}` : 'Nothing to redo'}">${studioStateActionIcon('redo')}<span>Redo</span></button>
              </div>
            </section>
            <section class="smo-studio-master-card ${data.preferred === 'master' ? 'is-preferred' : ''} ${data.masterActive ? 'is-active' : ''}">
              <div class="smo-studio-master-badge">${icon('lock')} Protected Master</div>
              <img src="${encode(data.master.url)}" alt="" />
              <h3>${encode(data.master.filename)}</h3>
              <p>${data.master.width} × ${data.master.height} · ${formatStudioMime(data.master.mime)} · ${encode(data.master.size)} ${studioLoadBadge(data.master.sizeBytes)}</p>
              <div class="smo-studio-source-statuses">${data.preferred === 'master' ? '<span class="smo-studio-state-chip is-preferred">Studio default</span>' : ''}${data.masterActive ? '<span class="smo-studio-state-chip is-active">Active in WordPress</span>' : ''}</div>
              <div class="smo-studio-master-actions">
                <button type="button" id="smo-studio-copy-master">${icon('copy')}<span>Copy original URL</span></button>
                <button type="button" id="smo-studio-prefer-master" ${data.preferred === 'master' ? 'disabled' : ''}>${data.preferred === 'master' ? 'Studio default' : 'Set as Studio default'}</button>
                <button type="button" id="smo-studio-restore-master" ${data.masterActive ? 'disabled' : ''}>${data.masterActive ? 'Active in WordPress' : 'Use Master in WordPress'}</button>
              </div>
              <div class="smo-copy-confirm" hidden aria-live="polite"></div>
              <div class="smo-studio-master-origin">${data.master.origin === 'current_attachment' ? 'Captured from the current WordPress source file.' : 'Recovered from WordPress’ retained pre-edit original.'}</div>
              <div class="smo-studio-master-promise">Normal Studio edits never overwrite this file. Studio default controls what Simme opens first; Active in WordPress controls the attachment WordPress currently serves. The protected master remains available for rollback.</div>
            </section>
            <div class="smo-studio-version-heading"><div><span class="smo-eyebrow">Version history</span><h3>${versions.length} working version${versions.length === 1 ? '' : 's'}</h3></div></div>
            <div class="smo-studio-version-list" id="smo-studio-version-list">${versionCards}</div>
          </aside>
        </div>`;

      const quality = $('#smo-studio-quality', content);
      if (quality) { quality.value = '82'; quality.disabled = false; }
      const qualityValue = $('#smo-studio-quality-value', content);
      if (qualityValue) qualityValue.textContent = '82';
      const qualityNote = $('#smo-studio-quality-note', content);
      if (qualityNote) qualityNote.textContent = 'Adjust JPEG, WebP or AVIF quality to balance file size and detail. PNG output remains lossless.';
      const label = $('#smo-studio-label', content);
      if (label) {
        label.value = 'Working Version';
        label.disabled = false;
      }
      const createButton = $('#smo-studio-create-version', content);
      // Every saved Working Version can coexist. Creating another always
      // starts from the protected Master; only explicit Re-edit replaces a version.
      if (createButton && !reeditMode) {
        createButton.disabled = false;
      }

      $('#smo-studio-source').value = state.studioSourceId;
      if (canRestore) applyStudioSessionControls(restoreSession);
      bindStudioUI();
    };

    const updateStudioTransformState = () => {
      const states = [];
      if (state.studioRotation) states.push(`Rotate ${state.studioRotation > 0 ? '+' : ''}${state.studioRotation}°`);
      if (state.studioFlipH) states.push('Flip horizontal');
      if (state.studioFlipV) states.push('Flip vertical');
      const el = $('#smo-studio-transform-state');
      if (el) el.textContent = states.length ? states.join(' · ') : 'No rotation or flip';
    };

    const resetStudioForSource = () => {
      const source = studioSource();
      if (!source) return;
      state.studioCrop = null;
      state.studioRotation = 0;
      state.studioFlipH = false;
      state.studioFlipV = false;
      state.studioCropMode = false;
      const image = $('#smo-studio-image');
      image.src = source.url;
      $('#smo-studio-source-label').innerHTML = `${encode(source.label)}<span>${source.width} × ${source.height} · ${formatStudioMime(source.mime)} · ${encode(source.size)}</span>`;
      $('#smo-studio-width').value = source.width;
      $('#smo-studio-height').value = source.height;
      const formatSelect = $('#smo-studio-format');
      if (formatSelect && formatSelect.options.length) formatSelect.options[0].textContent = `Keep ${formatStudioMime(source.mime)}`;
      const box = $('#smo-studio-crop-box');
      const layer = $('#smo-studio-crop-layer');
      if (box) box.hidden = true;
      if (layer) layer.classList.remove('is-active');
      $('#smo-studio-crop-readout').textContent = 'No crop selected';
      $$('.smo-ratio-preset').forEach((b) => b.classList.remove('is-active'));
      updateStudioTransformState();
      scheduleStudioPreview();
    };

    const studioHumanBytes = (bytes) => {
      const value = Math.max(0, Number(bytes || 0));
      if (value < 1024) return `${Math.round(value)} B`;
      if (value < 1024 * 1024) return `${(value / 1024).toFixed(value < 10240 ? 1 : 0)} KB`;
      return `${(value / (1024 * 1024)).toFixed(value < 10 * 1024 * 1024 ? 1 : 0)} MB`;
    };

    const studioSelectedMime = () => {
      const source = studioSource();
      const select = $('#smo-studio-format');
      const value = select ? select.value : 'original';
      if (value === 'original') return source?.mime || 'image/png';
      if (value === 'auto') {
        const option = (state.studioData?.formats || []).find((f) => f.value === 'auto');
        return option?.mime || 'image/webp';
      }
      return value;
    };

    const studioGeometry = () => {
      const source = studioSource();
      if (!source) return null;
      const crop = state.studioCrop || { x: 0, y: 0, width: Number(source.width), height: Number(source.height) };
      const baseW = Math.max(1, Number(crop.width || source.width));
      const baseH = Math.max(1, Number(crop.height || source.height));
      const requestedW = Math.max(1, Number($('#smo-studio-width')?.value || baseW));
      const requestedH = Math.max(1, Number($('#smo-studio-height')?.value || baseH));
      const scale = Math.min(1, requestedW / baseW, requestedH / baseH);
      const resizedW = Math.max(1, Math.round(baseW * scale));
      const resizedH = Math.max(1, Math.round(baseH * scale));
      const rot = ((Number(state.studioRotation || 0) % 360) + 360) % 360;
      const swaps = rot === 90 || rot === 270;
      return {
        source,
        crop,
        resizedW,
        resizedH,
        finalW: swaps ? resizedH : resizedW,
        finalH: swaps ? resizedW : resizedH,
        rotation: rot,
        flipH: !!state.studioFlipH,
        flipV: !!state.studioFlipV
      };
    };

    const studioRequestPayload = () => {
      const source = studioSource();
      if (!source || !state.studioData) return null;
      const crop = state.studioCrop || {};
      return {
        id: state.studioData.attachmentId,
        source_id: state.studioSourceId,
        crop_x: crop.x || 0,
        crop_y: crop.y || 0,
        crop_w: crop.width || 0,
        crop_h: crop.height || 0,
        resize_w: Number($('#smo-studio-width')?.value || source.width),
        resize_h: Number($('#smo-studio-height')?.value || source.height),
        rotation: state.studioRotation,
        flip_h: state.studioFlipH ? 1 : 0,
        flip_v: state.studioFlipV ? 1 : 0,
        format: $('#smo-studio-format')?.value || 'original',
        quality: $('#smo-studio-quality')?.value || 82,
        social_platform: state.studioPreset?.platform || '',
        social_preset_id: state.studioPreset?.id || '',
        social_target_w: Number(state.studioPreset?.width || 0),
        social_target_h: Number(state.studioPreset?.height || 0),
        social_fixed_aspect_ratio: state.studioPreset?.fixedAspectRatio ? 1 : 0,
        social_safe_zone_model: state.studioPreset?.safeZoneModel || '',
        social_safe_zones_enabled: state.studioPreset ? (state.studioSafeZonesEnabled ? 1 : 0) : 0
      };
    };

    const scheduleStudioEstimate = (delay = 260) => {
      clearTimeout(state.studioEstimateTimer);
      state.studioEstimateTimer = setTimeout(async () => {
        const payload = studioRequestPayload();
        const estimateSize = $('#smo-studio-estimate-size');
        const estimateMeta = $('#smo-studio-estimate-meta');
        const estimateLoad = $('#smo-studio-estimate-load');
        const g = studioGeometry();
        if (!payload || !g) return;
        const requestId = (state.studioEstimateRequestId || 0) + 1;
        state.studioEstimateRequestId = requestId;
        if (estimateSize) estimateSize.textContent = 'Calculating…';
        if (estimateMeta) estimateMeta.textContent = `${g.finalW} × ${g.finalH} · ${formatStudioMime(studioSelectedMime())} · checking exact output size`;
        if (estimateLoad) estimateLoad.innerHTML = '';
        try {
          const exact = await api('simme_media_organiser_studio_estimate', payload);
          if (state.studioEstimateRequestId !== requestId) return;
          const bytes = Number(exact.bytes || 0);
          const sourceBytes = Number(g.source.sizeBytes || 0);
          const saving = bytes && sourceBytes ? Math.round((1 - bytes / sourceBytes) * 100) : null;
          if (estimateSize) estimateSize.textContent = bytes ? studioHumanBytes(bytes) : 'Estimate unavailable';
          if (estimateMeta) {
            estimateMeta.textContent = bytes
              ? `${Number(exact.width || g.finalW)} × ${Number(exact.height || g.finalH)} · ${formatStudioMime(exact.mime || studioSelectedMime())}${saving !== null ? ` · ${saving >= 0 ? `${saving}% smaller` : `${Math.abs(saving)}% larger`}` : ''}`
              : `${g.finalW} × ${g.finalH} · ${formatStudioMime(studioSelectedMime())} · estimate unavailable`;
          }
          if (estimateLoad) estimateLoad.innerHTML = bytes ? studioLoadHealthHtml(bytes, 'Estimated final load') : '';
        } catch (err) {
          if (state.studioEstimateRequestId !== requestId) return;
          if (estimateSize) estimateSize.textContent = 'Estimate unavailable';
          if (estimateMeta) estimateMeta.textContent = `${g.finalW} × ${g.finalH} · ${formatStudioMime(studioSelectedMime())} · exact estimate unavailable`;
          if (estimateLoad) estimateLoad.innerHTML = '';
        }
      }, delay);
    };

    const canvasToBlob = (canvas, mime, quality) => new Promise((resolve) => {
      try { canvas.toBlob(resolve, mime, quality); } catch (_) { resolve(null); }
    });

    const buildStudioPreview = async () => {
      const image = $('#smo-studio-image');
      const previewImage = $('#smo-studio-preview-image');
      const status = $('#smo-studio-preview-status');
      const meta = $('#smo-studio-preview-meta');
      const estimateSize = $('#smo-studio-estimate-size');
      const estimateMeta = $('#smo-studio-estimate-meta');
      const estimateLoad = $('#smo-studio-estimate-load');
      const quality = $('#smo-studio-quality');
      if (!image || !previewImage || !state.studioData) return;
      if (!image.complete || !image.naturalWidth) {
        image.addEventListener('load', () => scheduleStudioPreview(20), { once: true });
        return;
      }
      const g = studioGeometry();
      if (!g) return;
      if (status) status.textContent = 'Updating preview…';
      const mime = studioSelectedMime();
      const q = Math.max(.4, Math.min(1, Number(quality?.value || 82) / 100));
      if (quality) quality.disabled = mime === 'image/png';
      const qualityNote = $('#smo-studio-quality-note');
      if (qualityNote) qualityNote.textContent = mime === 'image/png' ? 'PNG is lossless, so the quality slider is not used for this output.' : 'Quality mainly affects JPEG, WebP and AVIF. Lower values usually create smaller files.';

      const maxPixels = 9000000;
      const finalPixels = Math.max(1, g.finalW * g.finalH);
      const encodeScale = finalPixels > maxPixels ? Math.sqrt(maxPixels / finalPixels) : 1;
      const rw = Math.max(1, Math.round(g.resizedW * encodeScale));
      const rh = Math.max(1, Math.round(g.resizedH * encodeScale));
      const swaps = g.rotation === 90 || g.rotation === 270;
      const outW = swaps ? rh : rw;
      const outH = swaps ? rw : rh;

      const base = document.createElement('canvas');
      base.width = rw; base.height = rh;
      const bctx = base.getContext('2d', { alpha: true });
      if (!bctx) return;
      bctx.imageSmoothingEnabled = true;
      bctx.imageSmoothingQuality = 'high';
      bctx.drawImage(
        image,
        Number(g.crop.x || 0), Number(g.crop.y || 0), Number(g.crop.width || g.source.width), Number(g.crop.height || g.source.height),
        0, 0, rw, rh
      );

      const output = document.createElement('canvas');
      output.width = outW; output.height = outH;
      const ctx = output.getContext('2d', { alpha: mime !== 'image/jpeg' });
      if (!ctx) return;
      if (mime === 'image/jpeg') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, outW, outH);
      }
      ctx.save();
      ctx.translate(outW / 2, outH / 2);
      ctx.rotate(g.rotation * Math.PI / 180);
      ctx.scale(g.flipH ? -1 : 1, g.flipV ? -1 : 1);
      ctx.drawImage(base, -rw / 2, -rh / 2, rw, rh);
      ctx.restore();

      let blob = await canvasToBlob(output, mime, q);
      let estimateAvailable = !!blob && (!blob.type || blob.type === mime || mime === 'image/jpeg');
      if (!blob) blob = await canvasToBlob(output, 'image/png', 1);
      if (!blob) return;
      if (state.studioPreviewUrl) URL.revokeObjectURL(state.studioPreviewUrl);
      state.studioPreviewUrl = URL.createObjectURL(blob);
      previewImage.src = state.studioPreviewUrl;

      if (status) status.textContent = 'Live preview · not saved';
      if (meta) meta.textContent = `${g.finalW} × ${g.finalH} · ${formatStudioMime(mime)}${g.rotation ? ` · rotated ${g.rotation}°` : ''}${g.flipH || g.flipV ? ' · flipped' : ''}${state.studioCrop ? ' · cropped' : ''}`;
      if (estimateSize) estimateSize.textContent = estimateAvailable ? `~${studioHumanBytes(blob.size)}` : 'Calculating…';
      if (estimateMeta) {
        estimateMeta.textContent = estimateAvailable
          ? `${g.finalW} × ${g.finalH} · ${formatStudioMime(mime)} · checking exact output size`
          : `${g.finalW} × ${g.finalH} · ${formatStudioMime(mime)} · checking exact output size`;
      }
      if (estimateLoad) {
        estimateLoad.innerHTML = '';
      }
      scheduleStudioEstimate(180);
    };

    const scheduleStudioPreview = (delay = 180) => {
      clearTimeout(state.studioPreviewTimer);
      state.studioPreviewTimer = setTimeout(() => { buildStudioPreview().catch(() => {}); }, delay);
    };

    const bindStudioCrop = () => {
      if (typeof state.studioCropCleanup === 'function') {
        state.studioCropCleanup();
        state.studioCropCleanup = null;
      }
      const frame = $('#smo-studio-image-frame');
      const layer = $('#smo-studio-crop-layer');
      const box = $('#smo-studio-crop-box');
      const button = $('#smo-studio-draw-crop');
      const ratioSelect = $('#smo-studio-crop-ratio');
      if (!frame || !layer || !box || !button || !ratioSelect) return;

      let action = null;
      let start = null;
      let startRect = null;
      let handle = '';

      const ratioValue = () => state.studioPreset ? Number(state.studioPreset.width) / Number(state.studioPreset.height) : (ratioSelect.value === 'free' ? 0 : Number(ratioSelect.value || 0));
      const rectSize = () => layer.getBoundingClientRect();
      const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

      const updateSafeToggleState = () => {
        const safeToggle = $('#smo-social-safe-toggle');
        const overlayToggle = $('#smo-crop-safe-toggle');
        const available = socialSafeZonesAvailable(state.studioPreset);
        if (safeToggle) {
          safeToggle.disabled = !available;
          safeToggle.textContent = socialSafeToggleText(state.studioPreset);
          safeToggle.classList.toggle('is-active', !!(available && state.studioSafeZonesEnabled));
        }
        if (overlayToggle) {
          overlayToggle.hidden = !available;
          overlayToggle.textContent = socialSafeToggleText(state.studioPreset);
          overlayToggle.classList.toggle('is-active', !!(available && state.studioSafeZonesEnabled));
        }
      };

      const renderSafeZones = () => {
        const safe = $('#smo-crop-safe-zone');
        const legend = $('#smo-crop-safe-legend');
        const preset = state.studioPreset;
        if (!safe || !legend) return;
        if (!preset || !socialSafeZonesAvailable(preset) || !state.studioCrop) {
          safe.hidden = true;
          safe.innerHTML = '';
          legend.hidden = true;
          legend.innerHTML = '';
          return;
        }
        if (state.studioSafeZonesEnabled) {
          const zones = preset.safeZones || [];
          // Safe zones are reference guides only. Keep every coloured guide
          // inside the crop area and never turn a warning zone into a mask/cut-out.
          // Draw warning/danger shapes first so the green safe shape remains clear.
          const displayZones = [
            ...zones.filter((zone) => (zone.tone || 'safe') !== 'safe'),
            ...zones.filter((zone) => (zone.tone || 'safe') === 'safe')
          ];
          const cropWidth = Math.max(1, box.clientWidth || box.getBoundingClientRect().width || 1);
          const cropHeight = Math.max(1, box.clientHeight || box.getBoundingClientRect().height || 1);
          safe.hidden = false;
          safe.innerHTML = displayZones.map((zone) => {
            const left = Number(zone.x || 0) * cropWidth;
            const top = Number(zone.y || 0) * cropHeight;
            const width = Number(zone.width || 0) * cropWidth;
            const height = Number(zone.height || 0) * cropHeight;
            const style = `left:${left.toFixed(2)}px;top:${top.toFixed(2)}px;width:${width.toFixed(2)}px;height:${height.toFixed(2)}px`;
            const tone = encode(zone.tone || 'safe');
            const shapeClass = zone.shape === 'circle'
              ? 'is-circle'
              : (zone.shape === 'circle-corners' ? 'is-circle-corners' : '');
            return `<span class="smo-crop-safe-zone__item is-${tone} ${shapeClass}" style="${style}"></span>`;
          }).join('');
        } else {
          safe.hidden = true;
          safe.innerHTML = '';
        }
        const seen = new Set();
        const guideHead = `<div class="smo-crop-safe-legend__head"><strong>${encode(preset.safeGuideLabel || 'Safe-area guide')}</strong><small>${encode(preset.safeGuideNote || '')}</small></div>`;
        legend.innerHTML = guideHead + (preset.safeZones || []).filter((zone) => {
          const key = `${zone.label}-${zone.tone}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        }).map((zone) => `<span class="smo-crop-safe-legend__item is-${encode(zone.tone || 'safe')} ${zone.shape === 'circle' ? 'is-circle' : ''}"><i></i><span><strong>${encode(zone.label)}</strong>${zone.note ? `<small>${encode(zone.note)}</small>` : ''}</span></span>`).join('');
        legend.hidden = !legend.innerHTML;
      };

      const updatePresetStatus = () => {
        const preset = state.studioPreset;
        const status = $('#smo-social-preset-status');
        const label = $('#smo-crop-resolution-label');
        box.classList.remove('is-resolution-good', 'is-resolution-low');
        if (!preset || !state.studioCrop) {
          if (label) label.hidden = true;
          if (status && !preset) {
            status.className = 'smo-social-preset-status';
            status.innerHTML = socialEmptyStatusHtml();
          }
          updateSafeToggleState();
          renderSafeZones();
          return;
        }
        const c = state.studioCrop;
        const enough = Number(c.width) >= Number(preset.width) && Number(c.height) >= Number(preset.height);
        const fit = socialPresetStatusMessage(preset, c);
        box.classList.add(enough ? 'is-resolution-good' : 'is-resolution-low');
        if (label) {
          const cropWidth = Math.max(1, Math.round(Number(c.width || 0)));
          const cropHeight = Math.max(1, Math.round(Number(c.height || 0)));
          label.hidden = false;
          label.textContent = enough
            ? `✓ ${cropWidth} × ${cropHeight} px · target ${preset.width} × ${preset.height}`
            : `⚠ ${cropWidth} × ${cropHeight} px · needs ${preset.width} × ${preset.height}`;
        }
        if (status) {
          status.className = `smo-social-preset-status ${fit.tone}`;
          status.innerHTML = `<span class="smo-social-status-dot"></span><div><strong>${encode(preset.platformLabel)} · ${encode(preset.label || 'Avatar')} · ${encode(fit.title)}</strong><span>${encode(fit.body)}</span><small class="smo-social-status-aux">${encode(fit.aux)} ${socialSafeZonesAvailable(preset) ? `${encode(preset.safeGuideLabel)} available.` : ''}</small></div>`;
        }
        updateSafeToggleState();
        renderSafeZones();
      };

      const cropToDisplay = () => {
        const source = studioSource();
        const r = rectSize();
        if (!source || !state.studioCrop || !r.width || !r.height) return null;
        return {
          left: (state.studioCrop.x / source.width) * r.width,
          top: (state.studioCrop.y / source.height) * r.height,
          width: (state.studioCrop.width / source.width) * r.width,
          height: (state.studioCrop.height / source.height) * r.height
        };
      };

      const displayToCrop = (rect) => {
        const source = studioSource();
        const r = rectSize();
        if (!source || !r.width || !r.height) return null;
        const left = clamp(rect.left, 0, r.width - 2);
        const top = clamp(rect.top, 0, r.height - 2);
        const width = clamp(rect.width, 2, r.width - left);
        const height = clamp(rect.height, 2, r.height - top);
        return {
          x: Math.round((left / r.width) * source.width),
          y: Math.round((top / r.height) * source.height),
          width: Math.max(2, Math.round((width / r.width) * source.width)),
          height: Math.max(2, Math.round((height / r.height) * source.height))
        };
      };

      const renderCrop = () => {
        const d = cropToDisplay();
        if (!d) { box.hidden = true; updatePresetStatus(); return; }
        box.hidden = false;
        Object.assign(box.style, { left: `${d.left}px`, top: `${d.top}px`, width: `${d.width}px`, height: `${d.height}px` });
        const c = state.studioCrop;
        const presetText = state.studioPreset ? ` · target ${state.studioPreset.width} × ${state.studioPreset.height}` : '';
        $('#smo-studio-crop-readout').textContent = `${c.width} × ${c.height} source crop · x ${c.x}, y ${c.y}${presetText}`;
        updatePresetStatus();
      };

      const syncCropLayout = (delay = 0) => {
        const run = () => {
          if (!state.studioCropMode) return;
          renderCrop();
        };
        if (delay > 0) window.setTimeout(run, delay);
        else window.requestAnimationFrame(run);
      };

      const applyDisplayRect = (rect) => {
        const crop = displayToCrop(rect);
        if (!crop) return;
        state.studioCrop = crop;
        renderCrop();
        const lock = $('#smo-studio-lock-ratio');
        const w = $('#smo-studio-width');
        const h = $('#smo-studio-height');
        if (lock?.checked && w && h && crop.width) h.value = Math.max(1, Math.round(Number(w.value || crop.width) * crop.height / crop.width));
        scheduleStudioPreview();
      };

      const rectFromPoints = (x1, y1, x2, y2, ratio = 0) => {
        const r = rectSize();
        x1 = clamp(x1, 0, r.width); y1 = clamp(y1, 0, r.height);
        x2 = clamp(x2, 0, r.width); y2 = clamp(y2, 0, r.height);
        if (ratio > 0) {
          const sx = x2 >= x1 ? 1 : -1;
          const sy = y2 >= y1 ? 1 : -1;
          let w = Math.abs(x2 - x1);
          let h = Math.abs(y2 - y1);
          if (h === 0 || w / h > ratio) w = h * ratio;
          else h = w / ratio;
          x2 = clamp(x1 + sx * w, 0, r.width);
          y2 = clamp(y1 + sy * h, 0, r.height);
          w = Math.abs(x2 - x1); h = Math.abs(y2 - y1);
          if (h && Math.abs(w / h - ratio) > .01) {
            w = Math.min(w, h * ratio);
            h = w / ratio;
            x2 = clamp(x1 + sx * w, 0, r.width);
            y2 = clamp(y1 + sy * h, 0, r.height);
          }
        }
        return { left: Math.min(x1, x2), top: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) };
      };

      const initialCrop = () => {
        const r = rectSize();
        if (!r.width || !r.height) return;
        let width = r.width * (state.studioPreset ? 1 : .78);
        let height = r.height * (state.studioPreset ? 1 : .78);
        const ratio = ratioValue();
        if (ratio > 0) {
          if (width / height > ratio) width = height * ratio;
          else height = width / ratio;
        }
        applyDisplayRect({ left: (r.width - width) / 2, top: (r.height - height) / 2, width, height });
      };

      const setEnabled = (value) => {
        state.studioCropMode = !!value;
        button.classList.toggle('is-active', state.studioCropMode);
        button.innerHTML = state.studioCropMode ? `${icon('crop')} Crop active` : `${icon('crop')} Start free crop`;
        layer.classList.toggle('is-active', state.studioCropMode);
        layer.setAttribute('aria-hidden', state.studioCropMode ? 'false' : 'true');
        frame.classList.toggle('is-crop-mode', state.studioCropMode);
        if (state.studioCropMode && !state.studioCrop) initialCrop();
        renderCrop();
        $('#smo-studio-canvas-hint').textContent = state.studioCropMode
          ? 'Crop is active. Drag a corner to resize, drag inside the box to move it, or drag outside the box to draw a new crop.'
          : 'Choose a common ratio or a channel avatar preset in the left panel. The crop box appears automatically and can be moved or resized.';
      };

      button.addEventListener('click', () => {
        if (studioReeditMutationLocked()) return;
        setEnabled(!state.studioCropMode);
      });

      const point = (e) => {
        const r = rectSize();
        return { x: clamp(e.clientX - r.left, 0, r.width), y: clamp(e.clientY - r.top, 0, r.height), r };
      };

      layer.addEventListener('pointerdown', (e) => {
        if (studioReeditMutationLocked() || !state.studioCropMode || e.button !== 0) return;
        e.preventDefault();
        const p = point(e);
        start = p;
        startRect = cropToDisplay();
        handle = e.target.closest('[data-crop-handle]')?.dataset.cropHandle || '';
        if (handle && startRect) action = 'resize';
        else if (e.target.closest('#smo-studio-crop-box') && startRect) action = 'move';
        else action = 'draw';
        layer.setPointerCapture?.(e.pointerId);
      });

      layer.addEventListener('pointermove', (e) => {
        if (studioReeditMutationLocked()) {
          if (action) finish(e);
          return;
        }
        if (action && e.buttons === 0) { finish(e); return; }
        if (!action || !start) return;
        const p = point(e);
        const r = p.r;
        if (action === 'move' && startRect) {
          applyDisplayRect({
            left: clamp(startRect.left + (p.x - start.x), 0, r.width - startRect.width),
            top: clamp(startRect.top + (p.y - start.y), 0, r.height - startRect.height),
            width: startRect.width,
            height: startRect.height
          });
          return;
        }
        if (action === 'draw') {
          const rect = rectFromPoints(start.x, start.y, p.x, p.y, ratioValue());
          if (rect.width >= 4 && rect.height >= 4) applyDisplayRect(rect);
          return;
        }
        if (action === 'resize' && startRect) {
          const left = startRect.left, right = startRect.left + startRect.width, top = startRect.top, bottom = startRect.top + startRect.height;
          let x1, y1, x2, y2;
          if (handle === 'tl') { x1 = right; y1 = bottom; x2 = p.x; y2 = p.y; }
          if (handle === 'tr') { x1 = left; y1 = bottom; x2 = p.x; y2 = p.y; }
          if (handle === 'bl') { x1 = right; y1 = top; x2 = p.x; y2 = p.y; }
          if (handle === 'br') { x1 = left; y1 = top; x2 = p.x; y2 = p.y; }
          const rect = rectFromPoints(x1, y1, x2, y2, ratioValue());
          if (rect.width >= 8 && rect.height >= 8) applyDisplayRect(rect);
        }
      });

      const finish = (e) => {
        if (!action) return;
        action = null; start = null; startRect = null; handle = '';
        try { layer.releasePointerCapture?.(e.pointerId); } catch (_) {}
        renderCrop();
        scheduleStudioPreview(50);
      };
      layer.addEventListener('pointerup', finish);
      layer.addEventListener('pointercancel', finish);
      layer.addEventListener('pointerleave', finish);

      ratioSelect.addEventListener('change', () => {
        if (studioReeditMutationLocked()) return;
        setEnabled(true);
        if (!state.studioCrop) { initialCrop(); return; }
        const d = cropToDisplay();
        const ratio = ratioValue();
        if (!d || !ratio) { renderCrop(); return; }
        const cx = d.left + d.width / 2, cy = d.top + d.height / 2;
        let width = d.width, height = d.height;
        if (width / height > ratio) width = height * ratio; else height = width / ratio;
        const r = rectSize();
        width = Math.min(width, r.width); height = Math.min(height, r.height);
        applyDisplayRect({ left: clamp(cx - width / 2, 0, r.width - width), top: clamp(cy - height / 2, 0, r.height - height), width, height });
      });

      const startRatioPreset = (value) => {
        if (studioReeditMutationLocked()) return;
        state.studioPreset = null;
        ratioSelect.value = value;
        setEnabled(true);
        state.studioCrop = null;
        initialCrop();
        $$('.smo-ratio-preset').forEach((b) => b.classList.toggle('is-active', b.dataset.cropRatioPreset === value));
        const status = $('#smo-social-preset-status');
        if (status) {
          status.className = 'smo-social-preset-status';
          status.innerHTML = '<span class="smo-social-status-dot"></span><div><strong>Custom crop ratio</strong><span>Move or resize the crop on the image. Channel avatar presets below also set exact output dimensions.</span></div>';
        }
      };
      $$('.smo-ratio-preset').forEach((ratioButton) => ratioButton.addEventListener('click', () => startRatioPreset(ratioButton.dataset.cropRatioPreset || 'free')));

      const bindSocialPresetButtons = () => {
        $$('.smo-social-preset').forEach((presetButton) => presetButton.addEventListener('click', () => {
          if (studioReeditMutationLocked()) return;
          const platform = presetButton.dataset.platform;
          const group = socialPlatforms[platform];
          const preset = socialPresetProfile(platform);
          if (!group || !preset || preset.id !== presetButton.dataset.socialPreset) return;
          state.studioSocialPlatform = platform;
          localStorage.setItem('smo_social_platform', state.studioSocialPlatform);
          state.studioPreset = preset;
          state.studioSafeZonesEnabled = true;
          localStorage.setItem('smo_social_safe_zones', '1');
          ratioSelect.value = 'free';
          setEnabled(true);
          state.studioCrop = null;
          initialCrop();
          const width = $('#smo-studio-width');
          const height = $('#smo-studio-height');
          if (width) width.value = String(preset.width);
          if (height) height.value = String(preset.height);
          const lock = $('#smo-studio-lock-ratio');
          if (lock) lock.checked = true;
          const labelInput = $('#smo-studio-label');
          if (labelInput) {
            const currentLabel = String(labelInput.value || '').trim();
            const mayUseSuggestedName = state.studioLabelAuto || !currentLabel || currentLabel === 'Working Version' || currentLabel === 'Website Version';
            if (mayUseSuggestedName) {
              labelInput.value = `${group.label} Avatar`;
              state.studioLabelAuto = true;
            }
          }
          // Social presets control dimensions/safe-zone guidance only. They do not
          // change the user's selected output file type.
          const quality = $('#smo-studio-quality');
          if (quality) quality.value = '82';
          const qv = $('#smo-studio-quality-value');
          if (qv) qv.textContent = '82';
          $$('.smo-social-preset').forEach((b) => b.classList.toggle('is-active', b.dataset.socialPreset === preset.id));
          $$('.smo-ratio-preset').forEach((b) => b.classList.remove('is-active'));
          renderCrop();
          scheduleStudioPreview(40);
        }));
      };

      $$('.smo-social-platform').forEach((platformButton) => platformButton.addEventListener('click', () => {
        if (studioReeditMutationLocked()) return;
        state.studioSocialPlatform = platformButton.dataset.socialPlatform || 'instagram';
        localStorage.setItem('smo_social_platform', state.studioSocialPlatform);
        $$('.smo-social-platform').forEach((b) => b.classList.toggle('is-active', b.dataset.socialPlatform === state.studioSocialPlatform));
        const presets = $('#smo-social-presets');
        if (presets) presets.innerHTML = studioSocialPresetButtons(state.studioSocialPlatform);
        bindSocialPresetButtons();
        // Free exposes exactly one avatar/profile preset per channel. Selecting
        // the channel applies that preset immediately, including its safe-zone
        // reference overlay and live pixel-fit validation.
        const onlyPreset = presets?.querySelector('.smo-social-preset');
        if (onlyPreset) onlyPreset.click();
      }));
      bindSocialPresetButtons();

      const studioLookCloserLabel = (active) => {
        const icon = '<span class="smo-tool-button__icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="6.5"></circle><path d="M16.2 16.2 21 21"></path></svg></span>';
        const text = `<span class="smo-tool-button__text">${active ? 'Return to studio' : 'Look closer'}</span>`;
        return `${icon}${text}`;
      };

      const syncLookCloserButton = () => {
        const button = $('#smo-studio-look-closer');
        const closeButton = $('#smo-studio-focus-close');
        const modal = $('#smo-image-studio');
        if (!button || !modal) return;
        button.innerHTML = studioLookCloserLabel(!!state.studioFocusCanvas);
        button.classList.toggle('is-active', !!state.studioFocusCanvas);
        if (closeButton) closeButton.hidden = !state.studioFocusCanvas;
        modal.classList.toggle('is-focus-canvas', !!state.studioFocusCanvas);
      };

      const applyFocusCanvasBounds = () => {
        const shell = $('.smo-studio-shell');
        const canvasArea = $('.smo-studio-canvas-area');
        const canvasBackground = $('#smo-studio-canvas-bg');
        const toolbar = $('.smo-studio-canvas-toolbar');
        if (!canvasArea || !canvasBackground) return;

        if (!state.studioFocusCanvas || !shell) {
          ['position','left','top','right','bottom','width','height','max-width','max-height'].forEach((prop) => canvasArea.style.removeProperty(prop));
          ['height','min-height','max-height','flex'].forEach((prop) => canvasBackground.style.removeProperty(prop));
          return;
        }

        const rect = shell.getBoundingClientRect();
        const inset = window.innerWidth <= 680 ? 6 : (window.innerWidth <= 900 ? 8 : 10);
        const width = Math.max(280, Math.floor(rect.width - (inset * 2)));
        const height = Math.max(320, Math.floor(rect.height - (inset * 2)));

        canvasArea.style.setProperty('position', 'fixed', 'important');
        canvasArea.style.setProperty('left', `${Math.floor(rect.left + inset)}px`, 'important');
        canvasArea.style.setProperty('top', `${Math.floor(rect.top + inset)}px`, 'important');
        canvasArea.style.setProperty('right', 'auto', 'important');
        canvasArea.style.setProperty('bottom', 'auto', 'important');
        canvasArea.style.setProperty('width', `${width}px`, 'important');
        canvasArea.style.setProperty('height', `${height}px`, 'important');
        canvasArea.style.setProperty('max-width', 'none', 'important');
        canvasArea.style.setProperty('max-height', 'none', 'important');

        const areaStyle = window.getComputedStyle(canvasArea);
        const padY = (parseFloat(areaStyle.paddingTop) || 0) + (parseFloat(areaStyle.paddingBottom) || 0);
        const toolbarHeight = toolbar ? Math.ceil(toolbar.getBoundingClientRect().height) : 54;
        const toolbarGap = 10;
        const viewportHeight = Math.max(240, Math.floor(height - padY - toolbarHeight - toolbarGap));
        canvasBackground.style.setProperty('height', `${viewportHeight}px`, 'important');
        canvasBackground.style.setProperty('min-height', `${viewportHeight}px`, 'important');
        canvasBackground.style.setProperty('max-height', `${viewportHeight}px`, 'important');
        canvasBackground.style.setProperty('flex', '0 0 auto', 'important');
      };

      const syncFocusCanvasImage = () => {
        const image = $('#smo-studio-image');
        const canvasBackground = $('#smo-studio-canvas-bg');
        if (!image || !canvasBackground) return;
        if (!state.studioFocusCanvas) {
          image.style.removeProperty('max-width');
          image.style.removeProperty('max-height');
          return;
        }
        applyFocusCanvasBounds();
        const bgStyle = window.getComputedStyle(canvasBackground);
        const padX = (parseFloat(bgStyle.paddingLeft) || 0) + (parseFloat(bgStyle.paddingRight) || 0);
        const padY = (parseFloat(bgStyle.paddingTop) || 0) + (parseFloat(bgStyle.paddingBottom) || 0);
        const maxWidth = Math.max(160, canvasBackground.clientWidth - padX - 4);
        const maxHeight = Math.max(160, canvasBackground.clientHeight - padY - 4);
        image.style.maxWidth = `${Math.floor(maxWidth)}px`;
        image.style.maxHeight = `${Math.floor(maxHeight)}px`;
      };

      const setFocusCanvas = (enabled) => {
        const canvasArea = $('.smo-studio-canvas-area');
        const previousScrollTop = canvasArea ? canvasArea.scrollTop : 0;
        const previousScrollLeft = canvasArea ? canvasArea.scrollLeft : 0;
        state.studioFocusCanvas = !!enabled;
        syncLookCloserButton();
        if (!state.studioFocusCanvas) applyFocusCanvasBounds();
        const settle = () => {
          applyFocusCanvasBounds();
          if (canvasArea) {
            canvasArea.scrollTop = previousScrollTop;
            canvasArea.scrollLeft = previousScrollLeft;
          }
          syncFocusCanvasImage();
          syncCropLayout();
          syncCropLayout(80);
          syncCropLayout(180);
        };
        window.requestAnimationFrame(() => window.requestAnimationFrame(settle));
      };

      $('#smo-studio-look-closer')?.addEventListener('click', () => {
        setFocusCanvas(!state.studioFocusCanvas);
      });
      $('#smo-studio-focus-close')?.addEventListener('click', () => {
        setFocusCanvas(false);
      });
      syncLookCloserButton();

      const safeToggleButtons = ['#smo-social-safe-toggle', '#smo-crop-safe-toggle'];
      safeToggleButtons.forEach((selector) => {
        const button = $(selector);
        if (!button) return;
        button.addEventListener('click', () => {
          if (!socialSafeZonesAvailable(state.studioPreset)) return;
          state.studioSafeZonesEnabled = !state.studioSafeZonesEnabled;
          localStorage.setItem('smo_social_safe_zones', state.studioSafeZonesEnabled ? '1' : '0');
          renderCrop();
        });
      });

      let cropResizeObserver = null;
      if (window.ResizeObserver) {
        cropResizeObserver = new ResizeObserver(() => {
          syncFocusCanvasImage();
          syncCropLayout(0);
        });
        cropResizeObserver.observe(frame);
        cropResizeObserver.observe(layer);
        const image = $('#smo-studio-image');
        if (image) cropResizeObserver.observe(image);
        const canvasBackground = $('#smo-studio-canvas-bg');
        if (canvasBackground) cropResizeObserver.observe(canvasBackground);
        const canvasArea = $('.smo-studio-canvas-area');
        if (canvasArea) cropResizeObserver.observe(canvasArea);
      }
      const cropResizeHandler = () => syncCropLayout(0);
      window.addEventListener('resize', cropResizeHandler, { passive: true });
      state.studioCropCleanup = () => {
        cropResizeObserver?.disconnect();
        window.removeEventListener('resize', cropResizeHandler);
      };

      const clearCropState = () => {
        state.studioCrop = null;
        state.studioPreset = null;
        box.hidden = true;
        box.classList.remove('is-resolution-good', 'is-resolution-low');
        $('#smo-studio-crop-readout').textContent = 'No crop selected';
        $$('.smo-ratio-preset').forEach((b) => b.classList.remove('is-active'));
        $$('.smo-social-preset').forEach((b) => b.classList.remove('is-active'));
        const labelInput = $('#smo-studio-label');
        if (labelInput && state.studioLabelAuto) labelInput.value = '';
        state.studioLabelAuto = false;
        setEnabled(false);
        updatePresetStatus();
        scheduleStudioPreview();
      };

      $$('[data-clear-crop]').forEach((clearButton) => clearButton.addEventListener('click', async () => {
        if (studioReeditMutationLocked()) return;
        if (!state.studioCrop && !state.studioPreset) {
          clearCropState();
          return;
        }
        const confirmed = await simmeConfirm({ title: 'Clear the current crop?', message: 'This removes the active crop and any channel avatar preset linked to it.', note: 'Your protected master and working versions stay safe. If the version name was auto-filled from a social preset, it will be cleared as well.', confirmLabel: 'Clear crop', tone: 'warning' });
        if (!confirmed) return;
        clearCropState();
      }));

      // Rebuild the transient crop/safe-zone UI from state. This is intentionally
      // a fresh DOM mask every time Studio opens, preventing stale masks stacking.
      setEnabled(!!state.studioCropMode);
      updateStudioTransformState();
      const flipHButton = $('[data-studio-flip="h"]');
      const flipVButton = $('[data-studio-flip="v"]');
      if (flipHButton) flipHButton.classList.toggle('is-active', !!state.studioFlipH);
      if (flipVButton) flipVButton.classList.toggle('is-active', !!state.studioFlipV);

      const image = $('#smo-studio-image');
      image?.addEventListener('load', () => { if (state.studioCropMode && !state.studioCrop) initialCrop(); else renderCrop(); scheduleStudioPreview(30); }, { once: true });
    };

    const bindStudioUI = () => {
      const setupStudioVersionsRail = () => {
        const content = $('#smo-studio-content');
        const workspace = $('.smo-studio-workspace');
        const toggle = $('#smo-studio-versions-toggle');
        const panel = $('#smo-studio-versions-panel');
        const scrim = $('#smo-studio-versions-scrim');
        const drawerClose = $('#smo-studio-versions-drawer-close');
        const pin = $('#smo-studio-versions-pin');
        if (!content || !workspace || !toggle || !panel || !scrim || !drawerClose || !pin) return;

        let drawerMode = false;
        let canPin = false;
        let resizeObserver = null;
        let fallbackResize = null;
        let discoveryTimers = [];
        let discoveryRunning = false;

        const effectivePinned = () => drawerMode && canPin && !!state.studioVersionsPinned;
        const clearDiscoveryTimers = () => {
          discoveryTimers.forEach((timer) => window.clearTimeout(timer));
          discoveryTimers = [];
        };
        const stopVersionsDiscovery = ({ keepCurrentState = true } = {}) => {
          clearDiscoveryTimers();
          discoveryRunning = false;
          workspace.classList.remove('is-versions-discovery-peek');
          toggle.classList.remove('is-versions-discovery-glow', 'is-versions-discovery-static');
          if (!keepCurrentState && !effectivePinned()) applyOpenState(false);
        };
        const reduceVersionsDiscoveryMotion = () => {
          const wrap = workspace.closest('.smo-wrap');
          return wrap?.dataset.reduceMotion === '1' || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        };

        const syncPinControl = () => {
          const pinned = effectivePinned();
          pin.hidden = !drawerMode;
          pin.disabled = drawerMode && !canPin;
          pin.setAttribute('aria-pressed', pinned ? 'true' : 'false');
          pin.classList.toggle('is-pinned', pinned);
          pin.innerHTML = `${icon(pinned ? 'unlock' : 'lock')}<span>${pinned ? 'Unpin' : 'Keep open'}</span>`;
          pin.title = canPin
            ? (pinned ? 'Return the versions panel to slide-in mode' : 'Keep the versions panel fixed on the right while you work')
            : 'The Studio is too narrow to keep the versions panel pinned safely';
        };

        const applyOpenState = (open, { focusPanel = false, restoreFocus = false } = {}) => {
          const pinned = effectivePinned();
          const shouldOpen = drawerMode && (pinned || !!open);
          state.studioVersionsDrawerOpen = shouldOpen;
          workspace.classList.toggle('is-versions-pinned', pinned);
          workspace.classList.toggle('is-versions-open', shouldOpen);
          toggle.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
          toggle.hidden = !drawerMode || shouldOpen || pinned;
          scrim.hidden = !shouldOpen || pinned;
          panel.setAttribute('aria-hidden', drawerMode && !shouldOpen ? 'true' : 'false');
          syncPinControl();
          if (shouldOpen && focusPanel && !pinned) {
            window.requestAnimationFrame(() => drawerClose.focus({ preventScroll: true }));
          } else if (!shouldOpen && restoreFocus && drawerMode) {
            window.requestAnimationFrame(() => toggle.focus({ preventScroll: true }));
          }
        };

        const syncMode = () => {
          const available = Math.round(content.getBoundingClientRect().width || content.clientWidth || 0);
          const nextDrawerMode = true;
          const nextCanPin = available >= 900;
          const modeChanged = nextDrawerMode !== drawerMode;
          drawerMode = nextDrawerMode;
          canPin = nextCanPin;
          workspace.classList.toggle('is-versions-drawer', true);
          if (modeChanged && effectivePinned()) state.studioVersionsDrawerOpen = true;
          applyOpenState(state.studioVersionsDrawerOpen);
        };

        /* Versions discovery mirrors the main Library menu cue.
         * On each fresh Studio entry, briefly reveal the Versions drawer, then
         * return it to the normal closed state and pulse the edge activation tab.
         * It never steals focus, never overrides a pinned panel, and deliberate
         * user interaction cancels the automatic sequence immediately. */
        const startVersionsDiscovery = () => {
          if (state.studioVersionsDiscoveryStarted || !drawerMode) return;
          state.studioVersionsDiscoveryStarted = true;
          if (effectivePinned()) return;
          discoveryRunning = true;

          if (reduceVersionsDiscoveryMotion()) {
            toggle.classList.add('is-versions-discovery-static');
            discoveryTimers.push(window.setTimeout(() => {
              toggle.classList.remove('is-versions-discovery-static');
              discoveryRunning = false;
            }, 3600));
            return;
          }

          discoveryTimers.push(window.setTimeout(() => {
            if (!discoveryRunning || effectivePinned()) return;
            workspace.classList.add('is-versions-discovery-peek');
            applyOpenState(true, { focusPanel: false });
          }, 600));

          discoveryTimers.push(window.setTimeout(() => {
            if (!discoveryRunning || effectivePinned()) return;
            applyOpenState(false);
          }, 2450));

          discoveryTimers.push(window.setTimeout(() => {
            if (!discoveryRunning || effectivePinned()) return;
            workspace.classList.remove('is-versions-discovery-peek');
            toggle.classList.add('is-versions-discovery-glow');
          }, 2850));

          discoveryTimers.push(window.setTimeout(() => {
            toggle.classList.remove('is-versions-discovery-glow');
            discoveryRunning = false;
          }, 6500));
        };

        toggle.addEventListener('click', () => applyOpenState(true, { focusPanel: true }));
        drawerClose.addEventListener('click', () => {
          if (effectivePinned()) {
            state.studioVersionsPinned = false;
            localStorage.setItem('smo_studio_versions_pinned', '0');
          }
          applyOpenState(false, { restoreFocus: true });
        });
        scrim.addEventListener('click', () => applyOpenState(false, { restoreFocus: true }));
        pin.addEventListener('click', () => {
          if (!drawerMode || !canPin) return;
          state.studioVersionsPinned = !state.studioVersionsPinned;
          localStorage.setItem('smo_studio_versions_pinned', state.studioVersionsPinned ? '1' : '0');
          if (state.studioVersionsPinned) state.studioVersionsDrawerOpen = true;
          applyOpenState(state.studioVersionsDrawerOpen, { focusPanel: false });
        });

        // Deliberate interaction cancels the automatic discovery sequence and
        // leaves the user's chosen open/closed/pinned state untouched.
        [toggle, drawerClose, scrim, pin, panel].forEach((element) => {
          element?.addEventListener('pointerdown', () => {
            if (discoveryRunning) stopVersionsDiscovery({ keepCurrentState: true });
          }, { capture: true });
          element?.addEventListener('keydown', (event) => {
            if (!discoveryRunning) return;
            if (element === panel || event.key === 'Enter' || event.key === ' ') {
              stopVersionsDiscovery({ keepCurrentState: true });
            }
          }, { capture: true });
        });

        if (window.ResizeObserver) {
          resizeObserver = new ResizeObserver(syncMode);
          resizeObserver.observe(content);
        } else {
          fallbackResize = () => syncMode();
          window.addEventListener('resize', fallbackResize, { passive: true });
        }
        syncMode();
        window.requestAnimationFrame(() => startVersionsDiscovery());

        state.studioVersionsLayoutCleanup = () => {
          clearDiscoveryTimers();
          discoveryRunning = false;
          workspace.classList.remove('is-versions-discovery-peek');
          toggle.classList.remove('is-versions-discovery-glow', 'is-versions-discovery-static');
          resizeObserver?.disconnect();
          if (fallbackResize) window.removeEventListener('resize', fallbackResize);
        };
      };
      setupStudioVersionsRail();

      const sourceSelect = $('#smo-studio-source');
      sourceSelect?.addEventListener('change', () => {
        state.studioSourceId = sourceSelect.value;
        resetStudioForSource();
      });

      let ratioGuard = false;
      const widthInput = $('#smo-studio-width');
      const heightInput = $('#smo-studio-height');
      widthInput?.addEventListener('input', () => {
        if (studioReeditMutationLocked() || ratioGuard || !$('#smo-studio-lock-ratio')?.checked) return;
        const source = studioSource();
        const aspectW = state.studioCrop?.width || source?.width;
        const aspectH = state.studioCrop?.height || source?.height;
        if (!source || !aspectW || !aspectH) return;
        ratioGuard = true;
        heightInput.value = Math.max(1, Math.round(Number(widthInput.value || 1) * aspectH / aspectW));
        ratioGuard = false;
        scheduleStudioPreview();
      });
      heightInput?.addEventListener('input', () => {
        if (studioReeditMutationLocked() || ratioGuard || !$('#smo-studio-lock-ratio')?.checked) return;
        const source = studioSource();
        const aspectW = state.studioCrop?.width || source?.width;
        const aspectH = state.studioCrop?.height || source?.height;
        if (!source || !aspectW || !aspectH) return;
        ratioGuard = true;
        widthInput.value = Math.max(1, Math.round(Number(heightInput.value || 1) * aspectW / aspectH));
        ratioGuard = false;
        scheduleStudioPreview();
      });

      widthInput?.addEventListener('input', () => { if (!studioReeditMutationLocked()) scheduleStudioPreview(160); });
      heightInput?.addEventListener('input', () => { if (!studioReeditMutationLocked()) scheduleStudioPreview(160); });
      widthInput?.addEventListener('change', () => { if (!studioReeditMutationLocked()) scheduleStudioPreview(60); });
      heightInput?.addEventListener('change', () => { if (!studioReeditMutationLocked()) scheduleStudioPreview(60); });
      $('#smo-studio-lock-ratio')?.addEventListener('change', () => { if (!studioReeditMutationLocked()) scheduleStudioPreview(60); });

      $$('[data-studio-rotate]').forEach((button) => button.addEventListener('click', () => {
        if (studioReeditMutationLocked()) return;
        state.studioRotation += Number(button.dataset.studioRotate || 0);
        while (state.studioRotation > 270) state.studioRotation -= 360;
        while (state.studioRotation < -270) state.studioRotation += 360;
        updateStudioTransformState();
        scheduleStudioPreview();
      }));
      $$('[data-studio-flip]').forEach((button) => button.addEventListener('click', () => {
        if (studioReeditMutationLocked()) return;
        if (button.dataset.studioFlip === 'h') state.studioFlipH = !state.studioFlipH;
        if (button.dataset.studioFlip === 'v') state.studioFlipV = !state.studioFlipV;
        button.classList.toggle('is-active', button.dataset.studioFlip === 'h' ? state.studioFlipH : state.studioFlipV);
        updateStudioTransformState();
        scheduleStudioPreview();
      }));

      $('#smo-studio-quality')?.addEventListener('input', (e) => {
        if (studioReeditMutationLocked()) return;
        $('#smo-studio-quality-value').textContent = e.target.value;
        scheduleStudioPreview(120);
      });
      $('#smo-studio-format')?.addEventListener('change', () => { if (!studioReeditMutationLocked()) scheduleStudioPreview(80); });
      const applyStudioTransparencyBackground = (mode) => {
        const allowed = ['checker', 'dark', 'light'];
        const nextMode = allowed.includes(mode) ? mode : 'checker';
        state.studioTransparencyBg = nextMode;
        $$('[data-studio-bg]').forEach((b) => b.classList.toggle('is-active', b.dataset.studioBg === nextMode));
        const frameBg = $('#smo-studio-image-frame');
        if (frameBg) {
          frameBg.classList.remove('is-checker', 'is-dark', 'is-light');
          frameBg.classList.add(`is-${nextMode}`);
        }
        const previewFrameBg = $('#smo-studio-preview-image-frame');
        if (previewFrameBg) {
          previewFrameBg.classList.remove('is-checker', 'is-dark', 'is-light');
          previewFrameBg.classList.add(`is-${nextMode}`);
        }
      };

      $$('[data-studio-bg]').forEach((button) => button.addEventListener('click', () => {
        applyStudioTransparencyBackground(button.dataset.studioBg);
      }));
      applyStudioTransparencyBackground(state.studioTransparencyBg || 'checker');

      $('#smo-studio-reedit-lock')?.addEventListener('click', () => {
        if (!state.studioEditVersionId) return;
        syncStudioReeditLock(!state.studioEditLocked, true);
      });
      $('#smo-studio-reedit-reset')?.addEventListener('click', async () => {
        if (!state.studioEditVersionId || !state.studioData) return;
        const version = state.studioData.versions.find((item) => String(item.id) === String(state.studioEditVersionId));
        if (!version?.editable) return;
        const confirmed = await simmeConfirm({
          title: `Reset changes to “${version.label}”?`,
          message: 'Every unsaved adjustment made during this Re-edit will be discarded and Simme will reconstruct the version from its last saved recipe.',
          note: 'The protected master, saved version file and current revision are not changed. This only resets the open Re-edit session.',
          confirmLabel: 'Reset unsaved changes',
          tone: 'warning'
        });
        if (!confirmed) return;
        state.studioEditLocked = true;
        state.studioSourceId = 'master';
        renderStudio(state.studioData, 'master', versionRecipeSession(version, state.studioData.attachmentId));
        toast('Re-edit reset to the last saved version settings and locked for review.');
      });
      $$('[data-studio-exit-reedit]').forEach((button) => button.addEventListener('click', exitVersionReeditToMaster));

      $('#smo-studio-apply-recommendation')?.addEventListener('click', () => {
        if (studioReeditMutationLocked()) return;
        const source = studioSource();
        if (!source) return;
        const width = Math.min(1920, Number(source.width) || 1920);
        $('#smo-studio-width').value = width;
        $('#smo-studio-height').value = Math.max(1, Math.round(width * source.height / source.width));
        const formatSelect = $('#smo-studio-format');
        const auto = [...formatSelect.options].find((o) => o.value === 'auto');
        const webp = [...formatSelect.options].find((o) => o.value === 'image/webp');
        if (auto) formatSelect.value = 'auto';
        else if (webp) formatSelect.value = 'image/webp';
        $('#smo-studio-quality').value = '82';
        $('#smo-studio-quality-value').textContent = '82';
        $('#smo-studio-label').value = 'Website Optimised';
        $('#smo-studio-preferred').checked = false;
        scheduleStudioPreview(40);
        toast('Website optimisation settings applied. The unsaved preview is updating so you can review the result before creating it.');
      });

      const versionNameInput = $('#smo-studio-label');
      versionNameInput?.addEventListener('input', () => {
        // Social presets may suggest a useful starting name, but the Version
        // name is core Free metadata and always belongs to the user.
        state.studioLabelAuto = false;
      });

      bindStudioCrop();
      if (state.studioEditVersionId) syncStudioReeditLock(state.studioEditLocked, false);
      scheduleStudioPreview(60);

      $('#smo-studio-create-version')?.addEventListener('click', async (e) => {
        const button = e.currentTarget;
        const crop = state.studioCrop || {};
        const source = studioSource();
        if (!source) return;
        const requestedW = Number($('#smo-studio-width').value || source.width);
        const requestedH = Number($('#smo-studio-height').value || source.height);
        if (requestedW > source.width && requestedH > source.height) {
          toast('The requested size is larger than the source. Image Studio will keep the source size rather than silently upscaling it.', 'error', 4200);
        }
        button.disabled = true;
        button.textContent = state.studioEditVersionId ? 'Rebuilding version from master…' : 'Creating protected version…';
        try {
          const payload = studioRequestPayload() || {};
          payload.label = $('#smo-studio-label').value;
          payload.make_preferred = $('#smo-studio-preferred').checked ? 1 : 0;
          payload.crop_ratio = $('#smo-studio-crop-ratio')?.value || 'free';
          payload.lock_ratio = $('#smo-studio-lock-ratio')?.checked ? 1 : 0;
          payload.transparency_bg = state.studioTransparencyBg || 'checker';
          if (state.studioEditVersionId) {
            const currentVersion = state.studioData.versions.find((v) => String(v.id) === String(state.studioEditVersionId));
            if (currentVersion?.active) {
              const confirmed = await simmeConfirm({ title: `Update active version “${currentVersion.label}”?`, message: 'Simme will rebuild this active WordPress version from the untouched protected master using the settings you can see now.', note: 'The protected master stays unchanged. WordPress attachment metadata will be regenerated for the replacement output.', confirmLabel: 'Rebuild active version', tone: 'warning' });
              if (!confirmed) { button.disabled = false; button.textContent = 'Save changes to version'; return; }
            }
            payload.edit_version_id = state.studioEditVersionId;
          }
          const wasReedit = !!state.studioEditVersionId;
          const data = await api('simme_media_organiser_studio_create_version', payload);
          state.studioEditVersionId = null;
          state.studioEditLocked = false;
          state.studioSourceId = 'master';
          renderStudio(data, 'master');
          toast(wasReedit ? 'Changes saved. Back at Master Original — ready to create another protected version.' : 'Protected working version created. Master Original is back in the editing canvas.');
          await load();
        } catch (err) {
          toast(err.message, 'error', 6000);
          button.disabled = false;
          button.textContent = state.studioEditVersionId ? 'Save changes to version' : 'Create protected version';
        }
      });

      $('#smo-studio-copy-master')?.addEventListener('click', async (e) => {
        try { await copyText(state.studioData.master.url); copiedFeedback(e.currentTarget, 'Copy original URL'); toast('Media URL copied to clipboard.'); } catch (err) { toast(err.message, 'error'); }
      });
      $('#smo-studio-prefer-master')?.addEventListener('click', async () => {
        try {
          const attachmentId = state.studioData.attachmentId;
          const data = await api('simme_media_organiser_studio_set_preferred', { id: attachmentId, version_id: 'master' });
          state.studioSourceId = 'master';
          clearStudioSession(attachmentId);
          renderStudio(data, 'master');
          toast('Master Original is now the Studio default. The active WordPress image was not changed.');
        } catch (err) { toast(err.message, 'error'); }
      });
      $('#smo-studio-restore-master')?.addEventListener('click', async () => {
        const confirmed = await simmeConfirm({ title: 'Use Master Original in WordPress?', message: 'WordPress will use the protected Master Original as the active attachment again.', note: 'This also makes Master Original the Studio default. Working versions remain available and no Studio version is deleted.', confirmLabel: 'Use Master', tone: 'warning' });
        if (!confirmed) return;
        try {
          const attachmentId = state.studioData.attachmentId;
          const data = await api('simme_media_organiser_studio_restore_master', { id: attachmentId });
          state.studioEditVersionId = null;
          state.studioEditLocked = false;
          state.studioSourceId = 'master';
          clearStudioSession(attachmentId);
          renderStudio(data, 'master');
          refreshWordPressAttachmentModel(attachmentId);
          toast('Master Original is active in WordPress and is now the Studio default.');
          await load();
        } catch (err) { toast(err.message, 'error', 6000); }
      });

      const runStudioVersionStateHistory = async (direction) => {
        const action = direction === 'redo' ? 'simme_media_organiser_studio_redo_state' : 'simme_media_organiser_studio_undo_state';
        const attachmentId = state.studioData?.attachmentId;
        if (!attachmentId) return;
        const undoButtons = [$('#smo-studio-state-undo'), $('#smo-studio-toolbar-undo')].filter(Boolean);
        const redoButtons = [$('#smo-studio-state-redo'), $('#smo-studio-toolbar-redo')].filter(Boolean);
        undoButtons.forEach((button) => { button.disabled = true; });
        redoButtons.forEach((button) => { button.disabled = true; });
        try {
          const data = await api(action, { id: attachmentId });
          const preferredSource = data.preferred || 'master';
          state.studioEditVersionId = null;
          state.studioEditLocked = false;
          state.studioSourceId = preferredSource;
          clearStudioSession(attachmentId);
          renderStudio(data, preferredSource);
          refreshWordPressAttachmentModel(attachmentId);
          toast(data.stateHistoryMessage || (direction === 'redo' ? 'Version choice redone.' : 'Version choice undone.'));
          await load();
        } catch (err) {
          toast(err.message, 'error', 6000);
          if (state.studioData) renderStudio(state.studioData, state.studioSourceId || 'master');
        }
      };
      $('#smo-studio-state-undo')?.addEventListener('click', () => runStudioVersionStateHistory('undo'));
      $('#smo-studio-state-redo')?.addEventListener('click', () => runStudioVersionStateHistory('redo'));
      $('#smo-studio-toolbar-undo')?.addEventListener('click', () => runStudioVersionStateHistory('undo'));
      $('#smo-studio-toolbar-redo')?.addEventListener('click', () => runStudioVersionStateHistory('redo'));

      $$('.smo-studio-version').forEach((card) => {
        const versionId = card.dataset.versionId;
        const version = state.studioData.versions.find((v) => String(v.id) === String(versionId));
        if (!version) return;
        $('[data-studio-action="quicklook"]', card)?.addEventListener('click', (event) => openVersionQuickLook(version, version.label || 'Working Version', event.currentTarget));
        $('[data-studio-action="reedit"]', card)?.addEventListener('click', () => beginVersionReedit(version));
        $('[data-studio-action="compare"]', card)?.addEventListener('click', () => {
          const compare = $('#smo-studio-compare');
          compare.hidden = false;
          $('#smo-compare-after-image').src = version.url;
          $('#smo-compare-version-label').textContent = version.label;
          $('#smo-compare-meta').textContent = `Master ${state.studioData.master.width} × ${state.studioData.master.height} · ${formatStudioMime(state.studioData.master.mime)}  →  ${version.label} ${version.width} × ${version.height} · ${formatStudioMime(version.mime)}`;
          $('#smo-compare-range').value = '50';
          $('#smo-compare-after').style.clipPath = 'inset(0 50% 0 0)';
          $('#smo-compare-divider').style.left = '50%';
          compare.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
        $('[data-studio-action="copy"]', card)?.addEventListener('click', async (e) => {
          try { await copyText(version.url); copiedFeedback(e.currentTarget, 'Copy URL'); toast('Media URL copied to clipboard.'); } catch (err) { toast(err.message, 'error'); }
        });
        $('[data-studio-action="preferred"]', card)?.addEventListener('click', async () => {
          try {
            const attachmentId = state.studioData.attachmentId;
            const data = await api('simme_media_organiser_studio_set_preferred', { id: attachmentId, version_id: versionId });
            state.studioSourceId = versionId;
            clearStudioSession(attachmentId);
            renderStudio(data, versionId);
            toast(`${version.label} is now the Studio default. The active WordPress image was not changed.`);
          } catch (err) { toast(err.message, 'error'); }
        });
        $('[data-studio-action="publish"]', card)?.addEventListener('click', async () => {
          const confirmed = await simmeConfirm({ title: `Publish “${version.label}”?`, message: 'This working version will become the active WordPress attachment and the Studio default.', note: 'The protected master stays safely on the server and can be restored at any time. Existing direct master URLs continue to work, while WordPress will return the new version URL for this attachment.', confirmLabel: 'Publish version', tone: 'warning' });
          if (!confirmed) return;
          try {
            const attachmentId = state.studioData.attachmentId;
            const data = await api('simme_media_organiser_studio_publish_version', { id: attachmentId, version_id: versionId });
            state.studioSourceId = versionId;
            clearStudioSession(attachmentId);
            renderStudio(data, versionId);
            refreshWordPressAttachmentModel(attachmentId);
            toast('Working version is active in WordPress and is now the Studio default. The protected master is still safe.');
            await load();
          } catch (err) { toast(err.message, 'error', 6000); }
        });
        $('[data-studio-action="delete"]', card)?.addEventListener('click', async () => {
          const confirmed = await simmeConfirm({ title: `Delete “${version.label}”?`, message: 'This working version file will be deleted from Image Studio.', note: 'The protected master is not affected.', confirmLabel: 'Delete version', tone: 'danger' });
          if (!confirmed) return;
          try { renderStudio(await api('simme_media_organiser_studio_delete_version', { id: state.studioData.attachmentId, version_id: versionId })); toast('Working version deleted.'); await load(); } catch (err) { toast(err.message, 'error', 6000); }
        });
      });

      $('#smo-compare-close')?.addEventListener('click', () => {
        const compare = $('#smo-studio-compare');
        if (!compare) return;
        compare.hidden = true;
        const afterImage = $('#smo-compare-after-image');
        if (afterImage) afterImage.removeAttribute('src');
      });

      $('#smo-compare-range')?.addEventListener('input', (e) => {
        const value = Number(e.target.value || 50);
        $('#smo-compare-after').style.clipPath = `inset(0 ${100 - value}% 0 0)`;
        $('#smo-compare-divider').style.left = `${value}%`;
      });
    };

    const openStudio = async (id, selectedVersionId = null) => {
      const modal = $('#smo-image-studio');
      const content = $('#smo-studio-content');
      if (!modal || !content) return;
      closeInspector();
      state.studioVersionsDiscoveryStarted = false;
      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden', 'false');
      document.body.classList.add('smo-studio-open');
      const loadingSteps = [
        { title: 'Reading your source image…', detail: 'Simme is finding the protected master and checking the original media details.' },
        { title: 'Reviewing version history…', detail: 'Saved Studio versions, preferences and revision details are being gathered.' },
        { title: 'Rebuilding the Studio workspace…', detail: 'Preparing crop tools, load grades, quick actions and version controls.' },
        { title: 'Almost ready…', detail: 'Finishing the view so Image Studio opens cleanly without dead time.' },
      ];
      content.innerHTML = studioLoaderHtml('Preparing protected master…', loadingSteps[0].title, loadingSteps[0].detail);
      const stepTitle = $('#smo-studio-loading-step');
      const stepNote = $('#smo-studio-loading-note');
      let stepIndex = 0;
      const updateLoadingStep = () => {
        const step = loadingSteps[Math.min(stepIndex, loadingSteps.length - 1)] || loadingSteps[0];
        if (stepTitle) stepTitle.textContent = step.title;
        if (stepNote) stepNote.textContent = step.detail;
        if (stepIndex < loadingSteps.length - 1) stepIndex += 1;
      };
      const loadingTimer = window.setInterval(updateLoadingStep, 650);
      const minimumDisplay = new Promise((resolve) => window.setTimeout(resolve, 1700));
      try {
        const [data] = await Promise.all([
          api('simme_media_organiser_studio_get', { id }),
          minimumDisplay,
        ]);
        window.clearInterval(loadingTimer);
        const remembered = selectedVersionId ? null : state.studioSessions.get(studioSessionKey(id));
        const defaultSourceId = selectedVersionId || remembered?.sourceId || data.preferred || 'master';
        state.studioSourceId = defaultSourceId;
        renderStudio(data, selectedVersionId || (!remembered ? defaultSourceId : null), remembered || null);
      } catch (err) {
        window.clearInterval(loadingTimer);
        content.innerHTML = studioLoaderHtml('Image Studio could not open this image', '', err.message);
        toast(err.message, 'error', 6000);
      }
    };

    const closeStudio = () => {
      const modal = $('#smo-image-studio');
      const content = $('#smo-studio-content');
      if (!modal) return;
      const wasOpen = modal.classList.contains('is-open');
      if (wasOpen && state.studioData) captureStudioSession();

      // The mask is presentation-only. Remove it before the modal is hidden, then
      // discard the Studio DOM. The remembered crop/preset survives separately in
      // state.studioSessions and is rebuilt cleanly on the next open.
      removeStudioVisualMask();
      modal.classList.remove('is-open', 'is-focus-canvas');
      modal.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('smo-studio-open');
      clearTimeout(state.studioPreviewTimer);
      clearTimeout(state.studioEstimateTimer);
      if (typeof state.studioVersionsLayoutCleanup === 'function') {
        state.studioVersionsLayoutCleanup();
        state.studioVersionsLayoutCleanup = null;
      }
      state.studioVersionsDrawerOpen = false;
      state.studioVersionsDiscoveryStarted = false;
      if (typeof state.studioCropCleanup === 'function') {
        state.studioCropCleanup();
        state.studioCropCleanup = null;
      }
      state.studioEstimateRequestId = (state.studioEstimateRequestId || 0) + 1;
      if (state.studioPreviewUrl) { URL.revokeObjectURL(state.studioPreviewUrl); state.studioPreviewUrl = ''; }
      if (content) content.innerHTML = '';

      state.studioData = null;
      state.studioFocusCanvas = false;
      state.studioCrop = null;
      state.studioCropMode = false;
      state.studioPreset = null;
      state.studioEditVersionId = null;
      state.studioEditLocked = false;

      // Rebuild the visible library card from its authoritative media item data.
      // This guarantees that no transient Studio overlay can remain attached to it.
      if (wasOpen) renderMedia();
    };

    let usedInReturnFocus = null;

    const openAltEditor = (id) => {
      const item = state.items.find((i) => Number(i.id) === Number(id));
      if (!item || item.kind !== 'image') return;
      state.altEditItem = item;
      const modal = $('#smo-alt-modal');
      const input = $('#smo-alt-input');
      if (!modal || !input) return;
      $('#smo-alt-modal-title').textContent = item.alt ? 'Edit ALT text' : 'Add ALT text';
      $('#smo-alt-filename').textContent = item.filename || item.title || 'Image';
      const thumb = $('#smo-alt-thumb');
      if (thumb) {
        thumb.src = item.thumb || item.url || '';
        thumb.hidden = !(item.thumb || item.url);
      }
      input.value = item.alt || '';
      $('#smo-alt-char-count').textContent = String(input.value.length);
      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden', 'false');
      setTimeout(() => { input.focus(); input.select(); }, 40);
    };

    const closeAltEditor = () => {
      const modal = $('#smo-alt-modal');
      if (!modal) return;
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
      state.altEditItem = null;
    };

    const saveAltEditor = async () => {
      const item = state.altEditItem;
      const input = $('#smo-alt-input');
      if (!item || !input) return;
      const button = $('#smo-alt-save');
      if (button) { button.disabled = true; button.textContent = 'Saving…'; }
      try {
        await api('simme_media_organiser_save_alt', { id: item.id, alt: input.value.trim() });
        closeAltEditor();
        toast('ALT text saved.');
        await load();
      } catch (err) {
        toast(err.message, 'error');
      } finally {
        if (button) { button.disabled = false; button.textContent = 'Save ALT'; }
      }
    };

    let versionQuickLookReturnFocus = null;

    const ensureVersionQuickLook = () => {
      let modal = $('#smo-version-quick-look', wrap);
      if (modal) return modal;

      modal = document.createElement('div');
      modal.id = 'smo-version-quick-look';
      modal.className = 'smo-version-quicklook-modal';
      modal.setAttribute('aria-hidden', 'true');
      modal.innerHTML = `
        <div class="smo-version-quicklook__scrim" data-version-quicklook-close></div>
        <section class="smo-version-quicklook__panel" role="dialog" aria-modal="true" aria-labelledby="smo-version-quicklook-title">
          <header class="smo-version-quicklook__header">
            <div class="smo-version-quicklook__heading">
              <span class="smo-eyebrow">Quick Look</span>
              <strong id="smo-version-quicklook-title">Image version</strong>
              <span id="smo-version-quicklook-meta"></span>
            </div>
            <button type="button" class="smo-version-quicklook__close" data-version-quicklook-close aria-label="Close Quick Look">${icon('close')}<span>Close</span></button>
          </header>
          <div class="smo-version-quicklook__stage">
            <img id="smo-version-quicklook-image" src="" alt="" />
            <div class="smo-version-quicklook__error" id="smo-version-quicklook-error" hidden>Simme could not display this image preview.</div>
          </div>
          <footer class="smo-version-quicklook__footer">
            <span>${icon('eye')} Preview only · nothing is changed</span>
            <button type="button" class="smo-version-quicklook__copy" id="smo-version-quicklook-copy">${icon('copy')}<span>Copy URL</span></button>
          </footer>
        </section>`;
      wrap.appendChild(modal);

      $$('[data-version-quicklook-close]', modal).forEach((el) => el.addEventListener('click', () => closeVersionQuickLook()));
      $('#smo-version-quicklook-copy', modal)?.addEventListener('click', async (event) => {
        const url = modal.dataset.versionUrl || '';
        try {
          await copyText(url);
          copiedFeedback(event.currentTarget, 'Copy URL');
          toast('Media URL copied to clipboard.');
        } catch (err) {
          toast(err.message, 'error');
        }
      });
      return modal;
    };

    const closeVersionQuickLook = ({ restoreFocus = true } = {}) => {
      const modal = $('#smo-version-quick-look', wrap);
      if (!modal || !modal.classList.contains('is-open')) return false;
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
      const image = $('#smo-version-quicklook-image', modal);
      if (image) {
        image.removeAttribute('src');
        image.alt = '';
      }
      modal.dataset.versionUrl = '';
      if (restoreFocus && versionQuickLookReturnFocus && document.contains(versionQuickLookReturnFocus)) {
        versionQuickLookReturnFocus.focus({ preventScroll: true });
      }
      versionQuickLookReturnFocus = null;
      return true;
    };

    const openVersionQuickLook = (source, label = 'Image version', trigger = null) => {
      if (!source || !source.url) {
        toast('This version does not have an image URL to preview.', 'error');
        return;
      }
      const modal = ensureVersionQuickLook();
      const image = $('#smo-version-quicklook-image', modal);
      const error = $('#smo-version-quicklook-error', modal);
      const title = $('#smo-version-quicklook-title', modal);
      const meta = $('#smo-version-quicklook-meta', modal);
      const copy = $('#smo-version-quicklook-copy', modal);
      versionQuickLookReturnFocus = trigger || document.activeElement;
      modal.dataset.versionUrl = source.url || '';
      if (title) title.textContent = label || source.label || 'Image version';
      if (meta) meta.textContent = `${Number(source.width || 0)} × ${Number(source.height || 0)} · ${formatStudioMime(source.mime)} · ${source.size || '—'}`;
      if (error) error.hidden = true;
      if (image) {
        image.alt = `${label || source.label || 'Image version'} preview`;
        image.onload = () => { if (error) error.hidden = true; };
        image.onerror = () => { if (error) error.hidden = false; };
        image.src = source.url;
      }
      if (copy) {
        copy.classList.remove('is-copied');
        copy.innerHTML = `${icon('copy')}<span>Copy URL</span>`;
      }
      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden', 'false');
      requestAnimationFrame(() => $('.smo-version-quicklook__close', modal)?.focus({ preventScroll: true }));
    };

    const inspectorStudioStatusBadges = (data, version = null, isMaster = false) => {
      const badges = [];
      if (isMaster) badges.push('<span class="smo-inspector-version-badge is-master">Protected master</span>');
      const preferred = isMaster ? String(data.preferred || '') === 'master' : !!version?.preferred;
      const active = isMaster ? !!data.masterActive || String(data.active || '') === 'master' : !!version?.active;
      if (preferred) badges.push('<span class="smo-inspector-version-badge is-preferred">Studio default</span>');
      if (active) badges.push('<span class="smo-inspector-version-badge is-active">Active in WordPress</span>');
      return badges.join('');
    };

    const inspectorStudioVersionCard = (data, version, isMaster = false) => {
      const source = version || data.master;
      if (!source) return '';
      const label = isMaster ? 'Master Original' : (source.label || 'Working Version');
      const meta = `${Number(source.width || 0)} × ${Number(source.height || 0)} · ${formatStudioMime(source.mime)} · ${encode(source.size || '—')}`;
      return `<article class="smo-inspector-version-card ${isMaster ? 'is-master' : ''}" data-inspector-version-id="${encode(source.id || (isMaster ? 'master' : ''))}">
        <div class="smo-inspector-version-thumb"><img src="${encode(source.url || '')}" alt="" loading="lazy" /></div>
        <div class="smo-inspector-version-main">
          <div class="smo-inspector-version-title-row"><strong>${encode(label)}</strong><div class="smo-inspector-version-badges">${inspectorStudioStatusBadges(data, source, isMaster)}</div></div>
          <div class="smo-inspector-version-meta">${meta} ${studioLoadBadge(source.sizeBytes || 0)}</div>
          <div class="smo-inspector-version-actions">
            <button type="button" class="smo-inspector-version-look" data-version-id="${encode(isMaster ? 'master' : (source.id || ''))}">${icon('eye')}<span>Quick Look</span></button>
            <button type="button" class="smo-inspector-version-copy" data-version-url="${encode(source.url || '')}">${icon('copy')}<span>Copy URL</span></button>
            ${!isMaster ? `<button type="button" class="smo-inspector-version-open" data-version-id="${encode(source.id || '')}">${studioIconMarkup('is-inspector')}<span>Open in Studio</span></button>` : ''}
          </div>
        </div>
      </article>`;
    };

    const renderInspectorStudioVersions = (data) => {
      const target = $('#smo-inspector-studio-versions');
      if (!target || !data) return;
      const versions = Array.isArray(data.versions) ? data.versions : [];
      target.innerHTML = `
        <div class="smo-inspector-studio-summary">
          <div><strong>${versions.length} working ${versions.length === 1 ? 'version' : 'versions'}</strong><span>plus your protected master</span></div>
          <button type="button" class="smo-button smo-button--secondary smo-inspector-open-studio">${studioIconMarkup('is-button')} Open Image Studio</button>
        </div>
        <div class="smo-inspector-version-list">
          ${inspectorStudioVersionCard(data, data.master, true)}
          ${versions.map((version) => inspectorStudioVersionCard(data, version, false)).join('')}
        </div>`;

      $$('.smo-inspector-version-look', target).forEach((button) => button.addEventListener('click', () => {
        const versionId = button.dataset.versionId || '';
        const source = versionId === 'master' ? data.master : versions.find((version) => String(version.id) === String(versionId));
        if (!source) return;
        openVersionQuickLook(source, versionId === 'master' ? 'Master Original' : (source.label || 'Working Version'), button);
      }));
      $$('.smo-inspector-version-copy', target).forEach((button) => button.addEventListener('click', async (e) => {
        e.preventDefault();
        const url = button.dataset.versionUrl || '';
        try {
          await copyText(url);
          copiedFeedback(button, 'Copy URL');
          toast('Media URL copied to clipboard.');
        } catch (err) {
          toast(err.message, 'error');
        }
      }));
      $$('.smo-inspector-version-open', target).forEach((button) => button.addEventListener('click', () => {
        openStudio(data.attachmentId, button.dataset.versionId || null);
      }));
      $('.smo-inspector-open-studio', target)?.addEventListener('click', () => openStudio(data.attachmentId));
    };

    const loadInspectorStudioVersions = async (item) => {
      const target = $('#smo-inspector-studio-versions');
      if (!target || item.kind !== 'image') return;
      if (!item.studioMasterReady && !Number(item.studioVersionCount || 0)) {
        target.innerHTML = `<div class="smo-inspector-studio-empty"><div>${studioIconMarkup('is-empty')}</div><strong>No Image Studio versions yet</strong><span>Open Image Studio to create protected crops, optimised website versions or social-media assets while keeping the original safe.</span><button type="button" class="smo-button smo-button--secondary" id="smo-inspector-start-studio">${studioIconMarkup('is-button')} Open Image Studio</button></div>`;
        $('#smo-inspector-start-studio')?.addEventListener('click', () => openStudio(item.id));
        return;
      }
      target.innerHTML = `<div class="smo-inspector-studio-loading"><span class="smo-spinner"></span><div><strong>Loading Studio versions…</strong><span>Reading the protected master and working-version history.</span></div></div>`;
      try {
        const data = await api('simme_media_organiser_studio_get', { id: item.id });
        if (!state.inspectorItem || Number(state.inspectorItem.id) !== Number(item.id)) return;
        renderInspectorStudioVersions(data);
      } catch (err) {
        target.innerHTML = `<div class="smo-inspector-studio-empty is-error"><strong>Studio versions could not be loaded</strong><span>${encode(err.message)}</span></div>`;
      }
    };

    const openInspector = (id, options = {}) => {
      const item = state.items.find((entry) => Number(entry.id) === Number(id));
      if (!item) return;
      state.inspectorItem = item;
      const panel = $('#smo-inspector');
      $('#smo-inspector-title').textContent = item.title || item.filename;
      const preview = item.kind === 'image' && item.url
        ? `<img src="${encode(item.url)}" alt="" />`
        : item.kind === 'audio'
          ? `<audio controls style="width:90%" src="${encode(item.url)}"></audio>`
          : item.kind === 'video'
            ? `<video controls style="width:100%;height:100%;object-fit:contain" src="${encode(item.url)}"></video>`
            : icon(getFileKindIcon(item.kind));
      const dims = item.width && item.height ? `${item.width} × ${item.height}` : '—';
      $('#smo-inspector-content').innerHTML = `
        <div class="smo-inspector-preview">${preview}</div>
        <div class="smo-stat-grid">
          <div class="smo-stat"><span>Format</span><strong>${encode(item.extension)}</strong></div>
          <div class="smo-stat"><span>File size</span><strong>${encode(item.size)}</strong></div>
          <div class="smo-stat"><span>Dimensions</span><strong>${encode(dims)}</strong></div>
          <div class="smo-stat"><span>Load grade</span><strong>${encode(item.loadGrade || 'Not scanned')}</strong></div>
        </div>
        ${item.kind === 'image' ? `<div class="smo-inspector-section smo-inspector-studio-section"><div class="smo-inspector-section-heading"><h3>Image Studio versions</h3>${item.studioVersionCount ? `<span class="smo-inspector-version-count">${item.studioVersionCount}</span>` : ''}</div><div id="smo-inspector-studio-versions"></div></div>` : ''}
        <div class="smo-inspector-section">
          <h3>Content</h3>
          <label class="smo-field"><span>Title</span><input id="smo-edit-title" type="text" value="${encode(item.title)}" /></label>
          <label class="smo-field"><span>Alt text</span><input id="smo-edit-alt" type="text" value="${encode(item.alt)}" ${item.kind !== 'image' ? 'placeholder="Usually used for images"' : ''} /></label>
          <label class="smo-field"><span>Caption</span><textarea id="smo-edit-caption">${encode(item.caption)}</textarea></label>
          <label class="smo-field"><span>Description</span><textarea id="smo-edit-description">${encode(item.description)}</textarea></label>
        </div>
        <div class="smo-inspector-section">
          <h3>Organisation</h3>
          <label class="smo-field"><span>Virtual folder</span><select id="smo-edit-folder"><option value="0">Unfiled</option>${formatFolderOptions(state.folders)}</select></label>
        </div>
        <div class="smo-inspector-section smo-asset-control-section">
          <div class="smo-inspector-section-heading"><h3>Asset protection</h3><span class="smo-local-badge">Local only</span></div>
          <div class="smo-asset-control-actions">
            <button type="button" class="smo-button smo-button--secondary ${item.protected ? 'is-active is-unprotect-action' : ''}" id="smo-inspector-protect">${icon(item.protected ? 'shield-off' : 'shield')} ${item.protected ? 'Un-protect' : 'Protect asset'}</button>
            ${Number(item.duplicateCount || 0) > 1 ? `<button type="button" class="smo-button smo-button--secondary" id="smo-inspector-duplicates">${icon('duplicate')} Exact duplicates (${Number(item.duplicateCount) - 1})</button>` : ''}
          </div>
          <div class="smo-duplicate-results" id="smo-duplicate-results" hidden></div>
          <div class="smo-asset-safety-copy">Protection blocks WordPress deletion for this attachment until protection is deliberately removed.</div>
        </div>
        <div class="smo-inspector-section">
          <h3>File</h3>
          <label class="smo-field"><span>Filename — locked for safety</span><input type="text" readonly value="${encode(item.filename)}" /></label>
          <label class="smo-field"><span>Public URL</span><div class="smo-copy-row"><input id="smo-edit-url" type="text" readonly value="${encode(item.url)}" /><button type="button" class="smo-button smo-button--ghost" id="smo-copy-url">Copy</button></div></label>
          <div class="smo-stat-grid">
            <div class="smo-stat"><span>Attachment ID</span><strong>${item.id}</strong></div>
            <div class="smo-stat"><span>Uploaded</span><strong>${encode(item.dateLabel)}</strong></div>
            <div class="smo-stat"><span>WP derivatives</span><strong>${encode(item.derivatives)}</strong></div>
            <div class="smo-stat"><span>Total storage</span><strong>${encode(item.totalStorage)}</strong></div>
          </div>
        </div>
        <div class="smo-inspector-actions">${item.kind === 'image' ? `<button type="button" class="smo-button smo-button--secondary" id="smo-open-studio-from-inspector">${studioIconMarkup('is-button')} Open Image Studio</button>` : ''}<button type="button" class="smo-button smo-button--ghost" id="smo-cancel-edit">Cancel</button><button type="button" class="smo-button smo-button--primary" id="smo-save-media">Save changes</button></div>`;
      $('#smo-edit-folder').value = item.folder ? String(item.folder.id) : '0';
      $('#smo-copy-url')?.addEventListener('click', async () => {
        try { await copyText(item.url || ''); toast('Media URL copied to clipboard.'); } catch (err) { toast(err.message, 'error'); }
      });
      $('#smo-inspector-protect')?.addEventListener('click', async (event) => {
        const value = item.protected ? 0 : 1;
        try {
          await api('simme_media_organiser_toggle_protection', { ids: [id], value });
          item.protected = !!value;
          renderMedia();
          event.currentTarget.innerHTML = `${icon(value ? 'shield-off' : 'shield')} ${value ? 'Un-protect' : 'Protect asset'}`;
          toast(value ? 'Asset protected.' : 'Asset protection removed.');
        } catch (err) { toast(err.message, 'error'); }
      });
      $('#smo-inspector-duplicates')?.addEventListener('click', async (event) => {
        const target = $('#smo-duplicate-results');
        if (!target) return;
        target.hidden = false;
        target.innerHTML = '<div class="smo-usage-loading"><span class="smo-spinner"></span> Checking exact file matches…</div>';
        event.currentTarget.disabled = true;
        try {
          const data = await api('simme_media_organiser_duplicate_details', { id });
          const rows = Array.isArray(data.items) ? data.items : [];
          target.innerHTML = rows.length ? `<div class="smo-usage-head"><strong>${rows.length} exact duplicate${rows.length === 1 ? '' : 's'}</strong><span>Identical SHA-256 file contents</span></div>${rows.map((row) => `<div class="smo-duplicate-row"><div><strong>${encode(row.title || `Attachment ${row.id}`)}</strong><span>Attachment ${encode(String(row.id || ''))}</span></div><div class="smo-duplicate-row__actions">${row.url ? `<button type="button" data-duplicate-copy="${encode(row.url)}">Copy URL</button>` : ''}</div></div>`).join('')}<p>${encode(data.message || '')}</p>` : '<div class="smo-usage-empty"><strong>No other exact copies found</strong><span>The duplicate index may have changed since this card was loaded.</span></div>';
          $$('[data-duplicate-copy]', target).forEach((button) => button.addEventListener('click', async () => {
            try { await copyText(button.dataset.duplicateCopy || ''); copiedFeedback(button, 'Copy URL'); toast('Duplicate media URL copied to clipboard.'); } catch (err) { toast(err.message, 'error'); }
          }));
        } catch (err) { target.innerHTML = `<div class="smo-usage-empty is-error">${encode(err.message)}</div>`; }
        finally { event.currentTarget.disabled = false; }
      });
      $('#smo-open-studio-from-inspector')?.addEventListener('click', () => openStudio(id));
      $('#smo-save-media')?.addEventListener('click', saveInspector);
      $('#smo-cancel-edit')?.addEventListener('click', closeInspector);
      panel.classList.add('is-open');
      panel.setAttribute('aria-hidden', 'false');
      if (item.kind === 'image') loadInspectorStudioVersions(item);
      if (options.focusVersions && item.kind === 'image') {
        window.setTimeout(() => {
          const content = $('#smo-inspector-content');
          const section = $('.smo-inspector-studio-section', content);
          if (content && section) content.scrollTo({ top: Math.max(0, section.offsetTop - 12), behavior: 'smooth' });
        }, 80);
      }
    };

    const closeInspector = () => {
      const panel = $('#smo-inspector');
      panel.classList.remove('is-open');
      panel.setAttribute('aria-hidden', 'true');
      state.inspectorItem = null;
    };

    const saveInspector = async () => {
      const item = state.inspectorItem;
      if (!item) return;
      try {
        await api('simme_media_organiser_save_media', {
          id: item.id,
          title: $('#smo-edit-title').value,
          alt: $('#smo-edit-alt').value,
          caption: $('#smo-edit-caption').value,
          description: $('#smo-edit-description').value,
          folder_id: $('#smo-edit-folder').value
        });
        closeInspector();
        toast(SIMME_MEDIA_ORGANISER_DATA.strings.saveSuccess);
        await load();
      } catch (err) { toast(err.message, 'error'); }
    };

    const openFolderModal = () => {
      // Folder creation is launched from the Library drawer on every screen size.
      // Close that drawer first so it cannot obscure or compete with the modal.
      if (appShell?.classList.contains('is-nav-open')) closeLibraryNav();
      renderFolderDropdowns();
      $('#smo-folder-name').value = '';
      $('#smo-folder-colour').value = '#8c5cff';
      if (currentFolderId()) $('#smo-folder-parent').value = String(currentFolderId());
      const modal = $('#smo-folder-modal');
      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden', 'false');
      setTimeout(() => $('#smo-folder-name').focus(), 20);
    };

    const closeFolderModal = () => {
      const modal = $('#smo-folder-modal');
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
    };

    const createFolder = async () => {
      const name = $('#smo-folder-name').value.trim();
      if (!name) return toast('Please enter a folder name.', 'error');
      try {
        const data = await api('simme_media_organiser_create_folder', {
          name,
          parent: $('#smo-folder-parent').value,
          colour: $('#smo-folder-colour').value
        });
        state.folders = data.folders || [];
        const createdId = Number(data.folder || 0);
        const createdFromBulkPicker = state.bulkFolderCreateContext;
        state.bulkFolderCreateContext = false;
        closeFolderModal();
        renderFolders();
        renderFolderDropdowns();
        if (createdFromBulkPicker && createdId) {
          const created = findFolder(state.folders, createdId);
          setBulkFolderDestination(createdId, created ? created.name : name, created ? (created.colour || '') : $('#smo-folder-colour')?.value || '');
          toast('Virtual folder created and selected as the destination.');
        } else {
          toast('Folder created. Nothing on disk was moved.');
        }
      } catch (err) { toast(err.message, 'error'); }
    };

    const formatUploadEta = (seconds) => {
      if (!Number.isFinite(seconds) || seconds <= 0) return '';
      if (seconds < 5) return 'a few seconds left';
      if (seconds < 60) return `~${Math.ceil(seconds)}s left`;
      if (seconds < 3600) return `~${Math.ceil(seconds / 60)} min left`;
      return '';
    };

    const setUploadUi = ({ active = true, percent = 0, label = 'Uploading…', detail = '', processing = false, complete = false, error = false } = {}) => {
      const button = $('#smo-upload-button');
      const buttonLabel = $('.smo-upload-button-label', button || document);
      const progress = $('#smo-upload-progress');
      const progressFill = $('#smo-upload-progress-fill');
      const progressLabel = $('#smo-upload-progress-label');
      const progressDetail = $('#smo-upload-progress-detail');
      const progressBar = $('#smo-upload-progress-bar');
      const pct = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));

      if (button) {
        button.disabled = active && !complete;
        button.classList.toggle('is-uploading', active && !complete);
        button.classList.toggle('is-processing', processing);
        button.classList.toggle('is-upload-complete', complete);
        button.classList.toggle('is-upload-error', error);
        button.setAttribute('aria-busy', active && !complete ? 'true' : 'false');
        button.style.setProperty('--smo-upload-pct', `${pct}%`);
      }
      if (buttonLabel) buttonLabel.textContent = label;

      if (progress) {
        progress.hidden = !active && !complete && !error;
        progress.classList.toggle('is-active', active && !complete);
        progress.classList.toggle('is-processing', processing);
        progress.classList.toggle('is-complete', complete);
        progress.classList.toggle('is-error', error);
      }
      if (progressFill) progressFill.style.width = `${pct}%`;
      if (progressLabel) progressLabel.textContent = label;
      if (progressDetail) progressDetail.textContent = detail;
      if (progressBar) {
        progressBar.setAttribute('aria-valuenow', String(pct));
        progressBar.setAttribute('aria-valuetext', processing ? `${label}. Processing on the server.` : `${pct}% uploaded. ${detail}`.trim());
      }
    };

    const resetUploadUi = () => {
      const button = $('#smo-upload-button');
      const buttonLabel = $('.smo-upload-button-label', button || document);
      const progress = $('#smo-upload-progress');
      if (button) {
        button.disabled = false;
        button.classList.remove('is-uploading', 'is-processing', 'is-upload-complete', 'is-upload-error');
        button.removeAttribute('aria-busy');
        button.style.removeProperty('--smo-upload-pct');
      }
      if (buttonLabel) buttonLabel.textContent = 'Add media';
      if (progress) {
        progress.hidden = true;
        progress.classList.remove('is-active', 'is-processing', 'is-complete', 'is-error');
      }
    };

    const uploadFiles = async (files) => {
      if (!files.length) return;
      const button = $('#smo-upload-button');
      if (button && button.disabled) return;

      const folderId = currentFolderId();
      const fileCount = files.length;
      const totalBytes = files.reduce((sum, file) => sum + Math.max(Number(file.size) || 0, 1), 0);
      let completedBytes = 0;
      let done = 0;
      let failed = 0;
      const startedAt = performance.now();

      setUploadUi({ active: true, percent: 0, label: fileCount === 1 ? 'Uploading 0%' : `Uploading 1 of ${fileCount} · 0%`, detail: 'Starting upload…' });

      for (let index = 0; index < fileCount; index += 1) {
        const file = files[index];
        const fileBytes = Math.max(Number(file.size) || 0, 1);
        const position = index + 1;
        let lastLoaded = 0;

        try {
          await apiWithUploadProgress(
            'simme_media_organiser_upload_media',
            { folder_id: folderId },
            { file },
            {
              progress: (loaded, eventTotal) => {
                const currentTotal = Math.max(Number(eventTotal) || fileBytes, 1);
                const adjustedLoaded = Math.min(fileBytes, Math.max(0, (Number(loaded) || 0) * (fileBytes / currentTotal)));
                lastLoaded = adjustedLoaded;
                const overallLoaded = Math.min(totalBytes, completedBytes + adjustedLoaded);
                const percent = totalBytes ? (overallLoaded / totalBytes) * 100 : 0;
                const elapsedSeconds = Math.max((performance.now() - startedAt) / 1000, 0.001);
                const bytesPerSecond = overallLoaded / elapsedSeconds;
                const etaSeconds = bytesPerSecond > 0 && elapsedSeconds > 1.2 ? (totalBytes - overallLoaded) / bytesPerSecond : NaN;
                const eta = formatUploadEta(etaSeconds);
                const rounded = Math.max(0, Math.min(99, Math.round(percent)));
                const label = fileCount === 1 ? `Uploading ${rounded}%` : `Uploading ${position} of ${fileCount} · ${rounded}%`;
                const detail = [file.name, eta].filter(Boolean).join(' · ');
                setUploadUi({ active: true, percent: rounded, label, detail });
              },
              uploaded: () => {
                const approximatePercent = totalBytes ? ((completedBytes + fileBytes) / totalBytes) * 100 : 100;
                const label = fileCount === 1 ? 'Processing…' : `Processing ${position} of ${fileCount}…`;
                setUploadUi({
                  active: true,
                  processing: true,
                  percent: Math.max(1, Math.min(99, Math.round(approximatePercent))),
                  label,
                  detail: `${file.name} · upload received, WordPress is creating the media item`
                });
              }
            }
          );
          done += 1;
        } catch (err) {
          failed += 1;
          toast(`${file.name}: ${err.message}`, 'error', 5000);
        } finally {
          completedBytes += fileBytes;
          if (lastLoaded < fileBytes && index < fileCount - 1) {
            const percent = totalBytes ? (completedBytes / totalBytes) * 100 : 0;
            setUploadUi({ active: true, percent, label: `Uploading ${Math.min(position + 1, fileCount)} of ${fileCount}…`, detail: 'Moving to the next file…' });
          }
        }
      }

      if (failed) {
        setUploadUi({
          active: false,
          error: true,
          percent: done ? 100 : 0,
          label: done ? `${done} uploaded · ${failed} failed` : 'Upload failed',
          detail: done ? 'The successful media items are ready. Check the error message for anything that failed.' : 'No media was added. Check the error message and try again.'
        });
      } else {
        setUploadUi({
          active: false,
          complete: true,
          percent: 100,
          label: fileCount === 1 ? 'Upload complete' : `${done} files uploaded`,
          detail: 'Your media is ready in the library.'
        });
      }

      await load();
      setTimeout(resetUploadUi, failed ? 4200 : 2200);
    };

    const commandItems = () => [
      { label: 'All media', note: 'Open the complete library', run: () => { state.folder='all'; state.search=''; state.type='all'; state.alt='all'; state.page=1; syncLibraryControls(); setSmartNavActive('all'); load(); } },
      { label: 'Favourites', note: 'Show all favourites', run: toggleGlobalFavourites },
      { label: 'Missing ALT text', note: 'Accessibility clean-up', run: () => { state.folder='missing-alt'; state.type='image'; state.alt='missing'; state.page=1; syncLibraryControls(); setSmartNavActive('missing-alt'); load(); } },
      { label: 'Heavy media', note: 'Load Grade D / E', run: () => { state.folder='smart-heavy'; state.page=1; setSmartNavActive('smart-heavy'); load(); } },
      { label: 'Exact duplicates', note: 'Local checksum matches', run: () => { state.folder='smart-duplicates'; state.page=1; setSmartNavActive('smart-duplicates'); load(); } },
      { label: 'Protected assets', note: 'Deletion-protected media', run: () => { state.folder='smart-protected'; state.page=1; setSmartNavActive('smart-protected'); load(); } },
      { label: 'Image Studio assets', note: 'Items with Studio working versions', run: () => { state.folder='smart-studio'; state.page=1; setSmartNavActive('smart-studio'); load(); } },
      { label: 'Files over 1 MB', note: 'Large original files', run: () => { state.folder='smart-large'; state.page=1; setSmartNavActive('smart-large'); load(); } },
      { label: 'Broken media', note: 'Missing or unreadable source files', run: () => { state.folder='smart-broken'; state.page=1; setSmartNavActive('smart-broken'); load(); } },
      { label: 'Create folder', note: 'New virtual folder', run: openFolderModal },
      { label: 'Media Health Centre', note: 'Open local audit dashboard', href: SIMME_MEDIA_ORGANISER_DATA.healthUrl },
      { label: 'Settings', note: 'Workspace preferences', href: SIMME_MEDIA_ORGANISER_DATA.settingsUrl }
    ];
    const renderCommandResults = () => {
      const root = $('#smo-command-results'); const input = $('#smo-command-input'); if (!root || !input) return;
      const query = input.value.trim().toLowerCase();
      const commands = commandItems().filter((item) => !query || `${item.label} ${item.note}`.toLowerCase().includes(query));
      const mediaAction = query.length >= 2 ? `<button type="button" class="smo-command-result is-search" data-command-search="${encode(input.value.trim())}">${icon('search')}<span><strong>Search media for “${encode(input.value.trim())}”</strong><small>Run this search across the media library</small></span></button>` : '';
      root.innerHTML = mediaAction + commands.map((item, index) => `<button type="button" class="smo-command-result" data-command-index="${index}">${icon(index < 6 ? 'smart' : 'command')}<span><strong>${encode(item.label)}</strong><small>${encode(item.note)}</small></span></button>`).join('');
      $('[data-command-search]', root)?.addEventListener('click', (e) => { state.folder='all'; state.search=e.currentTarget.dataset.commandSearch || ''; state.page=1; syncLibraryControls(); closeCommand(); load(); });
      $$('[data-command-index]', root).forEach((button) => button.addEventListener('click', () => { if (button.disabled) return; const item=commands[Number(button.dataset.commandIndex)]; if (!item) return; closeCommand(); if (item.href) window.location.href=item.href; else item.run?.(); }));
    };
    const openCommand = () => { const modal=$('#smo-command-modal'); if (!modal) return; modal.classList.add('is-open'); modal.setAttribute('aria-hidden','false'); const input=$('#smo-command-input'); input.value=''; renderCommandResults(); setTimeout(()=>input.focus(),20); };
    const closeCommand = () => { const modal=$('#smo-command-modal'); if (!modal) return; modal.classList.remove('is-open'); modal.setAttribute('aria-hidden','true'); };

    let searchTimer;
    search.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => { state.search = search.value.trim(); state.page = 1; load(); }, 250);
    });
    typeFilter.addEventListener('change', () => { state.type = typeFilter.value; state.page = 1; syncFileTypeFilter(); closeFileTypeFilter(); load(); });
    typeFilterTrigger?.addEventListener('click', () => {
      if (!typeFilterMenu) return;
      if (typeFilterMenu.hidden) openFileTypeFilter(); else closeFileTypeFilter({ restoreFocus: true });
    });
    typeFilterOptions.forEach((option) => option.addEventListener('click', () => {
      const value = String(option.dataset.typeValue || 'all');
      if (typeFilter.value !== value) {
        typeFilter.value = value;
        typeFilter.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        syncFileTypeFilter();
        closeFileTypeFilter({ restoreFocus: true });
      }
    }));
    document.addEventListener('pointerdown', (event) => {
      if (!typeFilterShell || typeFilterMenu?.hidden) return;
      if (!typeFilterShell.contains(event.target)) closeFileTypeFilter();
    });
    typeFilterShell?.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeFileTypeFilter({ restoreFocus: true });
        return;
      }
      if (!typeFilterMenu || typeFilterMenu.hidden || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const enabled = typeFilterOptions.filter((option) => !option.disabled);
      if (!enabled.length) return;
      const current = Math.max(0, enabled.indexOf(document.activeElement));
      let next = current;
      if (event.key === 'ArrowDown') next = (current + 1) % enabled.length;
      if (event.key === 'ArrowUp') next = (current - 1 + enabled.length) % enabled.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = enabled.length - 1;
      enabled[next]?.focus();
    });
    syncFileTypeFilter();
    altFilter.addEventListener('change', () => { state.alt = altFilter.value; state.page = 1; load(); });
    sort.addEventListener('change', () => { state.sort = sort.value; state.preferCustomPositioning = state.sort === 'custom'; state.page = 1; load(); });
    prevButtons.forEach((button) => button.addEventListener('click', () => {
      if (state.page > 1) { state.page -= 1; load(); }
    }));
    nextButtons.forEach((button) => button.addEventListener('click', () => {
      if (state.page < state.pages) { state.page += 1; load(); }
    }));

    $$('.smo-nav-item').forEach((button) => button.addEventListener('click', () => {
      closeLibraryNav();
      if (button.dataset.folder === 'favourites') {
        toggleGlobalFavourites();
        return;
      }
      state.preFavouritesView = null;
      state.favouriteOnly = false;
      setSmartNavActive(button.dataset.folder);
      state.folder = button.dataset.folder;
      if (state.folder === 'missing-alt') {
        state.type = 'image';
        state.alt = 'missing';
      } else if (state.folder === 'trash') {
        state.type = 'all';
        state.alt = 'all';
      } else {
        state.type = typeFilter.value || 'all';
        state.alt = altFilter.value || 'all';
      }
      syncLibraryControls();
      state.page = 1;
      load();
    }));

    $$('.smo-view-switcher button').forEach((button) => button.addEventListener('click', () => {
      state.view = button.dataset.view;
      localStorage.setItem('smo_view', state.view);
      persistLibraryWorkspace();
      renderMedia();
    }));

    rangeToggle?.addEventListener('click', () => {
      state.rangeSelectEnabled = !state.rangeSelectEnabled;
      localStorage.setItem('smo_range_select_enabled', state.rangeSelectEnabled ? '1' : '0');
      // Keep the user's current selection, but clear the range anchor so switching
      // modes can never unexpectedly extend an old range.
      state.selectionAnchorId = null;
      state.rangeComplete = false;
      updateRangeToggle();
      toast(state.rangeSelectEnabled ? 'Range Select turned on.' : 'Range Select turned off.');
    });

    selectAll.addEventListener('change', () => {
      if (selectAll.checked) {
        state.items.forEach((i) => state.selected.add(Number(i.id)));
        state.selectionAnchorId = state.items.length ? Number(state.items[0].id) : null;
        state.rangeComplete = true;
      } else {
        state.selected.clear();
        state.selectionAnchorId = null;
        state.rangeComplete = false;
      }
      renderMedia();
      updateBulk();
    });

    $$('.smo-clear-selection-control').forEach((button) => button.addEventListener('click', () => {
      if (!state.selected.size) return;
      state.selected.clear();
      state.selectionAnchorId = null;
      state.rangeComplete = false;
      renderMedia();
      updateBulk();
      toast('Selection cleared.');
    }));
    $('#smo-bulk-folder-trigger')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const menu = $('#smo-bulk-folder-menu');
      const trigger = $('#smo-bulk-folder-trigger');
      if (!menu || !trigger) return;
      const opening = menu.hidden;
      menu.hidden = !opening;
      trigger.setAttribute('aria-expanded', opening ? 'true' : 'false');
      trigger.classList.toggle('is-open', opening);
    });
    $('#smo-bulk-folder-menu')?.addEventListener('click', (e) => e.stopPropagation());
    $('#smo-bulk-folder-create')?.addEventListener('click', () => {
      state.bulkFolderCreateContext = true;
      closeBulkFolderPicker();
      openFolderModal();
    });
    document.addEventListener('click', closeBulkFolderPicker);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeBulkFolderPicker(); });

    $('#smo-bulk-move').addEventListener('click', async () => {
      const value = $('#smo-bulk-folder').value;
      if (value === '') return toast('Choose a destination folder first.', 'error');
      await moveItems(Array.from(state.selected), Number(value));
    });
    const setBulkFavourite = async (value) => {
      const selectedIds = new Set(Array.from(state.selected).map(Number));
      const ids = state.items
        .filter((item) => selectedIds.has(Number(item.id)) && (!!item.favourite !== !!value))
        .map((item) => Number(item.id));
      if (!ids.length) return toast(value ? 'Every selected item is already a favourite.' : 'None of the selected items are favourites.');
      try {
        await api('simme_media_organiser_toggle_favourite', { ids, value: value ? 1 : 0 });
        state.items.forEach((item) => { if (ids.includes(Number(item.id))) item.favourite = !!value; });
        toast(value ? `${ids.length} selected item${ids.length === 1 ? '' : 's'} added to favourites.` : `${ids.length} selected item${ids.length === 1 ? '' : 's'} removed from favourites.`);
        if (state.folder === 'favourites' && !value) {
          await load();
        } else {
          renderMedia();
          syncSelectionUI();
          updateBulk();
        }
      } catch (err) { toast(err.message, 'error'); }
    };
    $('#smo-bulk-favourite')?.addEventListener('click', async () => setBulkFavourite(true));
    $('#smo-bulk-unfavourite')?.addEventListener('click', async () => setBulkFavourite(false));
    const setBulkProtection = async (value) => {
      const selectedIds = new Set(Array.from(state.selected).map(Number));
      const ids = state.items
        .filter((item) => selectedIds.has(Number(item.id)) && (!!item.protected !== !!value))
        .map((item) => Number(item.id));
      if (!ids.length) return toast(value ? 'Every selected asset is already protected.' : 'None of the selected assets are protected.');
      try {
        await api('simme_media_organiser_toggle_protection', { ids, value: value ? 1 : 0 });
        state.items.forEach((item) => { if (ids.includes(Number(item.id))) item.protected = !!value; });
        toast(value ? `${ids.length} selected asset${ids.length === 1 ? '' : 's'} protected.` : `${ids.length} selected asset${ids.length === 1 ? '' : 's'} un-protected.`);
        if (state.folder === 'smart-protected' && !value) {
          await load();
        } else {
          renderMedia();
          syncSelectionUI();
          updateBulk();
        }
      } catch (err) { toast(err.message, 'error'); }
    };
    $('#smo-bulk-protect')?.addEventListener('click', async () => setBulkProtection(true));
    $('#smo-bulk-unprotect')?.addEventListener('click', async () => setBulkProtection(false));
    $('#smo-bulk-trash')?.addEventListener('click', async () => trashSelectedItems(Array.from(state.selected)));
    $('#smo-bulk-restore')?.addEventListener('click', async () => restoreTrashItems(Array.from(state.selected)));
    $('#smo-bulk-trash-timer')?.addEventListener('click', () => openTrashTimer(Array.from(state.selected)));
    $('#smo-bulk-purge')?.addEventListener('click', async () => purgeTrashItems(Array.from(state.selected)));
    $('#smo-trash-purge-ready')?.addEventListener('click', purgeReadyTrash);
    $('#smo-bulk-url-download')?.addEventListener('click', downloadSelectedUrls);
    let currentTitleResizeTimer = 0;
    window.addEventListener('resize', () => {
      window.clearTimeout(currentTitleResizeTimer);
      currentTitleResizeTimer = window.setTimeout(() => {
        const title = $('#smo-current-title');
        const text = $('#smo-current-title-text');
        if (!title || !text || !title.classList.contains('is-folder-title')) return;
        title.classList.remove('is-overflowing');
        title.style.removeProperty('--smo-title-scroll-distance');
        window.requestAnimationFrame(() => {
          const overflow = Math.ceil(text.scrollWidth - title.clientWidth);
          if (overflow > 4) {
            title.style.setProperty('--smo-title-scroll-distance', `${overflow + 6}px`);
            title.classList.add('is-overflowing');
          }
        });
      }, 100);
    });

    const currentFolderRenameButton = $('#smo-current-folder-rename');
    const currentFolderRenameForm = $('#smo-current-folder-rename-form');
    const currentFolderRenameInput = $('#smo-current-folder-rename-input');
    const currentFolderRenameSave = $('#smo-current-folder-rename-save');
    const currentFolderRenameCancel = $('#smo-current-folder-rename-cancel');

    const closeCurrentFolderRename = ({ restoreFocus = false } = {}) => {
      const titleRow = currentFolderRenameForm?.closest('.smo-current-title-row');
      titleRow?.classList.remove('is-renaming');
      if (currentFolderRenameForm) currentFolderRenameForm.hidden = true;
      if (currentFolderRenameButton && /^\d+$/.test(String(state.folder || ''))) currentFolderRenameButton.hidden = false;
      if (restoreFocus) currentFolderRenameButton?.focus({ preventScroll: true });
    };

    const openCurrentFolderRename = () => {
      if (!/^\d+$/.test(String(state.folder || ''))) return;
      const folder = findFolder(state.folders, Number(state.folder));
      if (!folder || !currentFolderRenameForm || !currentFolderRenameInput) return;
      currentFolderRenameInput.value = folder.name || '';
      currentFolderRenameButton.hidden = true;
      currentFolderRenameForm.hidden = false;
      currentFolderRenameForm.closest('.smo-current-title-row')?.classList.add('is-renaming');
      window.requestAnimationFrame(() => {
        currentFolderRenameInput.focus({ preventScroll: true });
        currentFolderRenameInput.select();
      });
    };

    const saveCurrentFolderRename = async () => {
      if (!/^\d+$/.test(String(state.folder || ''))) return closeCurrentFolderRename();
      const folder = findFolder(state.folders, Number(state.folder));
      const name = String(currentFolderRenameInput?.value || '').trim();
      if (!folder) return closeCurrentFolderRename();
      if (!name) {
        toast('Enter a folder name before saving.', 'error');
        currentFolderRenameInput?.focus();
        return;
      }
      if (name === folder.name) return closeCurrentFolderRename({ restoreFocus: true });
      const originalSaveHtml = currentFolderRenameSave?.innerHTML || '';
      if (currentFolderRenameSave) {
        currentFolderRenameSave.disabled = true;
        currentFolderRenameSave.innerHTML = `${icon('history')}<span>Saving…</span>`;
      }
      try {
        const data = await api('simme_media_organiser_update_folder', {
          term_id: folder.id,
          name,
          parent: folder.parent || 0,
          colour: folder.colour || ''
        });
        state.folders = data.folders || state.folders;
        renderFolders();
        renderFolderDropdowns();
        closeCurrentFolderRename();
        toast('Folder renamed. Media files and public URLs were not changed.');
        await load();
      } catch (err) {
        toast(err.message, 'error', 6000);
        currentFolderRenameInput?.focus();
      } finally {
        if (currentFolderRenameSave) {
          currentFolderRenameSave.disabled = false;
          currentFolderRenameSave.innerHTML = originalSaveHtml;
        }
      }
    };

    currentFolderRenameButton?.addEventListener('click', openCurrentFolderRename);
    currentFolderRenameSave?.addEventListener('click', saveCurrentFolderRename);
    currentFolderRenameCancel?.addEventListener('click', () => closeCurrentFolderRename({ restoreFocus: true }));
    currentFolderRenameInput?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') { event.preventDefault(); saveCurrentFolderRename(); }
      if (event.key === 'Escape') { event.preventDefault(); closeCurrentFolderRename({ restoreFocus: true }); }
    });

    removeCustomPositioningButton?.addEventListener('click', async () => {
      if (!state.customPositioning) return;
      const currentName = ($('#smo-current-path')?.textContent || 'this view').trim();
      const first = await simmeConfirm({
        title: `Remove custom positioning from ${currentName}?`,
        message: 'This will forget the manual order you created for these media cards and return this view to automatic sorting.',
        note: 'No media files, URLs, folders, favourites or metadata will be changed. The saved card arrangement itself cannot be restored automatically after removal.',
        confirmLabel: 'Continue',
        tone: 'warning'
      });
      if (!first) return;
      const second = await simmeConfirm({
        title: 'Return to automatic positioning?',
        message: 'Remove the saved custom card positions now?',
        note: 'This is the final safety gate. Your media remains untouched; only the remembered visual order is removed.',
        confirmLabel: 'Remove Custom Positioning',
        tone: 'danger'
      });
      if (!second) return;
      try {
        await api('simme_media_organiser_reset_media_order', { folder: state.folder });
        state.customPositioning = false;
        state.preferCustomPositioning = false;
        state.sort = 'date_desc';
        state.page = 1;
        updateCustomPositioningControls();
        updateFilterClearState();
        persistLibraryWorkspace();
        toast('Custom positioning removed. Automatic media order restored.');
        await load();
      } catch (err) {
        toast(err.message, 'error', 5200);
      }
    });

    $('#smo-folder-tree')?.addEventListener('scroll', (event) => {
      lastKnownFolderTreeScroll = Math.max(0, Number(event.currentTarget.scrollTop || 0));
    }, { passive: true });
    window.addEventListener('pagehide', persistLibraryWorkspace);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') persistLibraryWorkspace();
    });

    window.addEventListener('resize', positionBulkbar, { passive: true });
    window.addEventListener('resize', () => { if (state.studioFocusCanvas) syncFocusCanvasImage(); }, { passive: true });
    if (window.ResizeObserver) {
      const bulkbarResizeObserver = new ResizeObserver(positionBulkbar);
      const libraryPanel = $('.smo-library', wrap);
      if (libraryPanel) bulkbarResizeObserver.observe(libraryPanel);
    }
    updateFilterClearState();

    $('#smo-new-folder')?.addEventListener('click', openFolderModal);
    $('#smo-create-folder-submit')?.addEventListener('click', createFolder);
    $$('[data-close-modal]').forEach((el) => el.addEventListener('click', closeFolderModal));
    $$('[data-studio-close]').forEach((el) => el.addEventListener('click', closeStudio));
    $('#smo-alt-save')?.addEventListener('click', saveAltEditor);
    $('#smo-alt-cancel')?.addEventListener('click', closeAltEditor);
    $('#smo-alt-close')?.addEventListener('click', closeAltEditor);
    $('#smo-alt-cancel-scrim')?.addEventListener('click', closeAltEditor);
    $('#smo-alt-input')?.addEventListener('input', (e) => { const count = $('#smo-alt-char-count'); if (count) count.textContent = String(e.target.value.length); });
    $('#smo-alt-input')?.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); saveAltEditor(); }
    });
    $('#smo-inspector-close')?.addEventListener('click', closeInspector);
    $('#smo-upload-button')?.addEventListener('click', () => $('#smo-upload-input')?.click());
    $('#smo-upload-input')?.addEventListener('change', (e) => { uploadFiles(Array.from(e.target.files || [])); e.target.value = ''; });
    favouritesToggle?.addEventListener('click', toggleGlobalFavourites);

    $('#smo-command-open')?.addEventListener('click', openCommand);
    $('#smo-command-input')?.addEventListener('input', renderCommandResults);
    $$('[data-command-close]').forEach((el) => el.addEventListener('click', closeCommand));

    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openCommand(); return; }
      if (e.key === 'Escape') {
        if (closeVersionQuickLook()) { e.preventDefault(); return; }
        closeCommand();
        if ($('#smo-confirm-dialog')?.classList.contains('is-open')) { closeSimmeConfirm(false); return; }
        const studioModal = $('#smo-image-studio');
        const versionsWorkspace = $('.smo-studio-workspace');
        if (versionsWorkspace?.classList.contains('is-versions-drawer') && versionsWorkspace.classList.contains('is-versions-open')) {
          $('#smo-studio-versions-drawer-close')?.click();
          e.preventDefault();
          return;
        }
        if (studioModal?.classList.contains('is-focus-canvas')) {
          setFocusCanvas(false);
          return;
        }
        closeAltEditor(); closeInspector(); closeFolderModal(); closeStudio();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
        e.preventDefault();
        state.items.forEach((i) => state.selected.add(Number(i.id)));
        state.selectionAnchorId = state.items.length ? Number(state.items[0].id) : null;
        state.rangeComplete = true;
        renderMedia(); updateBulk();
      }
    });

    updateRangeToggle();
    initHelp();
    renderFolders();
    renderFolderDropdowns();
    syncLibraryControls();
    if (initialView) setSmartNavActive(initialView);
    else if (restoredWorkspace) setSmartNavActive(state.folder);
    load();
  };

  const healthCentre = () => {
    const wrap = $('[data-smo-screen="health"]');
    if (!wrap) return;
    let latestSummary = {};
    let scanning = false;

    const updateSummary = (summary = {}) => {
      latestSummary = summary || {};
      const setText = (selector, value) => { const node = $(selector); if (node) node.textContent = String(value ?? ''); };
      setText('#smo-health-missing-alt', Number(summary.missingAlt || 0));
      setText('#smo-health-heavy', Number(summary.heavy || 0));
      setText('#smo-health-duplicates', Number(summary.duplicateItems || 0));
      setText('#smo-health-broken', Number(summary.broken || 0));
      setText('#smo-health-unfiled', Number(summary.unfiled || 0));
      setText('#smo-storage-total', summary.storage?.totalLabel || '0 B');
      setText('#smo-storage-original', summary.storage?.originalLabel || '0 B');
      setText('#smo-storage-derivatives', summary.storage?.derivativesLabel || '0 B');
      setText('#smo-storage-studio', summary.storage?.studioLabel || '0 B');
      setText('#smo-health-score strong', Number(summary.score || 0));
      setText('#smo-health-scan-state', `${Number(summary.scanned || 0)} of ${Number(summary.total || 0)} indexed`);
      const bar = $('#smo-health-progress-bar');
      if (bar) bar.style.width = `${Math.min(100, Math.max(0, Number(summary.scanPercent || 0)))}%`;
      const typeRoot = $('#smo-storage-by-type');
      if (typeRoot) {
        const labels = { image: 'Images', video: 'Video', audio: 'Audio', document: 'Documents', other: 'Other' };
        const rows = Array.isArray(summary.storage?.byType) ? summary.storage.byType : [];
        typeRoot.innerHTML = rows.length ? rows.map((row) => `<div><span>${encode(labels[row.type] || row.type || 'Other')} <small>${Number(row.items || 0)} item${Number(row.items || 0) === 1 ? '' : 's'}</small></span><strong>${encode(row.label || '0 B')}</strong></div>`).join('') : '<span class="smo-storage-empty">Run a Health scan to build storage detail.</span>';
      }
      const largestRoot = $('#smo-storage-largest');
      if (largestRoot) {
        const rows = Array.isArray(summary.storage?.largest) ? summary.storage.largest : [];
        largestRoot.innerHTML = rows.length ? rows.map((row) => `<button type="button" data-health-asset="${Number(row.id || 0)}"><span><strong>${encode(row.title || `Attachment ${row.id}`)}</strong><small>${encode(row.folder || 'Unfiled')}</small></span><b>${encode(row.label || '0 B')}</b></button>`).join('') : '<span class="smo-storage-empty">No indexed media yet.</span>';
        $$('[data-health-asset]', largestRoot).forEach((button) => button.addEventListener('click', () => {
          window.location.href = `${SIMME_MEDIA_ORGANISER_DATA.libraryUrl}&search=${encodeURIComponent(button.querySelector('strong')?.textContent || '')}`;
        }));
      }
    };

    const renderRecommendations = (summary = {}) => {
      const root = $('#smo-health-recommendations');
      if (!root) return;
      const actions = [];
      if (Number(summary.broken || 0) > 0) actions.push({ tone: 'danger', title: `${Number(summary.broken)} broken media item${Number(summary.broken) === 1 ? '' : 's'}`, text: 'Source files are missing or unreadable. Review these before other housekeeping.', view: 'smart-broken' });
      if (Number(summary.missingAlt || 0) > 0) actions.push({ tone: 'amber', title: `${Number(summary.missingAlt)} image${Number(summary.missingAlt) === 1 ? '' : 's'} missing ALT text`, text: 'Use the rapid ALT editor to work through accessibility gaps quickly.', view: 'missing-alt' });
      if (Number(summary.heavy || 0) > 0) actions.push({ tone: 'violet', title: `${Number(summary.heavy)} heavy media item${Number(summary.heavy) === 1 ? '' : 's'}`, text: 'Load Grade D/E files are worth reviewing for Image Studio optimisation.', view: 'smart-heavy' });
      if (Number(summary.duplicateItems || 0) > 0) actions.push({ tone: 'blue', title: `${Number(summary.duplicateItems)} exact-duplicate item${Number(summary.duplicateItems) === 1 ? '' : 's'}`, text: 'Compare exact file matches and protection before deciding what to keep.', view: 'smart-duplicates' });
      if (Number(summary.unfiled || 0) > 0) actions.push({ tone: 'lime', title: `${Number(summary.unfiled)} unfiled media item${Number(summary.unfiled) === 1 ? '' : 's'}`, text: 'Virtual folders can make these assets easier to find without changing their physical URLs.', view: 'unfiled' });
      if (!actions.length) actions.push({ tone: 'good', title: 'Nothing urgent is standing out', text: 'The indexed library currently has no high-priority issues in the main local Health checks.', view: 'all' });
      root.innerHTML = actions.slice(0, 6).map((item) => `<button type="button" class="smo-health-recommendation is-${item.tone}" data-health-view="${encode(item.view)}"><span class="smo-health-recommendation__dot"></span><div><strong>${encode(item.title)}</strong><span>${encode(item.text)}</span></div>${icon('chevron')}</button>`).join('');
      $$('[data-health-view]', root).forEach((button) => button.addEventListener('click', () => {
        window.location.href = `${SIMME_MEDIA_ORGANISER_DATA.libraryUrl}${SIMME_MEDIA_ORGANISER_DATA.libraryUrl.includes('?') ? '&' : '?'}view=${encodeURIComponent(button.dataset.healthView || 'all')}`;
      }));
    };

    const renderActivity = (activity = []) => {
      const root = $('#smo-health-activity');
      if (!root) return;
      if (!activity.length) {
        root.innerHTML = '<div class="smo-activity-empty">No Simme Media actions have been recorded yet.</div>';
        return;
      }
      root.innerHTML = activity.map((row) => `<article class="smo-activity-row ${row.undone ? 'is-undone' : ''}"><div class="smo-activity-dot"></div><div><strong>${encode(row.summary || row.action_key)}</strong><span>${encode(row.when || '')}${row.attachment_id ? ` · attachment ${Number(row.attachment_id)}` : ''}${row.undone ? ' · undone' : ''}</span></div>${row.undoable && !row.undone ? `<button type="button" class="smo-activity-undo" data-undo-activity="${Number(row.id)}">Undo</button>` : ''}</article>`).join('');
      $$('[data-undo-activity]', root).forEach((button) => button.addEventListener('click', async () => {
        button.disabled = true;
        try {
          const data = await api('simme_media_organiser_undo_activity', { id: button.dataset.undoActivity });
          toast(data.message || 'Action undone.');
          await refresh();
        } catch (err) { toast(err.message, 'error'); }
        finally { button.disabled = false; }
      }));
    };

    const refresh = async () => {
      try {
        const data = await api('simme_media_organiser_health_summary');
        updateSummary(data.summary || {});
        renderRecommendations(data.summary || {});
        renderActivity(data.activity || []);
      } catch (err) { toast(err.message, 'error'); }
    };

    const runScan = async () => {
      if (scanning) return;
      scanning = true;
      const button = $('#smo-health-scan');
      if (button) button.disabled = true;
      let offset = 0;
      let total = 0;
      try {
        do {
          const data = await api('simme_media_organiser_scan_batch', { offset, limit: 8 });
          offset = Number(data.offset || data.next || 0);
          total = Number(data.summary?.total || data.total || 0);
          updateSummary(data.summary || {});
          renderRecommendations(data.summary || {});
          if (data.done) break;
          await new Promise((resolve) => setTimeout(resolve, 70));
        } while (true);
        toast('Library Index refresh complete.', 'success', 4200);
        await refresh();
      } catch (err) { toast(err.message, 'error', 6000); }
      finally { scanning = false; if (button) button.disabled = false; }
    };

    $('#smo-health-scan')?.addEventListener('click', runScan);
    updateSummary(SIMME_MEDIA_ORGANISER_DATA.healthSummary || {});
    refresh();
  };

  const proPromotion = () => {
    const openButtons = $$('#smo-pro-open,[data-smo-pro-open]');
    const dialog = $('#smo-pro-dialog');
    if (!openButtons.length || !dialog) return;

    const closeButtons = $$('[data-smo-pro-close]', dialog);
    const card = $('.smo-pro-card', dialog);
    let previousFocus = null;

    const focusable = () => $$('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])', card || dialog)
      .filter((el) => !el.hidden && el.offsetParent !== null);

    const close = () => {
      if (dialog.hidden) return;
      dialog.hidden = true;
      document.documentElement.classList.remove('smo-pro-dialog-open');
      document.body.classList.remove('smo-pro-dialog-open');
      if (previousFocus && previousFocus.isConnected && typeof previousFocus.focus === 'function') previousFocus.focus();
      previousFocus = null;
    };

    const open = (trigger) => {
      if (!dialog.hidden) return;
      previousFocus = trigger || document.activeElement;
      dialog.hidden = false;
      document.documentElement.classList.add('smo-pro-dialog-open');
      document.body.classList.add('smo-pro-dialog-open');
      const targets = focusable();
      (targets[0] || card || dialog).focus?.();
    };

    openButtons.forEach((button) => button.addEventListener('click', () => open(button)));
    closeButtons.forEach((button) => button.addEventListener('click', close));

    dialog.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== 'Tab') return;
      const targets = focusable();
      if (!targets.length) {
        event.preventDefault();
        return;
      }
      const first = targets[0];
      const last = targets[targets.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
  };

  const nonLibraryHelp = () => {
    const wrap = $('[data-smo-screen]');
    if (!wrap || wrap.dataset.smoScreen === 'library') return;

    const toggle = $('#smo-help-toggle', wrap);
    const panel = $('#smo-help-panel', wrap);
    const titleNode = $('#smo-help-title', wrap);
    const textNode = $('#smo-help-text', wrap);
    if (!toggle || !panel || !titleNode || !textNode) return;

    let enabled = localStorage.getItem('smo_help_enabled') !== '0';
    let activeTarget = null;
    let timer = 0;
    let pointerX = 0;
    let pointerY = 0;
    const delay = 850;

    const updateToggle = () => {
      toggle.classList.toggle('is-active', enabled);
      toggle.setAttribute('aria-pressed', enabled ? 'true' : 'false');
      const label = toggle.querySelector('span');
      if (label) label.textContent = enabled ? 'Help: On' : 'Help: Off';
    };

    const clearTimer = () => {
      if (timer) window.clearTimeout(timer);
      timer = 0;
    };

    const hide = () => {
      clearTimer();
      activeTarget = null;
      panel.classList.remove('is-visible');
      panel.hidden = true;
    };

    const helpCopyFor = (target) => {
      const explicitTitle = target.getAttribute('data-help-title') || '';
      const explicitText = target.getAttribute('data-help-text') || '';
      if (explicitTitle || explicitText) return { title: explicitTitle || 'Help', text: explicitText || 'This area is part of the Simme Media Organiser workflow.' };

      const label = target.closest('label');
      const panelParent = target.closest('.smo-panel,.smo-health-card,.smo-health-scan-lane');
      const heading = panelParent?.querySelector('h2,strong')?.textContent?.trim() || '';
      const labelText = label?.querySelector('span,strong')?.textContent?.trim() || '';
      const ownText = target.getAttribute('aria-label') || target.textContent?.replace(/\s+/g, ' ').trim() || '';
      const title = labelText || ownText || heading || 'Help';
      let text = 'This control is part of the Simme Media Organiser workflow.';
      if (target.matches('select,input:not([type="button"]):not([type="submit"]),textarea')) text = `Adjust ${title} for this area. Your change is only applied when the relevant action or settings form is saved.`;
      else if (target.matches('button,a[href]')) text = heading ? `Use this control within ${heading}.` : 'Use this control to continue this part of the Simme Media Organiser workflow.';
      else if (panelParent === target || target.matches('.smo-panel,.smo-health-card,.smo-health-scan-lane')) text = `This section explains and controls ${title}.`;
      return { title, text };
    };

    const position = (target, x, y) => {
      if (panel.hidden || !enabled) return;
      const edge = 12;
      const gap = 14;
      const vw = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
      const vh = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
      const tr = target?.isConnected ? target.getBoundingClientRect() : null;
      const helpBoundary = wrap.querySelector('.smo-page-frame') || wrap;
      const boundaryRect = helpBoundary && helpBoundary.isConnected ? helpBoundary.getBoundingClientRect() : wrap.getBoundingClientRect();
      const bounds = {
        left: Math.max(edge, Math.round(boundaryRect.left + edge)),
        top: Math.max(edge, Math.round(boundaryRect.top + edge)),
        right: Math.min(vw - edge, Math.round(boundaryRect.right - edge)),
        bottom: Math.min(vh - edge, Math.round(boundaryRect.bottom - edge))
      };
      panel.style.left = `${bounds.left}px`;
      panel.style.top = `${bounds.top}px`;
      panel.style.right = 'auto';
      panel.style.bottom = 'auto';
      const mr = panel.getBoundingClientRect();
      const width = mr.width || 250;
      const height = mr.height || 90;
      const leftMax = Math.max(bounds.left, bounds.right - width);
      const topMax = Math.max(bounds.top, bounds.bottom - height);
      const clamp = (v,min,max) => Math.min(Math.max(v,min),max);
      const makeRect = (left,top) => ({left,top,right:left+width,bottom:top+height});
      const overlap = (a,b) => Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
      const obstacles = Array.from(wrap.querySelectorAll('.smo-brandbar,.smo-brand-tabs-deck,.smo-page-help-tools,.smo-panel,.smo-health-card,.smo-health-scan-lane,.smo-rule-panel,button,a[href],input:not([type="hidden"]),select,textarea')).filter((el) => {
        if (!el.isConnected || el === panel || el === target || (target && target.contains(el)) || el.contains(panel)) return false;
        const r=el.getBoundingClientRect(), cs=getComputedStyle(el);
        return cs.display!=='none' && cs.visibility!=='hidden' && r.width>2 && r.height>2 && r.bottom>bounds.top && r.right>bounds.left && r.top<bounds.bottom && r.left<bounds.right;
      }).map((el)=>el.getBoundingClientRect());
      const candidates=[];
      if (tr) candidates.push(
        {p:'right',l:tr.right+gap,t:tr.top+(tr.height-height)/2,d:0},
        {p:'left',l:tr.left-width-gap,t:tr.top+(tr.height-height)/2,d:0},
        {p:'below',l:tr.left+(tr.width-width)/2,t:tr.bottom+gap,d:0},
        {p:'above',l:tr.left+(tr.width-width)/2,t:tr.top-height-gap,d:0}
      );
      candidates.push(
        {p:'safe',l:bounds.left,t:bounds.bottom-height,d:600},
        {p:'safe',l:bounds.right-width,t:bounds.top,d:600},
        {p:'safe',l:bounds.right-width,t:bounds.bottom-height,d:650},
        {p:'safe',l:bounds.left,t:bounds.top,d:650}
      );
      const ranked=candidates.map((c)=>{
        const l=clamp(c.l,bounds.left,leftMax);
        const t=clamp(c.t,bounds.top,topMax);
        const rect=makeRect(l,t);
        let score=c.d || 0;
        if (tr) score += overlap(rect,tr)*100000;
        obstacles.forEach((o)=>{score += overlap(rect,o);});
        return {...c,l,t,score};
      }).sort((a,b)=>a.score-b.score);
      const best=ranked[0] || {p:'safe',l:bounds.left,t:bounds.top};
      panel.dataset.helpPlacement=best.p;
      panel.style.left=`${Math.round(best.l)}px`;
      panel.style.top=`${Math.round(best.t)}px`;
    };

    const show = (target) => {
      if (!enabled || !target?.isConnected) return;
      activeTarget=target;
      const copy=helpCopyFor(target);
      titleNode.textContent=copy.title;
      textNode.textContent=copy.text;
      panel.hidden=false;
      panel.classList.remove('is-visible');
      position(target,pointerX,pointerY);
      requestAnimationFrame(()=>panel.classList.add('is-visible'));
    };

    const schedule = (target,x,y) => {
      if (!enabled || !target) return;
      clearTimer();
      activeTarget=target;
      pointerX=x; pointerY=y;
      timer=window.setTimeout(()=>{
        timer=0;
        if (enabled && activeTarget===target && target.isConnected) show(target);
      },delay);
    };

    const helpTarget = (node) => node?.closest?.('[data-help-title],[data-help-text],[data-smo-help-auto],.smo-page-frame button,.smo-page-frame a[href],.smo-page-frame select,.smo-page-frame input:not([type="hidden"]),.smo-page-frame textarea');

    updateToggle();
    wrap.addEventListener('mouseover',(e)=>{
      if (!enabled) return;
      const target=helpTarget(e.target);
      if (!target || !wrap.contains(target) || target===activeTarget) return;
      hide(); schedule(target,e.clientX,e.clientY);
    });
    wrap.addEventListener('mousemove',(e)=>{pointerX=e.clientX;pointerY=e.clientY;},{passive:true});
    wrap.addEventListener('mouseout',(e)=>{
      if (!activeTarget) return;
      const related=e.relatedTarget;
      if (related && activeTarget.contains(related)) return;
      const leaving=helpTarget(e.target);
      if (leaving===activeTarget) hide();
    });
    wrap.addEventListener('focusin',(e)=>{
      if (!enabled) return;
      const target=helpTarget(e.target);
      if (!target || !wrap.contains(target)) return;
      hide(); const r=target.getBoundingClientRect(); schedule(target,r.right,r.bottom);
    });
    wrap.addEventListener('focusout',()=>hide());
    wrap.addEventListener('mouseleave',hide);
    window.addEventListener('blur',hide);
    window.addEventListener('scroll',hide,{passive:true,capture:true});
    window.addEventListener('resize',()=>{if (!panel.hidden && activeTarget) position(activeTarget,pointerX,pointerY);},{passive:true});
    toggle.addEventListener('click',()=>{
      enabled=!enabled;
      localStorage.setItem('smo_help_enabled',enabled?'1':'0');
      hide(); updateToggle();
      toast(enabled ? 'Hover help on — rest the pointer over a control.' : 'Hover help turned off.');
    });
  };


  proPromotion();
  library();
  healthCentre();
  nonLibraryHelp();
})();

/* Human-readable hand-maintained source. No build step. See SOURCE-CODE.md. */
(function () {
    'use strict';

    var data = window.SIMME_MEDIA_PICKER_DATA || {};
    if (!data.ajaxUrl || !data.nonce) {
        return;
    }

    var pickerMemory = {
        folder: 'all',
        search: '',
        page: 1,
        sort: 'date_desc'
    };

    var pickerStyleDocuments = [];
    // Human-readable inline stylesheet for WordPress media picker frames.
    // Source also lives at assets/css/media-picker.css. No build tooling is used.
    var embeddedPickerCss = String.raw`/* Simme Media Organiser — optional WordPress media picker integration */
.media-router .media-menu-item[data-id="simme-media"]{font-weight:700}.media-router .media-menu-item[data-id="simme-media"]:before{content:'✦';display:inline-block;margin-right:6px;color:#8c5cff;font-size:12px;line-height:1}
.smo-picker-view{height:100%;min-height:420px;background:#0b1119;color:#dfe7f2;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;--smo-picker-accent:#8c5cff;--smo-picker-accent-rgb:140,92,255}.smo-picker-view.smo-picker-accent-blue{--smo-picker-accent:#4f8cff;--smo-picker-accent-rgb:79,140,255}.smo-picker-view.smo-picker-accent-lime{--smo-picker-accent:#b7ff42;--smo-picker-accent-rgb:183,255,66}.smo-picker-view.smo-picker-accent-gold{--smo-picker-accent:#f0c35a;--smo-picker-accent-rgb:240,195,90}.smo-picker-shell{display:grid;grid-template-columns:320px minmax(0,1fr);height:100%;min-height:420px}.smo-picker-sidebar{display:flex;flex-direction:column;min-width:0;padding:16px 18px;border-right:1px solid rgba(255,255,255,.08);background:linear-gradient(180deg,#0d141e,#091019)}.smo-picker-brand{display:block;padding:2px 2px 16px}.smo-picker-brand__lockup{display:block;width:min(100%,242px);height:auto;object-fit:contain;filter:drop-shadow(0 10px 18px rgba(var(--smo-picker-accent-rgb),.16))}.smo-picker-search-wrap{display:block;margin-bottom:12px}.smo-picker-search{box-sizing:border-box;width:100%!important;height:38px!important;margin:0!important;padding:0 12px!important;border:1px solid rgba(255,255,255,.1)!important;border-radius:10px!important;background:#111925!important;color:#fff!important;box-shadow:none!important;font-size:12px!important}.smo-picker-search:focus{border-color:rgba(var(--smo-picker-accent-rgb),.55)!important;box-shadow:0 0 0 3px rgba(var(--smo-picker-accent-rgb),.08)!important;outline:0!important}.smo-picker-search::placeholder{color:#718096}.smo-picker-smart,.smo-picker-folders{display:grid;gap:3px}.smo-picker-nav,.smo-picker-folder{appearance:none;display:grid;grid-template-columns:22px minmax(0,1fr) minmax(34px,max-content);align-items:center;gap:7px;min-height:34px;width:100%;margin:0;padding:6px 9px;border:1px solid transparent;border-radius:9px;background:transparent;color:#aab5c5;text-align:left;cursor:pointer;box-shadow:none;font-size:11px;line-height:1.25}.smo-picker-nav:hover,.smo-picker-folder:hover{background:rgba(255,255,255,.045);color:#fff}.smo-picker-nav.is-active,.smo-picker-folder.is-active{background:linear-gradient(90deg,rgba(var(--smo-picker-accent-rgb),.18),rgba(var(--smo-picker-accent-rgb),.06));border-color:rgba(var(--smo-picker-accent-rgb),.23);color:#fff}.smo-picker-nav-icon{display:grid;place-items:center;width:20px;height:20px;color:var(--smo-picker-accent);font-size:15px}.smo-picker-folder{grid-template-columns:13px minmax(0,1fr) minmax(34px,max-content)}.smo-picker-folder i{display:block;width:8px;height:8px;border-radius:3px;border:2px solid var(--smo-folder-colour);box-shadow:0 0 10px var(--smo-folder-colour)}.smo-picker-folder small{min-width:34px;justify-self:end;text-align:right;color:#7f8da1;font-size:9px;font-variant-numeric:tabular-nums}.smo-picker-section-title{margin:16px 8px 7px;color:#66758a;font-size:9px;font-weight:800;letter-spacing:.14em;text-transform:uppercase}.smo-picker-no-folders{padding:8px;color:#67758a;font-size:10px}.smo-picker-open-full{margin-top:auto;padding:14px 7px 2px;color:#8d9aaf;text-decoration:none;font-size:10px}.smo-picker-open-full:hover{color:#fff;text-decoration:none}.smo-picker-main{display:grid;grid-template-rows:auto auto minmax(0,1fr) auto;min-width:0;min-height:0;background:radial-gradient(circle at 20% 0%,rgba(var(--smo-picker-accent-rgb),.08),transparent 28%),#0a1018}.smo-picker-main-head{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:15px 18px;border-bottom:1px solid rgba(255,255,255,.08);background:rgba(13,19,29,.86)}.smo-picker-eyebrow{display:block;color:var(--smo-picker-accent);font-size:8px;font-weight:900;letter-spacing:.15em}.smo-picker-main-head h2{margin:3px 0 0!important;padding:0!important;color:#fff!important;font-size:18px!important;font-weight:760!important;line-height:1.2!important}.smo-picker-head-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end}.smo-picker-type,.smo-picker-selection-count{display:inline-flex;align-items:center;min-height:28px;padding:0 9px;border-radius:999px;border:1px solid rgba(255,255,255,.08);background:#111925;color:#8d9aaf;font-size:9px;font-weight:700}.smo-picker-selection-count{border-color:rgba(var(--smo-picker-accent-rgb),.2);color:#c8baff}.smo-picker-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(145px,1fr));gap:10px;align-content:start;min-height:0;overflow:auto;padding:14px 16px 18px}.smo-picker-card{appearance:none;display:grid;grid-template-rows:auto auto;min-width:0;margin:0;padding:0;border:1px solid rgba(255,255,255,.09);border-radius:12px;overflow:hidden;background:linear-gradient(180deg,#141c28,#101721);color:inherit;text-align:left;cursor:pointer;box-shadow:0 8px 22px rgba(0,0,0,.12);transition:.14s ease}.smo-picker-card:hover{border-color:rgba(var(--smo-picker-accent-rgb),.35);transform:translateY(-1px);box-shadow:0 12px 28px rgba(0,0,0,.18)}.smo-picker-card.is-selected{border-color:rgba(var(--smo-picker-accent-rgb),.9);box-shadow:0 0 0 2px rgba(var(--smo-picker-accent-rgb),.16),0 12px 28px rgba(0,0,0,.18)}.smo-picker-card.is-resolving{opacity:.65;pointer-events:none}.smo-picker-card-preview{position:relative;display:block;aspect-ratio:1.25/1;background:#0c121a;overflow:hidden}.smo-picker-card-preview>img{display:block;width:100%;height:100%;object-fit:cover}.smo-picker-generic{display:grid;place-items:center;width:100%;height:100%;background:radial-gradient(circle at 50% 45%,rgba(var(--smo-picker-accent-rgb),.18),transparent 35%),#0c121a}.smo-picker-generic span{color:#cad2de;font-size:24px;font-weight:850}.smo-picker-file-badge{position:absolute;top:7px;left:7px;display:inline-flex;align-items:center;justify-content:center;min-width:36px;min-height:22px;padding:0 6px;border-radius:7px;border:1px solid rgba(255,255,255,.12);background:rgba(7,11,17,.82);color:#eef3fa;font-size:8px;font-weight:900;letter-spacing:.07em;backdrop-filter:blur(6px)}.smo-picker-file-badge.is-pdf{color:#ffb2a8;border-color:rgba(255,108,92,.34);background:rgba(89,28,23,.8)}.smo-picker-file-badge.is-audio{color:#e3bfff;border-color:rgba(188,124,218,.34);background:rgba(58,29,74,.8)}.smo-picker-file-badge.is-video{color:#ffbfdc;border-color:rgba(249,115,176,.34);background:rgba(76,25,51,.82)}.smo-picker-file-badge.is-png{color:#c4ddff;border-color:rgba(96,165,250,.34);background:rgba(20,49,86,.82)}.smo-picker-file-badge.is-jpg{color:#ffe0a6;border-color:rgba(251,191,36,.34);background:rgba(83,57,13,.82)}.smo-picker-file-badge.is-webp{color:#def5ae;border-color:rgba(163,230,53,.34);background:rgba(42,65,14,.82)}.smo-picker-file-badge.is-gif{color:#f5c0ff;border-color:rgba(232,121,249,.34);background:rgba(73,24,79,.82)}.smo-picker-file-badge.is-avif,.smo-picker-file-badge.is-svg{color:#c0faf0;border-color:rgba(45,212,191,.34);background:rgba(16,64,59,.82)}.smo-picker-selected-mark{position:absolute;top:7px;right:7px;display:grid;place-items:center;width:26px;height:26px;border-radius:9px;background:var(--smo-picker-accent);color:#fff;font-size:13px;font-weight:900;opacity:0;transform:scale(.8);transition:.14s ease}.smo-picker-card.is-selected .smo-picker-selected-mark{opacity:1;transform:scale(1)}.smo-picker-card-copy{display:block;min-width:0;padding:9px 10px 10px}.smo-picker-card-copy strong,.smo-picker-card-copy small,.smo-picker-card-copy em{display:block;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.smo-picker-card-copy strong{color:#f4f7fb;font-size:11px;font-style:normal}.smo-picker-card-copy small{display:flex;align-items:center;gap:5px;margin-top:5px;color:#8290a4;font-size:8.5px}.smo-picker-card-copy small i{display:inline-block;flex:0 0 auto;width:6px;height:14px;border-radius:4px;background:var(--folder-colour)}.smo-picker-card-copy em{margin-top:5px;color:#68768a;font-size:8px;font-style:normal}.smo-picker-pagination{display:flex;align-items:center;justify-content:center;gap:10px;padding:10px 14px;border-top:1px solid rgba(255,255,255,.07);background:#0d141e}.smo-picker-pagination .button{min-height:30px;border-color:rgba(255,255,255,.1);background:#121a26;color:#b8c3d1;box-shadow:none}.smo-picker-pagination .button:hover:not(:disabled){border-color:rgba(var(--smo-picker-accent-rgb),.35);background:#172131;color:#fff}.smo-picker-page{min-width:86px;color:#77859a;text-align:center;font-size:9px}.smo-picker-loading,.smo-picker-empty{grid-column:1/-1;min-height:260px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:#7b899e;text-align:center}.smo-picker-loading span{width:24px;height:24px;border:2px solid rgba(255,255,255,.1);border-top-color:var(--smo-picker-accent);border-radius:50%;animation:smo-picker-spin .8s linear infinite}.smo-picker-empty strong{color:#dce4ef;font-size:13px}.smo-picker-empty span{font-size:10px}@keyframes smo-picker-spin{to{transform:rotate(360deg)}}

/* v1.2.0-beta4 — upload directly inside the Simme Media picker */
.smo-picker-upload-panel{position:relative;display:grid;grid-template-columns:minmax(250px,1.35fr) minmax(190px,.65fr);gap:10px;padding:10px 14px;border-bottom:1px solid rgba(255,255,255,.07);background:linear-gradient(180deg,rgba(15,22,33,.98),rgba(10,16,24,.98))}
.smo-picker-dropzone{position:relative;display:flex;align-items:center;gap:11px;min-width:0;min-height:72px;padding:10px 13px;border:1px dashed rgba(var(--smo-picker-accent-rgb),.34);border-radius:12px;background:linear-gradient(135deg,rgba(var(--smo-picker-accent-rgb),.08),rgba(255,255,255,.018));outline:0;transition:border-color .16s ease,background .16s ease,box-shadow .16s ease,transform .16s ease}
.smo-picker-dropzone:hover,.smo-picker-dropzone:focus-within{border-color:rgba(var(--smo-picker-accent-rgb),.62);background:linear-gradient(135deg,rgba(var(--smo-picker-accent-rgb),.13),rgba(255,255,255,.025));box-shadow:0 0 0 3px rgba(var(--smo-picker-accent-rgb),.055)}
.smo-picker-dropzone.is-dragging{border-style:solid;border-color:var(--smo-picker-accent);background:radial-gradient(circle at 20% 50%,rgba(var(--smo-picker-accent-rgb),.2),transparent 42%),rgba(var(--smo-picker-accent-rgb),.09);box-shadow:0 0 0 3px rgba(var(--smo-picker-accent-rgb),.11),0 12px 28px rgba(0,0,0,.15);transform:translateY(-1px)}
.smo-picker-upload-icon{display:grid;place-items:center;flex:0 0 38px;width:38px;height:38px;border-radius:12px;border:1px solid rgba(var(--smo-picker-accent-rgb),.34);background:linear-gradient(145deg,rgba(var(--smo-picker-accent-rgb),.25),rgba(var(--smo-picker-accent-rgb),.08));color:#fff;font-size:22px;font-weight:500;line-height:1;box-shadow:0 8px 20px rgba(var(--smo-picker-accent-rgb),.1)}
.smo-picker-upload-copy{min-width:0}.smo-picker-upload-copy strong,.smo-picker-upload-copy span,.smo-picker-upload-copy small,.smo-picker-upload-actions{display:block}.smo-picker-upload-copy strong{margin-bottom:2px;color:#f6f8fc;font-size:11.5px;font-weight:780}.smo-picker-upload-copy span{color:#91a0b4;font-size:9.5px;line-height:1.4}.smo-picker-upload-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:8px}.smo-picker-upload-hint{color:#98a7bb;font-size:9px;line-height:1.4}.smo-picker-upload-copy small{margin-top:3px;color:#5f7088;font-size:8px;line-height:1.3}
.smo-picker-choose-files{appearance:none;display:inline-flex;align-items:center;justify-content:center;min-height:40px;padding:0 18px;border:1px solid rgba(var(--smo-picker-accent-rgb),.52)!important;border-radius:12px;background:linear-gradient(135deg,rgba(var(--smo-picker-accent-rgb),.26),rgba(var(--smo-picker-accent-rgb),.12))!important;color:#fff!important;font-size:11px;font-weight:800;line-height:1;cursor:pointer;box-shadow:0 10px 22px rgba(var(--smo-picker-accent-rgb),.12)!important;text-decoration:none;transition:transform .16s ease,border-color .16s ease,box-shadow .16s ease,background .16s ease}.smo-picker-choose-files:hover,.smo-picker-choose-files:focus{border-color:rgba(var(--smo-picker-accent-rgb),.9)!important;background:linear-gradient(135deg,rgba(var(--smo-picker-accent-rgb),.38),rgba(var(--smo-picker-accent-rgb),.18))!important;color:#fff!important;text-decoration:none;box-shadow:0 14px 28px rgba(var(--smo-picker-accent-rgb),.18)!important;transform:translateY(-1px);outline:0}
.smo-picker-upload-destination{display:flex;flex-direction:column;justify-content:center;min-width:0;padding:8px 10px;border:1px solid rgba(255,255,255,.075);border-radius:12px;background:#0e1621}.smo-picker-upload-destination label{display:block;margin:0}.smo-picker-upload-destination label>span{display:block;margin:0 0 5px;color:#77879d;font-size:8px;font-weight:850;letter-spacing:.1em;text-transform:uppercase}.smo-picker-upload-folder{box-sizing:border-box;width:100%!important;height:34px!important;min-height:34px!important;margin:0!important;padding:0 28px 0 9px!important;border:1px solid rgba(255,255,255,.1)!important;border-radius:9px!important;background-color:#131c29!important;color:#edf2f8!important;box-shadow:none!important;font-size:9.5px!important;font-weight:650!important;line-height:34px!important}.smo-picker-upload-folder:focus{border-color:rgba(var(--smo-picker-accent-rgb),.55)!important;box-shadow:0 0 0 3px rgba(var(--smo-picker-accent-rgb),.075)!important;outline:0!important}.smo-picker-upload-destination>small{display:block;margin-top:5px;color:#627289;font-size:7.8px;line-height:1.35}
.smo-picker-upload-status{grid-column:1/-1;display:grid;grid-template-columns:minmax(0,1fr);gap:5px;padding:8px 10px;border:1px solid rgba(var(--smo-picker-accent-rgb),.18);border-radius:10px;background:#0b121c}.smo-picker-upload-status[hidden]{display:none!important}.smo-picker-upload-status>div:first-child{display:flex;align-items:center;justify-content:space-between;gap:10px;min-width:0}.smo-picker-upload-status strong{color:#e9eef6;font-size:9px}.smo-picker-upload-status span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#7f8da1;font-size:8px;text-align:right}.smo-picker-upload-progress{height:4px;overflow:hidden;border-radius:999px;background:rgba(255,255,255,.06)}.smo-picker-upload-progress i{display:block;width:0;height:100%;border-radius:inherit;background:linear-gradient(90deg,var(--smo-picker-accent),#56d8ff);box-shadow:0 0 12px rgba(var(--smo-picker-accent-rgb),.25);transition:width .12s linear}.smo-picker-upload-status.is-success{border-color:rgba(132,204,22,.28);background:rgba(47,72,14,.18)}.smo-picker-upload-status.is-success .smo-picker-upload-progress i{background:linear-gradient(90deg,#9be53a,#62df88)}.smo-picker-upload-status.is-error{border-color:rgba(239,68,68,.3);background:rgba(90,24,24,.2)}.smo-picker-upload-status.is-error strong{color:#ffc3c3}.smo-picker-upload-status.is-error .smo-picker-upload-progress i{background:#ef6262}.smo-picker-upload-panel.is-uploading .smo-picker-dropzone,.smo-picker-upload-panel.is-uploading .smo-picker-upload-destination{opacity:.62;pointer-events:none}

@media(max-width:900px){.smo-picker-upload-panel{grid-template-columns:minmax(0,1fr) 230px;padding:9px 11px}.smo-picker-shell{grid-template-columns:280px minmax(0,1fr)}.smo-picker-grid{grid-template-columns:repeat(auto-fill,minmax(130px,1fr));padding:12px}.smo-picker-sidebar{padding:12px 10px}.smo-picker-main-head{padding:12px 14px}}
@media(max-width:680px){.smo-picker-upload-panel{grid-template-columns:1fr}.smo-picker-upload-status{grid-column:1}.smo-picker-dropzone{min-height:64px}.smo-picker-shell{grid-template-columns:1fr}.smo-picker-sidebar{max-height:190px;border-right:0;border-bottom:1px solid rgba(255,255,255,.08);overflow:auto}.smo-picker-brand,.smo-picker-open-full{display:none}.smo-picker-main{min-height:390px}.smo-picker-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}

/* v1.2.0-beta8 — instant enlarged hover inspection for compact media cards */
.smo-picker-hover-preview{position:fixed;z-index:2147483000;width:320px;max-width:calc(100vw - 28px);overflow:hidden;border:1px solid rgba(var(--smo-picker-accent-rgb,140,92,255),.42);border-radius:18px;background:linear-gradient(180deg,#121a26,#0c131d);color:#eaf0f8;box-shadow:0 26px 70px rgba(0,0,0,.48),0 0 0 1px rgba(255,255,255,.035),0 0 28px rgba(var(--smo-picker-accent-rgb,140,92,255),.13);opacity:0;transform:scale(.965);transform-origin:center;pointer-events:none;visibility:hidden;transition:opacity .08s ease,transform .08s ease;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
.smo-picker-hover-preview.is-visible{opacity:1;transform:scale(1)}
.smo-picker-hover-canvas{position:relative;display:grid;place-items:center;width:100%;height:300px;max-height:42vh;min-height:200px;overflow:hidden;background-color:#d1d5db;background-image:linear-gradient(45deg,#bcc3cd 25%,transparent 25%),linear-gradient(-45deg,#bcc3cd 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#bcc3cd 75%),linear-gradient(-45deg,transparent 75%,#bcc3cd 75%);background-size:28px 28px;background-position:0 0,0 14px,14px -14px,-14px 0}
.smo-picker-hover-canvas>img{display:block;width:100%;height:100%;object-fit:contain}
.smo-picker-hover-format{position:absolute;top:12px;left:12px;display:inline-flex;align-items:center;justify-content:center;min-width:48px;min-height:28px;padding:0 9px;border-radius:9px;border:1px solid rgba(255,255,255,.16);background:rgba(7,11,17,.86);color:#f4f7fb;font-size:10px;font-weight:900;letter-spacing:.07em;box-shadow:0 7px 18px rgba(0,0,0,.18);backdrop-filter:blur(8px)}
.smo-picker-hover-format.is-png{color:#c4ddff;border-color:rgba(96,165,250,.45);background:rgba(20,49,86,.88)}.smo-picker-hover-format.is-jpg{color:#ffe0a6;border-color:rgba(251,191,36,.45);background:rgba(83,57,13,.88)}.smo-picker-hover-format.is-webp{color:#def5ae;border-color:rgba(163,230,53,.45);background:rgba(42,65,14,.88)}.smo-picker-hover-format.is-gif{color:#f5c0ff;border-color:rgba(232,121,249,.45);background:rgba(73,24,79,.88)}.smo-picker-hover-format.is-avif,.smo-picker-hover-format.is-svg{color:#c0faf0;border-color:rgba(45,212,191,.45);background:rgba(16,64,59,.88)}
.smo-picker-hover-details{padding:11px 13px 12px;border-top:1px solid rgba(255,255,255,.08);background:linear-gradient(180deg,#121a26,#0d141e)}
.smo-picker-hover-details>strong,.smo-picker-hover-filename{display:block;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.smo-picker-hover-details>strong{color:#fff;font-size:13px;font-weight:800;line-height:1.25}.smo-picker-hover-filename{margin-top:4px;color:#8492a6;font-size:10px}
.smo-picker-hover-meta{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:10px}.smo-picker-hover-meta span{display:inline-flex;align-items:center;min-height:27px;padding:0 8px;border:1px solid rgba(255,255,255,.09);border-radius:8px;background:#18212e;color:#aeb9c8;font-size:9px;font-weight:700}.smo-picker-hover-meta span.is-good{border-color:rgba(77,205,123,.28);background:rgba(32,94,55,.22);color:#aee9c2}.smo-picker-hover-meta span.is-warning{border-color:rgba(240,195,90,.3);background:rgba(98,70,18,.22);color:#ffd887}
.smo-picker-hover-folder{display:flex;align-items:center;gap:8px;min-width:0;margin-top:10px;color:#98a6b9;font-size:10px}.smo-picker-hover-folder i{display:block;flex:0 0 5px;width:5px;height:20px;border-radius:999px;background:var(--folder-colour);box-shadow:0 0 12px var(--folder-colour)}.smo-picker-hover-folder span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.smo-picker-hover-details>small{display:block;margin-top:10px;color:#69798e;font-size:9px}
@media(max-width:760px),(hover:none){.smo-picker-hover-preview{display:none!important}}

/* v1.2.0-beta12 — clearer compact picker navigation */
.smo-picker-folder{min-height:36px;align-items:start}
.smo-picker-folder>span{min-width:0;white-space:normal;overflow-wrap:anywhere;line-height:1.28;padding-top:1px}
.smo-picker-folder small{align-self:start;padding-top:1px}


/* v1.2.0-beta13 — keep the compact picker folder column fully inside its grid track */
.smo-picker-view,.smo-picker-view *,.smo-picker-view *::before,.smo-picker-view *::after{box-sizing:border-box}
.smo-picker-sidebar{overflow-x:hidden}
.smo-picker-smart,.smo-picker-folders{width:100%;min-width:0}
.smo-picker-nav,.smo-picker-folder{max-width:100%;box-sizing:border-box}
.smo-picker-folder{grid-template-columns:13px minmax(0,1fr) auto;padding-right:12px}
.smo-picker-folder small{min-width:36px;max-width:58px;margin-right:0;padding:2px 6px;border-radius:999px;background:rgba(255,255,255,.035);white-space:nowrap;overflow:visible;text-overflow:clip}
.smo-picker-folder>span{padding-right:4px}
@media(max-width:900px){.smo-picker-folder{padding-right:10px}.smo-picker-folder small{min-width:34px;padding-left:5px;padding-right:5px}}

/* v1.2.0-beta14 — host-aware single/multiple selection in the compact picker */
.smo-picker-selection-mode{display:inline-flex;align-items:center;min-height:28px;padding:0 9px;border-radius:999px;border:1px solid rgba(255,255,255,.08);background:#111925;color:#8d9aaf;font-size:9px;font-weight:750;white-space:nowrap}
.smo-picker-selection-mode.is-multiple{border-color:rgba(var(--smo-picker-accent-rgb),.32);background:rgba(var(--smo-picker-accent-rgb),.1);color:#d8cdff}
.smo-picker-selection-mode.is-single{color:#9aa8bb}


/* v1.2.0-beta16 — Simme-balanced pagination and host action footer */
.smo-picker-pagination{
    display:grid!important;
    grid-template-columns:172px minmax(108px,auto) 172px!important;
    align-items:center!important;
    justify-content:center!important;
    gap:18px!important;
    padding:15px 18px!important;
    border-top:1px solid rgba(255,255,255,.08)!important;
    background:linear-gradient(180deg,#0d141e 0%,#0a1119 100%)!important;
}
.smo-picker-pagination .button{
    appearance:none!important;
    box-sizing:border-box!important;
    display:inline-flex!important;
    align-items:center!important;
    justify-content:center!important;
    width:172px!important;
    min-width:172px!important;
    height:50px!important;
    min-height:50px!important;
    margin:0!important;
    padding:0 18px!important;
    border:1px solid rgba(var(--smo-picker-accent-rgb),.38)!important;
    border-radius:13px!important;
    background:linear-gradient(135deg,rgba(var(--smo-picker-accent-rgb),.15),rgba(17,25,37,.96))!important;
    color:#eef2f8!important;
    box-shadow:inset 0 1px 0 rgba(255,255,255,.055),0 8px 20px rgba(0,0,0,.2)!important;
    font-size:12px!important;
    font-weight:800!important;
    line-height:1!important;
    text-shadow:none!important;
    transition:transform .16s ease,border-color .16s ease,box-shadow .16s ease,background .16s ease!important;
}
.smo-picker-pagination .button:hover:not(:disabled),
.smo-picker-pagination .button:focus:not(:disabled){
    border-color:rgba(var(--smo-picker-accent-rgb),.78)!important;
    background:linear-gradient(135deg,rgba(var(--smo-picker-accent-rgb),.30),rgba(var(--smo-picker-accent-rgb),.12))!important;
    color:#fff!important;
    box-shadow:0 12px 25px rgba(0,0,0,.24),0 0 24px rgba(var(--smo-picker-accent-rgb),.14)!important;
    transform:translateY(-1px)!important;
    outline:none!important;
}
.smo-picker-pagination .button:disabled{
    border-color:rgba(255,255,255,.10)!important;
    background:#101722!important;
    color:#66758a!important;
    box-shadow:none!important;
    opacity:.62!important;
    cursor:not-allowed!important;
}
.smo-picker-page{
    display:inline-flex!important;
    align-items:center!important;
    justify-content:center!important;
    min-width:108px!important;
    min-height:38px!important;
    padding:0 14px!important;
    border:1px solid rgba(255,255,255,.075)!important;
    border-radius:999px!important;
    background:#101722!important;
    color:#8290a5!important;
    text-align:center!important;
    font-size:10px!important;
    font-weight:760!important;
    letter-spacing:.015em!important;
    white-space:nowrap!important;
}

/* Applied by JS to Themify/WordPress action bars that live outside the picker DOM. */
.smo-simme-host-actionbar{
    box-sizing:border-box!important;
    min-height:76px!important;
    padding:12px 22px!important;
    border-top:1px solid rgba(255,255,255,.08)!important;
    background:linear-gradient(180deg,#0d141e 0%,#091019 100%)!important;
    box-shadow:inset 0 1px 0 rgba(255,255,255,.025),0 -12px 28px rgba(0,0,0,.12)!important;
}
.smo-simme-host-actionbar *{box-sizing:border-box}
.smo-simme-host-actionbar .smo-simme-host-action{
    appearance:none!important;
    min-width:176px!important;
    min-height:48px!important;
    margin:0!important;
    padding:0 20px!important;
    border:1px solid rgba(140,92,255,.62)!important;
    border-radius:13px!important;
    background:linear-gradient(135deg,rgba(140,92,255,.86),rgba(96,57,206,.92))!important;
    color:#fff!important;
    box-shadow:0 12px 26px rgba(98,60,205,.24),inset 0 1px 0 rgba(255,255,255,.16)!important;
    font-size:13px!important;
    font-weight:800!important;
    line-height:1!important;
    text-shadow:none!important;
    cursor:pointer!important;
}
.smo-simme-host-actionbar .smo-simme-host-action:hover:not(:disabled),
.smo-simme-host-actionbar .smo-simme-host-action:focus:not(:disabled){
    border-color:rgba(173,143,255,.92)!important;
    background:linear-gradient(135deg,#946cff,#6f43dc)!important;
    box-shadow:0 15px 30px rgba(98,60,205,.32),0 0 25px rgba(140,92,255,.16)!important;
    transform:translateY(-1px)!important;
    outline:none!important;
}
.smo-simme-host-actionbar .smo-simme-host-action:disabled{
    border-color:rgba(255,255,255,.10)!important;
    background:#151c28!important;
    color:#68768a!important;
    box-shadow:none!important;
    opacity:.72!important;
    cursor:not-allowed!important;
}
.smo-simme-host-actionbar .smo-simme-host-summary{
    display:inline-flex!important;
    align-items:center!important;
    min-height:38px!important;
    margin-right:12px!important;
    padding:0 13px!important;
    border:1px solid rgba(255,255,255,.08)!important;
    border-radius:999px!important;
    background:#111925!important;
    color:#9aa8ba!important;
    font-size:10px!important;
    font-weight:720!important;
    white-space:nowrap!important;
}
@media(max-width:680px){
    .smo-picker-pagination{grid-template-columns:1fr 1fr!important;gap:10px!important;padding:12px!important}
    .smo-picker-pagination .button{width:100%!important;min-width:0!important}
    .smo-picker-page{grid-column:1/-1!important;grid-row:1!important;justify-self:center!important}
}

/* v1.2.0-beta35 — builder/media picker panel definition
   Keep beta34/beta33 dark surface colours unchanged; strengthen only edges,
   separators and inner hairlines so the builder window follows the same
   visual hierarchy as the main Simme Media Organiser interface. */
.smo-picker-view{
    box-shadow:inset 0 0 0 1px rgba(205,220,242,.24),inset 0 1px 0 rgba(255,255,255,.045)!important;
}
.smo-picker-shell{
    box-shadow:inset 0 0 0 1px rgba(205,220,242,.18)!important;
}
.smo-picker-sidebar{
    border-right-color:rgba(205,220,242,.27)!important;
    box-shadow:inset -1px 0 0 rgba(255,255,255,.035)!important;
}
.smo-picker-main{
    box-shadow:inset 0 0 0 1px rgba(205,220,242,.13)!important;
}
.smo-picker-main-head{
    border-bottom-color:rgba(205,220,242,.24)!important;
    box-shadow:inset 0 -1px 0 rgba(255,255,255,.03)!important;
}
.smo-picker-upload-panel{
    border-bottom-color:rgba(205,220,242,.24)!important;
    box-shadow:inset 0 -1px 0 rgba(255,255,255,.025)!important;
}
.smo-picker-dropzone{
    border-color:rgba(var(--smo-picker-accent-rgb),.52)!important;
    box-shadow:inset 0 0 0 1px rgba(255,255,255,.025)!important;
}
.smo-picker-upload-destination,
.smo-picker-upload-status{
    border-color:rgba(205,220,242,.22)!important;
    box-shadow:inset 0 1px 0 rgba(255,255,255,.035),inset 0 0 0 1px rgba(255,255,255,.012)!important;
}
.smo-picker-search{
    border-color:rgba(205,220,242,.22)!important;
    box-shadow:inset 0 1px 0 rgba(255,255,255,.025)!important;
}
.smo-picker-type,
.smo-picker-selection-mode,
.smo-picker-selection-count,
.smo-picker-folder small,
.smo-picker-page{
    border-color:rgba(205,220,242,.18)!important;
    box-shadow:inset 0 1px 0 rgba(255,255,255,.025)!important;
}
.smo-picker-nav,
.smo-picker-folder{
    border-color:rgba(205,220,242,.075)!important;
}
.smo-picker-nav:hover,
.smo-picker-folder:hover{
    border-color:rgba(205,220,242,.18)!important;
}
.smo-picker-nav.is-active,
.smo-picker-folder.is-active{
    border-color:rgba(var(--smo-picker-accent-rgb),.48)!important;
    box-shadow:inset 0 0 0 1px rgba(255,255,255,.025),0 0 0 1px rgba(var(--smo-picker-accent-rgb),.04)!important;
}
.smo-picker-grid{
    box-shadow:inset 0 1px 0 rgba(255,255,255,.02),inset 0 -1px 0 rgba(205,220,242,.08)!important;
}
.smo-picker-card{
    border-color:rgba(205,220,242,.22)!important;
    box-shadow:inset 0 0 0 1px rgba(255,255,255,.025),0 8px 22px rgba(0,0,0,.12)!important;
}
.smo-picker-card:hover{
    border-color:rgba(var(--smo-picker-accent-rgb),.58)!important;
    box-shadow:inset 0 0 0 1px rgba(255,255,255,.035),0 12px 28px rgba(0,0,0,.18)!important;
}
.smo-picker-card.is-selected{
    border-color:rgba(var(--smo-picker-accent-rgb),.96)!important;
    box-shadow:inset 0 0 0 1px rgba(255,255,255,.04),0 0 0 2px rgba(var(--smo-picker-accent-rgb),.18),0 12px 28px rgba(0,0,0,.18)!important;
}
.smo-picker-card-preview{
    border-bottom:1px solid rgba(205,220,242,.16)!important;
}
.smo-picker-card-copy{
    box-shadow:inset 0 1px 0 rgba(255,255,255,.018)!important;
}
.smo-picker-pagination{
    border-top-color:rgba(205,220,242,.25)!important;
    box-shadow:inset 0 1px 0 rgba(255,255,255,.03)!important;
}
.smo-picker-pagination .button{
    border-color:rgba(205,220,242,.24)!important;
    box-shadow:inset 0 1px 0 rgba(255,255,255,.035),0 8px 20px rgba(0,0,0,.14)!important;
}
.smo-picker-pagination .button:not(:disabled):hover,
.smo-picker-pagination .button:not(:disabled):focus{
    border-color:rgba(var(--smo-picker-accent-rgb),.82)!important;
}
.smo-picker-hover-preview{
    border-color:rgba(205,220,242,.28)!important;
    box-shadow:inset 0 0 0 1px rgba(255,255,255,.03),0 26px 70px rgba(0,0,0,.48),0 0 28px rgba(var(--smo-picker-accent-rgb,140,92,255),.13)!important;
}
.smo-picker-hover-details{
    border-top-color:rgba(205,220,242,.2)!important;
}
.smo-simme-host-actionbar{
    border-top-color:rgba(205,220,242,.26)!important;
    box-shadow:inset 0 1px 0 rgba(255,255,255,.04),0 -12px 28px rgba(0,0,0,.12)!important;
}
.smo-simme-host-actionbar .smo-simme-host-summary{
    border-color:rgba(205,220,242,.2)!important;
}
@media(max-width:680px){
    .smo-picker-sidebar{
        border-right:0!important;
        border-bottom-color:rgba(205,220,242,.27)!important;
        box-shadow:inset 0 -1px 0 rgba(255,255,255,.035)!important;
    }
}

/* v1.2.0-beta39 — responsive resilience foundation for builder/media frames
   The Simme picker must adapt to the width of the picker itself, not merely
   assume a full desktop viewport. JS adds is-compact / is-narrow / is-phone
   classes from the live picker width; media queries remain as a fallback. */
.smo-picker-view{container-type:inline-size;max-width:100%;overflow:hidden}
.smo-picker-view img,.smo-picker-view video,.smo-picker-view canvas,.smo-picker-view svg{max-width:100%}
.smo-picker-view button,.smo-picker-view input,.smo-picker-view select{max-width:100%}
.smo-picker-main,.smo-picker-sidebar,.smo-picker-upload-panel,.smo-picker-grid,.smo-picker-pagination{min-width:0;max-width:100%}
.smo-picker-brand__lockup{max-width:100%}

/* Medium / compact picker: preserve two-column structure but stop the sidebar
   and upload controls from consuming disproportionate space. */
.smo-picker-view.is-compact .smo-picker-shell{grid-template-columns:250px minmax(0,1fr)}
.smo-picker-view.is-compact .smo-picker-sidebar{padding:14px 12px}
.smo-picker-view.is-compact .smo-picker-brand__lockup{width:min(100%,205px)}
.smo-picker-view.is-compact .smo-picker-upload-panel{grid-template-columns:minmax(0,1fr) minmax(205px,34%);padding:10px 12px}
.smo-picker-view.is-compact .smo-picker-grid{grid-template-columns:repeat(auto-fill,minmax(128px,1fr));gap:8px;padding:12px}
.smo-picker-view.is-compact .smo-picker-main-head{padding:13px 14px}
.smo-picker-view.is-compact .smo-picker-head-meta{gap:6px}
.smo-picker-view.is-compact .smo-picker-pagination{grid-template-columns:minmax(130px,160px) minmax(92px,auto) minmax(130px,160px)!important;gap:12px!important}
.smo-picker-view.is-compact .smo-picker-pagination .button{width:100%!important;min-width:0!important}

/* Narrow picker: the sidebar becomes a compact navigation deck above the
   library. Nothing is clipped; folders become a horizontally scrollable row. */
.smo-picker-view.is-narrow{overflow:auto}
.smo-picker-view.is-narrow .smo-picker-shell{display:block;height:auto;min-height:0}
.smo-picker-view.is-narrow .smo-picker-sidebar{
  display:grid;
  grid-template-columns:minmax(0,1fr);
  gap:10px;
  max-height:none;
  overflow:visible;
  padding:14px;
  border-right:0!important;
  border-bottom:1px solid rgba(205,220,242,.27)!important;
}
.smo-picker-view.is-narrow .smo-picker-brand{display:block;padding:0 0 4px}
.smo-picker-view.is-narrow .smo-picker-brand__lockup{width:min(220px,58vw);margin:0 auto}
.smo-picker-view.is-narrow .smo-picker-search-wrap{margin:0}
.smo-picker-view.is-narrow .smo-picker-search{height:44px!important}
.smo-picker-view.is-narrow .smo-picker-smart{grid-template-columns:repeat(4,minmax(0,1fr));gap:7px}
.smo-picker-view.is-narrow .smo-picker-nav{
  grid-template-columns:22px minmax(0,1fr);
  min-height:44px;
  padding:8px 10px;
  border-color:rgba(205,220,242,.09)!important;
}
.smo-picker-view.is-narrow .smo-picker-nav>span:last-child{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.smo-picker-view.is-narrow .smo-picker-section-title{margin:3px 4px -2px}
.smo-picker-view.is-narrow .smo-picker-folders{
  display:flex;
  gap:7px;
  width:100%;
  overflow-x:auto;
  overflow-y:hidden;
  padding:2px 2px 6px;
  scrollbar-width:thin;
  overscroll-behavior-inline:contain;
  -webkit-overflow-scrolling:touch;
}
.smo-picker-view.is-narrow .smo-picker-folder{
  flex:0 0 auto;
  width:auto;
  min-width:150px;
  max-width:235px;
  min-height:42px;
  grid-template-columns:13px minmax(0,1fr) auto;
  padding:7px 10px!important;
}
.smo-picker-view.is-narrow .smo-picker-folder>span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;overflow-wrap:normal}
.smo-picker-view.is-narrow .smo-picker-open-full{display:inline-flex;margin:0;padding:3px 4px 0;width:max-content;max-width:100%}
.smo-picker-view.is-narrow .smo-picker-main{min-height:0;height:auto}
.smo-picker-view.is-narrow .smo-picker-main-head{align-items:flex-start;flex-wrap:wrap;padding:14px}
.smo-picker-view.is-narrow .smo-picker-head-meta{justify-content:flex-start;width:100%;margin-top:3px}
.smo-picker-view.is-narrow .smo-picker-upload-panel{grid-template-columns:1fr;gap:10px;padding:12px 14px}
.smo-picker-view.is-narrow .smo-picker-upload-status{grid-column:1}
.smo-picker-view.is-narrow .smo-picker-dropzone{min-height:86px}
.smo-picker-view.is-narrow .smo-picker-grid{grid-template-columns:repeat(3,minmax(0,1fr));overflow:visible;padding:12px 14px 16px}
.smo-picker-view.is-narrow .smo-picker-pagination{position:relative;grid-template-columns:1fr 1fr!important;gap:10px!important;padding:12px 14px!important}
.smo-picker-view.is-narrow .smo-picker-page{grid-column:1/-1!important;grid-row:1!important;justify-self:center!important}
.smo-picker-view.is-narrow .smo-picker-pagination .button{width:100%!important;min-width:0!important}

/* Phone / very narrow builder frame. Keep all actions reachable and use
   comfortable touch targets rather than miniature desktop controls. */
.smo-picker-view.is-phone .smo-picker-sidebar{padding:11px;gap:8px}
.smo-picker-view.is-phone .smo-picker-brand__lockup{width:min(180px,64vw)}
.smo-picker-view.is-phone .smo-picker-smart{grid-template-columns:repeat(2,minmax(0,1fr))}
.smo-picker-view.is-phone .smo-picker-nav{min-height:46px;font-size:10px}
.smo-picker-view.is-phone .smo-picker-folder{min-width:138px;max-width:205px}
.smo-picker-view.is-phone .smo-picker-main-head h2{font-size:17px!important}
.smo-picker-view.is-phone .smo-picker-type,
.smo-picker-view.is-phone .smo-picker-selection-mode,
.smo-picker-view.is-phone .smo-picker-selection-count{min-height:32px;padding:0 8px;font-size:8px}
.smo-picker-view.is-phone .smo-picker-upload-panel{padding:10px}
.smo-picker-view.is-phone .smo-picker-dropzone{align-items:flex-start;flex-wrap:wrap;min-height:0;padding:12px}
.smo-picker-view.is-phone .smo-picker-dropzone-copy{min-width:0;flex:1 1 170px}
.smo-picker-view.is-phone .smo-picker-upload-destination{padding:10px}
.smo-picker-view.is-phone .smo-picker-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;padding:10px}
.smo-picker-view.is-phone .smo-picker-card-copy{padding:8px}
.smo-picker-view.is-phone .smo-picker-pagination{padding:10px!important}
.smo-picker-view.is-phone .smo-picker-pagination .button{height:46px!important;min-height:46px!important;padding:0 10px!important;font-size:11px!important}
.smo-picker-view.is-phone .smo-picker-page{min-height:34px!important;min-width:92px!important}
.smo-picker-view.is-phone ~ .smo-simme-host-actionbar,
.smo-simme-host-actionbar.is-simme-narrow{padding:10px!important;min-height:66px!important}
.smo-simme-host-actionbar.is-simme-narrow .smo-simme-host-action{width:100%!important;min-width:0!important;min-height:48px!important}
.smo-simme-host-actionbar.is-simme-narrow .smo-simme-host-summary{display:none!important}

@container (max-width:820px){
  .smo-picker-view:not(.is-narrow) .smo-picker-shell{display:block;height:auto}
}

@media(max-width:820px){
  .smo-picker-view:not(.is-compact):not(.is-narrow) .smo-picker-shell{grid-template-columns:230px minmax(0,1fr)}
}
@media(max-width:560px){
  .smo-picker-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
}
@media(max-width:390px){
  .smo-picker-view.is-phone .smo-picker-grid{grid-template-columns:1fr}
  .smo-picker-view.is-phone .smo-picker-brand__lockup{width:min(160px,68vw)}
}
`;

    function attachInlinePickerStyles(viewEl) {
        if (!viewEl || !embeddedPickerCss) { return false; }
        var existing = viewEl.querySelector ? viewEl.querySelector('style[data-simme-picker-inline-style="1"]') : null;
        if (existing) { return true; }
        var doc = viewEl.ownerDocument || document;
        var style = doc.createElement('style');
        style.type = 'text/css';
        style.setAttribute('data-simme-picker-inline-style', '1');
        style.textContent = embeddedPickerCss;
        if (viewEl.firstChild) {
            viewEl.insertBefore(style, viewEl.firstChild);
        } else {
            viewEl.appendChild(style);
        }
        return true;
    }

    function documentAlreadyStyled(doc) {
        for (var i = 0; i < pickerStyleDocuments.length; i++) {
            if (pickerStyleDocuments[i] === doc) { return true; }
        }
        return false;
    }

    function ensurePickerStyles(doc) {
        doc = doc || document;
        if (!doc || !doc.head || documentAlreadyStyled(doc)) { return; }

        var runtimeId = 'simme-media-organiser-picker-runtime-css';
        var existingRuntime = doc.getElementById(runtimeId);
        if (existingRuntime) {
            pickerStyleDocuments.push(doc);
            return;
        }

        var href = data.cssUrl || '';
        if (!href) { return; }

        var link = doc.createElement('link');
        link.id = runtimeId;
        link.rel = 'stylesheet';
        link.type = 'text/css';
        link.href = href + (href.indexOf('?') === -1 ? '?' : '&') + 'simme_runtime=1';
        link.setAttribute('data-simme-media-picker-runtime', '1');
        doc.head.appendChild(link);
        pickerStyleDocuments.push(doc);
    }

    function ensureAccessiblePickerDocuments() {
        ensurePickerStyles(document);
        try {
            if (window.parent && window.parent !== window && window.parent.document) {
                ensurePickerStyles(window.parent.document);
            }
        } catch (e) {}
        try {
            if (window.top && window.top !== window && window.top.document) {
                ensurePickerStyles(window.top.document);
            }
        } catch (e) {}
    }

    function encode(value) {
        var div = document.createElement('div');
        div.textContent = value == null ? '' : String(value);
        return div.innerHTML;
    }

    function flattenFolders(nodes, depth, out) {
        out = out || [];
        depth = depth || 0;
        (nodes || []).forEach(function (node) {
            out.push({
                id: node.id,
                name: node.name,
                path: node.path || node.name,
                colour: node.colour || '#657287',
                count: node.count || 0,
                depth: depth
            });
            flattenFolders(node.children || [], depth + 1, out);
        });
        return out;
    }

    function humanKind(type) {
        if (!type || type === 'all') { return 'All supported media'; }
        if (type === 'image') { return 'Images'; }
        if (type === 'audio') { return 'Audio'; }
        if (type === 'video') { return 'Video'; }
        if (type === 'document') { return 'Documents'; }
        return String(type);
    }

    function mimeToType(mimeOrType) {
        var raw = String(mimeOrType || '').toLowerCase();
        if (!raw) { return 'all'; }
        if (raw === 'image' || raw.indexOf('image/') === 0) { return 'image'; }
        if (raw === 'audio' || raw.indexOf('audio/') === 0) { return 'audio'; }
        if (raw === 'video' || raw.indexOf('video/') === 0) { return 'video'; }
        if (raw === 'application' || raw.indexOf('application/') === 0 || raw === 'text' || raw.indexOf('text/') === 0) { return 'document'; }
        return 'all';
    }

    function requestedType(controller) {
        var state = controller && controller.state ? controller.state() : null;
        var library = state && state.get ? state.get('library') : null;
        var props = library && library.props && library.props.toJSON ? library.props.toJSON() : {};
        var optionLibrary = controller && controller.options ? controller.options.library : null;
        var requested = props.type || (optionLibrary && optionLibrary.type) || '';

        if (Array.isArray(requested)) {
            if (requested.length === 1) {
                requested = requested[0];
            } else {
                return 'all';
            }
        }
        return mimeToType(requested);
    }

    function allowsMultipleSelection(controller, model) {
        var state = model || (controller && controller.state ? controller.state() : null);
        var stateMultiple = state && state.get ? state.get('multiple') : undefined;
        if (stateMultiple !== undefined && stateMultiple !== null) {
            return !!stateMultiple;
        }

        var selection = state && state.get ? state.get('selection') : null;
        if (selection && selection.multiple !== undefined && selection.multiple !== null) {
            return !!selection.multiple;
        }

        if (controller && controller.options && Object.prototype.hasOwnProperty.call(controller.options, 'multiple')) {
            return !!controller.options.multiple;
        }
        return false;
    }

    function fileBadgeClass(item) {
        var ext = String(item.extension || '').toUpperCase();
        if (ext === 'PDF') { return 'is-pdf'; }
        if (['MP3', 'WAV', 'M4A', 'AAC', 'FLAC', 'OGG'].indexOf(ext) !== -1) { return 'is-audio'; }
        if (['MP4', 'MOV', 'WEBM', 'AVI', 'M4V'].indexOf(ext) !== -1) { return 'is-video'; }
        if (ext === 'PNG') { return 'is-png'; }
        if (ext === 'JPG' || ext === 'JPEG') { return 'is-jpg'; }
        if (ext === 'WEBP') { return 'is-webp'; }
        if (ext === 'GIF') { return 'is-gif'; }
        if (ext === 'AVIF') { return 'is-avif'; }
        if (ext === 'SVG') { return 'is-svg'; }
        return 'is-file';
    }

    function genericPreview(item) {
        var label = item.kind === 'audio' ? '♪' : (item.kind === 'video' ? '▶' : (item.extension === 'PDF' ? 'PDF' : 'FILE'));
        return '<div class="smo-picker-generic smo-picker-generic--' + encode(item.kind || 'file') + '"><span>' + encode(label) + '</span></div>';
    }

    function post(params) {
        var body = new URLSearchParams();
        Object.keys(params).forEach(function (key) {
            body.append(key, params[key] == null ? '' : params[key]);
        });
        body.append('nonce', data.nonce);
        return fetch(data.ajaxUrl, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
            body: body.toString()
        }).then(function (response) {
            return response.json().then(function (json) {
                if (!response.ok || !json || !json.success) {
                    var message = json && json.data && json.data.message ? json.data.message : 'Unable to load Simme Media.';
                    throw new Error(message);
                }
                return json.data;
            });
        });
    }


    function acceptForType(type) {
        if (type === 'image') { return 'image/*'; }
        if (type === 'audio') { return 'audio/*'; }
        if (type === 'video') { return 'video/*'; }
        if (type === 'document') { return '.pdf,.txt,.json,.zip,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv'; }
        return '';
    }

    function fileMatchesType(file, type) {
        if (!file || !type || type === 'all') { return true; }
        var mime = String(file.type || '').toLowerCase();
        var name = String(file.name || '').toLowerCase();
        if (type === 'image') { return mime.indexOf('image/') === 0 || /\.(jpe?g|png|gif|webp|avif|svg)$/i.test(name); }
        if (type === 'audio') { return mime.indexOf('audio/') === 0 || /\.(mp3|wav|m4a|aac|flac|ogg)$/i.test(name); }
        if (type === 'video') { return mime.indexOf('video/') === 0 || /\.(mp4|mov|webm|avi|m4v)$/i.test(name); }
        if (type === 'document') { return mime.indexOf('application/') === 0 || mime.indexOf('text/') === 0 || /\.(pdf|txt|json|zip|docx?|xlsx?|pptx?|csv)$/i.test(name); }
        return true;
    }

    function uploadFile(file, folderId, onProgress) {
        return new Promise(function (resolve, reject) {
            var xhr = new XMLHttpRequest();
            var form = new FormData();
            form.append('action', 'simme_media_organiser_upload_media');
            form.append('nonce', data.nonce);
            form.append('folder_id', folderId || 0);
            form.append('file', file, file.name);

            xhr.open('POST', data.ajaxUrl, true);
            xhr.withCredentials = true;
            xhr.upload.onprogress = function (event) {
                if (event.lengthComputable && typeof onProgress === 'function') {
                    onProgress(Math.max(0, Math.min(100, Math.round((event.loaded / event.total) * 100))));
                }
            };
            xhr.onerror = function () { reject(new Error('Upload failed before WordPress could respond.')); };
            xhr.onload = function () {
                var json = null;
                try { json = JSON.parse(xhr.responseText || '{}'); } catch (e) {}
                if (xhr.status < 200 || xhr.status >= 300 || !json || !json.success) {
                    var message = json && json.data && json.data.message ? json.data.message : 'WordPress could not upload this file.';
                    reject(new Error(message));
                    return;
                }
                resolve(json.data || {});
            };
            xhr.send(form);
        });
    }

    function accessiblePickerDocuments() {
        var docs = [];
        function add(doc) {
            if (!doc || !doc.documentElement) { return; }
            for (var i = 0; i < docs.length; i++) { if (docs[i] === doc) { return; } }
            docs.push(doc);
        }
        add(document);
        try { if (window.parent && window.parent.document) { add(window.parent.document); } } catch (e) {}
        try { if (window.top && window.top.document) { add(window.top.document); } } catch (e) {}
        return docs;
    }

    function normalisedButtonText(button) {
        return String((button && (button.textContent || button.value)) || '').replace(/\s+/g, ' ').trim();
    }

    function findHostActionBar(button, doc) {
        if (!button || !doc) { return null; }
        var win = doc.defaultView || window;
        var viewportWidth = Math.max(1, win.innerWidth || doc.documentElement.clientWidth || 1);
        var node = button.parentElement;
        var fallback = node;
        for (var i = 0; node && node !== doc.body && i < 8; i++, node = node.parentElement) {
            var rect = null;
            try { rect = node.getBoundingClientRect(); } catch (e) {}
            if (!rect) { continue; }
            if (rect.width >= viewportWidth * 0.58 && rect.height >= 48 && rect.height <= 180) {
                return node;
            }
            if (rect.width > (fallback && fallback.getBoundingClientRect ? fallback.getBoundingClientRect().width : 0)) {
                fallback = node;
            }
        }
        return fallback;
    }

    function restoreHostChrome(view) {
        (view.hostChromeNodes || []).forEach(function (record) {
            var node = record.node;
            if (!node) { return; }
            if (record.className !== undefined) { node.className = record.className; }
            if (record.style !== undefined) { node.setAttribute('style', record.style); }
            else { node.removeAttribute('style'); }
            if (record.text !== undefined) { node.textContent = record.text; }
        });
        view.hostChromeNodes = [];
    }

    function rememberHostNode(view, node, rememberText) {
        if (!node) { return; }
        view.hostChromeNodes = view.hostChromeNodes || [];
        for (var i = 0; i < view.hostChromeNodes.length; i++) {
            if (view.hostChromeNodes[i].node === node) { return; }
        }
        view.hostChromeNodes.push({
            node: node,
            className: node.className,
            style: node.hasAttribute('style') ? node.getAttribute('style') : undefined,
            text: rememberText ? node.textContent : undefined
        });
    }


    function syncPickerResponsiveState(view) {
        if (!view || !view.el || !view.el.classList) { return 0; }
        var rect = view.el.getBoundingClientRect ? view.el.getBoundingClientRect() : null;
        var width = rect && rect.width ? rect.width : (view.el.clientWidth || 0);
        if (!width && view.el.ownerDocument && view.el.ownerDocument.documentElement) {
            width = view.el.ownerDocument.documentElement.clientWidth || 0;
        }
        view.el.classList.toggle('is-compact', width > 0 && width <= 1080);
        view.el.classList.toggle('is-narrow', width > 0 && width <= 820);
        view.el.classList.toggle('is-phone', width > 0 && width <= 540);
        view.pickerResponsiveWidth = width;
        return width;
    }

    function selectionActionLabel(type, count, multiple) {
        if (multiple) {
            if (count > 0) {
                var noun = type === 'image' ? (count === 1 ? 'image' : 'images') : (count === 1 ? 'file' : 'files');
                return 'Insert ' + count + ' ' + noun;
            }
            return type === 'image' ? 'Select images' : 'Select files';
        }
        if (type === 'image') { return count ? 'Use selected image' : 'Select an image'; }
        return count ? 'Use selected file' : 'Select a file';
    }

    function themeExternalHostAction(view) {
        if (!view) { return; }
        var pickerWidth = syncPickerResponsiveState(view);
        var narrowHost = pickerWidth > 0 && pickerWidth <= 820;
        var docs = accessiblePickerDocuments();
        var count = view.selection && view.selection.length ? view.selection.length : 0;
        var multiple = !!view.multipleSelection;
        var patterns = [/^insert file url$/i, /^insert media$/i, /^insert image$/i, /^insert$/i, /^insert \d+ /i, /^select$/i, /^select an image$/i, /^select images$/i, /^select a file$/i, /^select files$/i, /^use selected/i];

        docs.forEach(function (doc) {
            ensurePickerStyles(doc);
            var buttons = Array.prototype.slice.call(doc.querySelectorAll('button,input[type="button"],input[type="submit"],a.button,.button'));
            buttons.forEach(function (button) {
                var text = normalisedButtonText(button);
                var matches = patterns.some(function (pattern) { return pattern.test(text); });
                if (!matches) { return; }
                var bar = findHostActionBar(button, doc);
                if (!bar) { return; }

                rememberHostNode(view, bar, false);
                rememberHostNode(view, button, true);
                bar.classList.add('smo-simme-host-actionbar');
                bar.classList.toggle('is-simme-narrow', narrowHost);
                button.classList.add('smo-simme-host-action');

                /* Inline fallbacks are intentional: some Themify media controls live
                   outside the WordPress media document and do not inherit plugin CSS. */
                bar.style.setProperty('background', 'linear-gradient(180deg,#0d141e 0%,#091019 100%)', 'important');
                bar.style.setProperty('border-top', '1px solid rgba(255,255,255,.08)', 'important');
                bar.style.setProperty('min-height', narrowHost ? '66px' : '76px', 'important');
                bar.style.setProperty('padding', narrowHost ? '10px' : '12px 22px', 'important');
                button.style.setProperty('width', narrowHost ? '100%' : '', 'important');
                button.style.setProperty('min-width', narrowHost ? '0' : '176px', 'important');
                button.style.setProperty('min-height', '48px', 'important');
                button.style.setProperty('padding', '0 20px', 'important');
                button.style.setProperty('border', '1px solid rgba(140,92,255,.62)', 'important');
                button.style.setProperty('border-radius', '13px', 'important');
                button.style.setProperty('background', count ? 'linear-gradient(135deg,#8c5cff,#653cd2)' : '#151c28', 'important');
                button.style.setProperty('color', count ? '#ffffff' : '#68768a', 'important');
                button.style.setProperty('box-shadow', count ? '0 12px 26px rgba(98,60,205,.24), inset 0 1px 0 rgba(255,255,255,.16)' : 'none', 'important');
                button.style.setProperty('font-weight', '800', 'important');
                button.textContent = selectionActionLabel(view.type, count, multiple);
            });
        });
    }

    function initWhenReady() {
        if (!window.wp || !window.wp.media || !window.wp.media.view || !window.wp.media.view.MediaFrame || !window.wp.media.view.MediaFrame.Select || !window.wp.Backbone) {
            return false;
        }
        patchMediaFrame();
        return true;
    }

    function patchMediaFrame() {
        var Select = window.wp.media.view.MediaFrame.Select;
        var proto = Select.prototype;
        if (proto.__simmeMediaPickerPatched) {
            return;
        }
        proto.__simmeMediaPickerPatched = true;

        var originalBrowseRouter = proto.browseRouter;
        var originalBindHandlers = proto.bindHandlers;

        proto.browseRouter = function (routerView) {
            originalBrowseRouter.apply(this, arguments);
            routerView.set({
                'simme-media': {
                    text: (data.strings && data.strings.tab) || 'Simme Media',
                    priority: 60
                }
            });
        };

        proto.bindHandlers = function () {
            originalBindHandlers.apply(this, arguments);
            this.on('content:render:simme-media', this.simmeMediaPickerContent, this);
        };

        proto.simmeMediaPickerContent = function () {
            this.$el.removeClass('hide-toolbar');
            var frameElement = this.el || (this.$el && this.$el[0]);
            var frameDocument = frameElement && frameElement.ownerDocument ? frameElement.ownerDocument : document;
            ensurePickerStyles(frameDocument);
            ensureAccessiblePickerDocuments();
            var pickerView = new SimmePickerView({
                controller: this,
                selection: this.state().get('selection'),
                model: this.state()
            });
            this.content.set(pickerView);
            // Themify Visual Builder can move the media content between same-origin documents.
            // The style element lives inside the picker view so it travels with the view itself.
            attachInlinePickerStyles(pickerView.el);
            window.setTimeout(function () {
                attachInlinePickerStyles(pickerView.el);
                var liveDoc = pickerView.el && pickerView.el.ownerDocument ? pickerView.el.ownerDocument : frameDocument;
                ensurePickerStyles(liveDoc);
            }, 0);
        };
    }

    var SimmePickerView;

    function definePickerView() {
        if (SimmePickerView) {
            return;
        }
        SimmePickerView = window.wp.Backbone.View.extend({
            className: 'smo-picker-view smo-picker-accent-' + encode(data.accent || 'violet'),

            events: {
                'input .smo-picker-search': 'onSearchInput',
                'click [data-smo-picker-folder]': 'onFolderClick',
                'click .smo-picker-card': 'onCardClick',
                'mouseenter .smo-picker-card': 'showHoverPreview',
                'mouseleave .smo-picker-card': 'hideHoverPreview',
                'focusin .smo-picker-card': 'showHoverPreview',
                'focusout .smo-picker-card': 'hideHoverPreview',
                'click .smo-picker-prev': 'previousPage',
                'click .smo-picker-next': 'nextPage',
                'click .smo-picker-choose-files': 'chooseFiles',
                'change .smo-picker-upload-input': 'onFilesChosen',
                'change .smo-picker-upload-folder': 'onUploadFolderChange',
                'dragenter .smo-picker-dropzone': 'onDragEnter',
                'dragover .smo-picker-dropzone': 'onDragOver',
                'dragleave .smo-picker-dropzone': 'onDragLeave',
                'drop .smo-picker-dropzone': 'onDrop'
            },

            initialize: function (options) {
                this.controller = options.controller;
                this.selection = options.selection;
                this.type = requestedType(this.controller);
                this.multipleSelection = allowsMultipleSelection(this.controller, options.model);
                this.items = [];
                this.pages = 1;
                this.total = 0;
                this.currentPath = 'All media';
                this.loading = false;
                this.searchTimer = null;
                this.folders = flattenFolders(data.folders || []);
                this.uploading = false;
                this.dragDepth = 0;
                this.uploadFolder = 0;
                this.uploadFolderManuallyChanged = false;
                this.hoverPreview = null;
                this.hostChromeNodes = [];
                this.hostChromeTimer = null;
                this.state = {
                    folder: pickerMemory.folder || 'all',
                    search: pickerMemory.search || '',
                    page: pickerMemory.page || 1,
                    sort: pickerMemory.sort || 'date_desc'
                };
                this.listenTo(this.selection, 'add remove reset update', this.syncSelection);
                this.render();
                this.load();
                var self = this;
                syncPickerResponsiveState(this);
                if (window.ResizeObserver) {
                    this.responsiveObserver = new window.ResizeObserver(function () {
                        syncPickerResponsiveState(self);
                        themeExternalHostAction(self);
                    });
                    this.responsiveObserver.observe(this.el);
                }
                themeExternalHostAction(this);
                this.hostChromeTimer = window.setInterval(function () { themeExternalHostAction(self); }, 350);
            },

            remove: function () {
                if (this.searchTimer) {
                    window.clearTimeout(this.searchTimer);
                }
                this.destroyHoverPreview();
                if (this.hostChromeTimer) { window.clearInterval(this.hostChromeTimer); this.hostChromeTimer = null; }
                if (this.responsiveObserver) { this.responsiveObserver.disconnect(); this.responsiveObserver = null; }
                restoreHostChrome(this);
                this.stopListening();
                return window.wp.Backbone.View.prototype.remove.apply(this, arguments);
            },

            render: function () {
                ensurePickerStyles(this.el && this.el.ownerDocument ? this.el.ownerDocument : document);
                var strings = data.strings || {};
                this.el.innerHTML = '' +
                    '<div class="smo-picker-shell">' +
                        '<aside class="smo-picker-sidebar">' +
                            '<div class="smo-picker-brand"><img class="smo-picker-brand__lockup" src="' + encode(data.brandLockupUrl || data.brandLogoUrl || '') + '" alt="' + encode(data.brandLogoAlt || 'Simme Media Organiser logo') + '"></div>' +
                            '<label class="smo-picker-search-wrap"><span class="screen-reader-text">Search media</span><input type="search" class="smo-picker-search" value="' + encode(this.state.search) + '" placeholder="' + encode(strings.search || 'Search organised media…') + '"></label>' +
                            '<nav class="smo-picker-smart">' +
                                this.navButton('all', strings.allMedia || 'All media', '▦') +
                                this.navButton('favourites', strings.favourites || 'Favourites', '♡') +
                                this.navButton('recent', strings.recent || 'Recently added', '◷') +
                                this.navButton('unfiled', strings.unfiled || 'Unfiled', '□') +
                            '</nav>' +
                            '<div class="smo-picker-section-title">' + encode(strings.folders || 'Folders') + '</div>' +
                            '<div class="smo-picker-folders">' + this.folderButtons() + '</div>' +
                            '<a class="smo-picker-open-full" href="' + encode(data.libraryUrl || '#') + '" target="_blank" rel="noopener">' + encode(strings.openLibrary || 'Open full Simme Media Organiser') + ' ↗</a>' +
                        '</aside>' +
                        '<main class="smo-picker-main">' +
                            '<header class="smo-picker-main-head"><div><span class="smo-picker-eyebrow">SIMME MEDIA</span><h2 class="smo-picker-path">' + encode(this.currentPath) + '</h2></div><div class="smo-picker-head-meta"><span class="smo-picker-type">' + encode(humanKind(this.type)) + '</span><span class="smo-picker-selection-mode' + (this.multipleSelection ? ' is-multiple' : ' is-single') + '">' + (this.multipleSelection ? 'Select multiple' : 'Select one') + '</span><span class="smo-picker-selection-count">0 selected</span></div></header>' +
                            this.uploadPanelHtml() +
                            '<div class="smo-picker-grid" aria-live="polite"></div>' +
                            '<footer class="smo-picker-pagination"><button type="button" class="button smo-picker-prev">← ' + encode(strings.previous || 'Previous') + '</button><span class="smo-picker-page">' + encode(strings.page || 'Page') + ' 1 of 1</span><button type="button" class="button smo-picker-next">' + encode(strings.next || 'Next') + ' →</button></footer>' +
                        '</main>' +
                    '</div>';
                attachInlinePickerStyles(this.el);
                syncPickerResponsiveState(this);
                this.syncSelection();
                this.syncUploadDestination();
                return this;
            },

            navButton: function (id, label, icon) {
                return '<button type="button" class="smo-picker-nav ' + (this.state.folder === id ? 'is-active' : '') + '" data-smo-picker-folder="' + encode(id) + '"><span class="smo-picker-nav-icon">' + encode(icon) + '</span><span>' + encode(label) + '</span></button>';
            },

            folderButtons: function () {
                var self = this;
                if (!this.folders.length) {
                    return '<div class="smo-picker-no-folders">No virtual folders yet.</div>';
                }
                return this.folders.map(function (folder) {
                    var active = String(self.state.folder) === String(folder.id) ? ' is-active' : '';
                    var indent = Math.min(5, folder.depth) * 10;
                    return '<button type="button" class="smo-picker-folder' + active + '" data-smo-picker-folder="' + encode(folder.id) + '" style="--smo-folder-colour:' + encode(folder.colour || '#657287') + ';padding-left:' + (12 + indent) + 'px"><i></i><span>' + encode(folder.name) + '</span><small>' + encode(folder.count) + '</small></button>';
                }).join('');
            },


            uploadFolderOptions: function () {
                var html = '<option value="0">Unfiled</option>';
                this.folders.forEach(function (folder) {
                    var indent = new Array(Math.min(5, folder.depth) + 1).join('— ');
                    html += '<option value="' + encode(folder.id) + '">' + encode(indent + folder.name) + '</option>';
                });
                return html;
            },

            uploadPanelHtml: function () {
                var strings = data.strings || {};
                var accept = acceptForType(this.type);
                var dropLabel = this.type === 'all' ? (strings.dropFiles || 'Drop files here') : ((strings.dropPrefix || 'Drop') + ' ' + humanKind(this.type).toLowerCase() + ' ' + (strings.dropSuffix || 'here'));
                return '<section class="smo-picker-upload-panel">' +
                    '<div class="smo-picker-dropzone" tabindex="0">' +
                        '<input class="smo-picker-upload-input" type="file" ' + (this.multipleSelection ? 'multiple ' : '') + (accept ? 'accept="' + encode(accept) + '"' : '') + ' hidden>' +
                        '<span class="smo-picker-upload-icon" aria-hidden="true">↑</span>' +
                        '<div class="smo-picker-upload-copy"><strong>' + encode(dropLabel) + '</strong><span>' + encode(strings.uploadOr || 'Drag files straight from your computer or use the quick button.') + '</span><div class="smo-picker-upload-actions"><button type="button" class="smo-picker-choose-files">' + encode(strings.chooseFiles || 'Choose files') + '</button><span class="smo-picker-upload-hint">' + encode(strings.dragHint || 'or drag and drop them here') + '</span></div><small>' + encode((data.maxUploadLabel ? 'Maximum per file: ' + data.maxUploadLabel : '') || 'Uploads use normal WordPress media handling.') + '</small></div>' +
                    '</div>' +
                    '<div class="smo-picker-upload-destination">' +
                        '<label><span>' + encode(strings.uploadTo || 'Upload to') + '</span><select class="smo-picker-upload-folder">' + this.uploadFolderOptions() + '</select></label>' +
                        '<small>' + encode(strings.uploadSafety || 'Virtual filing never changes the physical WordPress upload URL.') + '</small>' +
                    '</div>' +
                    '<div class="smo-picker-upload-status" aria-live="polite" hidden><div><strong>Uploading…</strong><span></span></div><div class="smo-picker-upload-progress"><i></i></div></div>' +
                '</section>';
            },

            syncUploadDestination: function () {
                var numericFolder = /^\d+$/.test(String(this.state.folder || '')) ? parseInt(this.state.folder, 10) : 0;
                if (!this.uploadFolderManuallyChanged) {
                    this.uploadFolder = numericFolder || 0;
                }
                var select = this.$('.smo-picker-upload-folder');
                if (select && select.length) { select.val(String(this.uploadFolder || 0)); }
            },

            chooseFiles: function (event) {
                event.preventDefault();
                event.stopPropagation();
                if (this.uploading) { return; }
                var input = this.$('.smo-picker-upload-input');
                if (input && input.length && input[0]) { input[0].click(); }
            },

            onFilesChosen: function (event) {
                var files = Array.prototype.slice.call(event.currentTarget.files || []);
                event.currentTarget.value = '';
                this.processUploads(files);
            },

            onUploadFolderChange: function (event) {
                this.uploadFolder = parseInt(event.currentTarget.value || '0', 10) || 0;
                this.uploadFolderManuallyChanged = true;
            },

            onDragEnter: function (event) {
                event.preventDefault();
                event.stopPropagation();
                if (this.uploading) { return; }
                this.dragDepth += 1;
                event.currentTarget.classList.add('is-dragging');
            },

            onDragOver: function (event) {
                event.preventDefault();
                event.stopPropagation();
                if (event.originalEvent && event.originalEvent.dataTransfer) { event.originalEvent.dataTransfer.dropEffect = 'copy'; }
                else if (event.dataTransfer) { event.dataTransfer.dropEffect = 'copy'; }
            },

            onDragLeave: function (event) {
                event.preventDefault();
                event.stopPropagation();
                this.dragDepth = Math.max(0, this.dragDepth - 1);
                if (!this.dragDepth) { event.currentTarget.classList.remove('is-dragging'); }
            },

            onDrop: function (event) {
                event.preventDefault();
                event.stopPropagation();
                this.dragDepth = 0;
                event.currentTarget.classList.remove('is-dragging');
                if (this.uploading) { return; }
                var original = event.originalEvent || event;
                var files = original.dataTransfer && original.dataTransfer.files ? Array.prototype.slice.call(original.dataTransfer.files) : [];
                this.processUploads(files);
            },

            setUploadStatus: function (visible, title, detail, percent, tone) {
                var status = this.$('.smo-picker-upload-status');
                if (!status || !status.length) { return; }
                status.prop('hidden', !visible);
                status.toggleClass('is-error', tone === 'error');
                status.toggleClass('is-success', tone === 'success');
                status.find('strong').text(title || 'Uploading…');
                status.find('span').text(detail || '');
                status.find('i').css('width', Math.max(0, Math.min(100, percent || 0)) + '%');
            },

            selectUploaded: function (items) {
                var self = this;
                if (!items || !items.length || !this.selection) { return; }
                var multiple = allowsMultipleSelection(this.controller, this.model);
                this.multipleSelection = multiple;
                if (!multiple) {
                    items = [items[items.length - 1]];
                    this.selection.reset([]);
                }
                items.forEach(function (item) {
                    var id = parseInt(item.id, 10);
                    if (!id) { return; }
                    var attachment = window.wp.media.attachment(id);
                    attachment.set({
                        id: id,
                        title: item.title || item.filename,
                        filename: item.filename,
                        url: item.url,
                        mime: item.mime,
                        type: item.kind,
                        subtype: String(item.mime || '').split('/')[1] || '',
                        width: item.width || 0,
                        height: item.height || 0,
                        icon: item.thumb || item.url
                    });
                    try { attachment.fetch(); } catch (e) {}
                    if (multiple) { self.selection.add(attachment); }
                    else { self.selection.reset([attachment]); }
                });
                this.syncSelection();
            },

            processUploads: function (files) {
                var self = this;
                if (this.uploading || !files || !files.length) { return; }
                var allowed = [];
                var rejected = [];
                var maxBytes = parseInt(data.maxUploadBytes || '0', 10) || 0;
                files.forEach(function (file) {
                    if (!fileMatchesType(file, self.type)) { rejected.push(file.name + ': wrong media type for this picker'); return; }
                    if (maxBytes && file.size > maxBytes) { rejected.push(file.name + ': larger than ' + (data.maxUploadLabel || 'the WordPress upload limit')); return; }
                    allowed.push(file);
                });
                if (!allowed.length) {
                    this.setUploadStatus(true, 'Nothing uploaded', rejected.join(' · ') || 'Choose a supported file.', 0, 'error');
                    return;
                }

                this.uploading = true;
                this.$('.smo-picker-upload-panel').addClass('is-uploading');
                var uploaded = [];
                var failures = rejected.slice();
                var index = 0;
                var folderId = this.uploadFolder || 0;

                var next = function () {
                    if (index >= allowed.length) {
                        self.uploading = false;
                        self.$('.smo-picker-upload-panel').removeClass('is-uploading');
                        var done = uploaded.length;
                        var total = files.length;
                        var summary = done + ' of ' + total + ' uploaded' + (failures.length ? ' · ' + failures.length + ' skipped/failed' : '');
                        self.setUploadStatus(true, done ? 'Upload complete' : 'Upload failed', summary, done ? 100 : 0, done ? 'success' : 'error');
                        self.selectUploaded(uploaded);
                        self.state.search = '';
                        self.state.page = 1;
                        self.state.folder = folderId ? String(folderId) : 'recent';
                        pickerMemory.folder = self.state.folder;
                        pickerMemory.search = '';
                        self.uploadFolderManuallyChanged = false;
                        self.load();
                        if (failures.length) {
                            window.setTimeout(function () {
                                self.setUploadStatus(true, 'Some files need attention', failures.join(' · '), 100, 'error');
                            }, 900);
                        } else {
                            window.setTimeout(function () { self.setUploadStatus(false, '', '', 0, ''); }, 2400);
                        }
                        return;
                    }
                    var file = allowed[index];
                    var position = index + 1;
                    self.setUploadStatus(true, 'Uploading ' + position + ' of ' + allowed.length, file.name, 0, '');
                    uploadFile(file, folderId, function (percent) {
                        var overall = Math.round(((index + (percent / 100)) / allowed.length) * 100);
                        self.setUploadStatus(true, 'Uploading ' + position + ' of ' + allowed.length, file.name + ' · ' + percent + '%', overall, '');
                    }).then(function (result) {
                        if (result && result.item) { uploaded.push(result.item); }
                    }).catch(function (error) {
                        failures.push(file.name + ': ' + (error.message || 'upload failed'));
                    }).then(function () {
                        index += 1;
                        next();
                    });
                };
                next();
            },

            load: function () {
                var self = this;
                if (this.loading) { return; }
                this.loading = true;
                var grid = this.$('.smo-picker-grid');
                if (grid && grid.length) {
                    grid.html('<div class="smo-picker-loading"><span></span>' + encode((data.strings && data.strings.loading) || 'Loading organised media…') + '</div>');
                }
                post({
                    action: 'simme_media_organiser_list_media',
                    page: this.state.page,
                    per_page: 48,
                    search: this.state.search,
                    folder: this.state.folder,
                    type: this.type,
                    alt: 'all',
                    sort: this.state.sort,
                    favourite_only: 0
                }).then(function (result) {
                    self.loading = false;
                    self.items = result.items || [];
                    self.total = result.total || 0;
                    self.pages = Math.max(1, result.pages || 1);
                    self.state.page = Math.min(self.state.page, self.pages);
                    self.currentPath = result.currentPath || 'All media';
                    if (result.folders) {
                        data.folders = result.folders;
                        self.folders = flattenFolders(result.folders);
                    }
                    pickerMemory.folder = self.state.folder;
                    pickerMemory.search = self.state.search;
                    pickerMemory.page = self.state.page;
                    self.renderResults();
                }).catch(function (error) {
                    self.loading = false;
                    var target = self.$('.smo-picker-grid');
                    if (target && target.length) {
                        target.html('<div class="smo-picker-empty"><strong>Could not load Simme Media</strong><span>' + encode(error.message || 'Please try again.') + '</span></div>');
                    }
                });
            },

            renderResults: function () {
                var self = this;
                this.hideHoverPreview();
                this.$('.smo-picker-path').text(this.currentPath);
                this.$('.smo-picker-folders').html(this.folderButtons());
                var uploadSelect = this.$('.smo-picker-upload-folder');
                if (uploadSelect && uploadSelect.length) { uploadSelect.html(this.uploadFolderOptions()); }
                this.syncUploadDestination();
                this.$('.smo-picker-smart').html(
                    this.navButton('all', (data.strings && data.strings.allMedia) || 'All media', '▦') +
                    this.navButton('favourites', (data.strings && data.strings.favourites) || 'Favourites', '♡') +
                    this.navButton('recent', (data.strings && data.strings.recent) || 'Recently added', '◷') +
                    this.navButton('unfiled', (data.strings && data.strings.unfiled) || 'Unfiled', '□')
                );
                var grid = this.$('.smo-picker-grid');
                if (!this.items.length) {
                    grid.html('<div class="smo-picker-empty"><strong>' + encode((data.strings && data.strings.empty) || 'No media matches this Simme view.') + '</strong><span>Try another folder or search.</span></div>');
                } else {
                    grid.html(this.items.map(function (item) { return self.cardHtml(item); }).join(''));
                }
                this.$('.smo-picker-page').text(((data.strings && data.strings.page) || 'Page') + ' ' + this.state.page + ' of ' + this.pages);
                this.$('.smo-picker-prev').prop('disabled', this.state.page <= 1);
                this.$('.smo-picker-next').prop('disabled', this.state.page >= this.pages);
                this.syncSelection();
            },

            cardHtml: function (item) {
                var preview = item.thumb ? '<img src="' + encode(item.thumb) + '" alt="" loading="lazy">' : genericPreview(item);
                var folder = item.folder && item.folder.path ? item.folder.path : 'Unfiled';
                var details = [];
                if (item.width && item.height) { details.push(item.width + ' × ' + item.height); }
                if (item.size) { details.push(item.size); }
                if (item.loadGrade) { details.push('Load ' + item.loadGrade); }
                var selected = this.selection && this.selection.get && this.selection.get(item.id);
                return '<button type="button" class="smo-picker-card' + (selected ? ' is-selected' : '') + '" data-attachment-id="' + encode(item.id) + '" aria-pressed="' + (selected ? 'true' : 'false') + '">' +
                    '<span class="smo-picker-card-preview">' + preview + '<span class="smo-picker-file-badge ' + fileBadgeClass(item) + '">' + encode(item.extension || 'FILE') + '</span><span class="smo-picker-selected-mark">✓</span></span>' +
                    '<span class="smo-picker-card-copy"><strong title="' + encode(item.title || item.filename) + '">' + encode(item.title || item.filename) + '</strong><small title="' + encode(folder) + '"><i style="--folder-colour:' + encode(item.folder && item.folder.colour ? item.folder.colour : '#657287') + '"></i>' + encode(folder) + '</small><em>' + encode(details.join(' · ')) + '</em></span>' +
                '</button>';
            },

            onSearchInput: function (event) {
                var self = this;
                this.state.search = event.currentTarget.value || '';
                this.state.page = 1;
                if (this.searchTimer) { window.clearTimeout(this.searchTimer); }
                this.searchTimer = window.setTimeout(function () { self.load(); }, 280);
            },

            onFolderClick: function (event) {
                event.preventDefault();
                this.state.folder = String(event.currentTarget.getAttribute('data-smo-picker-folder') || 'all');
                this.state.page = 1;
                this.uploadFolderManuallyChanged = false;
                this.uploadFolder = /^\d+$/.test(this.state.folder) ? (parseInt(this.state.folder, 10) || 0) : 0;
                this.load();
            },

            findItem: function (id) {
                id = parseInt(id, 10);
                for (var i = 0; i < this.items.length; i++) {
                    if (parseInt(this.items[i].id, 10) === id) { return this.items[i]; }
                }
                return null;
            },

            ensureHoverPreview: function () {
                if (this.hoverPreview && this.hoverPreview.parentNode) { return this.hoverPreview; }
                var doc = this.el && this.el.ownerDocument ? this.el.ownerDocument : document;
                var node = doc.createElement('div');
                node.className = 'smo-picker-hover-preview';
                node.setAttribute('aria-hidden', 'true');
                var computed;
                try { computed = doc.defaultView.getComputedStyle(this.el); } catch (e) { computed = null; }
                if (computed) {
                    var accent = computed.getPropertyValue('--smo-picker-accent');
                    var accentRgb = computed.getPropertyValue('--smo-picker-accent-rgb');
                    if (accent) { node.style.setProperty('--smo-picker-accent', accent.trim()); }
                    if (accentRgb) { node.style.setProperty('--smo-picker-accent-rgb', accentRgb.trim()); }
                }
                doc.body.appendChild(node);
                this.hoverPreview = node;
                return node;
            },

            destroyHoverPreview: function () {
                if (this.hoverPreview && this.hoverPreview.parentNode) {
                    this.hoverPreview.parentNode.removeChild(this.hoverPreview);
                }
                this.hoverPreview = null;
            },

            showHoverPreview: function (event) {
                var card = event.currentTarget;
                var id = parseInt(card.getAttribute('data-attachment-id'), 10);
                var item = this.findItem(id);
                if (!item || item.kind !== 'image') { return; }

                var popup = this.ensureHoverPreview();
                var folder = item.folder && item.folder.path ? item.folder.path : 'Unfiled';
                var dims = item.width && item.height ? (item.width + ' × ' + item.height) : 'Dimensions unavailable';
                var altLabel = item.alt ? 'ALT ✓' : 'ALT !';
                var loadLabel = item.loadGrade ? ('Load ' + item.loadGrade) : 'Load —';
                var previewUrl = item.previewUrl || item.url || item.thumb || '';
                var title = item.title || item.filename || 'Media item';

                popup.innerHTML = '' +
                    '<div class="smo-picker-hover-canvas">' +
                        (previewUrl ? '<img src="' + encode(previewUrl) + '" alt="">' : genericPreview(item)) +
                        '<span class="smo-picker-hover-format ' + fileBadgeClass(item) + '">' + encode(item.extension || 'FILE') + '</span>' +
                    '</div>' +
                    '<div class="smo-picker-hover-details">' +
                        '<strong title="' + encode(title) + '">' + encode(title) + '</strong>' +
                        '<span class="smo-picker-hover-filename">' + encode(item.filename || '') + '</span>' +
                        '<div class="smo-picker-hover-meta">' +
                            '<span>' + encode(dims) + '</span>' +
                            '<span>' + encode(item.size || 'Size unavailable') + '</span>' +
                            '<span>' + encode(loadLabel) + '</span>' +
                            '<span class="' + (item.alt ? 'is-good' : 'is-warning') + '">' + encode(altLabel) + '</span>' +
                        '</div>' +
                        '<div class="smo-picker-hover-folder"><i style="--folder-colour:' + encode(item.folder && item.folder.colour ? item.folder.colour : '#657287') + '"></i><span>' + encode(folder) + '</span></div>' +
                        '<small>' + (this.multipleSelection ? 'Click to add or remove this image from the selection' : 'Click to select this image') + '</small>' +
                    '</div>';

                popup.classList.add('is-visible');
                popup.style.visibility = 'hidden';
                popup.style.left = '0px';
                popup.style.top = '0px';

                var doc = popup.ownerDocument || document;
                var win = doc.defaultView || window;
                var rect = card.getBoundingClientRect();
                var box = popup.getBoundingClientRect();
                var gap = 14;
                var margin = 12;
                var left;
                var top;

                if ((win.innerWidth - rect.right) >= box.width + gap) {
                    left = rect.right + gap;
                } else if (rect.left >= box.width + gap) {
                    left = rect.left - box.width - gap;
                } else {
                    left = Math.max(margin, Math.min(win.innerWidth - box.width - margin, rect.left + (rect.width - box.width) / 2));
                }
                top = rect.top + (rect.height - box.height) / 2;
                top = Math.max(margin, Math.min(win.innerHeight - box.height - margin, top));

                popup.style.left = Math.round(left) + 'px';
                popup.style.top = Math.round(top) + 'px';
                popup.style.visibility = 'visible';
            },

            hideHoverPreview: function () {
                if (!this.hoverPreview) { return; }
                this.hoverPreview.classList.remove('is-visible');
                this.hoverPreview.style.visibility = 'hidden';
            },

            onCardClick: function (event) {
                event.preventDefault();
                var self = this;
                var button = event.currentTarget;
                var id = parseInt(button.getAttribute('data-attachment-id'), 10);
                var item = this.findItem(id);
                if (!id || !item || !this.selection) { return; }

                var attachment = window.wp.media.attachment(id);
                var applySelection = function () {
                    var multiple = allowsMultipleSelection(self.controller, self.model);
                    self.multipleSelection = multiple;
                    if (multiple) {
                        if (self.selection.get(id)) {
                            self.selection.remove(self.selection.get(id));
                        } else {
                            self.selection.add(attachment);
                        }
                    } else {
                        self.selection.reset([attachment]);
                    }
                    self.syncSelection();
                };

                attachment.set({
                    id: id,
                    title: item.title || item.filename,
                    filename: item.filename,
                    url: item.url,
                    mime: item.mime,
                    type: item.kind,
                    subtype: String(item.mime || '').split('/')[1] || '',
                    width: item.width || 0,
                    height: item.height || 0,
                    icon: item.thumb || item.url
                });

                button.classList.add('is-resolving');
                var request;
                try { request = attachment.fetch(); } catch (e) { request = null; }
                if (request && request.always) {
                    request.always(function () {
                        button.classList.remove('is-resolving');
                        applySelection();
                    });
                } else {
                    button.classList.remove('is-resolving');
                    applySelection();
                }
            },

            syncSelection: function () {
                var self = this;
                var count = this.selection && this.selection.length ? this.selection.length : 0;
                var multiple = allowsMultipleSelection(this.controller, this.model);
                this.multipleSelection = multiple;
                var countNode = this.$('.smo-picker-selection-count');
                if (countNode && countNode.length) {
                    countNode.text(count + ' ' + ((data.strings && data.strings.selected) || 'selected').toLowerCase());
                }
                var modeNode = this.$('.smo-picker-selection-mode');
                if (modeNode && modeNode.length) {
                    modeNode.text(multiple ? 'Select multiple' : 'Select one');
                    modeNode.toggleClass('is-multiple', multiple);
                    modeNode.toggleClass('is-single', !multiple);
                }
                this.$('.smo-picker-card').each(function () {
                    var id = parseInt(this.getAttribute('data-attachment-id'), 10);
                    var selected = self.selection && self.selection.get && !!self.selection.get(id);
                    this.classList.toggle('is-selected', selected);
                    this.setAttribute('aria-pressed', selected ? 'true' : 'false');
                });
                themeExternalHostAction(this);
            },

            previousPage: function () {
                if (this.state.page <= 1) { return; }
                this.state.page -= 1;
                this.load();
            },

            nextPage: function () {
                if (this.state.page >= this.pages) { return; }
                this.state.page += 1;
                this.load();
            }
        });
    }

    ensureAccessiblePickerDocuments();

    var tries = 0;
    var timer = window.setInterval(function () {
        tries += 1;
        if (window.wp && window.wp.Backbone) {
            definePickerView();
        }
        if (initWhenReady() || tries > 240) {
            window.clearInterval(timer);
        }
    }, 250);

    if (window.wp && window.wp.Backbone) {
        definePickerView();
        if (initWhenReady()) {
            window.clearInterval(timer);
        }
    }
}());

/**
 * AnyPlay Frontend - Rewritten from Scratch with Tailwind CSS integration
 */

const interceptedLogs = [];
function interceptConsole() {
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;
    
    function appendLog(type, args) {
        const time = new Date().toLocaleTimeString('en-US', { hour12: false });
        const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
        interceptedLogs.push(`[${time}] [${type}] ${msg}`);
        if (interceptedLogs.length > 500) interceptedLogs.shift();
    }

    console.log = function(...args) {
        appendLog('INFO', args);
        originalLog.apply(console, args);
    };
    console.warn = function(...args) {
        appendLog('WARN', args);
        originalWarn.apply(console, args);
    };
    console.error = function(...args) {
        appendLog('ERROR', args);
        originalError.apply(console, args);
    };
}
interceptConsole();

document.addEventListener('DOMContentLoaded', () => {
    applySavedColors();
    
    // Hide and make Navigation Bar transparent using the Capawesome plugin
    if (window.Capacitor && window.Capacitor.Plugins.NavigationBar) {
        try {
            window.Capacitor.Plugins.NavigationBar.setTransparency({ isTransparent: true }).catch(()=>{});
            window.Capacitor.Plugins.NavigationBar.hide().catch(()=>{});
        } catch(e) {}
    }

    // --- Routing & Tab Management ---
    const isShowPage = window.location.pathname.includes('show.html');
    
    if (isShowPage) {
        initShowPage();
    } else {
        initHomePage();
    }
});

// ==========================================
// HOME PAGE LOGIC (index.html)
// ==========================================
function initHomePage() {
    // 1. Sidebar toggles (Mobile)
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    const openBtn = document.getElementById('openSidebarBtn');
    const closeBtn = document.getElementById('closeSidebarBtn');

    function toggleSidebar() {
        const isOpen = !sidebar.classList.contains('-translate-x-full');
        if (isOpen) {
            sidebar.classList.add('-translate-x-full');
            overlay.classList.add('hidden');
        } else {
            sidebar.classList.remove('-translate-x-full');
            overlay.classList.remove('hidden');
        }
    }

    if (openBtn) openBtn.addEventListener('click', toggleSidebar);
    if (closeBtn) closeBtn.addEventListener('click', toggleSidebar);
    if (overlay) overlay.addEventListener('click', toggleSidebar);

    // 2. Tab Navigation
    const tabBtns = document.querySelectorAll('.tab-btn');
    const views = document.querySelectorAll('.view-panel');

    function switchTab(tabId) {
        // Update URL
        if (window.history.pushState) {
            const url = new URL(window.location);
            url.searchParams.set('tab', tabId);
            window.history.pushState({}, '', url);
        }

        // Update Buttons
        tabBtns.forEach(btn => {
            if (btn.dataset.tab === tabId) {
                btn.classList.add('bg-gray-800', 'text-white', 'font-medium');
                btn.classList.remove('text-gray-400');
            } else {
                btn.classList.remove('bg-gray-800', 'text-white', 'font-medium');
                btn.classList.add('text-gray-400');
            }
        });

        // Update Views
        views.forEach(view => {
            if (view.id === `view-${tabId}`) {
                view.classList.remove('hidden');
                view.classList.add('block');
            } else {
                view.classList.remove('block');
                view.classList.add('hidden');
            }
        });

        // Trigger specific logic based on tab
        if (tabId === 'library') loadLibrary();
        
        // Close sidebar on mobile after clicking
        if (window.innerWidth < 768 && !sidebar.classList.contains('-translate-x-full')) {
            toggleSidebar();
        }
    }

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Check URL for active tab
    const urlParams = new URLSearchParams(window.location.search);
    const initialTab = urlParams.get('tab') || 'library';
    switchTab(initialTab);

    // 3. Polling Downloads & Storage
    setInterval(pollDownloads, 2000);
    pollStorage();
    setInterval(pollStorage, 30000); // Check storage every 30 seconds

    // 4. Attach event listeners for scrapers
    initAnimeScraper();
    initMovieScraper();
    initTVScraper();
    
    // 5. Settings Logic
    const clearCacheBtn = document.getElementById('clearCacheBtn');
    if (clearCacheBtn) {
        clearCacheBtn.addEventListener('click', async () => {
            if (confirm("Are you sure you want to clear cache and temporary files?")) {
                if (AnyPlayNative && AnyPlayNative.clearCache) {
                    try {
                        const res = await AnyPlayNative.clearCache();
                        alert("Cache cleared successfully! Freed " + (res.freedMB || 0).toFixed(1) + " MB.");
                    } catch (e) {
                        alert("Error clearing cache: " + e.message);
                    }
                } else {
                    alert("Cache cleared (Simulated).");
                }
            }
        });
    }

    const checkUpdatesBtn = document.getElementById('checkUpdatesBtn');
    if (checkUpdatesBtn) {
        checkUpdatesBtn.addEventListener('click', async () => {
            const status = document.getElementById('updateStatus');
            status.textContent = "Checking for updates...";
            try {
                const res = await fetch("https://api.github.com/repos/ArturCaffeinated/AnyPlay/releases/latest");
                const data = await res.json();
                if (data && data.tag_name) {
                    const currentVersion = "v1.0.0";
                    if (data.tag_name !== currentVersion) {
                        status.innerHTML = `New update available: <b>${data.tag_name}</b>! <a href="${data.html_url}" target="_blank" class="text-primary underline">Download here</a>`;
                    } else {
                        status.textContent = "You are up to date! (v1.0.0)";
                    }
                } else {
                    status.textContent = "Failed to check for updates.";
                }
            } catch (e) {
                status.textContent = "Error checking updates: " + e.message;
            }
        });
    }

    document.getElementById('stopAllDownloadsBtn')?.addEventListener('click', () => {
        if(confirm("Stop all active downloads?")) {
            alert("Downloads will be cleared on next app restart.");
        }
    });

    document.getElementById('copySystemLogsBtn')?.addEventListener('click', (e) => {
        const box = document.getElementById('systemLogsBox');
        if (box && box.textContent) {
            navigator.clipboard.writeText(box.textContent).then(() => {
                const btn = e.currentTarget;
                const originalHtml = btn.innerHTML;
                btn.innerHTML = `<svg class="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>`;
                setTimeout(() => { btn.innerHTML = originalHtml; }, 2000);
            }).catch(err => {
                alert("Failed to copy logs: " + err);
            });
        }
    });
}

function applySavedColors() {
    const accentColor = localStorage.getItem('AnyPlay_accent') || '#00a8e1';
    const bgColor = localStorage.getItem('AnyPlay_bg') || '#0f171e';

    // Calculate a slightly lighter color for cards
    const r = Math.min(255, parseInt(bgColor.slice(1, 3), 16) + 10);
    const g = Math.min(255, parseInt(bgColor.slice(3, 5), 16) + 10);
    const b = Math.min(255, parseInt(bgColor.slice(5, 7), 16) + 10);
    const cardBg = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;

    document.documentElement.style.setProperty('--accent-color', accentColor);
    document.documentElement.style.setProperty('--bg-color', bgColor);
    document.documentElement.style.setProperty('--card-bg', cardBg);

    const accentInput = document.getElementById('accentColor');
    const bgInput = document.getElementById('bgColor');
    if (accentInput) accentInput.value = accentColor;
    if (bgInput) bgInput.value = bgColor;
}

async function pollStorage() {
    try {
        if (!AnyPlayNative) return;
        
        const data = await AnyPlayNative.getStorageSpace();
        
        const gbFree = (data.free / (1024 ** 3)).toFixed(1);
        const gbTotal = (data.total / (1024 ** 3)).toFixed(1);
        const pct = (data.used / data.total) * 100;
        
        const txt = document.getElementById('storageText');
        const bar = document.getElementById('storageBar');
        
        if (txt) txt.textContent = `${gbFree} GB free`;
        if (bar) bar.style.width = `${pct}%`;
    } catch(err) {
        console.error("Failed to fetch storage:", err);
    }
}

    // Global lazy getter — Capacitor plugins may not be ready at script load time
    function getAnyPlayNative() {
        return window.Capacitor?.Plugins?.AnyPlayNative || null;
    }
    // Backward-compat: any code using bare `AnyPlayNative` will still work  
    Object.defineProperty(window, 'AnyPlayNative', { get: getAnyPlayNative });

// --- Library ---
async function loadLibrary() {
    const grid = document.getElementById('libraryGrid');
    if (!grid) return;

    try {
        let library = [];
        let downloads = {};
        if (AnyPlayNative) {
            const libRes = await AnyPlayNative.listLibrary();
            library = libRes.library || [];
            downloads = await AnyPlayNative.getDownloads();
        }
        
        grid.innerHTML = '';
        if (library.length === 0) {
            grid.innerHTML = '<div class="col-span-full text-center py-10 text-gray-500">Your library is empty. Go download some media!</div>';
            return;
        }

        library.forEach(item => {
            const card = document.createElement('a');
            card.href = `/show.html?id=${encodeURIComponent(item.id)}&type=${item.type}`;
            card.className = 'media-card block bg-gray-900 rounded-xl overflow-hidden cursor-pointer relative';
            card.dataset.title = item.title;
            card.dataset.cover = item.cover;
            
            const badgeStr = item.type === 'movie' ? 'Movie' : `Show`;

            card.innerHTML = `
                <div class="relative aspect-[2/3] w-full card-img-wrapper">
                    <img src="${item.cover || '/static/placeholder.jpg'}" alt="${item.title}" class="w-full h-full object-cover transition-all duration-300">
                </div>
                <div class="p-4">
                    <h3 class="font-bold text-sm sm:text-base truncate" title="${item.title}">${item.title}</h3>
                    <p class="text-xs text-gray-400 mt-1">${badgeStr}</p>
                </div>
            `;
            grid.appendChild(card);
        });
        
        updateLibraryProgress(downloads);
    } catch (err) {
        console.error("Failed to load library:", err);
        grid.innerHTML = '<div class="col-span-full text-center py-10 text-red-500">Failed to load library.</div>';
    }
}

// --- Downloads Polling ---
async function pollDownloads() {
    try {
        if (!AnyPlayNative) return;
        const data = await AnyPlayNative.getDownloads();
        
        const list = document.getElementById('downloadsList');
        const badge = document.getElementById('queueBadge');
        
        const dlKeys = Object.keys(data).filter(k => {
            const status = data[k].status;
            return status !== 'completed' && !status.startsWith('error') && status !== 'cancelled';
        });

        updateLibraryProgress(data);

        if (badge) {
            if (dlKeys.length > 0) {
                badge.textContent = dlKeys.length;
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        }
        
        if (AnyPlayNative.getTorrentLogs) {
            try {
                const logsRes = await AnyPlayNative.getTorrentLogs();
                const nativeLogs = logsRes && logsRes.logs ? logsRes.logs : "";
                const browserLogs = interceptedLogs.join('\n');
                const allLogs = "=== BROWSER LOGS ===\n" + browserLogs + "\n\n=== NATIVE LOGS ===\n" + nativeLogs;
                
                const logsBox = document.getElementById('systemLogsBox');
                if (logsBox && logsBox.textContent !== allLogs) {
                    const isScrolledToBottom = logsBox.scrollHeight - logsBox.clientHeight <= logsBox.scrollTop + 10;
                    logsBox.textContent = allLogs;
                    if (isScrolledToBottom) {
                        logsBox.scrollTop = logsBox.scrollHeight;
                    }
                }
            } catch (e) {
                // Ignore log fetch errors
            }
        }
        
        if (!list) return;

        if (Object.keys(data).length === 0) {
            list.innerHTML = '<p class="text-gray-500 text-center py-10">No active downloads.</p>';
            return;
        }

        // Group by show/movie
        const batches = {};
        for (let id in data) {
            let dl = data[id];
            dl.id = id;
            let batchName = dl.title.split(" S0")[0].split(" S1")[0].split(" S2")[0].split(" S3")[0].split(" - Episode")[0].split(" [")[0].trim();
            if (!batches[batchName]) batches[batchName] = [];
            batches[batchName].push(dl);
        }

        const openDetailsIds = new Set();
        const logScrollPositions = {};
        list.querySelectorAll('details').forEach(el => {
            if (el.open && el.id) {
                openDetailsIds.add(el.id);
                const content = el.querySelector('.log-content');
                if (content) {
                    logScrollPositions[el.id] = {
                        scrollTop: content.scrollTop,
                        scrollHeight: content.scrollHeight,
                        clientHeight: content.clientHeight
                    };
                }
            }
        });

        list.innerHTML = '';
        for (let bName in batches) {
            const batchDiv = document.createElement('div');
            batchDiv.className = 'bg-gray-900 border border-gray-800 rounded-xl p-6';
            
            const header = document.createElement('div');
            header.className = 'flex items-center justify-between border-b border-gray-800 pb-4 mb-4';
            header.innerHTML = `
                <h3 class="text-xl font-bold">${bName}</h3>
                <button onclick="stopBatch('${bName}')" class="text-sm bg-red-900/50 hover:bg-red-800 text-red-200 px-3 py-1.5 rounded transition-colors">Stop Batch</button>
            `;
            batchDiv.appendChild(header);

            batches[bName].forEach(dl => {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'bg-black/50 p-4 rounded-lg mb-3 last:mb-0';
                
                const pct = Math.round(dl.progress || 0);
                const isError = dl.status.startsWith('error');
                const isDone = dl.status === 'completed';
                
                let colorClass = 'bg-primary';
                if (isError) colorClass = 'bg-red-500';
                if (isDone) colorClass = 'bg-green-500';

                let statusText = dl.status;
                let errorBox = '';
                if (isError) {
                    statusText = 'ERROR';
                    errorBox = `
                    <div class="mt-2 relative group">
                        <button onclick="copyToClipboard(this)" class="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 rounded text-gray-400 hover:text-white transition-colors opacity-0 group-hover:opacity-100 z-10" title="Copy error">
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                        </button>
                        <div class="log-content text-[10px] text-red-400 bg-red-950/30 p-2 rounded max-h-40 overflow-y-auto font-mono whitespace-pre-wrap break-all">${dl.status}</div>
                    </div>`;
                }

                let logsBox = '';
                if (dl.logs) {
                    const detailsId = `details-${dl.id}`;
                    const isOpen = openDetailsIds.has(detailsId) ? 'open' : '';
                    logsBox = `
                    <details id="${detailsId}" class="mt-2" ${isOpen}>
                        <summary class="font-bold text-gray-300 cursor-pointer text-xs mb-1 focus:outline-none">View Logs</summary>
                        <div class="relative group">
                            <button onclick="copyToClipboard(this)" class="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 rounded text-gray-400 hover:text-white transition-colors opacity-0 group-hover:opacity-100 z-10" title="Copy logs">
                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                            </button>
                            <div class="log-content text-[10px] text-gray-400 bg-black/40 p-2 rounded max-h-40 overflow-y-auto font-mono whitespace-pre-wrap break-all">${dl.logs}</div>
                        </div>
                    </details>`;
                }

                itemDiv.innerHTML = `
                    <div class="flex justify-between items-center mb-2">
                        <div class="flex-1 pr-4 min-w-0">
                            <span class="font-bold truncate block">${dl.title}</span>
                            <span class="text-xs text-gray-400 uppercase tracking-wide block mt-1">${statusText}</span>
                        </div>
                        ${(!isDone && !isError) ? `<button onclick="stopDownload('${dl.id}')" class="text-xs bg-gray-800 hover:bg-gray-700 px-2 py-1 rounded">Cancel</button>` : ''}
                    </div>
                    <div class="w-full bg-gray-800 h-2 rounded-full overflow-hidden">
                        <div class="${colorClass} h-full transition-all duration-500" style="width: ${pct}%"></div>
                    </div>
                    ${errorBox}
                    ${logsBox}
                `;
                batchDiv.appendChild(itemDiv);
            });
            list.appendChild(batchDiv);
        }

        // Restore scroll positions
        for (let id of openDetailsIds) {
            const el = document.getElementById(id);
            if (el) {
                const content = el.querySelector('.log-content');
                const pos = logScrollPositions[id];
                if (content && pos) {
                    const wasAtBottom = pos.scrollHeight - pos.clientHeight <= pos.scrollTop + 10;
                    if (wasAtBottom) {
                        content.scrollTop = content.scrollHeight;
                    } else {
                        content.scrollTop = pos.scrollTop;
                    }
                }
            }
        }

    } catch(err) {
        console.error("Polling error:", err);
    }
}

window.stopDownload = function(id) {
    fetch('/api/cancel', { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({id}) });
};
window.stopBatch = function(batch) {
    fetch('/api/cancel_batch', { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({batch}) });
};
window.copyToClipboard = function(btn) {
    const container = btn.parentElement.querySelector('.log-content');
    if (container && container.textContent) {
        navigator.clipboard.writeText(container.textContent).then(() => {
            const originalHtml = btn.innerHTML;
            btn.innerHTML = `<svg class="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>`;
            setTimeout(() => { btn.innerHTML = originalHtml; }, 2000);
        }).catch(e => alert("Failed to copy: " + e));
    }
};
function updateLibraryProgress(downloads) {
    const cards = document.querySelectorAll('#libraryGrid .media-card');
    cards.forEach(card => {
        const title = card.dataset.title;
        if (!title) return;
        
        let totalProgress = 0;
        let count = 0;
        let isDownloading = false;
        
        for (let did in downloads) {
            let dl = downloads[did];
            const matches = dl.title === title || 
                            dl.title.startsWith(title + " -") || 
                            dl.title.startsWith(title + " S");
                            
            if (matches && !dl.status.startsWith('error') && dl.status !== 'cancelled') {
                isDownloading = true;
                count++;
                if (dl.status === 'completed') {
                    totalProgress += 100;
                } else {
                    totalProgress += (dl.progress || 0);
                }
            }
        }
        
        if (count > 0 && totalProgress === count * 100) {
            isDownloading = false;
        }

        const progress = count > 0 ? Math.round(totalProgress / count) : 0;
        const img = card.querySelector('img.object-cover');
        let overlay = card.querySelector('.dl-overlay');
        const wrapper = card.querySelector('.card-img-wrapper');
        
        if (isDownloading) {
            if (img) img.classList.add('grayscale');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.className = 'dl-overlay absolute inset-0 z-10 flex flex-col justify-end pointer-events-none';
                const cover = card.dataset.cover || '/static/placeholder.jpg';
                overlay.innerHTML = `
                    <div class="dl-progress-bg absolute inset-0 bg-cover bg-center" style="background-image: url('${cover}'); transition: clip-path 0.5s ease;"></div>
                    <div class="dl-progress-text absolute bottom-2 right-2 bg-black/80 text-primary px-2 py-1 rounded font-bold text-xs z-20"></div>
                `;
                if (wrapper) wrapper.appendChild(overlay);
            }
            const bg = overlay.querySelector('.dl-progress-bg');
            const txt = overlay.querySelector('.dl-progress-text');
            if (bg) bg.style.clipPath = `inset(${100 - progress}% 0 0 0)`;
            if (txt) txt.textContent = `${progress}%`;
        } else {
            if (img) img.classList.remove('grayscale');
            if (overlay) overlay.remove();
        }
    });
}


// --- Anime Scraper ---
let currentAnime = null;
let currentAnimeEpisodes = [];

function initAnimeScraper() {
    const form = document.getElementById('animeSearchForm');
    const input = document.getElementById('animeSearchInput');
    const results = document.getElementById('animeSearchResults');
    const epSelection = document.getElementById('animeEpisodeSelection');
    
    const epList = document.getElementById('animeEpisodeList');
    const animeDownloadSelectedBtn = document.getElementById('animeDownloadSelectedBtn');
    
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const q = input.value.trim();
        if(!q) return;

        results.innerHTML = '<div class="text-gray-400">Searching AniDB...</div>';
        epSelection.classList.add('hidden');

        try {
            const list = await window.Scrapers.AnimeScraper.search(q);
            results.innerHTML = '';
            
            if (list.length === 0) {
                results.innerHTML = '<div class="text-gray-400">No anime found</div>';
                return;
            }

            list.forEach(item => {
                const div = document.createElement('div');
                div.className = 'bg-gray-800 p-3 rounded cursor-pointer hover:bg-gray-700 mb-2';
                div.innerHTML = `<div class="font-bold">${item.title}</div>`;
                div.onclick = async () => {
                    currentAnime = item;
                    epSelection.classList.remove('hidden');
                    epList.innerHTML = '<div class="text-gray-400 p-4">Loading episodes...</div>';
                    
                    const eps = await window.Scrapers.AnimeScraper.getEpisodes(item.id);
                    epList.innerHTML = '';
                    eps.forEach(ep => {
                        const el = document.createElement('label');
                        el.className = 'flex items-center space-x-3 p-2 hover:bg-gray-700 rounded cursor-pointer';
                        el.innerHTML = `
                            <input type="checkbox" value='${JSON.stringify(ep)}' class="form-checkbox h-5 w-5 text-blue-500 rounded border-gray-600 bg-gray-800">
                            <span>Episode ${ep.number}</span>
                        `;
                        epList.appendChild(el);
                    });
                };
                results.appendChild(div);
            });
        } catch (e) {
            results.innerHTML = '<div class="text-red-500">Error searching</div>';
        }
    });

    document.getElementById('animeSelectAllBtn')?.addEventListener('click', () => {
        document.querySelectorAll('#animeEpisodeList input[type="checkbox"]').forEach(cb => cb.checked = true);
    });
    document.getElementById('animeDeselectAllBtn')?.addEventListener('click', () => {
        document.querySelectorAll('#animeEpisodeList input[type="checkbox"]').forEach(cb => cb.checked = false);
    });
    document.getElementById('animeCancelSelectionBtn')?.addEventListener('click', () => {
        epSelection.classList.add('hidden');
    });
    
    animeDownloadSelectedBtn?.addEventListener('click', async () => {
        const checked = epList.querySelectorAll('input:checked');
        if (checked.length === 0) {
            alert('Select at least one episode');
            return;
        }

        const selected = Array.from(checked).map(c => JSON.parse(c.value));
        epSelection.classList.add('hidden');
        document.querySelector('.tab-btn[data-tab="progress"]')?.click();
        
        // 1. Immediately create placeholders
        if (AnyPlayNative) {
            for (let ep of selected) {
                const id = `anime_${currentAnime.slug}_${ep.id}`;
                await AnyPlayNative.prepareDownload({ id, title: `${currentAnime.title} - Episode ${ep.number}.ts` });
            }
            pollDownloads(); 

            // 2. Fetch metadata asynchronously
            window.Scrapers.AnimeScraper.getMetadata(currentAnime.slug).then(async (meta) => {
                if (meta && AnyPlayNative) {
                    if (meta.image_url) {
                        try {
                            const r = await fetch(meta.image_url);
                            const blob = await r.blob();
                            const reader = new FileReader();
                            meta.base64Cover = await new Promise(res => { reader.onloadend = () => res(reader.result); reader.readAsDataURL(blob); });
                        } catch(e) { console.error("Cover fetch err", e); }
                    }
                    meta.title = currentAnime.title;
                    await AnyPlayNative.saveMetadata({ type: 'anime', title: currentAnime.title, metadata: meta });
                }
            });

            // 3. Fetch sources asynchronously
            selected.forEach(async (ep) => {
                const id = `anime_${currentAnime.slug}_${ep.id}`;
                const startT = Date.now();
                try {
                    await AnyPlayNative.appendDownloadLog({ id, log: `Starting API fetch for Episode ${ep.number}...` });
                    await AnyPlayNative.appendDownloadLog({ id, log: `Querying AnimeScraper source for ID ${ep.id}` });
                    const m3u8Url = await window.Scrapers.AnimeScraper.getM3u8(ep.id);
                    const diff = Date.now() - startT;
                    if (m3u8Url) {
                        await AnyPlayNative.appendDownloadLog({ id, log: `Successfully found stream in ${diff}ms` });
                        await AnyPlayNative.appendDownloadLog({ id, log: `HLS URL: ${m3u8Url.substring(0, 80)}...` });
                        AnyPlayNative.downloadHLS({
                            id,
                            url: m3u8Url,
                            title: currentAnime.title,
                            episodePath: `Season 1/Episode ${ep.number}.ts`
                        });
                    } else {
                        await AnyPlayNative.appendDownloadLog({ id, log: `API returned empty source after ${diff}ms` });
                        AnyPlayNative.setDownloadError({ id, error: "No stream found" });
                    }
                } catch (err) {
                    const diff = Date.now() - startT;
                    await AnyPlayNative.appendDownloadLog({ id, log: `API error after ${diff}ms: ${err.message || String(err)}` });
                    AnyPlayNative.setDownloadError({ id, error: err.message || String(err) });
                }
            });
        }
    });
}

async function loadAnimeEpisodes(anime) {
    currentAnime = anime;
    const epSelection = document.getElementById('animeEpisodeSelection');
    const epList = document.getElementById('animeEpisodeList');
    const title = document.getElementById('animeSelectedTitle');

    title.textContent = "Loading episodes for " + anime.title + "...";
    epSelection.classList.remove('hidden');
    epList.innerHTML = '';

    try {
        const data = await window.Scrapers.AnimeScraper.getEpisodes(anime.id);
        currentAnimeEpisodes = data;
        
        let totalSizeMB = data.length * 300;
        let totalStr = totalSizeMB > 1000 ? (totalSizeMB/1024).toFixed(1) + ' GB' : totalSizeMB + ' MB';
        title.innerHTML = `${anime.title} <span class="text-sm text-gray-400 font-normal ml-3 bg-black/40 px-3 py-1 rounded-full border border-gray-800">Whole Series: ~${totalStr}</span>`;
        
        data.forEach(ep => {
            const lbl = document.createElement('label');
            lbl.className = 'flex items-center gap-2 bg-black/30 p-2 rounded cursor-pointer hover:bg-gray-800 border border-gray-800';
            lbl.innerHTML = `
                <input type="checkbox" value="${ep.id}" class="rounded text-primary focus:ring-primary bg-gray-800 border-gray-700">
                <span class="text-sm flex-1">Episode ${ep.number}</span>
                <span class="text-xs font-bold text-gray-400 bg-black/50 px-2 py-0.5 rounded shadow-sm border border-gray-700">~300 MB</span>
            `;
            epList.appendChild(lbl);
        });
    } catch(err) {
        title.textContent = "Error loading episodes.";
    }
}


// --- Movie Scraper ---
let currentMovieResults = [];

function initMovieScraper() {
    const form = document.getElementById('movieSearchForm');
    const input = document.getElementById('movieSearchInput');
    const results = document.getElementById('movieSearchResults');

    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const q = input.value.trim();
        if(!q) return;

        results.innerHTML = '<div class="col-span-full text-gray-400">Searching YTS...</div>';

        try {
            const data = await window.Scrapers.MovieScraper.search(q);
            currentMovieResults = data;
            
            results.innerHTML = '';
            if (data.length === 0) {
                results.innerHTML = '<div class="col-span-full text-gray-400">No movies found.</div>';
                return;
            }

            data.forEach(movie => {
                let sizeBadge = '';
                if (movie.torrents && movie.torrents.length > 0) {
                    const t1080 = movie.torrents.find(t => t.quality === '1080p') || movie.torrents[0];
                    if (t1080.size) {
                        sizeBadge = `<div class="absolute top-2 right-2 bg-black/80 text-primary text-xs font-bold px-2 py-1 rounded shadow-lg border border-primary/30 z-10">${t1080.size}</div>`;
                    }
                }

                const card = document.createElement('div');
                card.className = 'bg-gray-900 border border-gray-800 rounded-xl overflow-hidden flex flex-col relative';
                card.innerHTML = `
                    <div class="aspect-[2/3] w-full bg-black relative">
                        ${sizeBadge}
                        ${movie.cover ? `<img src="${movie.cover}" class="w-full h-full object-cover">` : `<div class="flex items-center justify-center h-full text-gray-600">No Cover</div>`}
                    </div>
                    <div class="p-5 flex-1 flex flex-col">
                        <h3 class="font-bold text-lg mb-2 leading-tight">${movie.title}</h3>
                        <p class="text-gray-400 text-sm line-clamp-3 mb-4 flex-1">${movie.description || 'No description.'}</p>
                        <button onclick="downloadMovie('${movie.id}')" class="w-full bg-primary hover:bg-red-700 text-white font-bold py-2 rounded transition-colors">Download</button>
                    </div>
                `;
                results.appendChild(card);
            });
        } catch(err) {
            results.innerHTML = '<div class="col-span-full text-red-500">Error searching.</div>';
        }
    });
}

window.downloadMovie = async function(id) {
    const movie = currentMovieResults.find(m => m.id === id);
    if (!movie) return;

    alert("Movie download queued!");
    document.querySelector('.tab-btn[data-tab="progress"]')?.click();
    
    if (AnyPlayNative) {
        const id = `movie_${movie.id}`;
        await AnyPlayNative.prepareDownload({ id, title: movie.title });
        pollDownloads(); // Instant!

        (async () => {
            if (movie.cover) {
                try {
                    const r = await fetch(movie.cover);
                    const blob = await r.blob();
                    const reader = new FileReader();
                    movie.base64Cover = await new Promise(res => { reader.onloadend = () => res(reader.result); reader.readAsDataURL(blob); });
                } catch(e) {}
            }
            await AnyPlayNative.saveMetadata({ type: 'movie', title: movie.title, metadata: movie });
        })();
        
        try {
            const startT = Date.now();
            await AnyPlayNative.appendDownloadLog({ id, log: `Starting API fetch for Movie ${movie.title}...` });
            await AnyPlayNative.appendDownloadLog({ id, log: `Querying MovieScraper for 1080p magnet...` });
            const magnetUrl = await window.Scrapers.MovieScraper.get1080pMagnet(movie);
            const diff = Date.now() - startT;
            if (magnetUrl) {
                await AnyPlayNative.appendDownloadLog({ id, log: `Successfully found 1080p magnet in ${diff}ms` });
                AnyPlayNative.startTorrent({
                    id,
                    magnetUrl,
                    title: movie.title,
                    type: 'movie'
                });
            } else {
                await AnyPlayNative.appendDownloadLog({ id, log: `API returned empty source after ${diff}ms` });
                AnyPlayNative.setDownloadError({ id, error: "No 1080p source found for this movie." });
            }
        } catch(err) {
            await AnyPlayNative.appendDownloadLog({ id, log: `API error: ${err.message || String(err)}` });
            AnyPlayNative.setDownloadError({ id, error: err.message || String(err) });
        }
    }
};

// --- TV Scraper ---
let currentTV = null;
let currentTVEpisodes = [];

function initTVScraper() {
    const form = document.getElementById('tvSearchForm');
    const input = document.getElementById('tvSearchInput');
    const results = document.getElementById('tvSearchResults');
    const epSelection = document.getElementById('tvEpisodeSelection');
    
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const q = input.value.trim();
        if(!q) return;

        results.innerHTML = '<div class="col-span-full text-gray-400">Searching TVMaze...</div>';
        epSelection.classList.add('hidden');

        try {
            const data = await window.Scrapers.TVScraper.search(q);
            
            results.innerHTML = '';
            if (data.length === 0) {
                results.innerHTML = '<div class="col-span-full text-gray-400">No results found.</div>';
                return;
            }

            data.forEach(item => {
                const card = document.createElement('div');
                card.className = 'bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded-lg p-4 cursor-pointer transition-colors';
                card.innerHTML = `
                    <h3 class="font-bold text-lg">${item.title}</h3>
                    <p class="text-xs text-gray-400 mt-1 line-clamp-2">${item.description || ''}</p>
                `;
                card.onclick = () => loadTVEpisodes(item);
                results.appendChild(card);
            });
        } catch(err) {
            results.innerHTML = '<div class="col-span-full text-red-500">Error searching.</div>';
        }
    });

    document.getElementById('tvSelectAllBtn')?.addEventListener('click', () => {
        document.querySelectorAll('#tvEpisodeList input[type="checkbox"]').forEach(cb => cb.checked = true);
    });
    document.getElementById('tvDeselectAllBtn')?.addEventListener('click', () => {
        document.querySelectorAll('#tvEpisodeList input[type="checkbox"]').forEach(cb => cb.checked = false);
    });
    document.getElementById('tvCancelSelectionBtn')?.addEventListener('click', () => {
        epSelection.classList.add('hidden');
    });
    
    document.getElementById('tvDownloadSelectedBtn')?.addEventListener('click', async () => {
        const selected = Array.from(document.querySelectorAll('#tvEpisodeList input:checked')).map(cb => {
            return currentTVEpisodes.find(e => e.id == cb.value);
        });
        if (selected.length === 0) return alert("Select at least one episode.");
        
        alert("Downloads queued!");
        epSelection.classList.add('hidden');
        document.querySelector('.tab-btn[data-tab="progress"]')?.click();
        
        if (AnyPlayNative) {
            for (let ep of selected) {
                const id = `tv_${currentTV.id}_${ep.id}`;
                const epTitle = `${currentTV.title} S${String(ep.season).padStart(2, '0')}E${String(ep.episode).padStart(2, '0')}`;
                await AnyPlayNative.prepareDownload({ id, title: epTitle });
            }
            pollDownloads(); // Instant!
            
            (async () => {
                if (currentTV.image) {
                    try {
                        const r = await fetch(currentTV.image);
                        const blob = await r.blob();
                        const reader = new FileReader();
                        currentTV.base64Cover = await new Promise(res => { reader.onloadend = () => res(reader.result); reader.readAsDataURL(blob); });
                    } catch(e) {}
                }
                await AnyPlayNative.saveMetadata({ type: 'tv', title: currentTV.title, metadata: currentTV });
            })();

            selected.forEach(async (ep) => {
                const id = `tv_${currentTV.id}_${ep.id}`;
                const epTitle = `${currentTV.title} S${String(ep.season).padStart(2, '0')}E${String(ep.episode).padStart(2, '0')}`;
                const startT = Date.now();
                try {
                    await AnyPlayNative.appendDownloadLog({ id, log: `Starting API fetch for ${epTitle}...` });
                    await AnyPlayNative.appendDownloadLog({ id, log: `Querying TVScraper magnet for ID ${ep.id}` });
                    const magnetUrl = await window.Scrapers.TVScraper.getMagnet(currentTV.title, ep.season, ep.episode);
                    const diff = Date.now() - startT;
                    if (magnetUrl) {
                        await AnyPlayNative.appendDownloadLog({ id, log: `Successfully found magnet in ${diff}ms` });
                        AnyPlayNative.startTorrent({
                            id,
                            magnetUrl,
                            title: epTitle,
                            showTitle: currentTV.title,
                            type: 'tv'
                        });
                    } else {
                        await AnyPlayNative.appendDownloadLog({ id, log: `API returned empty source after ${diff}ms` });
                        AnyPlayNative.setDownloadError({ id, error: "No source found" });
                        console.warn(`No source found for S${ep.season}E${ep.episode}`);
                    }
                } catch(err) {
                    const diff = Date.now() - startT;
                    await AnyPlayNative.appendDownloadLog({ id, log: `API error after ${diff}ms: ${err.message || String(err)}` });
                    AnyPlayNative.setDownloadError({ id, error: err.message || String(err) });
                }
            });
        }
    });
}

async function loadTVEpisodes(show) {
    currentTV = show;
    const epSelection = document.getElementById('tvEpisodeSelection');
    const epList = document.getElementById('tvEpisodeList');
    const title = document.getElementById('tvSelectedTitle');
    const desc = document.getElementById('tvSelectedDesc');

    title.textContent = "Loading episodes...";
    desc.textContent = "";
    
    epSelection.classList.remove('hidden');
    epList.innerHTML = '';
    
    // Scroll to selection box smoothly
    epSelection.scrollIntoView({behavior: 'smooth', block: 'nearest'});

    try {
        const data = await window.Scrapers.TVScraper.getEpisodes(show.id);
        currentTVEpisodes = data;
        
        let totalSizeMB = data.length * 800;
        let totalStr = totalSizeMB > 1000 ? (totalSizeMB/1024).toFixed(1) + ' GB' : totalSizeMB + ' MB';
        title.innerHTML = `${show.title} <span class="text-sm text-gray-400 font-normal ml-3 bg-black/40 px-3 py-1 rounded-full border border-gray-800">Whole Series: ~${totalStr}</span>`;
        desc.textContent = show.description;

        data.forEach(ep => {
            const lbl = document.createElement('label');
            lbl.className = 'flex items-center gap-3 bg-black/30 p-3 rounded cursor-pointer hover:bg-gray-800 border border-gray-800';
            
            const seasonStr = String(ep.season).padStart(2, "0");
            const epStr = String(ep.episode).padStart(2, "0");

            lbl.innerHTML = `
                <input type="checkbox" value="${ep.id}" class="rounded text-primary focus:ring-primary bg-gray-800 border-gray-700 w-4 h-4">
                <span class="text-sm font-medium w-16 text-gray-400">S${seasonStr}E${epStr}</span>
                <span class="text-sm text-gray-200 truncate flex-1">${ep.title}</span>
                <span class="text-xs font-bold text-gray-400 bg-black/50 px-2 py-0.5 rounded shadow-sm border border-gray-700">~800 MB</span>
            `;
            epList.appendChild(lbl);
        });
    } catch(err) {
        title.textContent = "Error loading episodes.";
    }
}

// ==========================================
// SHOW PAGE LOGIC (show.html)
async function initShowPage() {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');
    const type = urlParams.get('type') || 'anime';
    
    if (!id) {
        document.getElementById('showTitle').textContent = "Not Found";
        return;
    }

    try {
        if (!AnyPlayNative) {
            document.getElementById('showTitle').textContent = "Plugin not available";
            return;
        }
        
        const libRes = await AnyPlayNative.listLibrary();
        const library = libRes.library || [];
        const item = library.find(i => i.id === id);
        
        if (!item) {
            document.getElementById('showTitle').textContent = "Not Found in Library";
            return;
        }
        
        window.currentShowItem = item;
        setInterval(pollShowProgress, 2000);

        const meta = item.metadata || {};
        
        document.title = `${item.title} - AnyPlay`;
        document.getElementById('showTitle').textContent = item.title || 'Unknown Title';
        document.getElementById('showMeta').textContent = type === 'movie' ? 'Movie' : type;
        document.getElementById('showDesc').textContent = meta.description || "No description available.";
        
        // NEW LOGIC: Update Badges
        const showMatch = document.getElementById('showMatch');
        if (showMatch) {
            let rating = meta.rating || meta.imdbRating || meta.score;
            if (rating) {
                showMatch.textContent = `${rating}/10 ?`;
                showMatch.classList.remove('hidden');
            } else {
                showMatch.classList.add('hidden');
            }
        }
        
        const showYear = document.getElementById('showYear');
        if (showYear) {
            showYear.textContent = meta.year || meta.releaseInfo || meta.seasonYear || '';
        }

        const showCodec = document.getElementById('showCodec');
        const showRes = document.getElementById('showRes');
        
        if (showCodec && showRes) {
            if (item.episodes && item.episodes.length > 0) {
                showCodec.textContent = "H.264/AAC";
                showRes.textContent = "1080p";
                showCodec.classList.remove('hidden');
                showRes.classList.remove('hidden');
            } else {
                showCodec.classList.add('hidden');
                showRes.classList.add('hidden');
            }
        }

        // Setup Continue / Watch button
        const continueBtn = document.getElementById('continueBtn');
        if (continueBtn && item.episodes && item.episodes.length > 0) {
            continueBtn.classList.remove('hidden');
            const firstEp = item.episodes[0];
            const btnText = type === "movie" ? "Watch Movie" : `Watch ${firstEp.display.replace(/\\/g, "/")}`;
            continueBtn.innerHTML = `<svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd"></path></svg>${btnText}`;
            continueBtn.onclick = () => {
                window.showPlayer(firstEp.path, firstEp.display, id, 0);
            };
        } else if (continueBtn) {
            continueBtn.classList.add('hidden');
        }

        const hero = document.getElementById('showHero');
        if (hero && item.cover) {
            hero.style.backgroundImage = `url('${item.cover}')`;
        }

        const deleteShowBtn = document.getElementById('deleteShowBtn');
        if (deleteShowBtn) {
            deleteShowBtn.onclick = async () => {
                if (confirm(`Are you sure you want to completely delete ${item.title}?`)) {
                    const showPath = item.path;
                    if (showPath) {
                        try {
                            const res = await AnyPlayNative.deleteContent({ path: showPath });
                            if (res.success) {
                                window.location.href = '/?tab=library';
                            } else {
                                alert("Failed to delete show");
                            }
                        } catch(e) {
                            alert("Error: " + e.message);
                        }
                    } else {
                        alert("Could not determine show path.");
                    }
                }
            };
        }

        const epList = document.getElementById('showEpisodes');
        if (epList) {
            if (item.episodes && item.episodes.length > 0) {
                epList.innerHTML = '';
                item.episodes.forEach(ep => {
                    const card = document.createElement('div');
                    card.className = 'bg-gray-900 border border-gray-800 rounded-xl p-4 mb-3 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-gray-800 transition-colors gap-4 relative group';
                    const sizeMB = (ep.size / (1024 * 1024)).toFixed(1);
                    card.dataset.epDisplay = ep.display;
                    card.innerHTML = `
                        <!-- Subtle Action Icons (Top Right) -->
                        <div class="absolute top-3 right-3 flex items-center gap-2 opacity-50 hover:opacity-100 transition-opacity">
                            <button class="text-gray-400 hover:text-white rename-btn p-1" title="Rename">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                            </button>
                            <button class="text-gray-400 hover:text-red-500 delete-btn p-1" title="Delete">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                            </button>
                        </div>
                        
                        <div class="flex-1 pr-12 truncate cursor-pointer" onclick="window.showPlayer('${ep.path.replace(/\\/g, '\\\\')}', '${ep.display.replace(/'/g, "\\'")}', '${id}', 0)">
                            <h4 class="font-bold text-white text-base truncate">${ep.display.replace(/\\/g, '/')}</h4>
                            <p class="text-gray-400 text-xs mt-1">${sizeMB} MB <span class="ep-status ml-2"></span></p>
                            <div class="ep-progress-bar hidden w-full bg-gray-800 h-1.5 rounded-full mt-2 overflow-hidden">
                                <div class="ep-progress-fill bg-primary h-full rounded-full transition-all duration-300" style="width: 0%"></div>
                            </div>
                        </div>
                        <div class="flex items-center flex-shrink-0">
                            <button class="bg-primary hover:bg-accent text-white font-bold py-2 px-6 rounded-lg transition-colors shadow-lg" onclick="window.showPlayer('${ep.path.replace(/\\/g, '\\\\')}', '${ep.display.replace(/'/g, "\\'")}', '${id}', 0)">Play</button>
                        </div>
                    `;
                    
                    card.querySelector('.delete-btn').onclick = async (e) => {
                        e.stopPropagation();
                        if (confirm(`Delete ${ep.display}?`)) {
                            try {
                                const res = await AnyPlayNative.deleteContent({ path: ep.path });
                                if (res.success) {
                                    card.remove();
                                    if (epList.children.length === 0) {
                                        window.location.reload();
                                    }
                                }
                            } catch(err) {
                                alert("Failed to delete episode: " + err.message);
                            }
                        }
                    };

                    card.querySelector('.rename-btn').onclick = async (e) => {
                        e.stopPropagation();
                        let defaultName = ep.display;
                        if (defaultName.lastIndexOf('.') > 0) defaultName = defaultName.substring(0, defaultName.lastIndexOf('.'));
                        const newName = prompt("Enter new name:", defaultName);
                        if (newName && newName !== defaultName) {
                            try {
                                const res = await AnyPlayNative.renameContent({ oldPath: ep.path, newName: newName });
                                if (res.success) {
                                    window.location.reload();
                                }
                            } catch(err) {
                                alert("Failed to rename episode: " + err.message);
                            }
                        }
                    };
                    
                    epList.appendChild(card);
                });
            } else {
                epList.innerHTML = '<div class="text-gray-400 py-6 text-center border border-dashed border-gray-800 rounded-xl">No episodes downloaded yet.</div>';
            }
        }
    } catch (err) {
        console.error("Failed to load show:", err);
    }
}

async function pollShowProgress() {
    try {
        if (!AnyPlayNative || !window.currentShowItem) return;
        const data = await AnyPlayNative.getDownloads();
        const item = window.currentShowItem;
        
        const cards = document.querySelectorAll('#showEpisodes > div.group');
        cards.forEach(card => {
            const epDisplay = card.dataset.epDisplay;
            if (!epDisplay) return;
            
            let matchDl = null;
            for (let did in data) {
                let dl = data[did];
                if (dl.status === 'completed' || dl.status.startsWith('error') || dl.status === 'cancelled') continue;
                
                if (item.type === 'anime') {
                    if (dl.title === `${item.title} - ${epDisplay}` || dl.title.endsWith(epDisplay)) {
                        matchDl = dl; break;
                    }
                } else if (item.type === 'tv') {
                    const m = dl.title.match(/S\d+E\d+/i);
                    if (m && epDisplay.toUpperCase().includes(m[0].toUpperCase())) {
                        matchDl = dl; break;
                    }
                } else if (item.type === 'movie') {
                    if (dl.title === item.title) {
                        matchDl = dl; break;
                    }
                }
            }
            
            const pbar = card.querySelector('.ep-progress-bar');
            const pfill = card.querySelector('.ep-progress-fill');
            const pstatus = card.querySelector('.ep-status');
            
            if (matchDl) {
                pbar.classList.remove('hidden');
                pfill.style.width = `${matchDl.progress || 0}%`;
                pstatus.textContent = `- ${matchDl.progress || 0}%`;
                pstatus.className = "ep-status ml-2 text-primary font-bold";
            } else {
                pbar.classList.add('hidden');
                pstatus.textContent = "";
            }
        });
    } catch(err) {
        console.error(err);
    }
}


// --- Player Logic ---
let progressInterval = null;

window.showPlayer = async function(path, name, showId, savedTime) {
    if (AnyPlayNative) {
        AnyPlayNative.playVideo({
            videoPath: path,
            subtitlePath: null
        });
    } else {
        alert("Native plugin not available. Path: " + path);
    }
};

window.closePlayer = function() {
    // Native player closes itself. This is fallback.
    const wrapper = document.getElementById('playerWrapper');
    if (wrapper) wrapper.classList.add('hidden');
};

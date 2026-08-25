// Capacitor HTTP plugin for CORS-free requests
// When CapacitorHttp is enabled in capacitor.config.json, it patches window.fetch
// so we can just use fetch() directly. No need for a separate Http plugin reference.

async function fetchNative(url, options = {}) {
    try {
        const fetchOptions = {
            method: options.method || 'GET',
            headers: options.headers || {}
        };
        if (options.body) fetchOptions.body = options.body;
        
        const response = await fetch(url, fetchOptions);
        return {
            json: async () => response.json(),
            text: async () => response.text(),
            ok: response.ok,
            status: response.status
        };
    } catch (e) {
        console.error("fetchNative error for", url, e);
        throw e;
    }
}

const MovieScraper = {
    async search(query) {
        const cinemetaUrl = `https://v3-cinemeta.strem.io/catalog/movie/top/search=${encodeURIComponent(query)}.json`;
        try {
            const r = await fetchNative(cinemetaUrl);
            const data = await r.json();
            
            if (!data.metas || data.metas.length === 0) return [];
            
            // Fetch additional details for top 5 to get descriptions
            const detailedMetas = [];
            for (let i = 0; i < Math.min(5, data.metas.length); i++) {
                const meta = data.metas[i];
                try {
                    const detailRes = await fetchNative(`https://v3-cinemeta.strem.io/meta/movie/${meta.id}.json`);
                    const detailData = await detailRes.json();
                    if (detailData && detailData.meta) {
                        detailedMetas.push(detailData.meta);
                    } else {
                        detailedMetas.push(meta);
                    }
                } catch (e) {
                    detailedMetas.push(meta);
                }
            }
            
            return detailedMetas.map(movie => {
                const year = movie.year || movie.releaseInfo || '';
                const titleWithYear = year ? `${movie.name} (${year})` : movie.name;
                return {
                    id: movie.id, // IMDb ID
                    title: titleWithYear,
                    rawTitle: movie.name,
                    year: year,
                    slug: movie.id,
                    cover: movie.poster || '',
                    description: movie.description || 'No summary available.',
                    torrents: []
                };
            });
        } catch (e) {
            console.error("Movie search error:", e);
            return [];
        }
    },
    
    async get1080pMagnet(movie) {
        // If movie object is passed directly
        let query = typeof movie === 'string' ? movie : (movie.rawTitle || movie.title);
        if (typeof movie === 'object' && movie.year) {
            query = `${movie.rawTitle} ${movie.year}`;
        }
        
        try {
            const url = `https://apibay.org/q.php?q=${encodeURIComponent(query + ' 1080p')}&cat=207`;
            const r = await fetchNative(url);
            const data = await r.json();
            
            if (Array.isArray(data)) {
                for (let res of data) {
                    if (res.info_hash && res.info_hash !== "0000000000000000000000000000000000000000") {
                        const tl = res.name.toLowerCase();
                        if (tl.includes('1080p') && !tl.includes('cam') && !tl.includes('ts')) {
                            return `magnet:?xt=urn:btih:${res.info_hash}&dn=${encodeURIComponent(res.name)}&tr=http%3A%2F%2Ftracker.opentrackr.org%3A1337%2Fannounce&tr=http%3A%2F%2Ftracker.openbittorrent.com%3A80%2Fannounce&tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337%2Fannounce&tr=udp%3A%2F%2Fopen.demonii.com%3A1337%2Fannounce`;
                        }
                    }
                }
            }
        } catch (e) {
            console.error("Apibay error:", e);
        }
        return null;
    }
};

const TVScraper = {
    async search(query) {
        const url = `https://api.tvmaze.com/search/shows?q=${encodeURIComponent(query)}`;
        try {
            const r = await fetchNative(url);
            const data = await r.json();
            return data.slice(0, 5).map(item => ({
                id: String(item.show.id),
                title: item.show.name,
                image: item.show.image ? item.show.image.medium : '',
                description: item.show.summary ? item.show.summary.replace(/<[^>]*>?/gm, '') : ''
            }));
        } catch (e) {
            console.error("TV search error:", e);
            return [];
        }
    },
    
    async getEpisodes(showId) {
        const url = `https://api.tvmaze.com/shows/${showId}/episodes`;
        try {
            const r = await fetchNative(url);
            const data = await r.json();
            return data.map(ep => ({
                id: String(ep.id),
                title: ep.name || `Episode ${ep.number}`,
                season: ep.season,
                episode: ep.number
            }));
        } catch (e) {
            console.error("TV episodes error:", e);
            return [];
        }
    },
    
    async getMagnet(title, season, episode) {
        const q = `${title} s${String(season).padStart(2, '0')}e${String(episode).padStart(2, '0')}`;
        
        function isSupported(t) {
            const tl = t.toLowerCase();
            return !(tl.includes("hevc") || tl.includes("x265") || tl.includes("h265") || tl.includes("h.265"));
        }
        
        // Fallback: use Apibay (The Pirate Bay API) which is more reliable
        try {
            const url = `https://apibay.org/q.php?q=${encodeURIComponent(q)}`;
            const r = await fetchNative(url);
            const data = await r.json();
            if (Array.isArray(data)) {
                for (let res of data) {
                    if (res.info_hash && res.info_hash !== "0000000000000000000000000000000000000000") {
                        if (isSupported(res.name)) {
                            return `magnet:?xt=urn:btih:${res.info_hash}&dn=${encodeURIComponent(res.name)}&tr=http%3A%2F%2Ftracker.opentrackr.org%3A1337%2Fannounce&tr=http%3A%2F%2Ftracker.openbittorrent.com%3A80%2Fannounce&tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337%2Fannounce&tr=udp%3A%2F%2Fopen.demonii.com%3A1337%2Fannounce`;
                        }
                    }
                }
            }
        } catch (e) {
            console.error("Apibay error:", e);
        }
        
        // Fallback 2: Bitsearch
        try {
            const url = `https://bitsearch.to/api/v1/search?q=${encodeURIComponent(q)}`;
            const r = await fetchNative(url);
            const data = await r.json();
            
            if (data.results) {
                for (let res of data.results) {
                    if (isSupported(res.title)) {
                        return `magnet:?xt=urn:btih:${res.infohash}&dn=${encodeURIComponent(res.title)}&tr=http%3A%2F%2Ftracker.opentrackr.org%3A1337%2Fannounce&tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337%2Fannounce`;
                    }
                }
            }
        } catch (e) {
            console.error("Bitsearch error:", e);
        }
        return null;
    }
};

const AnimeScraper = {
    async search(query) {
        const url = `https://anidb.app/browse?q=${encodeURIComponent(query)}`;
        try {
            const r = await fetchNative(url);
            const html = await r.text();
            
            const pattern = /<a href="[^"]*?anime\/([^"]+)"[^>]*title="([^"]+)"/g;
            const results = [];
            let match;
            while ((match = pattern.exec(html)) !== null) {
                const slug = match[1];
                const title = match[2].replace(/&#039;/g, "'").replace(/&quot;/g, '"');
                const id = slug.split('-').pop();
                results.push({ title, id, slug });
            }
            return results;
        } catch (e) {
            console.error("Anime search error:", e);
            return [];
        }
    },
    
    async getEpisodes(animeId) {
        const url = `https://anidb.app/api/frontend/anime/${animeId}/episodes`;
        try {
            const r = await fetchNative(url);
            const data = await r.json();
            return data.episodes || [];
        } catch (e) {
            console.error("Anime episodes error:", e);
            return [];
        }
    },
    
    async getM3u8(episodeId) {
        const url = `https://anidb.app/api/frontend/episode/${episodeId}/languages`;
        try {
            const r = await fetchNative(url);
            const data = await r.json();
            if (!data.languages || data.languages.length === 0) return null;
            
            const embedUrl = data.languages[0].embed_url;
            const r2 = await fetchNative(embedUrl);
            const html = await r2.text();
            
            const match = /file:\s*'([^']+)'/.exec(html);
            if (match) return match[1];
        } catch (e) {
            console.error("Anime m3u8 error:", e);
        }
        return null;
    },
    
    async getMetadata(slug) {
        const url = `https://anidb.app/anime/${slug}`;
        try {
            const r = await fetchNative(url);
            const html = await r.text();
            
            const imgMatch = /<meta property="og:image" content="([^"]+)"/.exec(html);
            const titleMatch = /<meta property="og:title" content="([^"]+)"/.exec(html);
            let rawTitle = titleMatch ? titleMatch[1] : "Unknown Title";
            let cleanTitle = rawTitle.replace(/&#039;/g, "'").replace(/&quot;/g, '"').replace(/\s*[-|�]\s*AniDB\s*/g, '');
            
            let metadata = {
                image_url: imgMatch ? imgMatch[1].replace(/&amp;/g, "&") : null,
                description: "No description available.",
                title: cleanTitle,
                rating: null,
                year: null
            };

            // Enrich with full description and rating from AniList
            try {
                const query = `
                query ($search: String) {
                  Media (search: $search, type: ANIME) {
                    description(asHtml: false)
                    averageScore
                    seasonYear
                    coverImage { large }
                  }
                }`;
                const alRes = await fetch("https://graphql.anilist.co", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ query, variables: { search: cleanTitle } })
                });
                const alData = await alRes.json();
                if (alData && alData.data && alData.data.Media) {
                    const m = alData.data.Media;
                    if (m.description) metadata.description = m.description.replace(/<[^>]*>?/gm, ''); // Strip any remaining HTML
                    if (m.averageScore) metadata.rating = (m.averageScore / 10).toFixed(1); // 1-10 scale
                    if (m.seasonYear) metadata.year = m.seasonYear;
                    if (m.coverImage && m.coverImage.large && !metadata.image_url) metadata.image_url = m.coverImage.large;
                }
            } catch (e) {
                console.error("AniList enrichment failed", e);
            }
            
            return metadata;
        } catch (e) {
            console.error("Anime metadata error:", e);
            return null;
        }
    }
};

window.Scrapers = { MovieScraper, TVScraper, AnimeScraper };

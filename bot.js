const axios = require('axios');

// هێنانی کلیلەکە لە گیتھەب ئەکشنزەوە
const FB_SECRET = process.env.FIREBASE_SECRET; 

const TMDB_API_KEY = '7ff77f551b7a1db3b68d9a5a991e7cd5';
const FB_URL = 'https://sarko-43d61-default-rtdb.firebaseio.com';

// ---------------------------------------------------------
// ١. مەکینەی وەرگێڕان بۆ کوردی (خۆڕایی و بێ کلیل)
// ---------------------------------------------------------
async function translateToKurdish(text) {
    if (!text || text === "") return "زانیاری بەردەست نییە.";
    try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=ckb&dt=t&q=${encodeURIComponent(text)}`;
        const res = await axios.get(url);
        let translated = "";
        
        res.data[0].forEach(part => {
            translated += part[0];
        });
        return translated;
    } catch (error) {
        console.log("⚠️ کێشە لە وەرگێڕان.");
        return text;
    }
}

// ---------------------------------------------------------
// ٢. پشکنینی دووبارەبوونەوە (کلیلەکەی فایەربەیسی بۆ زیادکرا)
// ---------------------------------------------------------
async function checkExists(path, id) {
    try {
        // بەکارهێنانی auth بۆ ئەوەی فایەربەیس ڕێگە بدات بیخوێنینەوە
        const authParam = FB_SECRET ? `&auth=${FB_SECRET}` : "";
        const res = await axios.get(`${FB_URL}/${path}/${id}.json?shallow=true${authParam}`);
        return res.data !== null; 
    } catch (e) {
        return false;
    }
}

// ---------------------------------------------------------
// ٣. هێنانی فیلمە تازەکان
// ---------------------------------------------------------
async function fetchAndSaveMovies() {
    console.log("🎬 دەستکردن بە هێنانی فیلمە تازەکان بۆ subtitled_movies1...");
    
    for (let page = 1; page <= 3; page++) {
        try {
            const res = await axios.get(`https://api.themoviedb.org/3/movie/now_playing?api_key=${TMDB_API_KEY}&language=en-US&page=${page}`);
            const movies = res.data.results;

            for (let tmdbMovie of movies) {
                const exists = await checkExists('subtitled_movies1', tmdbMovie.id);
                if (exists) continue;

                const kurdishDesc = await translateToKurdish(tmdbMovie.overview);
                const kurdishTitle = await translateToKurdish(tmdbMovie.title);
                const finalTitle = `${tmdbMovie.title} - ${kurdishTitle}`;

                const movieObj = {
                    badge_text: "FREE",
                    description: kurdishDesc, 
                    dubbedAudioUrl: "",
                    genre_id: tmdbMovie.genre_ids && tmdbMovie.genre_ids.length > 0 ? tmdbMovie.genre_ids[0] : 0,
                    hasKurdishSub: true,
                    hasSubtitle: true,
                    id: tmdbMovie.id,
                    image: tmdbMovie.poster_path ? `https://image.tmdb.org/t/p/w500${tmdbMovie.poster_path}` : "",
                    introEndTime: 0,
                    isDubbed: false,
                    subtitleKurdish: "",
                    title: finalTitle, 
                    type: "movie",
                    url: "", 
                    views: 0,
                    year: tmdbMovie.release_date ? tmdbMovie.release_date.split('-')[0] : ""
                };

                // ناردن بۆ فایەربەیس بە بەکارهێنانی کلیلە نهێنییەکە (auth)
                const authParam = FB_SECRET ? `?auth=${FB_SECRET}` : "";
                await axios.put(`${FB_URL}/subtitled_movies1/${tmdbMovie.id}.json${authParam}`, movieObj);
                console.log(`✅ فیلمی نوێ خەزنکرا: ${movieObj.title}`);
            }
        } catch (error) {
            console.error(`❌ هەڵە لە پەڕەی ${page} ی فیلمەکان:`, error.message);
        }
    }
}

// ---------------------------------------------------------
// ٤. هێنانی زنجیرە تازەکان
// ---------------------------------------------------------
async function fetchAndSaveSeries() {
    console.log("📺 دەستکردن بە هێنانی زنجیرە تازەکان بۆ series1...");
    
    for (let page = 1; page <= 3; page++) {
        try {
            const res = await axios.get(`https://api.themoviedb.org/3/tv/on_the_air?api_key=${TMDB_API_KEY}&language=en-US&page=${page}`);
            const seriesList = res.data.results;

            for (let tmdbShow of seriesList) {
                const exists = await checkExists('series1', tmdbShow.id);
                if (exists) continue;

                const showDetailsRes = await axios.get(`https://api.themoviedb.org/3/tv/${tmdbShow.id}?api_key=${TMDB_API_KEY}&language=en-US`);
                const showDetails = showDetailsRes.data;

                const kurdishDesc = await translateToKurdish(showDetails.overview);
                const kurdishTitle = await translateToKurdish(showDetails.name);
                const finalTitle = `${showDetails.name} - ${kurdishTitle}`;

                let seasonsArray = [];

                for (let season of showDetails.seasons) {
                    if (season.season_number === 0) continue; 

                    const seasonRes = await axios.get(`https://api.themoviedb.org/3/tv/${tmdbShow.id}/season/${season.season_number}?api_key=${TMDB_API_KEY}&language=en-US`);
                    const seasonData = seasonRes.data;

                    let episodesArray = [];
                    for (let episode of seasonData.episodes) {
                        episodesArray.push({
                            id: episode.episode_number,
                            duration: episode.runtime ? `${episode.runtime}:00` : "45:00",
                            image: episode.still_path ? `https://image.tmdb.org/t/p/w500${episode.still_path}` : (showDetails.backdrop_path ? `https://image.tmdb.org/t/p/w500${showDetails.backdrop_path}` : ""),
                            title: `ئەڵقەی ${episode.episode_number}`,
                            url: ""
                        });
                    }

                    seasonsArray.push({
                        id: season.season_number,
                        title: `وەرزی ${season.season_number}`,
                        episodes: episodesArray
                    });
                }

                const seriesObj = {
                    badge_text: "نوێ",
                    description: kurdishDesc,
                    id: showDetails.id,
                    image: showDetails.backdrop_path ? `https://image.tmdb.org/t/p/w780${showDetails.backdrop_path}` : "",
                    imdb: showDetails.vote_average,
                    poster: showDetails.poster_path ? `https://image.tmdb.org/t/p/w500${showDetails.poster_path}` : "",
                    title: finalTitle,
                    translation: "زنجیرە",
                    type: "series",
                    views: 0,
                    seasons: seasonsArray
                };

                // ناردن بۆ فایەربەیس بە بەکارهێنانی کلیلە نهێنییەکە (auth)
                const authParam = FB_SECRET ? `?auth=${FB_SECRET}` : "";
                await axios.put(`${FB_URL}/series1/${tmdbShow.id}.json${authParam}`, seriesObj);
                console.log(`✅ زنجیرەی نوێ خەزنکرا: ${seriesObj.title}`);
            }
        } catch (error) {
            console.error(`❌ هەڵە لە زنجیرەکان پەڕەی ${page}:`, error.message);
        }
    }
}

// ---------------------------------------------------------
// ٥. کارپێکردن
// ---------------------------------------------------------
async function runBot() {
    await fetchAndSaveMovies();
    console.log("-----------------------------------");
    await fetchAndSaveSeries();
    console.log("🚀 پرۆسەی بۆتەکە بە تەواوی کۆتایی هات!");
}

runBot();

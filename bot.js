const axios = require('axios');

const TMDB_API_KEY = '7ff77f551b7a1db3b68d9a5a991e7cd5';
const FB_URL = 'https://sarko-43d61-default-rtdb.firebaseio.com';

// فەنکشنی پشکنینی دووبارەبوونەوە (بۆ ئەوەی ملیۆنێک فیلمەکە تێک نەچێت)
async function checkExists(path, id) {
    try {
        const res = await axios.get(`${FB_URL}/${path}/${id}.json?shallow=true`);
        return res.data !== null; 
    } catch (e) {
        return false;
    }
}

// مەکینەی هێنانی فیلمەکان
async function fetchAndSaveMovies() {
    console.log("🎬 دەستکردن بە هێنانی فیلمەکان بۆ subtitled_movies1...");
    try {
        const res = await axios.get(`https://api.themoviedb.org/3/movie/popular?api_key=${TMDB_API_KEY}&language=ar&page=1`);
        const movies = res.data.results;

        for (let tmdbMovie of movies) {
            const exists = await checkExists('subtitled_movies1', tmdbMovie.id);
            if (exists) {
                console.log(`⚠️ فیلمی دووبارە تێپەڕێنرا: ${tmdbMovie.title}`);
                continue;
            }

            // پەیکەری فیلم ڕێک وەک داواکارییەکەی خۆت
            const movieObj = {
                badge_text: "FREE",
                description: tmdbMovie.overview || "زانیاری بەردەست نییە",
                dubbedAudioUrl: "",
                genre_id: tmdbMovie.genre_ids && tmdbMovie.genre_ids.length > 0 ? tmdbMovie.genre_ids[0] : 0,
                hasKurdishSub: true,
                hasSubtitle: true,
                id: tmdbMovie.id,
                image: tmdbMovie.poster_path ? `https://image.tmdb.org/t/p/w500${tmdbMovie.poster_path}` : "",
                introEndTime: 0,
                isDubbed: false,
                subtitleKurdish: "",
                title: tmdbMovie.title,
                type: "movie",
                url: "", // لێرەدا دواتر لینکی پڕۆکسییەکەی خۆمانی تێ دەکەین
                views: 0,
                year: tmdbMovie.release_date ? tmdbMovie.release_date.split('-')[0] : ""
            };

            await axios.put(`${FB_URL}/subtitled_movies1/${tmdbMovie.id}.json`, movieObj);
            console.log(`✅ فیلمی نوێ خەزنکرا: ${movieObj.title}`);
        }
    } catch (error) {
        console.error("❌ هەڵە لە فیلمەکان:", error.message);
    }
}

// مەکینەی هێنانی زنجیرەکان بە هەموو ئەڵقەکانییەوە
async function fetchAndSaveSeries() {
    console.log("📺 دەستکردن بە هێنانی زنجیرەکان بۆ series1...");
    try {
        const res = await axios.get(`https://api.themoviedb.org/3/tv/popular?api_key=${TMDB_API_KEY}&language=ar&page=1`);
        const seriesList = res.data.results;

        for (let tmdbShow of seriesList) {
            const exists = await checkExists('series1', tmdbShow.id);
            if (exists) {
                console.log(`⚠️ زنجیرەی دووبارە تێپەڕێنرا: ${tmdbShow.name}`);
                continue;
            }

            // هێنانی زانیاری تەواوەتی زنجیرەکە بۆ دۆزینەوەی وەرزەکان
            const showDetailsRes = await axios.get(`https://api.api.themoviedb.org/3/tv/${tmdbShow.id}?api_key=${TMDB_API_KEY}&language=ar`);
            const showDetails = showDetailsRes.data;

            let seasonsArray = [];

            // هێنانی ئەڵقەکانی هەر وەرزێک
            for (let season of showDetails.seasons) {
                if (season.season_number === 0) continue; // تێپەڕاندنی ئەڵقە تایبەتەکان (Specials)

                const seasonRes = await axios.get(`https://api.themoviedb.org/3/tv/${tmdbShow.id}/season/${season.season_number}?api_key=${TMDB_API_KEY}&language=ar`);
                const seasonData = seasonRes.data;

                let episodesArray = [];
                for (let episode of seasonData.episodes) {
                    episodesArray.push({
                        id: episode.episode_number,
                        duration: episode.runtime ? `${episode.runtime}:00` : "45:00",
                        image: episode.still_path ? `https://image.tmdb.org/t/p/w500${episode.still_path}` : (tmdbShow.backdrop_path ? `https://image.tmdb.org/t/p/w500${tmdbShow.backdrop_path}` : ""),
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

            // پەیکەری زنجیرە ڕێک وەک داواکارییەکەی خۆت
            const seriesObj = {
                badge_text: "نوێ",
                description: showDetails.overview || "زانیاری بەردەست نییە",
                id: showDetails.id,
                image: showDetails.backdrop_path ? `https://image.tmdb.org/t/p/w780${showDetails.backdrop_path}` : "",
                imdb: showDetails.vote_average,
                poster: showDetails.poster_path ? `https://image.tmdb.org/t/p/w500${showDetails.poster_path}` : "",
                title: showDetails.name,
                translation: "زنجیرە",
                type: "series",
                views: 0,
                seasons: seasonsArray
            };

            await axios.put(`${FB_URL}/series1/${tmdbShow.id}.json`, seriesObj);
            console.log(`✅ زنجیرەی نوێ خەزنکرا: ${seriesObj.title} (بە ${seasonsArray.length} وەرزەوە)`);
        }
    } catch (error) {
        console.error("❌ هەڵە لە زنجیرەکان:", error.message);
    }
}

// کارپێکردنی هەردوو مەکینەکە
async function runBot() {
    await fetchAndSaveMovies();
    console.log("-----------------------------------");
    await fetchAndSaveSeries();
    console.log("🚀 پرۆسەی بۆتەکە بە تەواوی کۆتایی هات!");
}

runBot();

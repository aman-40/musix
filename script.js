// ========= CONFIG & HELPERS =========
const APP_NAME = "MyHtmlMusicPlayer";

// Jamendo public test client_id (for demo).
const JAMENDO_CLIENT_ID = "709fa152";

// --- Audius helpers ---
async function getAudiusHost() {
  try {
    const res = await fetch("https://api.audius.co");
    const data = await res.json();
    if (!data || !data.data || !data.data.length) {
      throw new Error("No Audius host available");
    }
    return data.data[0];
  } catch (e) {
    console.error("Audius host error:", e);
    return null; // don't break app if Audius unavailable
  }
}

async function fetchAudiusTrending(host) {
  if (!host) return [];
  try {
    const res = await fetch(`${host}/v1/tracks/trending?app_name=${APP_NAME}`);
    const json = await res.json();
    return json.data || [];
  } catch (e) {
    console.error("Audius trending error:", e);
    return [];
  }
}

// --- Jamendo helpers ---
async function fetchJamendoTracks() {
  try {
    if (!JAMENDO_CLIENT_ID) return [];

    const url = `https://api.jamendo.com/v3.0/tracks/?client_id=${JAMENDO_CLIENT_ID}&format=json&limit=10&audioformat=mp31`;
    const res = await fetch(url);
    const json = await res.json();

    if (!json || !json.results) return [];

    return json.results;
  } catch (e) {
    console.error("Jamendo fetch error:", e);
    return [];
  }
}

// Jamendo search helper
async function searchJamendo(query) {
  try {
    if (!query || !JAMENDO_CLIENT_ID) return [];
    const url = `https://api.jamendo.com/v3.0/tracks/?client_id=${JAMENDO_CLIENT_ID}&format=json&limit=25&search=${encodeURIComponent(
      query
    )}&audioformat=mp31`;
    const res = await fetch(url);
    const json = await res.json();
    if (!json || !json.results) return [];
    return json.results.map((t) => ({
      title: `${t.artist_name || "Unknown"} - ${t.name || "Unknown"}`,
      url: t.audio
    }));
  } catch (e) {
    console.error("Jamendo search error", e);
    return [];
  }
}

// Audius search helper
async function searchAudius(host, query) {
  try {
    if (!query || !host) return [];
    const res = await fetch(
      `${host}/v1/tracks/search?app_name=${APP_NAME}&q=${encodeURIComponent(
        query
      )}`
    );
    const json = await res.json();
    if (!json || !json.data) return [];
    return json.data.map((t) => ({
      title: `${(t.user && t.user.name) || "Unknown"} - ${
        t.title || "Unknown"
      }`,
      url: `${host}/v1/tracks/${t.id}/stream?app_name=${APP_NAME}`
    }));
  } catch (e) {
    console.error("Audius search error", e);
    return [];
  }
}

// ========= MUSIC PLAYER CLASS =========
class MusicPlayer {
  constructor(config) {
    this.music = config.music || [];
    this.currentIndex = 0;
    this.barsCount = 44;

    this.playerBlock = document.querySelector(".player");
    this.musicList = document.querySelector(".playlist__list");
    this.audio = document.getElementById("audioPlayer");
    this.playlistBth = document.getElementById("musicPlaylist");
    this.settingsBth = document.getElementById("settingsPlayer");
    this.autoplayBtn = document.getElementById("autoplay");
    this.playBtn = document.getElementById("playBtn");
    this.replayBtn = document.getElementById("replayBtn");
    this.barsContainer = document.getElementById("bars");
    this.title = document.getElementById("musicTitle");
    this.artist = document.getElementById("musicArtist");
    this.durationDisplay = document.getElementById("musicDuration");
    this.playIcon = this.playBtn.querySelector(".player__play-icon");
    this.pauseIcon = this.playBtn.querySelector(".player__pause-icon");
    this.nextBtn = document.querySelector(".player__next-btn");
    this.prevBtn = document.querySelector(".player__prev-btn");
    this.closePlaylist = document.querySelector(".playlist__control");
    this.volumeInput = document.getElementById("volumeInput");
    this.randomBtn = document.getElementById("randomBtn");

    this.audioContext = new (window.AudioContext ||
      window.webkitAudioContext)();
    this.gainNode = this.audioContext.createGain();
    this.analyser = this.audioContext.createAnalyser();

    const source = this.audioContext.createMediaElementSource(this.audio);
    source.connect(this.gainNode);
    this.gainNode.connect(this.analyser);
    this.analyser.connect(this.audioContext.destination);

    this.analyser.fftSize = 512;
    this.bufferLength = this.analyser.frequencyBinCount;
    this.dataArray = new Uint8Array(this.bufferLength);

    const initialVolume = config.volume ?? 0.5;

    this.gainNode.gain.value = initialVolume;
    this.audio.volume = initialVolume;

    if (this.volumeInput) {
      this.volumeInput.value = Math.round(this.audio.volume * 100);
      this.volumeInput.style.setProperty(
        "--range",
        this.volumeInput.value + "%"
      );

      this.setupVolumeControl();
    }

    this.random = config.random;
    this.autoplay = this.autoplayBtn.checked;

    this.createBars();
    this.setupControllers();
    this.playlistControl();
    this.setupPlaylist();
    if (this.music.length) {
      this.playTrack(0);
    }
    this.isMobile();
  }

  // helper to safely play (avoid AbortError spam)
  safePlay() {
    this.audioContext.resume();
    this.audio
      .play()
      .then(() => {
        this.updateControlButtons(true);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          console.error("Play error:", err);
        }
      });
  }

  playTrack(index) {
    if (this.music[index]) {
      this.currentIndex = index;

      this.playlistItems?.forEach((el, i) => {
        el.classList.toggle("current", i === index);
      });

      const [artist, title] = this.music[index].title.split(" - ");

      this.audio.src = this.music[index].url;
      this.artist.textContent = artist || "Unknown Artist";
      this.title.textContent = title || "Unknown Name";

      this.updateControlButtons(false);
      this.createBars();
    }
  }

  // Player Actions

  next(isAuto = false) {
    if (isAuto && !this.autoplay) return;

    if (this.random) {
      let nextIndex;
      do {
        nextIndex = Math.floor(Math.random() * this.music.length);
      } while (nextIndex === this.currentIndex && this.music.length > 1);

      this.playTrack(nextIndex);
    } else {
      if (this.currentIndex < this.music.length - 1) {
        this.playTrack(this.currentIndex + 1);
      } else {
        return;
      }
    }

    this.safePlay();
  }

  prev() {
    if (this.currentIndex > 0) {
      if (this.autoplay) {
        this.playTrack(this.currentIndex - 1);
        this.safePlay();
      } else {
        this.playTrack(this.currentIndex - 1);
        this.updateControlButtons(false);
      }
    }
  }

  updateControlButtons(isPlaying, ended = false) {
    this.prevBtn.classList.toggle("disabled", this.currentIndex < 1);
    this.nextBtn.classList.toggle(
      "disabled",
      this.currentIndex === this.music.length - 1 && !this.random
    );

    if (!this.autoplay && ended) {
      this.replayBtn.classList.remove("hidden");
      this.playBtn.classList.add("hidden");
      return;
    } else {
      this.replayBtn.classList.add("hidden");
      this.playBtn.classList.remove("hidden");
    }

    if (isPlaying) {
      this.playIcon.classList.add("hidden");
      this.pauseIcon.classList.remove("hidden");
    } else {
      this.playIcon.classList.remove("hidden");
      this.pauseIcon.classList.add("hidden");
    }
  }

  // Audio Wave

  createBars() {
    this.barsContainer.innerHTML = "";

    for (let i = 0; i < this.barsCount; i++) {
      const bar = document.createElement("div");

      bar.classList.add("player__bar");
      this.barsContainer.appendChild(bar);
    }
  }

  updateBars() {
    this.analyser.getByteFrequencyData(this.dataArray);

    const bars = [...document.querySelectorAll(".player__bar")];
    const step = Math.floor(this.bufferLength / this.barsCount);

    bars.forEach((bar, index) => {
      let sum = 0;
      for (let i = 0; i < step; i++) {
        sum += this.dataArray[index * step + i];
      }

      const average = sum / step;
      const fillHeight = average / 2;

      bar.style.height = `${fillHeight}%`;

      const barDuration = this.audio.duration / this.barsCount;
      const currentIndex = Math.floor(this.audio.currentTime / barDuration);

      if (index <= currentIndex) {
        bar.classList.add("color");
      } else {
        bar.classList.remove("color");
      }
    });
  }

  // Playlist

  setupPlaylist() {
    this.playlistItems = [];
    this.musicList.innerHTML = "";

    for (let i = 0; i < this.music.length; i++) {
      const [artist, title] = this.music[i].title.split(" - ");
      const newMusicItem = document.createElement("div");

      newMusicItem.tabIndex = 0;
      newMusicItem.classList.add("playlist__item");

      if (i === 0) newMusicItem.classList.add("current");
      newMusicItem.setAttribute("data-song-id", i);

      newMusicItem.innerHTML = `
        <span class="playlist__song">${artist} - <span class="playlist__song-name">${title}</span></span>
        <p class="playlist__duration">00:00</p>
      `;

      this.musicList.appendChild(newMusicItem);
      this.playlistItems.push(newMusicItem);

      const durationElement = newMusicItem.querySelector(".playlist__duration");
      const tempAudio = document.createElement("audio");
      tempAudio.src = this.music[i].url;

      tempAudio.addEventListener("loadedmetadata", () => {
        const duration = tempAudio.duration;
        const mins = Math.floor(duration / 60)
          .toString()
          .padStart(2, "0");
        const secs = Math.floor(duration % 60)
          .toString()
          .padStart(2, "0");

        durationElement.textContent = `${mins}:${secs}`;
      });

      newMusicItem.addEventListener("click", () => {
        this.playlistItems.forEach((el) => el.classList.remove("current"));
        newMusicItem.classList.add("current");
        this.playTrack(i);

        if (this.autoplay) {
          this.safePlay();
        } else {
          this.updateControlButtons(false);
        }
      });
    }
  }

  // Replace current music list with new array and rerender playlist
  setMusic(newMusic = []) {
    this.music = newMusic || [];
    this.currentIndex = 0;
    this.setupPlaylist();
    if (this.music.length) {
      this.playTrack(0);
      this.updateControlButtons(false);
    }
  }

  playlistControl() {
    this.playlistBth.addEventListener("click", () => {
      this.playerBlock.classList.toggle("open-playlist");
      this.playlistBth.classList.toggle("active");
    });

    this.closePlaylist.addEventListener("click", () => {
      this.playerBlock.classList.remove("open-playlist");
      this.playlistBth.classList.remove("active");
    });
  }

  // Player Controllers

  setupControllers() {
    // Audio error: skip to next track
    this.audio.addEventListener("error", () => {
      console.warn("Error loading track, skipping to next…");
      this.next(true);
    });

    this.audio.addEventListener("ended", () => {
      this.updateControlButtons(false, true);
      this.next(true);
    });

    this.audio.addEventListener("timeupdate", () => {
      if (this.audio.duration && !isNaN(this.audio.duration)) {
        const remainingTime = this.audio.duration - this.audio.currentTime;
        const mins = Math.floor(remainingTime / 60)
          .toString()
          .padStart(2, "0");
        const secs = Math.floor(remainingTime % 60)
          .toString()
          .padStart(2, "0");

        this.durationDisplay.textContent = `${mins}:${secs}`;
      } else {
        this.durationDisplay.textContent = "00:00";
      }
    });

    this.audio.addEventListener("loadedmetadata", () => {
      if (this.audio.duration && !isNaN(this.audio.duration)) {
        const mins = Math.floor(this.audio.duration / 60)
          .toString()
          .padStart(2, "0");
        const secs = Math.floor(this.audio.duration % 60)
          .toString()
          .padStart(2, "0");

        this.durationDisplay.textContent = `${mins}:${secs}`;
      } else {
        this.durationDisplay.textContent = "00:00";
      }
    });

    this.audio.addEventListener("play", () => {
      const update = () => {
        this.updateBars();

        if (!this.audio.paused) {
          requestAnimationFrame(update);
        }
      };

      update();
    });

    // Control Buttons

    this.playBtn.addEventListener("click", () => {
      if (this.audio.paused) {
        this.safePlay();
      } else {
        this.audio.pause();
        this.updateControlButtons(false);
      }
    });

    this.nextBtn.addEventListener("click", () => {
      this.next(false);
    });

    this.prevBtn.addEventListener("click", () => {
      this.prev();
    });

    this.replayBtn.addEventListener("click", () => {
      this.audio.currentTime = 0;
      this.safePlay();
    });

    this.randomBtn.addEventListener("click", () => {
      this.randomBtn.classList.toggle("active");
      this.random = !this.random;
    });

    // Audio Wave Controller

    this.barsContainer.addEventListener("click", (event) => {
      const rect = this.barsContainer.getBoundingClientRect();
      const clickX = event.clientX - rect.left;

      const barWidth = rect.width / this.barsCount;
      const index = Math.min(
        this.barsCount - 1,
        Math.max(0, Math.floor(clickX / barWidth))
      );

      const timePerBar = this.audio.duration / this.barsCount;
      const newTime = index * timePerBar;

      this.audio.currentTime = newTime;

      if (this.audio.paused) {
        const bars = [...document.querySelectorAll(".player__bar")];

        bars.forEach((bar, i) => {
          if (i <= index) {
            bar.classList.add("color");
          } else {
            bar.classList.remove("color");
          }
        });
      } else {
        this.updateBars();
      }
    });

    // Settings Controllers

    this.settingsBth.addEventListener("click", () => {
      this.settingsBth.classList.toggle("active");
    });

    this.autoplayBtn.addEventListener("change", () => {
      this.autoplay = this.autoplayBtn.checked;
    });
  }

  setupVolumeControl() {
    const volumeMute = document.querySelector(".player__volume-mute");
    const volumeHigh = document.querySelector(".player__volume-high");
    const volumeDefault = document.querySelector(".player__volume-default");

    const updateVolumeUI = (val) => {
      const volume = val / 100;

      this.audio.volume = volume;
      this.gainNode.gain.value = volume;
      this.volumeInput.style.setProperty("--range", val + "%");

      if (val <= 0) {
        volumeDefault.classList.add("hidden");
        volumeHigh.classList.add("hidden");
        volumeMute.classList.remove("hidden");
      } else if (val >= 60) {
        volumeDefault.classList.add("hidden");
        volumeMute.classList.add("hidden");
        volumeHigh.classList.remove("hidden");
      } else {
        volumeMute.classList.add("hidden");
        volumeHigh.classList.add("hidden");
        volumeDefault.classList.remove("hidden");
      }
    };

    let isDragging = false;

    const moveHandler = (clientX) => {
      const rect = this.volumeInput.getBoundingClientRect();

      let percent = ((clientX - rect.left) / rect.width) * 100;
      percent = Math.max(0, Math.min(100, percent));

      this.volumeInput.value = percent;
      updateVolumeUI(percent);
    };

    this.volumeInput.addEventListener("touchstart", (e) => {
      isDragging = true;
      moveHandler(e.touches[0].clientX);
      e.preventDefault();
    });

    this.volumeInput.addEventListener("touchmove", (e) => {
      if (!isDragging) return;
      moveHandler(e.touches[0].clientX);
      e.preventDefault();
    });

    this.volumeInput.addEventListener("touchend", () => (isDragging = false));
    this.volumeInput.addEventListener("click", (e) => moveHandler(e.clientX));
    this.volumeInput.addEventListener("input", (e) =>
      updateVolumeUI(e.target.value)
    );
  }

  isMobile() {
    const updateBarsCount = () => {
      this.barsCount = window.innerWidth < 620 ? 25 : 50;
      this.createBars();
    };

    updateBarsCount();
    window.addEventListener("resize", updateBarsCount);
  }
}

// ========= INIT: trending + search wiring =========
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const searchInput = document.getElementById("searchInput");
    const searchBtn = document.getElementById("searchBtn");
    const playlistTitleEl = document.querySelector(".playlist__title");

    const host = await getAudiusHost();

    const [audiusTracks, jamendoTracks] = await Promise.all([
      fetchAudiusTrending(host),
      fetchJamendoTracks()
    ]);

    const audiusMapped = audiusTracks.map((t) => {
      const artist = (t.user && t.user.name) || "Unknown Artist";
      const title = t.title || "Unknown Title";

      return {
        title: `${artist} - ${title}`,
        url: `${host}/v1/tracks/${t.id}/stream?app_name=${APP_NAME}`
      };
    });

    const jamendoMapped = jamendoTracks.map((t) => {
      const artist = t.artist_name || "Unknown Artist";
      const title = t.name || "Unknown Title";
      const url = t.audio;

      return {
        title: `${artist} - ${title}`,
        url
      };
    });

    const music = [...audiusMapped, ...jamendoMapped];

    const defaults = {
      random: false,
      volume: 0.5,
      music
    };

    const playerInstance = new MusicPlayer(defaults);

    // --- SEARCH LOGIC ---
    async function doSearch() {
      const q = searchInput.value.trim();
      if (!q) return;

      const oldText = searchBtn.textContent;
      searchBtn.disabled = true;
      searchBtn.textContent = "Searching...";
      playlistTitleEl.textContent = `Searching: "${q}" ...`;

      const [audResults, jamResults] = await Promise.all([
        searchAudius(host, q).catch(() => []),
        searchJamendo(q).catch(() => [])
      ]);

      let results = [...audResults, ...jamResults];

      // Fallback: filter current playlist locally if APIs return nothing
      if (!results.length) {
        const localFiltered = defaults.music.filter((track) =>
          track.title.toLowerCase().includes(q.toLowerCase())
        );
        results = localFiltered;
      }

      if (!results.length) {
        playlistTitleEl.textContent = `No results for "${q}"`;
      } else {
        playlistTitleEl.textContent = `Results for "${q}" (${results.length})`;
      }

      playerInstance.setMusic(results);

      searchBtn.disabled = false;
      searchBtn.textContent = oldText;
    }

    searchBtn.addEventListener("click", doSearch);
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        doSearch();
      }
    });
  } catch (err) {
    console.error("Failed to init music player:", err);
  }
});

let playerControlIndex = 0;
const playerFields = ["btn-play-pause", "btn-stop"];
let isPaused = false;
let controlTimeout;

let hiddenCategories = { live: [], movie: [], series: [] };
let categoryToggleData = [];
let manageState = "main";
const manageSections = ["live", "movie", "series", "back"];

let focusArea = "login"; 
const loginFields = ["input-url", "input-user", "input-pass", "btn-login", "btn-cancel"];
let loginIndex = 0;
let dashIndex = 0;

const dashFields = ["dash-live", "dash-movies", "dash-series", "dash-settings", "dash-exit"];

const setFields = ["set-creds", "set-manage-cats", "set-back"];

let setIndex = 0;
let currentType = "live"; 
let categoriesData = [];
let channelsData = [];
let currentFilteredData = [];
let focusIndex = 0; 
let channelFocusIndex = 0; 
let lastCategoryIndex = 0; 

let serverConfig = { url: "", user: "", pass: "" };
const FILE_NAME = "creds.json";

window.onload = function() {
	
	setInterval(updateClock, 1000);

	function updateClock() {
	    const now = new Date();
	    const clockEl = document.getElementById('clock');
	    if (clockEl) clockEl.innerText = now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
	}
	
	
    window.focus();
    try {
        const keys = ["Return", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter"];
        keys.forEach(key => tizen.tvinputdevice.registerKey(key));
    } catch (e) { console.error("Key Reg Error"); }

    loadFromFs();
    document.addEventListener('keydown', handleKey);
};

function updateFocus() {
    document.querySelectorAll('.focused').forEach(el => el.classList.remove('focused'));
           
    let el;
    if (focusArea === "search") el = document.getElementById('search-input');
    else if (focusArea === "login") el = document.getElementById(loginFields[loginIndex]);
    else if (focusArea === "dashboard") el = document.getElementById(dashFields[dashIndex]);
    else if (focusArea === "categories") el = document.getElementById(`cat-${focusIndex}`);
    else if (focusArea === "channels") el = document.getElementById(`ch-${channelFocusIndex}`);
    else if (focusArea === "player") el = document.getElementById(playerFields[playerControlIndex]);
    else if (focusArea === "mini-channels") el = document.getElementById(`mini-ch-${channelFocusIndex}`);
    else if (focusArea === "settings") {
        if (manageState === "sections") el = document.getElementById("manage-sec-" + setIndex);
        else if (manageState === "toggling") el = document.getElementById("toggle-cat-" + setIndex);
        else el = document.getElementById(setFields[setIndex]);
    }

    if (el) {
        el.classList.add('focused');
        el.scrollIntoView({ block: "center", behavior: "smooth" });
    }
}

function handleKey(e) {
    const key = e.keyCode;
    let fieldid = loginFields[loginIndex];
    logDebug("DEBUG: focusArea: " + focusArea + "  Key: " + key + "  Field: " + fieldid);
    // Prevent default scrolling for arrow keys
    if ([38, 40, 37, 39].includes(key)) e.preventDefault();
    
    // Global: Exit Input handling for virtual keyboard
    if (document.activeElement.tagName === "INPUT" && (key === 13 || key === 10009)) {
        document.activeElement.blur(); 
        return;
    }

    if (focusArea === "login") {
        if (key === 38 && loginIndex > 0){
        		if (document.activeElement.tagName === "INPUT") {
                document.activeElement.blur();
            }
        		loginIndex--;
        	}
        else if (key === 40 && loginIndex < loginFields.length - 1) {
        		if (document.activeElement.tagName === "INPUT") {
                document.activeElement.blur();
            }
        		loginIndex++;
        	}
        else if (key === 13) {
            let id = loginFields[loginIndex];
            if (id === "btn-login") {
                serverConfig = { 
                    url: document.getElementById('input-url').value.trim(), 
                    user: document.getElementById('input-user').value.trim(), 
                    pass: document.getElementById('input-pass').value.trim() 
                };
                attemptLogin(false);
            } else if (id === "btn-cancel") { 
                closeCredScreen(); 
            } else {
                let el = document.getElementById(id);
                el.readOnly = false; 
                el.focus(); 
                el.onblur = () => { el.readOnly = true; window.focus(); };
            }
        }
    } 
    else if (focusArea === "dashboard") {
        if (key === 37 && dashIndex > 0) dashIndex--;
        else if (key === 39 && dashIndex < dashFields.length - 1) dashIndex++;
        else if (key === 13) {
            if (dashIndex === 0) startSection("live");
            else if (dashIndex === 1) startSection("movie");
            else if (dashIndex === 2) startSection("series");
            else if (dashIndex === 3) openSettings();
            else if (dashIndex === 4) tizen.application.getCurrentApplication().exit();
        }
    } 
    else if (focusArea === "search") {
        if (key === 40) { 
            // Move down to categories and hide keyboard
            document.getElementById('search-input').blur();
            focusArea = "categories";
            focusIndex = 0;
        } else if (key === 13) { 
            // Enter to type
            let input = document.getElementById('search-input');
            input.readOnly = false;
            input.focus();
            input.oninput = (el) => {
                renderChannels(el.target.value);
            };
            input.onblur = () => {
                input.readOnly = true;
                window.focus();
            };
        } else if (key === 10009) {
            exitAppSection();
        }
    }
    else if (focusArea === "settings") {
        if (manageState === "main") {
            if (key === 38 && setIndex > 0) setIndex--;
            else if (key === 40 && setIndex < setFields.length - 1) setIndex++;
            else if (key === 13) handleSettingsSelect();
            else if (key === 10009) closeSettings();
        } 
        else if (manageState === "sections") {
            if (key === 38 && setIndex > 0) setIndex--;
            else if (key === 40 && setIndex < manageSections.length - 1) setIndex++;
            else if (key === 13) loadToggleList(manageSections[setIndex]);
            else if (key === 10009) {
                document.getElementById('settings-main-menu').style.display = "block";
                document.getElementById('settings-category-menu').style.display = "none";
                manageState = "main"; 
                setIndex = 1;
            }
            renderManageSections();
        }
        else if (manageState === "toggling") {
            if (key === 38 && setIndex > 0) setIndex--;
            else if (key === 40 && setIndex < categoryToggleData.length - 1) setIndex++;
            else if (key === 13) {
                let selected = categoryToggleData[setIndex];
                if (selected.category_id === "TOGGLE_ALL") {
                    if (hiddenCategories[currentType].length === 0) {
                        hiddenCategories[currentType] = categoryToggleData.filter(c => c.category_id !== "TOGGLE_ALL").map(c => c.category_id);
                    } else { 
                        hiddenCategories[currentType] = []; 
                    }
                } else {
                    let catId = selected.category_id;
                    let list = hiddenCategories[currentType];
                    let idx = list.indexOf(catId);
                    if (idx === -1) list.push(catId); else list.splice(idx, 1);
                }
                saveToFs(serverConfig); 
                renderToggleList();
            }
            else if (key === 10009) { 
                manageState = "sections"; 
                setIndex = 0; 
                renderManageSections(); 
            }
        }
    }
    else if (focusArea === "player") {
        if (currentType === "live") {
            // Live TV logic: Left/Right to change channels, Return to stop
            if (key === 37)  changeLiveChannel(-1); // Previous Channel
            else if (key === 39) changeLiveChannel(1);  // Next Channel
            else if (key === 38 || key === 40) showMiniChannelList();
            else if (key === 10009) { 
                stopVideo(); 
            }
        } else {
            // Movie/Series logic: Standard player navigation (Play/Pause/Stop)
            if (key === 10009) { 
                stopVideo(); 
                hideControls(); 
            }
            else if (key === 37 && playerControlIndex > 0) {
                playerControlIndex--; 
            }
            else if (key === 39 && playerControlIndex < playerFields.length - 1) {
                playerControlIndex++; 
            }
            else if (key === 13) {
                if (playerFields[playerControlIndex] === "btn-play-pause") {
                    if (isPaused) {
                        webapis.avplay.play();
                        document.getElementById('btn-play-pause').innerText = "⏸";
                        isPaused = false;
                        hideControls();
                    } else {
                        webapis.avplay.pause();
                        document.getElementById('btn-play-pause').innerText = "▶️";
                        isPaused = true;
                    }
                } else {
                    stopVideo();
                    hideControls();
                }
            }
        }
    }
    else if (focusArea === "mini-channels") {
        if (key === 38 && channelFocusIndex > 0) channelFocusIndex--;
        else if (key === 40 && channelFocusIndex < currentFilteredData.length - 1) channelFocusIndex++;
        else if (key === 13) {
            playContent(currentFilteredData[channelFocusIndex]);
            hideMiniChannelList();
        }
        else if (key === 10009 || key === 37) { // Return or Left to close
            hideMiniChannelList();
        }
    }
    else { 
        handleAppNav(key); 
    }
    
    updateFocus();
}


/**
 * New function to handle Live TV channel switching
 * @param {number} direction - 1 for next, -1 for previous
 */
function changeLiveChannel(direction) {
    if (channelsData.length === 0) return;

    let newIndex = channelFocusIndex + direction;

    if (newIndex < 0) {
        newIndex = channelsData.length - 1;
    } else if (newIndex >= channelsData.length) {
        newIndex = 0;
    }

    channelFocusIndex = newIndex;
    const nextChannel = channelsData[channelFocusIndex];
    
    // Clean name for debug log
    let rawName = nextChannel.name || nextChannel.title || "";
    let cleanName = rawName.includes('|') ? rawName.split('|').pop().trim() : rawName;
    
    logDebug("Zapping to: " + cleanName);
    playContent(nextChannel);
}

function logDebug(msg) {
    const debugEl = document.getElementById('debug-log');
    if (debugEl) debugEl.innerText = "DEBUG: " + msg;
}

function handleAppNav(key) {
    if (key === 10009) { exitAppSection(); return; }

    if (focusArea === "categories") {
        if (key === 38) { 
            if (focusIndex === 0) focusArea = "search"; 
            else focusIndex--; 
        }
        else if (key === 40 && focusIndex < categoriesData.length - 1) focusIndex++;
        else if (key === 39 && currentFilteredData.length > 0) { 
            lastCategoryIndex = focusIndex; 
            focusArea = "channels"; 
            channelFocusIndex = 0; 
        }
        else if (key === 13) loadChannels();
    } 
    else if (focusArea === "channels") {
        if (key === 38) { 
            if (channelFocusIndex >= 4) channelFocusIndex -= 4; 
            else focusArea = "search"; 
        }
        else if (key === 40) { 
            if (channelFocusIndex + 4 < currentFilteredData.length) channelFocusIndex += 4; 
        }
        else if (key === 37) { 
            if (channelFocusIndex % 4 === 0) { focusArea = "categories"; focusIndex = lastCategoryIndex; } 
            else channelFocusIndex--; 
        }
        else if (key === 39 && channelFocusIndex < currentFilteredData.length - 1) channelFocusIndex++;
        else if (key === 13) playContent(currentFilteredData[channelFocusIndex]);
    }
}


function startSection(type) {
    currentType = type; 
    focusArea = "categories"; 
    focusIndex = 0;
    channelFocusIndex = 0; // Reset channel focus index

    // Clear existing data and UI immediately
    channelsData = [];
    currentFilteredData = [];
    document.getElementById('category-list').innerHTML = ""; 
    document.getElementById('channel-grid').innerHTML = ""; 

    document.getElementById('dashboard').style.display = "none";
    document.getElementById('app').style.display = "flex";

    let action = (type === "live") ? "get_live_categories" : (type === "movie") ? "get_vod_categories" : "get_series_categories";
    
    fetch(`${serverConfig.url}/player_api.php?username=${serverConfig.user}&password=${serverConfig.pass}&action=${action}`)
        .then(r => r.json())
        .then(data => {
            categoriesData = data.filter(cat => !hiddenCategories[currentType].includes(cat.category_id));
            renderCategories();
            if (categoriesData.length > 0) {
                loadChannels();
            }
        })
        .catch(e => logDebug("Error switching sections: " + e.message));
}


function renderCategories() {
    const container = document.getElementById('category-list');
    container.innerHTML = "";
    categoriesData.forEach((cat, i) => {
        let div = document.createElement('div');
        div.className = "item"; div.id = `cat-${i}`; div.innerText = cat.category_name;
        container.appendChild(div);
    });
}

function loadChannels() {
    let catId = categoriesData[focusIndex].category_id;
    let action = (currentType === "live") ? "get_live_streams" : (currentType === "movie") ? "get_vod_streams" : "get_series";
    fetch(`${serverConfig.url}/player_api.php?username=${serverConfig.user}&password=${serverConfig.pass}&action=${action}&category_id=${catId}`)
        .then(r => r.json()).then(data => { 
            channelsData = data; 
            renderChannels(document.getElementById('search-input').value); 
        });
}


function renderChannels(filterText = "") {
    const grid = document.getElementById('channel-grid');
    grid.innerHTML = "";

    // Filter data based ONLY on channel names/titles
    let displayData = channelsData;
    if (filterText) {
        displayData = channelsData.filter(ch => {
            const name = (ch.name || ch.title || "").toLowerCase();
            return name.includes(filterText.toLowerCase());
        });
    }

    // Alphabetical Sort
    displayData.sort((a, b) => {
        var nameA = (a.name || a.title || "").toLowerCase();
        var nameB = (b.name || b.title || "").toLowerCase();
        return nameA < nameB ? -1 : nameA > nameB ? 1 : 0;
    });

    displayData.forEach((ch, i) => {
        let div = document.createElement('div');
        div.className = "channel-card";
        div.id = `ch-${i}`;

        let rawName = ch.name || ch.title || "";
        let cleanName = rawName.includes('|') ? rawName.split('|').pop().trim() : rawName;
        let iconUrl = ch.stream_icon || ch.cover || "";
        let imgHtml = iconUrl ? `<img src="${iconUrl}" onerror="this.src='https://via.placeholder.com/150?text=TV'">` : `<div class="icon-placeholder">📺</div>`;

        div.innerHTML = `
            <div class="channel-poster">${imgHtml}</div>
            <div class="channel-name">${cleanName}</div>
        `;
        grid.appendChild(div);
    });

    // Update the reference for navigation to the currently filtered set
    currentFilteredData = displayData; 
    updateFocus();
}

/**
 * New function to filter the category sidebar
 */
function filterCategories(query) {
    const container = document.getElementById('category-list');
    container.innerHTML = "";
    
    // Filter the master categoriesData list by name
    const filteredCats = categoriesData.filter(cat => 
        cat.category_name.toLowerCase().includes(query.toLowerCase()) &&
        hiddenCategories[currentType].indexOf(cat.category_id) === -1
    );

    filteredCats.forEach((cat, i) => {
        const div = document.createElement('div');
        div.className = "item";
        div.id = `cat-${i}`;
        div.innerText = cat.category_name;
        container.appendChild(div);
    });

    // Update the active categories for navigation
    // Note: We don't overwrite the global categoriesData so we don't lose the full list
    if (query) {
        logDebug(`Found ${filteredCats.length} matching categories`);
    }
}

function playContent(item) {
    if (!item) return;
    // Hide all UI layers so the video is visible
    document.getElementById('dashboard').style.display = "none";
    document.getElementById('login-screen').style.display = "none";
    document.getElementById('app').style.display = "none";
    
    // Get Clean Name
    let rawName = item.name || item.title || "";
    let cleanName = rawName.includes('|') ? rawName.split('|').pop().trim() : rawName;

    logDebug("Playing: " + cleanName);

    const infoBox = document.getElementById('live-channel-info');
    if (infoBox) infoBox.style.display = "none";

    try {
        webapis.avplay.stop();
        webapis.avplay.close();
    } catch (e) {}

    document.getElementById('app').style.display = "none";
    
    // Use cleanName for UI elements
    document.getElementById('playing-now-title').innerText = cleanName;
    
    let streamUrl = "";
    if (currentType === "live") {
        streamUrl = `${serverConfig.url}/live/${serverConfig.user}/${serverConfig.pass}/${item.stream_id}.ts`;
    } else {
        streamUrl = `${serverConfig.url}/movie/${serverConfig.user}/${serverConfig.pass}/${item.stream_id || item.movie_id}.${item.container_extension}`;
    }

    try {
        webapis.avplay.open(streamUrl);
        webapis.avplay.setDisplayRect(0, 0, 1920, 1080);
        
        webapis.avplay.prepareAsync(() => {
            webapis.avplay.play();
            
            if (currentType === "live") {
                focusArea = "player"; 
                document.getElementById('player-controls').style.display = "none";
                
                if (infoBox) {
                    // Update the overlay text with cleanName
                    document.getElementById('live-channel-name').innerText = cleanName;
                    infoBox.style.display = "block";
                 
                }
            } else {
                showControls(); 
            }
        }, (err) => {
            logDebug("Playback Error: " + err.name);
            stopVideo();
        });
    } catch (e) { 
        logDebug("AVPlay Catch: " + e.message);
        stopVideo(); 
    }
}


function hideControls() {
    // Only attempt to hide/shift focus if we are actually in the player area
    if (focusArea === "player") {
        document.getElementById('player-controls').style.display = "none";
        focusArea = "channels"; 
    }
}


function stopVideo() {
    logDebug("Stopping playback and releasing hardware...");
    
    try { 
        // 1. Explicitly stop and close the Tizen AVPlay hardware
        webapis.avplay.stop(); 
        webapis.avplay.close(); 
    } catch(e) {
        logDebug("AVPlay Stop/Close Error: " + e.message);
    }
    
    // 2. Reset Player State variables
    isPaused = false;
    if(document.getElementById('btn-play-pause')) {
        document.getElementById('btn-play-pause').innerText = "⏸";
    }

    // 3. Hide all player-related UI overlays
    document.getElementById('live-channel-info').style.display = "none";
    document.getElementById('live-channel-list').style.display = "none";
    document.getElementById('player-controls').style.display = "none";
    
    // 4. Restore the main application grid
    document.getElementById('app').style.display = "flex";
    
    // 5. Re-enable navigation in the channel/movie grid
    focusArea = "channels";
    updateFocus();
}

function exitAppSection() {
    document.getElementById('app').style.display = "none";
    document.getElementById('dashboard').style.display = "flex";
    focusArea = "dashboard";
}

function loadFromFs() {
    try {
        tizen.filesystem.resolve("documents", function(dir) {
            try {
                var file = dir.resolve(FILE_NAME);
                file.openStream("r", function(stream) {
                    var data = stream.read(file.fileSize);
                    stream.close();
                    if (data) {
                        var parsed = JSON.parse(data);
                        serverConfig = parsed.server || parsed;
                        if (parsed.hidden) hiddenCategories = parsed.hidden;
                        attemptLogin(true); 
                    } else { showLogin(); }
                }, showLogin, "UTF-8");
            } catch(e) { showLogin(); }
        }, showLogin, "r");
    } catch (e) { showLogin(); }
}

function saveToFs(config) {
    try {
        tizen.filesystem.resolve("documents", function(dir) {
            var file;
            try { file = dir.createFile(FILE_NAME); } catch(e) { file = dir.resolve(FILE_NAME); }
            file.openStream("w", function(stream) {
                const saveData = { server: config, hidden: hiddenCategories };
                stream.write(JSON.stringify(saveData));
                stream.close();
            }, null, "UTF-8");
        }, null, "rw");
    } catch (e) {}
}

//Replace your attemptLogin function in main.js
async function attemptLogin(isAuto) {
    const cleanUrl = serverConfig.url.replace(/\/+$/, "");
    const path = `${cleanUrl}/player_api.php?username=${serverConfig.user}&password=${serverConfig.pass}`;
    try {
        const res = await fetch(path);
        if (!res.ok) throw new Error("Server unreachable");
        
        const data = await res.json();
        
        if (data.user_info && data.user_info.auth === 1) {
            saveToFs(serverConfig);
            
            document.getElementById('login-screen').style.display = "none";
            document.getElementById('dashboard').style.display = "flex";
            focusArea = "dashboard";
            dashIndex = 0;
            updateFocus();
            
            // Populate the Bottom Info Bar
            const info = data.user_info;
            document.getElementById('info-username').innerText = info.username || "Guest";
            document.getElementById('info-status').innerText = (info.status || "Active").toUpperCase();
            
            // Expiry Date Formatting
            if (info.exp_date && info.exp_date !== "null" && info.exp_date !== "0") {
                const date = new Date(parseInt(info.exp_date) * 1000);
                document.getElementById('info-expiry').innerText = date.toLocaleDateString();
            } else {
                document.getElementById('info-expiry').innerText = "Unlimited";
            }
            
            // Connection Count
            const active = info.active_cons || "0";
            const max = info.max_connections || "1";
            document.getElementById('info-connections').innerText = `${active} / ${max}`;

            document.getElementById('login-screen').style.display = "none";
            document.getElementById('dashboard').style.display = "flex";
            focusArea = "dashboard";
        } else {
        		showLoginError("Invalid Username or Password");
            //showLogin();
        }
    } catch (e) { 
        logDebug("Error From AttempLogin: " + e.message);
        showLoginError("Connection Error: Check URL and Credentials");
        showLogin();
    }
}

function showLoginError(msg) {
    const errorEl = document.getElementById('login-error');
    if (errorEl) {
        errorEl.innerText = msg;
        errorEl.style.display = "block";
    }
    logDebug("Login Error: " + msg);
}

function showLogin() {
    focusArea = "login"; 
    loginIndex = 0;
    
    // Ensure all other major screens are hidden to prevent overlap
    document.getElementById('dashboard').style.display = "none";
    document.getElementById('settings-screen').style.display = "none";
    document.getElementById('app').style.display = "none";
    
    document.getElementById('info-username').innerText = "-";
    
    const loginScreen = document.getElementById('login-screen');
    loginScreen.style.display = "flex";

    // Re-populate existing values from the serverConfig object
    if (serverConfig) {
        document.getElementById('input-url').value = serverConfig.url || "";
        document.getElementById('input-user').value = serverConfig.user || "";
        document.getElementById('input-pass').value = serverConfig.pass || "";
    }
    
    updateFocus();
}

function openSettings() {
    focusArea = "settings"; 
    manageState = "main"; 
    setIndex = 0;
    document.getElementById('dashboard').style.display = "none";
    document.getElementById('app').style.display = "none"; // Safety check
    
    // Ensure the settings screen exists in index.html before calling
    const setScreen = document.getElementById('settings-screen');
    if (setScreen) setScreen.style.display = "flex";
}

function handleSettingsNav(key) {
    if (manageState === "main") {
        if (key === 38 && setIndex > 0) setIndex--;
        else if (key === 40 && setIndex < setFields.length - 1) setIndex++;
        else if (key === 13) {
            if (setFields[setIndex] === "set-back") closeSettings();
            else if (setFields[setIndex] === "set-creds") showLogin();
        }
        else if (key === 10009) closeSettings();
    }
}

function closeSettings() {
    focusArea = "dashboard";
    document.getElementById('settings-screen').style.display = "none";
    document.getElementById('dashboard').style.display = "flex";
}

function showMiniChannelList() {
    const container = document.getElementById('mini-channel-container');
    container.innerHTML = "";
    
    currentFilteredData.forEach((ch, i) => {
        let rawName = ch.name || ch.title || "";
        let cleanName = rawName.includes('|') ? rawName.split('|').pop().trim() : rawName;
        
        let div = document.createElement('div');
        div.className = "mini-item";
        div.id = `mini-ch-${i}`;
        div.innerText = cleanName;
        container.appendChild(div);
    });

    document.getElementById('live-channel-list').style.display = "flex";
    focusArea = "mini-channels";
    updateFocus();
}

function hideMiniChannelList() {
    document.getElementById('live-channel-list').style.display = "none";
    focusArea = "player";
}

function handleSettingsSelect() {
    let id = setFields[setIndex];
    if (id === "set-back") {
        closeSettings();
    } else if (id === "set-creds") {
        document.getElementById('settings-screen').style.display = "none";
        showLogin();
    } else if (id === "set-manage-cats") {
        // Switch to category management
        document.getElementById('settings-main-menu').style.display = "none";
        document.getElementById('settings-category-menu').style.display = "flex";
        manageState = "sections";
        setIndex = 0;
        renderManageSections();
    }
}

/* Add these functions to main.js */

function loadToggleList(type) {
    if (type === "back") {
        // Go back to settings main menu
        document.getElementById('settings-main-menu').style.display = "block";
        document.getElementById('settings-category-menu').style.display = "none";
        manageState = "main";
        setIndex = 1;
        updateFocus();
        return;
    }

    currentType = type; // Keep track of which section we are toggling
    let action = (type === "live") ? "get_live_categories" : (type === "movie") ? "get_vod_categories" : "get_series_categories";
    
    fetch(`${serverConfig.url}/player_api.php?username=${serverConfig.user}&password=${serverConfig.pass}&action=${action}`)
        .then(r => r.json())
        .then(data => {
            // Add a "Toggle All" option at the top
            categoryToggleData = [{ category_id: "TOGGLE_ALL", category_name: "--- TOGGLE ALL ---" }, ...data];
            manageState = "toggling";
            setIndex = 0;
            renderToggleList();
        })
        .catch(e => logDebug("Error loading toggle list"));
}

function renderToggleList() {
    const list = document.getElementById('category-toggle-list');
    list.innerHTML = "";
    document.getElementById('manage-title').innerText = "Manage " + currentType.toUpperCase();

    categoryToggleData.forEach((cat, i) => {
        let isHidden = hiddenCategories[currentType].includes(cat.category_id);
        let div = document.createElement('div');
        div.className = "item";
        div.id = "toggle-cat-" + i;
        
        if (cat.category_id === "TOGGLE_ALL") {
            div.innerText = cat.category_name;
        } else {
            // Create color-coded status strings
            let statusLabel = isHidden ? 
                '<span style="color: #ff4444;"> [HIDDEN]</span>' : 
                '<span style="color: #00c851;"> [VISIBLE]</span>';
            
            div.innerHTML = cat.category_name + statusLabel;
        }
        
        // Dim the overall text slightly if hidden, otherwise keep it white
        div.style.color = isHidden ? "#888" : "#fff";

        list.appendChild(div);
    });
    updateFocus();
}

function renderManageSections() {
    const list = document.getElementById('category-toggle-list');
    list.innerHTML = "";
    document.getElementById('manage-title').innerText = "Select Section";

    manageSections.forEach((sec, i) => {
        let div = document.createElement('div');
        div.className = "item";
        div.id = "manage-sec-" + i;
        	if (sec === 'back')
            div.innerText = sec;
        	else
            div.innerText = "Manage " + sec.toUpperCase();
        list.appendChild(div);
    });
    updateFocus();
}


/**
 * Closes the login/credential screen and returns to the dashboard
 */
/**
 * Handles the Cancel button on the login screen
 */
function closeCredScreen() {
    // Check if we have saved credentials in the config
    const hasCreds = serverConfig && serverConfig.url && serverConfig.user && serverConfig.pass;

    if (hasCreds) {
        // If credentials exist, allow closing the screen and returning to dashboard
        document.getElementById('login-screen').style.display = "none";
        document.getElementById('dashboard').style.display = "flex";
        focusArea = "dashboard";
        updateFocus();
    } else {
        // First-time run or no creds: Display a mandatory entry message
        const msgEl = document.getElementById('login-welcome-msg');
        if (msgEl) {
            msgEl.innerText = "Credentials are required to continue to the application.";
            msgEl.style.color = "#ff4444"; // Change to red to indicate importance
        }
        logDebug("Login required for first-time use");
    }
}



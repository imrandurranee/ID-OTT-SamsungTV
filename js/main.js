let savedAccounts = []; // Array of { url, user, pass, active: boolean }

let playerControlIndex = 0;
const playerFields = ["btn-play-pause", "btn-stop"];
let isPaused = false;
let controlTimeout;

let loginOrigin = "startup";

let seekTimer; // Interval for updating the seekbar
let currentFetchController = null; // To track and cancel pending requests


let playbackHistory = {}; // Stores { stream_id: timestamp_in_ms }
let pendingResumeItem = null;
let resumeIndex = 0; // 0 for Resume, 1 for Start Over
const resumeFields = ["btn-resume-yes", "btn-resume-no"];
const HISTORY_FILE = "history.json";

let hiddenCategories = { live: [], movie: [], series: [] };
let categoryToggleData = [];
let manageState = "main";
const manageSections = ["live", "movie", "series", "back"];

let focusArea = "login"; 
const loginFields = ["input-url", "input-user", "input-pass", "btn-login", "btn-cancel"];
let loginIndex = 0;
let dashIndex = 0;

const dashFields = ["dash-live", "dash-movies", "dash-series", "dash-reload", "dash-settings", "dash-exit"];
const setFields = ["set-creds", "set-manage-accounts", "set-manage-cats", "set-back"];

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
        const keys = [//"Return", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter",
		        'Info',
		        'MediaPause', 'MediaPlay',
		        'MediaPlayPause', 'MediaStop',
		        'MediaFastForward', 'MediaRewind',
		        '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
		        'ColorF1Green', 'ColorF0Red',
		        'ChannelDown', 'ChannelUp','Guide' 
		 ]
        
     // Register keys
        keys.forEach(function(key) {
            if (tizen && tizen.tvinputdevice && tizen.tvinputdevice.registerKey) {
                try {
                    tizen.tvinputdevice.registerKey(key);
                } catch (error) {
                	logDebug("Failed to register key " + key + ": " + error.message);
                }
            }
        }); 
        
    } catch (e) { console.error("Key Reg Error"); }
    document.addEventListener('keydown', handleKey);

    loadFromFs();
};



function updateFocus() {
    // 1. Sidebar Category List (Main App)
//    const listItems = document.querySelectorAll('#category-list .item');
//    listItems.forEach((item, i) => {
//    	const isFocused = (focusArea === 'categories' && i === focusIndex);
//    	const isActive = (i === focusIndex);
//    	
//        item.classList.toggle('focused', isFocused);
//        item.classList.toggle('active-category', isActive); // New class for persistent highlight
//        
//        if (isFocused) {
//            item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
//        }
//    });
    document.querySelectorAll('.focused').forEach(el => el.classList.remove('focused'));
    document.querySelectorAll('.item.category-active').forEach(el => el.classList.remove('category-active'));

    let el;
    if (focusArea === "categories") {
        el = document.getElementById(`cat-${focusIndex}`);
        
        // Highlight the category that is CURRENTLY DISPLAYED in the grid
        const activeCat = document.getElementById(`cat-${lastCategoryIndex}`);
        if (activeCat) {
            activeCat.classList.add('category-active');
        }
    }
    else if (focusArea === "channels") {
        el = document.getElementById(`ch-${channelFocusIndex}`);
        
        // When in the grid, the selected category must stay highlighted
        const activeCat = document.getElementById(`cat-${lastCategoryIndex}`);
        if (activeCat) {
            activeCat.classList.add('category-active');
        }
    }
    if (el) {
        el.classList.add('focused');
        el.scrollIntoView({ block: "center", behavior: "smooth" });
    }
    
    // 2. Channel/Movie/Series Grid (Main App)
    const gridItems = document.querySelectorAll('.channel-card');
    gridItems.forEach((item, i) => {
        const isFocused = focusArea === 'channels' && i === channelFocusIndex;
        item.classList.toggle('focused', isFocused);
        if (isFocused) {
            item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    });

    // 3. Dashboard Navigation
    if (focusArea === "dashboard") {
        dashFields.forEach((id, i) => {
            const el = document.getElementById(id);
            if (el) el.classList.toggle("focused", i === dashIndex);
        });
    }

    // 4. Settings Screens (Accounts, Categories, Sections)
    if (focusArea === "settings") {
        if (manageState === "main") {
            setFields.forEach((id, i) => {
                const el = document.getElementById(id);
                if (el) el.classList.toggle("focused", i === setIndex);
            });
        } 
        else if (manageState === "sections" || manageState === "accounts" || manageState === "toggling") {
            // All these states use the generic #category-toggle-list
            const items = document.querySelectorAll('#category-toggle-list .item');
            items.forEach((item, i) => {
                const isFocused = (i === setIndex);
                item.classList.toggle("focused", isFocused);
                if (isFocused) {
                    item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                }
            });
        }
    }

    // 5. Login Screen
    if (focusArea === "login") {
        loginFields.forEach((id, i) => {
            const el = document.getElementById(id);
            if (el) el.classList.toggle("focused", i === loginIndex);
        });
    }

    // 6. Video Player Controls (Overlay)
    if (focusArea === "player") {
        playerFields.forEach((id, i) => {
            const el = document.getElementById(id);
            if (el) el.classList.toggle("focused", i === playerControlIndex);
        });
    }

    // 7. Resume Playback Popup
    if (focusArea === "resume-popup") {
        resumeFields.forEach((id, i) => {
            const el = document.getElementById(id);
            if (el) el.classList.toggle("focused", i === resumeIndex);
        });
    }

    // 8. Mini Channel List (Right-side list during video playback)
    if (focusArea === "mini-channels") {
        const miniItems = document.querySelectorAll('#mini-channel-container .item');
        miniItems.forEach((item, i) => {
            const isFocused = i === channelFocusIndex;
            item.classList.toggle('focused', isFocused);
            if (isFocused) {
                item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
        });
    }
}



function handleKey(e) {
    const key = e.keyCode;
    let fieldid = loginFields[loginIndex];
    logDebug("DEBUG: focusArea: " + focusArea + "  Key: " + key + "  manageState: " + manageState + "  Field: " + fieldid);
    
    // 1. Toggle Debug Log with key '6' (Key Code 54)
    if (key === 54) { 
        const logEl = document.getElementById('debug-log');
        if (logEl) {
            if (logEl.style.display === 'none') {
                logEl.style.display = 'block';
                logDebug("Debug Log: VISIBLE");
            } else {
                logEl.style.display = 'none';
            }
        }
        return; 
    }

    // 2. Global: Back/Return Key Handling for Video Player
    // This MUST be checked before other conditions to stop background playback
    if (key === 10009 && focusArea === "player") {
        e.preventDefault(); // Stop Tizen from exiting the app or navigating back
        logDebug("Back pressed: Killing hardware player instance.");
        stopVideo(); 
        if (currentType !== "live") hideControls(); 
        return;
    }
    
    // Prevent default scrolling for arrow keys
    if ([38, 40, 37, 39].includes(key)) e.preventDefault();
    
    // Global: Exit Input handling for virtual keyboard
    if (document.activeElement.tagName === "INPUT" && (key === 13 || key === 10009)) {
        document.activeElement.blur(); 
        return;
    }

    if (focusArea === "login") {
        if (key === 38 && loginIndex > 0) {
            if (document.activeElement.tagName === "INPUT") document.activeElement.blur();
            loginIndex--;
        }
        else if (key === 40 && loginIndex < loginFields.length - 1) {
            if (document.activeElement.tagName === "INPUT") document.activeElement.blur();
            loginIndex++;
        }
        if (key === 39 && loginFields[loginIndex] === "input-pass") {
            togglePasswordVisibility();
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
            }else if (id === "input-pass") {
                // Existing logic to focus the input for typing
                let el = document.getElementById(id);
                el.readOnly = false; 
                el.focus(); 
                el.onblur = () => { el.readOnly = true; window.focus(); };
            } 
            else if (id === "btn-cancel") {
                if (loginOrigin === "switch") {
                    // Return to Switch Account List
                    document.getElementById('login-screen').style.display = "none";
                    document.getElementById('settings-screen').style.display = "flex";
                    focusArea = "settings";
                    manageState = "accounts";
                    renderAccountList(); // Ensure the list is repopulated
                } else {
                    // Default behavior (e.g., exit app if no accounts exist)
                    //tizen.application.getCurrentApplication().exit();
                    closeCredScreen(); 
                }
            }
            else {
                let el = document.getElementById(id);
                el.readOnly = false; 
                el.focus(); 
                el.onblur = () => { el.readOnly = true; window.focus(); };
            }
        }
    } 
 // Inside handleKey(e) function
 // Locate this block in your main.js (around line 123)
    else if (focusArea === "dashboard") {
        // 39: Right
        if (key === 39) { 
            if (dashIndex < 2) {
                dashIndex++; // Move between Live, Movies, Series
            } else if (dashIndex >= 3 && dashIndex < 5) {
                dashIndex++; // Move between Reload, Settings, Exit
            }
        } 
        // 37: Left
        else if (key === 37) { 
            if (dashIndex > 0 && dashIndex <= 2) {
                dashIndex--; // Move between Series, Movies, Live
            } else if (dashIndex > 3) {
                dashIndex--; // Move between Exit, Settings, Reload
            } else if (dashIndex === 3) {
                dashIndex = 0; // Jump from Reload back to the first card
            }
        } 
        // 40: Down
        else if (key === 40) { 
            if (dashIndex < 3) {
                dashIndex = 3; // Go down to Reload from any top card
            } else if (dashIndex < 5) {
                dashIndex++; // Step through utility buttons
            }
        } 
        // 38: Up
        else if (key === 38) { 
            if (dashIndex >= 3) {
                dashIndex = 0; // Go back up to the top row
            }
        } 
        else if (key === 13) { // Enter
            let id = dashFields[dashIndex];
            if (id === "dash-live") startSection("live");
            else if (id === "dash-movies") startSection("movie");
            else if (id === "dash-series") startSection("series");
            else if (id === "dash-reload") location.reload(); // REFRESH ACTION
            else if (id === "dash-settings") openSettings();
            else if (id === "dash-exit") tizen.application.getCurrentApplication().exit();
        }
        updateFocus();
    }
    else if (focusArea === "search") {
        if (key === 40) { 
            document.getElementById('search-input').blur();
            focusArea = "categories";
            focusIndex = 0;
        } else if (key === 13) { 
            let input = document.getElementById('search-input');
            input.readOnly = false;
            input.focus();
            input.oninput = (el) => { renderChannels(el.target.value); };
            input.onblur = () => { input.readOnly = true; window.focus(); };
        } else if (key === 10009) {
            exitAppSection();
        }
    }
    else if (focusArea === "settings") {
    		logDebug("inside settings");
        if (manageState === "main") {
        		logDebug("inside main, set Index = " + setIndex);
            if (key === 38 && setIndex > 0) setIndex--;
            else if (key === 40 && setIndex < setFields.length - 1) setIndex++;
            else if (key === 13) handleSettingsSelect();
            else if (key === 10009) closeSettings();
        } 
        else if (manageState === "sections") {
            // Navigation for selecting which section to manage (Live, Movies, or Series)
            if (key === 38 && setIndex > 0) { // Up
                setIndex--;
                updateFocus();
            } 
            else if (key === 40 && setIndex < manageSections.length - 1) { // Down
                setIndex++;
                updateFocus();
            } 
            else if (key === 13) { // Enter
                let selection = manageSections[setIndex];
                if (selection === "back") {
                    // Go back to main settings menu
                    manageState = "main";
                    setIndex = 2; // Return to 'Manage Categories' button
                    document.getElementById('settings-main-menu').style.display = "block";
                    document.getElementById('settings-category-menu').style.display = "none";
                } else {
                    // Enter the specific category list for Live, Movie, or Series
                    //manageState = "categories";
                    currentManageType = selection; // Store which one we are editing
                    //setIndex = 0;
                    renderManageCategories(); // This should be your function that lists categories with checkboxes
                }
            }
            else if (key === 10009) { // Back button
                manageState = "main";
                setIndex = 2;
                document.getElementById('settings-main-menu').style.display = "block";
                document.getElementById('settings-category-menu').style.display = "none";
            }
            updateFocus();
        }
        else if (manageState === "accounts") {
            // Navigation for Account List
            if (key === 38 && setIndex > 0) setIndex--; // Up
            else if (key === 40 && setIndex < savedAccounts.length) setIndex++; // Down (+1 for "Add New")
            else if (key === 13) { // Enter Key
                if (setIndex === savedAccounts.length) {
                    // User clicked "+ Add New Account"
                    serverConfig = { url: "", user: "", pass: "" };
                    showLogin("switch"); // Pass "switch" as the origin
                } else {
                    // Switch to existing account logic...
                    let selected = savedAccounts[setIndex];
                    serverConfig = { url: selected.url, user: selected.user, pass: selected.pass };
                    attemptLogin(true);
                }
            }
            else if (key === 10009) { // Back key
                manageState = "main";
                setIndex = 1; // Return to "Switch Account" button
                document.getElementById('settings-main-menu').style.display = "block";
                document.getElementById('settings-category-menu').style.display = "none";
            }
            renderAccountList();
        }
        else if (manageState === "toggling") {
            // 38: Up - Change index and update visual highlight
            if (key === 38 && setIndex > 0) {
                setIndex--;
                updateFocus(); // Move the orange bar
            } 
            // 40: Down - Change index and update visual highlight
            else if (key === 40 && setIndex < categoryToggleData.length - 1) {
                setIndex++;
                updateFocus(); // Move the orange bar
            } 
            // 13: Enter - Perform the Toggle
            else if (key === 13) {
                let selected = categoryToggleData[setIndex];
                // currentManageType stores if we are in live, movie, or series
                let list = hiddenCategories[currentManageType]; 
                
                if (selected.category_id === "TOGGLE_ALL") {
                    // Bulk toggle logic
                    let allIds = categoryToggleData
                        .filter(c => c.category_id !== "TOGGLE_ALL")
                        .map(c => c.category_id);
                    
                    if (list.length >= allIds.length) {
                        hiddenCategories[currentManageType] = []; // Show all
                    } else {
                        hiddenCategories[currentManageType] = allIds; // Hide all
                    }
                } else {
                    // Single item toggle logic
                    let catId = selected.category_id;
                    let idx = list.indexOf(catId);
                    if (idx === -1) {
                        list.push(catId); // Hide it
                    } else {
                        list.splice(idx, 1); // Show it
                    }
                }
                
                saveToFs();        // Save the change to the file
                renderToggleList(); // Redraw the list to update [VISIBLE/HIDDEN] labels
                updateFocus();      // Keep the focus on the current item
            }
            // 10009: Back
            else if (key === 10009) {
                manageState = "sections";
                setIndex = 0;
                renderManageSections();
            }
        }
    }
    else if (focusArea === "player") {
        // Player specific navigation (excluding back button which is handled globally above)
        if (currentType === "live") {
            if (key === 37) changeLiveChannel(-1);
            else if (key === 39) changeLiveChannel(1);
            else if (key === 38 || key === 40) showMiniChannelList();
        } else {
        		showControls();
            // Movie/Series seeking logic
            if (currentType === "series_episode") {
            		if (key === 38 || key === 40) showMiniChannelList(); // Up/Down: Show List
            }
            // Standard Controls (Play/Pause/Stop)

            if (key === 37) seekManual(-10000); // Left: Rewind 10s
            else if (key === 39) seekManual(10000); // Right: Forward 10s
            else if (key === 427) seekManual(60000); // Channel Up: Forward 1m
            else if (key === 428) seekManual(-60000); // Channel Down: Rewind 1m
            else if (key === 13) {
                if (playerFields[playerControlIndex] === "btn-play-pause") {
                    togglePlayPause();
                } else {
                    stopVideo();
                }
            }
        }
    }
    else if (focusArea === "resume-popup") {
        if (key === 37) resumeIndex = 0; // Left
        else if (key === 39) resumeIndex = 1; // Right
        else if (key === 13) {
            document.getElementById('resume-modal').style.display = "none";
            if (resumeIndex === 0) {
                logDebug("Resuming the video");
                playContent(pendingResumeItem, true); // Logic to resume
            } else {
                logDebug("Starting from begining");
                const uniqueId = pendingResumeItem.id || pendingResumeItem.stream_id || pendingResumeItem.movie_id;
                delete playbackHistory[uniqueId]; // Clear history if starting over
                saveToFs(serverConfig);
                playContent(pendingResumeItem, false); // Start over
            }
        }
        updateFocus();
        return;
    }
    else if (focusArea === "mini-channels") {
        if (key === 38 && channelFocusIndex > 0) { channelFocusIndex--; updateFocus();}
        else if (key === 40 && channelFocusIndex < currentFilteredData.length - 1) { channelFocusIndex++; ; updateFocus();}
        else if (key === 13) {
        		stopVideo();
            hideMiniChannelList();
            playContent(currentFilteredData[channelFocusIndex]);
        }
        else if (key === 10009 || key === 37) { hideMiniChannelList(); 
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
    const logEl = document.getElementById('debug-log');
    if (logEl) {
        const now = new Date();
        const time = now.getHours() + ":" + now.getMinutes() + ":" + now.getSeconds();
        logEl.innerHTML += `<div>[${time}] ${msg}</div>`;
        
        // Auto-scroll so the latest message at the bottom is always visible
        logEl.scrollTop = logEl.scrollHeight;
        
        // Keep the log from getting too long (removes oldest if over 50 lines)
        if (logEl.children.length > 50) {
            logEl.removeChild(logEl.firstChild);
        }
    }
    console.log(msg);
}

function handleAppNav(key) {
    if (key === 10009) { 
    		document.getElementById('loading-spinner').style.display = "none";
    	
        if (currentType === "series_episode") {
            renderSeasons();
            return;
        } else if (currentType === "series_season") {
            currentType = "series";
            loadChannels();
            return;
        }
        exitAppSection(); 
        return; 
    }

    if (focusArea === "categories") {
        // ... (Keep existing category nav logic)
        if (key === 38) { if (focusIndex === 0) focusArea = "search"; else focusIndex--; }
        else if (key === 40 && focusIndex < categoriesData.length - 1) focusIndex++;
        else if (key === 39 && currentFilteredData.length > 0) { 
            focusArea = "channels"; channelFocusIndex = 0; 
        }
        else if (key === 13) { channelsData = []; loadChannels(); }
    } 
    else if (focusArea === "channels") {
        // ... (Keep existing grid nav logic for Up/Down/Left/Right)
        if (key === 38) { if (channelFocusIndex >= 4) channelFocusIndex -= 4; else focusArea = "search"; }
        else if (key === 40) { if (channelFocusIndex + 4 < currentFilteredData.length) channelFocusIndex += 4; }
        else if (key === 37) { if (channelFocusIndex % 4 === 0) { focusArea = "categories"; focusIndex = lastCategoryIndex; } else channelFocusIndex--; }
        else if (key === 39 && channelFocusIndex < currentFilteredData.length - 1) channelFocusIndex++;
        
        // ENTER KEY LOGIC
        else if (key === 13) {
            const selectedItem = currentFilteredData[channelFocusIndex];
            if (currentType === "series") {
                loadSeriesDetails(selectedItem.series_id);
            } else if (currentType === "series_season") {
                renderEpisodes(selectedItem.season_number);
            } else {
                playContent(selectedItem);
            }
        }
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
    // 1. If there's an existing fetch in progress, cancel it
	lastCategoryIndex = focusIndex;
	
	// Check if we already have the data in memory for the current series/category
    if (channelsData && channelsData.length > 0) {
        logDebug("Loading from memory, skipping fetch...");
        renderChannels(document.getElementById('search-input').value);
        return; 
    }
    
    if (currentFetchController) {
        currentFetchController.abort();
    }

    // 2. Create a new controller for this specific request
    currentFetchController = new AbortController();
    const signal = currentFetchController.signal;

    const grid = document.getElementById('channel-grid');
    grid.innerHTML = "";
    document.getElementById('loading-spinner').style.display = "flex";

    let catId = categoriesData[focusIndex].category_id;
    let action = (currentType === "live") ? "get_live_streams" : (currentType === "movie") ? "get_vod_streams" : "get_series";
    
    // 3. Pass the signal to the fetch call
    fetch(`${serverConfig.url}/player_api.php?username=${serverConfig.user}&password=${serverConfig.pass}&action=${action}&category_id=${catId}`, { signal })
        .then(r => r.json())
        .then(data => { 
            document.getElementById('loading-spinner').style.display = "none";
            currentFetchController = null; // Clear the controller on success
            channelsData = data; 
            renderChannels(document.getElementById('search-input').value); 
        })
        .catch(e => {
            if (e.name === 'AbortError') {
                logDebug("Fetch aborted: User switched categories or exited.");
            } else {
                document.getElementById('loading-spinner').style.display = "none";
                currentFetchController = null;
                logDebug("Load Error: " + e.message);
            }
        });
}




function renderChannels(filterText = "") {
    const grid = document.getElementById('channel-grid');
    grid.innerHTML = "";

    // 1. Filter data based on search input
    let displayData = channelsData;
    if (filterText) {
        displayData = channelsData.filter(ch => {
            const name = (ch.name || ch.title || "").toLowerCase();
            return name.includes(filterText.toLowerCase());
        });
    }

    // 2. Updated Sorting Logic: Date Added for VOD, Alphabetical for Live
    displayData.sort((a, b) => {
        if (currentType === "movie" || currentType === "series") {
            // Sort by 'added' timestamp (Newest first)
            let dateA = parseInt(a.added) || 0;
            let dateB = parseInt(b.added) || 0;
            return dateB - dateA; // Descending order
        } else {
            // Alphabetical Sort for Live TV
            var nameA = (a.name || a.title || "").toLowerCase();
            var nameB = (b.name || b.title || "").toLowerCase();
            return nameA < nameB ? -1 : nameA > nameB ? 1 : 0;
        }
    });

    // 3. Render the items
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

//Add forceStartOver as a second parameter with a default value of false
function playContent(item, forceStartOver = false) {
    if (!item) return;

 // If it's a Series, we need to drill down into Seasons/Episodes first
    if (currentType === "series") {
        loadSeriesDetails(item.series_id || item.stream_id);
        return;
    }
    
    const streamId = item.id || item.stream_id || item.movie_id;
    if (!forceStartOver && currentType !== "live" && playbackHistory[streamId]) {
        pendingResumeItem = item;
        
        // 1. Set the correct focusArea name that matches your updateFocus()
        focusArea = "resume-popup"; 
        resumeIndex = 0; 
        
        // 2. Clear any active mini-lists that might be visible
        document.getElementById('live-channel-list').style.display = "none";
        
        showResumeModal(playbackHistory[streamId]);
        
        // 3. Force the UI to update immediately
        updateFocus(); 
        return; // <--- CRITICAL: Stop execution here so we don't reach "focusArea = player" below
    }

    pendingResumeItem = item; 
    
    // UI management
    document.getElementById('loading-spinner').style.display = "flex";
    document.getElementById('dashboard').style.display = "none";
    document.getElementById('app').style.display = "none";
    
    focusArea = "player";

    let rawName = item.name || item.title || "";
    let cleanName = rawName.includes('|') ? rawName.split('|').pop().trim() : rawName;

    let fullDisplayTitle = cleanName;
    if (currentType === "series_episode" && currentSeriesName) {
        // Displays as "Show Name - Episode Title"
        fullDisplayTitle = currentSeriesName + " - " + fullDisplayTitle;
    }
    
    // Update the player UI elements
    document.getElementById('playing-now-title').innerText = fullDisplayTitle;
    document.getElementById('live-channel-name').innerText = fullDisplayTitle;
    
    // Reset player instance
    try {
        if (webapis.avplay.getState() !== "NONE") {
            webapis.avplay.stop();
            webapis.avplay.close();
        }
    } catch (e) {}

 // Inside playContent(item, forceStartOver)
    let streamUrl;
    if (currentType === "live") {
        streamUrl = `${serverConfig.url}/live/${serverConfig.user}/${serverConfig.pass}/${item.stream_id}.ts`;
    } else if (currentType === "series_episode") {
        // Series episodes use item.id and item.container_extension
        streamUrl = `${serverConfig.url}/series/${serverConfig.user}/${serverConfig.pass}/${item.id}.${item.container_extension}`;
    } else {
        streamUrl = `${serverConfig.url}/movie/${serverConfig.user}/${serverConfig.pass}/${item.stream_id || item.movie_id}.${item.container_extension}`;
    }
    
    try {
        webapis.avplay.open(streamUrl);
        webapis.avplay.setDisplayRect(0, 0, 1920, 1080);
        
        webapis.avplay.setListener({
            onbufferingcomplete: function() {
                document.getElementById('loading-spinner').style.display = "none";
            },
            onstreamcompleted: function() { stopVideo(); },
            onerror: function(err) { 
                document.getElementById('loading-spinner').style.display = "none";
                stopVideo(); 
            }
        });

        webapis.avplay.prepareAsync(() => {
            webapis.avplay.play();
            
            // 2. Seek ONLY after play() has been called and only if we aren't starting over
            if (forceStartOver && currentType !== "live" && playbackHistory[streamId]) {
                logDebug("Resuming at: " + playbackHistory[streamId]);
                webapis.avplay.seekTo(playbackHistory[streamId]);
            }
            document.getElementById('live-channel-info').style.display = "block";

            if (currentType !== "live") {
                startSeekTimer();
                showControls(); 
            }
        }, (err) => { 
            document.getElementById('loading-spinner').style.display = "none";
            stopVideo(); 
        });

    } catch (e) { 
        document.getElementById('loading-spinner').style.display = "none";
        stopVideo(); 
    }
}

function showResumeModal(timestamp) {
    focusArea = "resume-popup";
    resumeIndex = 0;
    document.getElementById('resume-text').innerText = "You watched this up to " + formatTime(timestamp) + ". Resume?";
    document.getElementById('resume-modal').style.display = "flex";
    updateFocus();
}


function hideControls() {
    // Only attempt to hide/shift focus if we are actually in the player area
    if (focusArea === "player") {
        document.getElementById('player-controls').style.display = "none";
        //focusArea = "channels"; 
    }
}

function showControls() {
    const controls = document.getElementById('player-controls');
    if (controls) {
        controls.style.display = 'flex';
        
        // Reset the auto-hide timer
        clearTimeout(controlTimeout);
        
        // Only auto-hide if the video is actually playing (not paused)
        if (!isPaused) {
            controlTimeout = setTimeout(hideControls, 5000); // Hide after 5 seconds
        }
    }
}

function stopVideo() {
    logDebug("Executing Hard Stop...");
    clearInterval(seekTimer); // Stop seekbar updates
    document.getElementById('loading-spinner').style.display = "none";

    document.getElementById('current-time').innerText = formatTime(0);
    document.getElementById('total-time').innerText = formatTime(0);

    
 // --- RESUME LOGIC UPDATE ---
    if (currentType !== "live" && pendingResumeItem) {
        try {
            const lastTime = webapis.avplay.getCurrentTime();
            const duration = webapis.avplay.getDuration();
            
            // Fix: Use .id for episodes, or .stream_id/.movie_id for movies
            const uniqueId = pendingResumeItem.id || pendingResumeItem.stream_id || pendingResumeItem.movie_id;

            if (uniqueId) {
                // Only save if watched more than 10s and not at the very end (95%)
                if (lastTime > 10000 && lastTime < (duration * 0.95)) {
                    playbackHistory[uniqueId] = lastTime;
                    logDebug("Saved progress for ID: " + uniqueId);
                } else {
                    // Remove from history if finished or barely started
                    delete playbackHistory[uniqueId];
                    logDebug("Cleared history for ID: " + uniqueId);
                }
                saveToFs(serverConfig); // Save the unified file to persistent storage
            }
        } catch (e) {
            logDebug("History Save Error: " + e.message);
        }
    }
    // ----------------------------
    
    
    try {
        // Check state before stopping to prevent exceptions
        var currentState = webapis.avplay.getState();
        logDebug("Current Player State: " + currentState);
        
        if (currentState !== "NONE" && currentState !== "IDLE") {
            webapis.avplay.stop(); // Stops the stream
        }
        webapis.avplay.close(); // Releases the hardware decoder
    } catch (e) {
        logDebug("Stop Error: " + e.message);
    }

    // Reset UI
    isPaused = false;
    document.getElementById('player-controls').style.display = "none";
    document.getElementById('live-channel-info').style.display = "none";
    document.getElementById('live-channel-list').style.display = "none";
    
    // Return to the grid
    document.getElementById('app').style.display = "flex";
    focusArea = "channels";
    updateFocus();
}

function exitAppSection() {
    // Abort any active fetch so it doesn't pop up later
    if (currentFetchController) {
        currentFetchController.abort();
        currentFetchController = null;
    }

    document.getElementById('loading-spinner').style.display = "none";
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
                        
                        // Load Multi-Accounts
                        savedAccounts = parsed.accounts || [];
                        
                        // Find the active account or default to the first one
                        let activeAccount = savedAccounts.find(a => a.active) || savedAccounts[0];
                        
                        if (activeAccount) {
                            serverConfig = { url: activeAccount.url, user: activeAccount.user, pass: activeAccount.pass };
                            if (parsed.hidden) hiddenCategories = parsed.hidden;
                            if (parsed.history) playbackHistory = parsed.history;
                            attemptLogin(true); 
                        } else { 
                            showLogin(); 
                        }
                    } else { showLogin(); }
                }, showLogin, "UTF-8");
            } catch(e) { showLogin(); }
        }, showLogin, "r");
    } catch (e) { showLogin(); }
}

function saveToFs() {
    try {
        tizen.filesystem.resolve("documents", function(dir) {
            var file;
            try { file = dir.resolve(FILE_NAME); } catch(e) { file = dir.createFile(FILE_NAME); }
            file.openStream("w", function(stream) {
                const saveData = { 
                    accounts: savedAccounts, 
                    hidden: hiddenCategories,
                    history: playbackHistory 
                };
                stream.write(JSON.stringify(saveData));
                stream.close();
                logDebug("Accounts and data saved.");
            }, null, "UTF-8");
        }, null, "rw");
    } catch (e) { logDebug("Save Error: " + e.message); }
}


async function attemptLogin(isAuto) {
    // 1. If NOT an auto-login/switch, we must ensure we have values from inputs
    // If it IS an auto-login, serverConfig is already populated by loadFromFs or the account list.
    if (!isAuto) {
        serverConfig.url = document.getElementById('input-url').value.trim();
        serverConfig.user = document.getElementById('input-user').value.trim();
        serverConfig.pass = document.getElementById('input-pass').value.trim();
    }

    // 2. Critical Validation Check
    if (!serverConfig.url || !serverConfig.user || !serverConfig.pass) {
        showLoginError("All fields are required");
        return;
    }

    const cleanUrl = serverConfig.url.replace(/\/+$/, "");
    const path = `${cleanUrl}/player_api.php?username=${serverConfig.user}&password=${serverConfig.pass}`;
    
    // Show spinner for feedback
    document.getElementById('loading-spinner').style.display = "flex";

    try {
        const res = await fetch(path);
        const data = await res.json();
        
        if (data.user_info && data.user_info.auth === 1) {
            // Manage Multi-Account List
            savedAccounts.forEach(a => a.active = false);
            let existing = savedAccounts.find(a => a.user === serverConfig.user && a.url === serverConfig.url);
            
            if (existing) {
                existing.active = true;
                existing.pass = serverConfig.pass; // Update pass in case it changed
            } else {
                savedAccounts.push({ ...serverConfig, active: true });
            }

            saveToFs(); 
            
            // Hide all login/settings layers
            document.getElementById('login-screen').style.display = "none";
            document.getElementById('settings-screen').style.display = "none";
            document.getElementById('settings-category-menu').style.display = "none";
            document.getElementById('settings-main-menu').style.display = "block";
            
            // Return to Dashboard
            manageState = "main";
            document.getElementById('dashboard').style.display = "flex";
            focusArea = "dashboard";
            
            // Update the Dashboard info bar
            document.getElementById('info-username').innerText = data.user_info.username || "-";
            document.getElementById('info-status').innerText = data.user_info.status || "-";
          
            let expiry = "Unlimited";
            if (data.user_info.exp_date && data.user_info.exp_date !== "null") {
              let date = new Date(parseInt(data.user_info.exp_date) * 1000);
              expiry = date.toLocaleDateString();
            }
            document.getElementById('info-expiry').innerText = expiry;
            document.getElementById('info-connections').innerText = (data.user_info.active_cons || "0") + " / " + (data.user_info.max_connections || "0");
            
            updateFocus();
            document.getElementById('loading-spinner').style.display = "none";
        } else {
            document.getElementById('loading-spinner').style.display = "none";
            showLoginError("Invalid Credentials");
        }
    } catch (e) { 
        document.getElementById('loading-spinner').style.display = "none";
        
        if (!isAuto) {
            // 1. Reset the screen first
            showLogin(loginOrigin); 
            // 2. Then show the error so it doesn't get cleared
            showLoginError("Connection Error"); 
        } else {
            // If it's an auto-login/switch, just show the error on the current screen
            showLoginError("Connection Error");
        }
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

function showLogin(origin = "startup") {
	loginOrigin = origin;
    focusArea = "login"; 
    loginIndex = 0;
    
    const errorEl = document.getElementById('login-error');
    if (errorEl) {
        errorEl.innerText = "";
        errorEl.style.display = "none";
    }
    
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
        div.className = "item";
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
    logDebug("DEBUG: Field is: " + id);
    if (id === "set-creds") {
        showLogin(); // Goes back to login screen
    } 
    else if (id === "set-manage-accounts") {
        document.getElementById('settings-main-menu').style.display = "none";
        document.getElementById('settings-category-menu').style.display = "flex";
        manageState = "accounts"; // Set state to handle account list keys
        setIndex = 0;
        renderAccountList();
    } 
    else if (id === "set-manage-cats") {
        document.getElementById('settings-main-menu').style.display = "none";
        document.getElementById('settings-category-menu').style.display = "flex";
        manageState = "sections";
        setIndex = 0;
        renderManageSections();
    } 
    else if (id === "set-back") {
        document.getElementById('settings-screen').style.display = "none";
        document.getElementById('dashboard').style.display = "flex";
        focusArea = "dashboard";
        updateFocus();
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
    
    // Use currentManageType so the title says "Manage MOVIE" or "Manage SERIES"
    document.getElementById('manage-title').innerText = "Manage " + currentManageType.toUpperCase();

    categoryToggleData.forEach((cat, i) => {
        // Check the specific list for the section we are actually managing
        let isHidden = hiddenCategories[currentManageType].includes(cat.category_id);
        
        let div = document.createElement('div');
        div.className = "item";
        if (i === setIndex) div.classList.add("focused");
        
        div.id = "toggle-cat-" + i;
        
        if (cat.category_id === "TOGGLE_ALL") {
            div.innerText = cat.category_name;
        } else {
            let statusLabel = isHidden ? 
                '<span style="color: #ff4444;"> [HIDDEN]</span>' : 
                '<span style="color: #00c851;"> [VISIBLE]</span>';
            div.innerHTML = cat.category_name + statusLabel;
        }
        
        div.style.color = isHidden ? "#888" : "#fff";
        list.appendChild(div);
    });
    
    const focusedEl = list.querySelector('.focused');
    if (focusedEl) focusedEl.scrollIntoView({ block: 'nearest' });
}

function renderManageSections() {
    const list = document.getElementById('category-toggle-list');
    list.innerHTML = "";
    document.getElementById('manage-title').innerText = "Select Section";

    manageSections.forEach((sec, i) => {
        let div = document.createElement('div');
        div.className = "item";
        // USE THE STRING NAME FOR THE ID TO MATCH updateFocus()
        div.id = "manage-" + sec; 
        
        if (sec === 'back') {
            div.innerText = "Back";
        } else {
            div.innerText = "Manage " + sec.toUpperCase();
        }
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

function startSeekTimer() {
    clearInterval(seekTimer);
    seekTimer = setInterval(() => {
        try {
            const current = webapis.avplay.getCurrentTime();
            const total = webapis.avplay.getDuration();
            const percent = (current / total) * 100;

            document.getElementById('seekbar-fill').style.width = percent + "%";
            document.getElementById('current-time').innerText = formatTime(current);
            document.getElementById('total-time').innerText = formatTime(total);
        } catch (e) {}
    }, 1000);
}

function seekManual(ms) {
    try {
        const state = webapis.avplay.getState();
        if (state === "PLAYING" || state === "PAUSED") {
            
            if (ms > 0) {
                // Forward (ms is positive)
                webapis.avplay.jumpForward(ms);
                logDebug("Forwarding: " + (ms / 1000) + "s");
            } else {
                // Rewind (ms is negative, so we convert it to positive for jumpBackward)
                const rewindMs = Math.abs(ms);
                webapis.avplay.jumpBackward(rewindMs);
                logDebug("Rewinding: " + (rewindMs / 1000) + "s");
            }
            
            showControls(); // Bring up the seekbar
        }
    } catch (e) {
        logDebug("Seek Error: " + e.message);
    }
}

function formatTime(ms) {
    if (isNaN(ms) || ms < 0) return "00:00";
    let totalSeconds = Math.floor(ms / 1000);
    let hours = Math.floor(totalSeconds / 3600);
    let minutes = Math.floor((totalSeconds % 3600) / 60);
    let seconds = totalSeconds % 60;

    let result = "";
    if (hours > 0) result += (hours < 10 ? "0" + hours : hours) + ":";
    result += (minutes < 10 ? "0" + minutes : minutes) + ":";
    result += (seconds < 10 ? "0" + seconds : seconds);
    return result;
}

function togglePlayPause() {
    if (isPaused) {
        webapis.avplay.play();
        document.getElementById('btn-play-pause').innerText = "⏸";
        isPaused = false;
        // Start auto-hide timer again if desired
    } else {
        webapis.avplay.pause();
        document.getElementById('btn-play-pause').innerText = "▶️";
        isPaused = true;
    }
}


let seriesDetailData = null; // Store the fetched series details globally
let currentSeriesName = ""; // Global variable to store the Show Name

async function loadSeriesDetails(seriesId) {
    if (currentFetchController) currentFetchController.abort();
    currentFetchController = new AbortController();

    document.getElementById('loading-spinner').style.display = "flex";
    document.getElementById('channel-grid').innerHTML = "";

    try {
        const res = await fetch(`${serverConfig.url}/player_api.php?username=${serverConfig.user}&password=${serverConfig.pass}&action=get_series_info&series_id=${seriesId}`, { 
            signal: currentFetchController.signal 
        });
        seriesDetailData = await res.json();
        
        currentSeriesName = seriesDetailData.info.name || ""; 
        document.getElementById('loading-spinner').style.display = "none";
        currentFetchController = null;
        renderSeasons();
    } catch (e) {
        if (e.name !== 'AbortError') {
            document.getElementById('loading-spinner').style.display = "none";
            currentFetchController = null;
        }
    }
}


function renderSeasons() {
    const grid = document.getElementById('channel-grid');
    grid.innerHTML = "";
    currentType = "series_season"; // Update state for handleAppNav

    const seasons = seriesDetailData.seasons || [];
    
    seasons.forEach((season, i) => {
        let div = document.createElement('div');
        div.className = "channel-card";
        div.id = `ch-${i}`;
        div.innerHTML = `
            <div class="channel-poster"><div style="font-size:50px; margin-top:20px;">📂</div></div>
            <div class="channel-name">Season ${season.season_number}</div>
        `;
        grid.appendChild(div);
    });

    currentFilteredData = seasons; 
    channelFocusIndex = 0;
    updateFocus();
}

function renderEpisodes(seasonNumber) {
    const grid = document.getElementById('channel-grid');
    grid.innerHTML = "";
    currentType = "series_episode"; // Update state for handleAppNav

    // The API returns episodes grouped by season number in an object
    const episodes = seriesDetailData.episodes[seasonNumber] || [];
    
    episodes.forEach((ep, i) => {
        let div = document.createElement('div');
        div.className = "channel-card";
        div.id = `ch-${i}`;
        
        let imgUrl = ep.info && ep.info.movie_image ? ep.info.movie_image : "";
        let imgHtml = imgUrl ? `<img src="${imgUrl}" onerror="this.src='https://via.placeholder.com/150?text=EP'">` : `<div class="icon-placeholder">🎬</div>`;

        div.innerHTML = `
            <div class="channel-poster">${imgHtml}</div>
            <div class="channel-name">E${ep.episode_num}: ${ep.title}</div>
        `;
        grid.appendChild(div);
    });

    currentFilteredData = episodes;
    channelFocusIndex = 0;
    updateFocus();
}


function togglePasswordVisibility() {
    const passInput = document.getElementById('input-pass');
    const toggleText = document.getElementById('toggle-password-text');
    
    if (passInput.type === "password") {
        passInput.type = "text";
        toggleText.innerText = "HIDE";
        logDebug("Password visibility: SHOWN");
    } else {
        passInput.type = "password";
        toggleText.innerText = "SHOW";
        logDebug("Password visibility: HIDDEN");
    }
}



function renderAccountList() {
    const list = document.getElementById('category-toggle-list');
    list.innerHTML = "";
    document.getElementById('manage-title').innerText = "Switch Account";

    // Loop through saved accounts
    savedAccounts.forEach((acc, i) => {
        let div = document.createElement('div');
        div.className = "item";
        
        // Add 'focused' class if this index matches our current navigation position
        if (i === setIndex) {
            div.classList.add("focused");
        }
        
        div.id = "acc-item-" + i;
        
        let status = acc.active ? '<span style="color: #00c851;"> [ACTIVE]</span>' : '';
        // Display username and a shortened version of the URL
        let displayUrl = acc.url.replace(/^https?:\/\//, '');
        div.innerHTML = acc.user + " @ " + displayUrl + status;

        list.appendChild(div);
    });
    
    // Handle the "+ Add New Account" option at the end of the list
    let addDiv = document.createElement('div');
    addDiv.className = "item";
    if (setIndex === savedAccounts.length) {
        addDiv.classList.add("focused");
    }
    addDiv.id = "acc-item-" + savedAccounts.length;
    addDiv.innerText = "+ Add New Account";
    list.appendChild(addDiv);
    
    // Ensure the container scrolls to follow the focus
    const focusedEl = list.querySelector('.focused');
    if (focusedEl) {
        focusedEl.scrollIntoView({ block: 'nearest' });
    }
}


function renderManageCategories() {
    // Determine which section's categories to fetch based on user selection
    let action = "";
    if (currentManageType === "live") action = "get_live_categories";
    else if (currentManageType === "movie") action = "get_vod_categories";
    else if (currentManageType === "series") action = "get_series_categories";

    document.getElementById('loading-spinner').style.display = "flex";

    fetch(`${serverConfig.url}/player_api.php?username=${serverConfig.user}&password=${serverConfig.pass}&action=${action}`)
        .then(r => r.json())
        .then(data => {
            document.getElementById('loading-spinner').style.display = "none";
            // Add a "Toggle All" option at the top of the list
            categoryToggleData = [{ category_id: "TOGGLE_ALL", category_name: "--- TOGGLE ALL ---" }, ...data];
            manageState = "toggling";
            setIndex = 0;
            renderToggleList(); // Use your existing toggle renderer
        })
        .catch(e => {
            document.getElementById('loading-spinner').style.display = "none";
            logDebug("Error loading categories to manage: " + e.message);
        });
}


